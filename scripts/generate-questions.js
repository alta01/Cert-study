#!/usr/bin/env node
/**
 * generate-questions.js
 *
 * CLI script that calls the Anthropic API to generate exam questions and
 * writes them to the appropriate domain folder.
 *
 * Usage:
 *   node scripts/generate-questions.js \
 *     --exam aws-saa-c03 \
 *     --domain "domain-1-design-secure-architectures" \
 *     --domain-title "Domain 1: Design Secure Architectures" \
 *     --count 10 \
 *     --style single-answer \
 *     [--enrich-refs]
 *
 * Requires:
 *   ANTHROPIC_API_KEY environment variable (or VITE_ANTHROPIC_API_KEY)
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ── Parse CLI arguments ─────────────────────────────────────────────────────

const args = process.argv.slice(2);

function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : null;
}

const examSlug     = getArg('exam')         ?? 'aws-saa-c03';
const domainSlug   = getArg('domain')       ?? 'domain-1-design-secure-architectures';
const domainTitle  = getArg('domain-title') ?? 'Domain 1: Design Secure Architectures';
const examName     = getArg('exam-name')    ?? 'AWS Certified Solutions Architect – Associate (SAA-C03)';
const count        = parseInt(getArg('count') ?? '5', 10);
const style        = getArg('style')        ?? 'single-answer';
const enrichRefs   = args.includes('--enrich-refs');

const API_KEY = process.env.ANTHROPIC_API_KEY ?? process.env.VITE_ANTHROPIC_API_KEY;
const MODEL   = process.env.LLM_MODEL ?? 'claude-3-5-sonnet-20241022';

if (!API_KEY) {
  console.error('Error: ANTHROPIC_API_KEY is not set.');
  process.exit(1);
}

// ── Prompts ──────────────────────────────────────────────────────────────────

const SYSTEM = `You are an expert certification exam question writer. You produce
high-quality, scenario-based multiple-choice questions that closely mirror the
style of real vendor certification exams. Every question must be accurate,
unambiguous, and include a concise explanation and at least one authoritative
reference link.`;

function buildUserPrompt(params) {
  const { examName, domainTitle, count, style } = params;
  const styleDesc =
    style === 'multi-answer'
      ? 'multiple-answer (select all that apply, 2+ correct)'
      : style === 'scenario-chain'
      ? 'scenario-chain (one shared scenario followed by 3 related questions)'
      : 'single-answer multiple choice';

  return `Generate ${count} ${styleDesc} questions for the "${examName}" exam,
covering "${domainTitle}". Return ONLY a valid JSON array (no markdown fences).
Each object must match:
{
  "id": "<unique string>",
  "stem": "<question text>",
  "scenario": null,
  "scenarioId": null,
  "imageUrl": null,
  "multiAnswer": false,
  "choices": [{ "id": "A", "text": "..." }, ...],
  "correctAnswers": ["<id>"],
  "explanation": "<why correct>",
  "references": [{ "title": "<doc>", "url": "<https://...>" }],
  "domain": "${domainTitle}",
  "difficulty": "associate"
}`;
}

// ── Anthropic API helper ─────────────────────────────────────────────────────

function callAnthropic(system, userPrompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: MODEL,
      max_tokens: 8192,
      system,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`API error ${res.statusCode}: ${data}`));
        } else {
          resolve(JSON.parse(data));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n📝 Generating ${count} "${style}" questions for:`);
  console.log(`   Exam:   ${examName}`);
  console.log(`   Domain: ${domainTitle}\n`);

  // Step 1 – Generate
  const response = await callAnthropic(SYSTEM, buildUserPrompt({ examName, domainTitle, count, style }));
  const raw = response.content?.[0]?.text ?? '[]';
  let questions;
  try {
    questions = JSON.parse(raw);
  } catch {
    console.error('LLM returned invalid JSON:\n', raw.slice(0, 400));
    process.exit(1);
  }

  console.log(`✅ Generated ${questions.length} questions.`);

  // Step 2 – Write to file
  const outputDir = path.join(ROOT, 'data', 'exams', examSlug, 'domains', domainSlug);
  fs.mkdirSync(outputDir, { recursive: true });

  const outputPath = path.join(outputDir, 'questions.json');
  let existing = { questions: [] };

  if (fs.existsSync(outputPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    } catch {
      // corrupt file – start fresh
    }
  }

  // Merge, avoiding duplicate IDs
  const existingIds = new Set((existing.questions ?? []).map((q) => q.id));
  const newQuestions = questions.filter((q) => !existingIds.has(q.id));
  const merged = { questions: [...(existing.questions ?? []), ...newQuestions] };

  fs.writeFileSync(outputPath, JSON.stringify(merged, null, 2));
  console.log(`💾 Saved to ${path.relative(ROOT, outputPath)} (${merged.questions.length} total questions)\n`);
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});

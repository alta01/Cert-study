#!/usr/bin/env node
/**
 * generate-questions.js
 *
 * CLI script that calls the Anthropic API to generate exam questions in the
 * app's flat JSON format and merges them into data/exams/<slug>.json.
 *
 * Usage:
 *   node scripts/generate-questions.js \
 *     --exam "AWS SAA-C03" \
 *     --code SAA-C03 \
 *     --slug aws-saa-c03 \
 *     --domain 1 \
 *     --domain-name "Design Secure Architectures" \
 *     --domain-weight "30%" \
 *     --count 20 \
 *     --focus "VPC design, S3 bucket policies, KMS key rotation" \
 *     --reference-host docs.aws.amazon.com
 *
 * Constraints:
 *   --count is capped at 20 per invocation (larger batches hit transient API errors)
 *   --focus is optional; comma-separated sub-skills to bias the batch
 *   --reference-host is optional; restricts references to a specific docs host
 *
 * Requires: ANTHROPIC_API_KEY environment variable
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ── CLI args ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : null;
}

const examName    = getArg('exam')          ?? 'AWS Certified Solutions Architect – Associate';
const examCode    = getArg('code')          ?? 'SAA-C03';
const examSlug    = getArg('slug')          ?? 'aws-saa-c03';
const domainNum   = parseInt(getArg('domain') ?? '1', 10);
const domainName  = getArg('domain-name')  ?? 'Design Secure Architectures';
const domainWeight = getArg('domain-weight') ?? '';
const count       = parseInt(getArg('count') ?? '5', 10);
const focus       = getArg('focus')         ?? '';
const referenceHost = getArg('reference-host') ?? '';

if (count > 20) {
  console.error('Error: --count must be 20 or fewer (provider rate-limits larger batches).');
  process.exit(1);
}

const API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL   = process.env.LLM_MODEL ?? 'claude-sonnet-4-6';

if (!API_KEY) {
  console.error('Error: ANTHROPIC_API_KEY is not set.');
  process.exit(1);
}

// ── Prompt ───────────────────────────────────────────────────────────────────

const SCHEMA_EXAMPLE = `{
  "id": 1,
  "domain": 1,
  "domainName": "Domain Name",
  "topic": "specific sub-topic",
  "question": "Scenario-based question text that requires synthesis across services?",
  "options": { "A": "First option", "B": "Second option", "C": "Third option", "D": "Fourth option" },
  "answer": "B",
  "rationale": "B is correct because…",
  "optionRationales": {
    "A": "Why A is wrong (specific, not generic).",
    "B": "Why B is correct.",
    "C": "Why C is wrong.",
    "D": "Why D is wrong."
  },
  "references": [
    { "text": "Page title from the official docs", "url": "https://learn.microsoft.com/..." },
    { "text": "Another supporting doc page", "url": "https://learn.microsoft.com/..." }
  ]
}`;

function buildPrompt() {
  const focusBlock = focus
    ? `\n\nFor this batch, prioritize these sub-skills (pick a different one for each question; do not let any one sub-skill dominate):\n- ${focus.split(',').map((s) => s.trim()).filter(Boolean).join('\n- ')}`
    : '';

  const refHostBlock = referenceHost
    ? `\n- Every reference URL MUST start with "https://${referenceHost}/". Do not invent URLs — only use real, currently-published documentation pages you are confident exist.`
    : '\n- Every reference URL MUST be an https:// link to the vendor\'s official documentation. Do not invent URLs.';

  return `You are an expert certification exam question writer. Generate exactly ${count} high-quality multiple-choice questions for the "${examName}" exam, covering domain ${domainNum}: "${domainName}"${domainWeight ? ` (${domainWeight} of exam)` : ''}.${focusBlock}

Rules:
- Each question must have exactly 4 options (A, B, C, D)
- Only one option is correct
- Questions must be SCENARIO-BASED: present a realistic situation (company, constraints, existing infrastructure) and require the test-taker to synthesize knowledge across multiple services or features
- No pure memorization or trivia questions; the correct answer must follow from understanding, not recall of a single fact
- Distractors must reflect REAL misconceptions a partially-informed candidate would hold (e.g., a feature that almost fits but has a subtle disqualifying constraint). Do not use obviously wrong throwaway options.
- Cover different sub-topics within the domain — no two questions in this batch should test the same specific sub-skill
- For optionRationales: one concise sentence per option explaining why it is correct or incorrect, citing the specific feature or constraint that decides it
- Each question MUST include a "references" array with 2-3 entries pointing to the specific documentation pages that ground the correct answer (not generic landing pages).${refHostBlock}

Return ONLY a valid JSON array (no markdown fences, no commentary). Each object must match this schema:
${SCHEMA_EXAMPLE}

Use sequential integers for "id" starting from __START_ID__.`;
}

// ── Anthropic API ─────────────────────────────────────────────────────────────

function callAnthropicOnce(prompt, startId) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: MODEL,
      max_tokens: 8192,
      messages: [{ role: 'user', content: prompt.replace('__START_ID__', startId) }],
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
          const err = new Error(`API error ${res.statusCode}: ${data}`);
          err.status = res.statusCode;
          reject(err);
        } else {
          resolve(JSON.parse(data));
        }
      });
    });

    req.on('error', (err) => { err.transient = true; reject(err); });
    req.write(body);
    req.end();
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function callAnthropic(prompt, startId) {
  const delays = [2000, 4000, 8000, 16000, 32000];
  let lastErr;
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      return await callAnthropicOnce(prompt, startId);
    } catch (err) {
      lastErr = err;
      const retryable = err.transient || err.status === 429 || (err.status >= 500 && err.status < 600);
      if (!retryable || attempt === delays.length) throw err;
      const wait = delays[attempt];
      console.warn(`API call failed (${err.status ?? 'network'}); retrying in ${wait / 1000}s...`);
      await sleep(wait);
    }
  }
  throw lastErr;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const outputPath = path.join(ROOT, 'data', 'exams', `${examSlug}.json`);

  // Load existing file or scaffold a new one
  let existing = {
    exam: {
      code: examCode,
      name: examName,
      passingScore: 700,
      maxScore: 1000,
      domains: [{ number: domainNum, name: domainName, weight: domainWeight || '100%', topics: [] }],
    },
    questions: [],
  };

  if (fs.existsSync(outputPath)) {
    try { existing = JSON.parse(fs.readFileSync(outputPath, 'utf8')); } catch { /* start fresh */ }
  }

  const startId = (existing.questions.at(-1)?.id ?? 0) + 1;

  console.log(`\nGenerating ${count} questions for ${examName} — Domain ${domainNum}: ${domainName}`);
  console.log(`Model: ${MODEL}  |  Starting ID: ${startId}\n`);

  const response = await callAnthropic(buildPrompt(), startId);
  const raw = response.content?.[0]?.text ?? '[]';

  let newQuestions;
  try {
    const text = raw.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '');
    newQuestions = JSON.parse(text);
  } catch {
    console.error('LLM returned invalid JSON:\n', raw.slice(0, 600));
    process.exit(1);
  }

  // Re-number IDs sequentially to avoid collisions
  newQuestions.forEach((q, i) => { q.id = startId + i; q.domain = domainNum; q.domainName = domainName; });

  const existingIds = new Set(existing.questions.map((q) => q.id));
  const merged = [...existing.questions, ...newQuestions.filter((q) => !existingIds.has(q.id))];
  existing.questions = merged;

  // Ensure the domain is registered in exam metadata
  if (!existing.exam.domains.find((d) => d.number === domainNum)) {
    existing.exam.domains.push({ number: domainNum, name: domainName, weight: domainWeight || '', topics: [] });
    existing.exam.domains.sort((a, b) => a.number - b.number);
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(existing, null, 2));
  console.log(`Saved ${newQuestions.length} new questions to ${path.relative(ROOT, outputPath)} (${merged.length} total)\n`);
}

main().catch((err) => { console.error('Fatal:', err.message); process.exit(1); });

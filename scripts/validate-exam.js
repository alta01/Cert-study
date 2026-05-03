#!/usr/bin/env node
/**
 * validate-exam.js
 *
 * Validates a flat exam JSON file against the app's question schema.
 *
 * Usage:
 *   node scripts/validate-exam.js data/exams/sc-300.json
 *   node scripts/validate-exam.js data/exams/aws-saa-c03.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const target = process.argv[2];

if (!target) {
  console.error('Usage: node scripts/validate-exam.js <path-to-exam.json>');
  process.exit(1);
}

const abs = path.isAbsolute(target) ? target : path.resolve(ROOT, target);

if (!fs.existsSync(abs)) {
  console.error(`File not found: ${abs}`);
  process.exit(1);
}

let data;
try {
  data = JSON.parse(fs.readFileSync(abs, 'utf8'));
} catch (err) {
  console.error('Invalid JSON:', err.message);
  process.exit(1);
}

const errors = [];
const warnings = [];

// ── Top-level structure ───────────────────────────────────────────────────────

if (!data.exam || typeof data.exam !== 'object') {
  errors.push('Missing top-level "exam" object.');
} else {
  if (!data.exam.code)         warnings.push('exam.code is missing.');
  if (!data.exam.name)         errors.push('exam.name is required.');
  if (!data.exam.passingScore) warnings.push('exam.passingScore is missing.');
  if (!data.exam.maxScore)     warnings.push('exam.maxScore is missing.');
  if (!Array.isArray(data.exam.domains) || !data.exam.domains.length)
    warnings.push('exam.domains array is empty or missing.');
}

if (!Array.isArray(data.questions)) {
  errors.push('Missing top-level "questions" array.');
} else if (!data.questions.length) {
  errors.push('Question list is empty.');
}

// ── Per-question checks ───────────────────────────────────────────────────────

const seenIds = new Set();
const seenTexts = new Set();
const VALID_ANSWERS = new Set(['A', 'B', 'C', 'D']);

(data.questions ?? []).forEach((q, idx) => {
  const label = `Q${idx + 1} (id: ${q.id ?? 'undefined'})`;

  if (q.id === undefined || q.id === null) errors.push(`${label}: missing "id"`);
  if (!q.question)                          errors.push(`${label}: missing "question"`);
  if (!q.options || typeof q.options !== 'object') {
    errors.push(`${label}: missing or invalid "options" object`);
  } else {
    const keys = Object.keys(q.options);
    if (keys.length < 2) errors.push(`${label}: must have at least 2 options`);
    const missing = ['A','B','C','D'].filter(k => !(k in q.options));
    if (missing.length) warnings.push(`${label}: missing option(s): ${missing.join(', ')}`);
  }
  if (!q.answer)                            errors.push(`${label}: missing "answer"`);
  else if (!VALID_ANSWERS.has(q.answer))    errors.push(`${label}: "answer" must be A, B, C, or D (got "${q.answer}")`);
  if (q.answer && q.options && !(q.answer in q.options)) errors.push(`${label}: answer "${q.answer}" not in options`);

  if (q.id !== undefined) {
    if (seenIds.has(q.id)) errors.push(`${label}: duplicate id "${q.id}"`);
    else seenIds.add(q.id);
  }
  if (q.question) {
    if (seenTexts.has(q.question)) warnings.push(`${label}: duplicate question text`);
    else seenTexts.add(q.question);
  }

  if (!q.domain)           warnings.push(`${label}: missing "domain" number`);
  if (!q.domainName)       warnings.push(`${label}: missing "domainName"`);
  if (!q.rationale && !q.optionRationales) warnings.push(`${label}: no rationale or optionRationales`);
});

// ── Report ────────────────────────────────────────────────────────────────────

const valid = errors.length === 0;
const rel   = path.relative(ROOT, abs);

console.log(`\nValidation report: ${rel}`);
console.log(`  Questions : ${(data.questions ?? []).length}`);
console.log(`  Result    : ${valid ? 'PASSED' : 'FAILED'}\n`);

if (errors.length) {
  console.log('ERRORS:');
  errors.forEach((e) => console.log('  ✗', e));
  console.log();
}
if (warnings.length) {
  console.log('WARNINGS:');
  warnings.forEach((w) => console.log('  ⚠', w));
  console.log();
}
if (valid && !warnings.length) console.log('No issues found.\n');

const reportPath = abs.replace(/\.json$/, '-validation-report.json');
fs.writeFileSync(reportPath, JSON.stringify({ valid, errors, warnings, checkedAt: new Date().toISOString() }, null, 2));
console.log(`Report saved to: ${path.relative(ROOT, reportPath)}\n`);

process.exit(valid ? 0 : 1);

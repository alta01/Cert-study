#!/usr/bin/env node
/**
 * validate-exam.js
 *
 * CLI script that runs the Exam Validator Agent against a questions.json
 * or exam.json file and prints a report.
 *
 * Usage:
 *   node scripts/validate-exam.js <path-to-questions.json>
 *   node scripts/validate-exam.js data/exams/aws-saa-c03/domains/domain-1-design-secure-architectures/questions.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const target = process.argv[2];

if (!target) {
  console.error('Usage: node scripts/validate-exam.js <path-to-questions.json>');
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

const questions = Array.isArray(data) ? data : (data.questions ?? []);

// ── Validation logic (mirrors validatorAgent.js) ─────────────────────────────

const errors = [];
const warnings = [];
const seenIds = new Set();
const seenStems = new Set();

if (!questions.length) {
  errors.push('Question list is empty.');
} else {
  questions.forEach((q, idx) => {
    const label = `Q${idx + 1} (id: ${q.id ?? 'undefined'})`;

    if (!q.id)                                                   errors.push(`${label}: missing "id"`);
    if (!q.stem)                                                 errors.push(`${label}: missing "stem"`);
    if (!Array.isArray(q.choices) || q.choices.length < 2)      errors.push(`${label}: must have at least 2 choices`);
    if (!Array.isArray(q.correctAnswers) || !q.correctAnswers.length) errors.push(`${label}: missing "correctAnswers"`);
    if (q.multiAnswer && (q.correctAnswers?.length ?? 0) < 2)   errors.push(`${label}: multiAnswer needs 2+ correct answers`);

    if (q.id) {
      if (seenIds.has(q.id)) errors.push(`${label}: duplicate id "${q.id}"`);
      else seenIds.add(q.id);
    }
    if (q.stem) {
      if (seenStems.has(q.stem)) warnings.push(`${label}: duplicate stem`);
      else seenStems.add(q.stem);
    }
    if (!q.explanation)        warnings.push(`${label}: missing explanation`);
    if (!q.references?.length) warnings.push(`${label}: no references`);
    if (q.scenarioId && !q.scenario) warnings.push(`${label}: has scenarioId but no scenario text`);
  });
}

// ── Report ─────────────────────────────────────────────────────────────────

const valid = errors.length === 0;
console.log(`\n📋 Validation report for: ${path.relative(ROOT, abs)}`);
console.log(`   Questions checked: ${questions.length}`);
console.log(`   Result: ${valid ? '✅ PASSED' : '❌ FAILED'}\n`);

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

if (valid && !warnings.length) {
  console.log('No issues found.\n');
}

// Optionally save report
const reportPath = abs.replace(/\.json$/, '-validation-report.json');
fs.writeFileSync(reportPath, JSON.stringify({ valid, errors, warnings, checkedAt: new Date().toISOString() }, null, 2));
console.log(`Report saved to: ${path.relative(ROOT, reportPath)}\n`);

process.exit(valid ? 0 : 1);

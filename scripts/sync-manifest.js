#!/usr/bin/env node
/**
 * sync-manifest.js
 * Scans data/exams/ for top-level .json exam files and updates manifest.json.
 * Preserves any extra fields (category, notes) from existing manifest entries.
 *
 * Run:  node scripts/sync-manifest.js
 *       npm run sync
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT      = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const EXAMS_DIR = join(ROOT, 'data', 'exams');
const MANIFEST  = join(ROOT, 'manifest.json');

async function main() {
  // Load existing manifest so we can preserve fields like 'category'
  let existing = {};
  try {
    const raw = await readFile(MANIFEST, 'utf8');
    const mf  = JSON.parse(raw);
    for (const e of (mf.exams || [])) existing[e.file] = e;
  } catch { /* no existing manifest — that's fine */ }

  let files;
  try {
    files = await readdir(EXAMS_DIR);
  } catch {
    console.error('Could not read data/exams/ — does it exist?');
    process.exit(1);
  }

  const jsonFiles = files.filter(f => f.endsWith('.json') && !f.startsWith('.'));

  const entries = [];
  for (const file of jsonFiles) {
    const filePath = join(EXAMS_DIR, file);
    const relPath  = `data/exams/${file}`;
    try {
      const raw  = await readFile(filePath, 'utf8');
      const data = JSON.parse(raw);
      if (!data?.exam?.code || !Array.isArray(data?.questions)) {
        console.warn(`  skipped ${file} — not a valid exam file`);
        continue;
      }
      const prev = existing[relPath] || {};
      entries.push({
        id:       data.exam.code.toLowerCase(),
        file:     relPath,
        title:    `${data.exam.code}: ${data.exam.name}`,
        // Preserve category from existing entry or exam JSON
        category: prev.category || data.exam.category || '',
      });
      console.log(`  found   ${file}  (${data.questions.length} questions)`);
    } catch {
      console.warn(`  skipped ${file} — could not parse JSON`);
    }
  }

  entries.sort((a, b) => a.id.localeCompare(b.id));

  const manifest = { version: '1', exams: entries };
  await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`\nWrote manifest.json with ${entries.length} exam(s).`);
  if (entries.some(e => !e.category)) {
    console.log('Tip: add a "category" field to exam JSON files, or edit manifest.json to set them.');
  }
}

main().catch(e => { console.error(e); process.exit(1); });

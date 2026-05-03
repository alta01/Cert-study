#!/usr/bin/env node
/**
 * import-content.js
 *
 * CLI script that fetches content from a URL or reads from a file and
 * saves it as a Markdown content file for a specific exam domain.
 *
 * Usage:
 *   # From a local file
 *   node scripts/import-content.js \
 *     --exam aws-saa-c03 \
 *     --domain domain-1-design-secure-architectures \
 *     --file ./my-notes.md
 *
 *   # From a URL (plain text / Markdown)
 *   node scripts/import-content.js \
 *     --exam aws-saa-c03 \
 *     --domain domain-1-design-secure-architectures \
 *     --url https://example.com/notes.md
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ── Parse CLI arguments ─────────────────────────────────────────────────────

const args = process.argv.slice(2);

function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : null;
}

const examSlug   = getArg('exam');
const domainSlug = getArg('domain');
const filePath   = getArg('file');
const url        = getArg('url');

if (!examSlug || !domainSlug) {
  console.error('Usage: node scripts/import-content.js --exam <slug> --domain <slug> [--file <path> | --url <url>]');
  process.exit(1);
}

if (!filePath && !url) {
  console.error('Error: Provide either --file or --url');
  process.exit(1);
}

// ── Fetch helpers ────────────────────────────────────────────────────────────

function fetchUrl(rawUrl) {
  return new Promise((resolve, reject) => {
    const client = rawUrl.startsWith('https') ? https : http;
    client.get(rawUrl, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // Simple redirect follow
        resolve(fetchUrl(res.headers.location));
        return;
      }
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${rawUrl}`));
        } else {
          resolve(data);
        }
      });
    }).on('error', reject);
  });
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  let content;

  if (filePath) {
    const abs = path.resolve(filePath);
    if (!fs.existsSync(abs)) {
      console.error(`File not found: ${abs}`);
      process.exit(1);
    }
    content = fs.readFileSync(abs, 'utf8');
    console.log(`📂 Read ${content.length} bytes from ${abs}`);
  } else {
    console.log(`🌐 Fetching ${url}…`);
    content = await fetchUrl(url);
    console.log(`✅ Fetched ${content.length} bytes`);
  }

  const outputDir = path.join(ROOT, 'data', 'exams', examSlug, 'domains', domainSlug);
  fs.mkdirSync(outputDir, { recursive: true });

  // Version-safe write: don't overwrite existing content.md
  let outputPath = path.join(outputDir, 'content.md');
  if (fs.existsSync(outputPath)) {
    let v = 2;
    while (fs.existsSync(path.join(outputDir, `content-v${v}.md`))) v++;
    outputPath = path.join(outputDir, `content-v${v}.md`);
    console.log(`⚠️  content.md already exists. Writing to ${path.basename(outputPath)}`);
  }

  fs.writeFileSync(outputPath, content, 'utf8');
  console.log(`💾 Saved to ${path.relative(ROOT, outputPath)}\n`);
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});

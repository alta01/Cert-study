/* Self-hosted browser acceptance suite. No Firebase project or internet required. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
const { chromium } = await import(process.env.CERT_STUDY_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(new URL('..', import.meta.url).pathname);
const fixture = { exam: { code: 'TEST', name: 'Learning smoke test', passingScore: 700, maxScore: 1000, domains: [{ number: 1, name: 'Identity' }, { number: 2, name: 'Networking' }, { number: 3, name: 'Compute' }] }, questions: [
  { id: 1, domain: 1, domainName: 'Identity', conceptId: 'permissions', conceptName: 'Permissions', topic: 'Roles', question: 'Select the correct permissions control.', options: { A: 'Correct control', B: 'Wrong control' }, answer: 'A', rationale: 'Use the correct control.' },
  { id: 2, domain: 1, domainName: 'Identity', conceptId: 'permissions', conceptName: 'Permissions', topic: 'Consent', question: 'Select the correct consent control.', options: { A: 'Wrong control', B: 'Correct control' }, answer: 'B', rationale: 'Use the correct control.' },
  { id: 3, domain: 2, domainName: 'Networking', conceptId: 'dns', conceptName: 'DNS', type: 'hotspot', question: 'Click the DNS configuration target.', image: 'sc-500/images/test.png', hotspots: [{ x: 30, y: 40, w: 20, h: 20, label: 'DNS settings' }], tolerance: 0.5, rationale: 'DNS is configured here.' },
  { id: 4, domain: 2, domainName: 'Networking', conceptId: 'dns', conceptName: 'DNS', question: 'Select the correct DNS setting.', options: { A: 'Correct', B: 'Incorrect' }, answer: 'A' },
  { id: 5, domain: 3, domainName: 'Compute', topic: 'VM identity', question: 'Select the VM identity configuration.', options: { A: 'Correct', B: 'Incorrect' }, answer: 'A' },
] };
const server = http.createServer(async (request, response) => {
  const name = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  if (name === '/manifest.json') { response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify({ exams: [{ file: 'data/exams/test.json' }] })); return; }
  if (name === '/config.js') { response.setHeader('Content-Type', 'application/javascript'); response.end('window.__CS_CONFIG__ = { FIREBASE: null, OLLAMA_BASE: "" };'); return; }
  if (name === '/data/exams/test.json') { response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify(fixture)); return; }
  if (name === '/data/exams/sc-500/images/test.png') { response.setHeader('Content-Type', 'image/svg+xml'); response.end('<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="800"><rect width="1000" height="800" fill="#e5eefb"/><rect x="300" y="320" width="200" height="160" fill="#3b82f6"/></svg>'); return; }
  const filename = path.resolve(root, '.' + (name === '/' ? '/index.html' : name));
  if (!filename.startsWith(root + '/')) { response.writeHead(403); response.end(); return; }
  try { const data = await fs.readFile(filename); response.setHeader('Content-Type', ({ '.js': 'application/javascript', '.json': 'application/json', '.html': 'text/html', '.css': 'text/css', '.png': 'image/png' })[path.extname(filename)] || 'text/plain'); response.end(data); }
  catch { response.writeHead(404); response.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, ...(process.env.CERT_STUDY_CHROMIUM ? { executablePath: process.env.CERT_STUDY_CHROMIUM, args: ['--no-sandbox', '--disable-dev-shm-usage'] } : {}) });
try {
  const context = await browser.newContext({ viewport: { width: 420, height: 880 }, acceptDownloads: true });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url); await page.waitForSelector('.exam-card');
  await page.getByRole('button', { name: 'Custom quiz' }).click();
  await page.locator('#btn-start').click();
  await page.locator('input[name="q-ans"][value="B"]').check();
  assert.equal(await page.locator('#btn-submit').isDisabled(), true);
  await page.locator('input[name="confidence"][value="confident"]').check();
  await page.locator('#btn-submit').click(); await page.waitForSelector('#btn-next:not(.hidden)');
  await page.evaluate(() => submitAnswer());
  assert.equal(await page.evaluate(() => LearningStore.events('TEST').length), 1);
  await page.locator('#btn-back-quiz').click(); await page.locator('#btn-progress').click();
  await page.waitForSelector('#progress-focus .needs-review');
  assert.match(await page.locator('#progress-focus .needs-review').innerText(), /1 confident errors/);
  assert.equal(await page.locator('#progress-empty').isVisible(), false);
  // Durable answer log and regular resume survive reload before quiz completion.
  await page.reload(); await page.waitForSelector('[data-action="resume"][data-mode="regular"]');
  assert.equal(await page.evaluate(() => LearningStore.events('TEST').length), 1);
  await page.locator('[data-action="resume"][data-mode="regular"]').click();
  assert.match(await page.locator('#q-label').innerText(), /2 \/ 5/);
  await page.locator('input[name="q-ans"][value="B"]').check();
  await page.locator('input[name="confidence"][value="guess"]').check();
  await page.locator('#btn-submit').click(); await page.waitForSelector('#btn-next:not(.hidden)');
  await page.locator('#btn-back-quiz').click();
  await page.locator('[data-action="focus"]').click();
  assert.deepEqual(await page.evaluate(() => App.pool.map(q => q.id)), [1,2]);
  // Independent focused practice and regular quiz have separate slots.
  await page.locator('#btn-back-quiz').click();
  assert.equal(await page.locator('[data-action="resume"][data-mode="regular"]').count(), 1);
  assert.equal(await page.locator('[data-action="resume"][data-mode="focus"]').count(), 1);
  await page.locator('[data-action="resume"][data-mode="regular"]').click();
  await page.waitForSelector('.hotspot-image');
  await page.locator('.hotspot-image').evaluate(img => img.decode());
  const box = await page.locator('.hotspot-image').boundingBox();
  await page.mouse.click(box.x + box.width * .4, box.y + box.height * .5);
  assert.equal(await page.locator('#btn-submit').isDisabled(), true);
  await page.locator('input[name="confidence"][value="unsure"]').check();
  await page.locator('#btn-submit').click(); await page.waitForSelector('.hotspot-correct-zone');
  assert.equal(await page.evaluate(() => App.answers[3].correct), true);
  assert.match(await page.locator('#exp-banner').innerText(), /Correct/);
  await page.locator('#btn-back-quiz').click(); await page.locator('#btn-progress').click();
  assert.match(await page.locator('#progress-focus').innerText(), /Needs confirmation/);
  // Portable backup round-trips twice without duplicate events.
  const downloadPromise = page.waitForEvent('download'); await page.locator('#btn-export-progress').click();
  const download = await downloadPromise, backup = path.join(os.tmpdir(), 'cert-study-smoke-backup.json');
  await download.saveAs(backup);
  const backupData = JSON.parse(await fs.readFile(backup, 'utf8'));
  assert.equal(backupData.events.length, 3); assert.equal(JSON.stringify(backupData).includes('apiKey'), false);
  await page.locator('#progress-import').setInputFiles(backup); await page.waitForTimeout(200);
  await page.locator('#progress-import').setInputFiles(backup); await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => LearningStore.events('TEST').length), 3);
  // Switching profiles cannot display or upload the guest's history automatically.
  await page.evaluate(() => onAuthChange({ id: 'alice', name: 'Alice', email: 'alice@example.test' }));
  assert.equal(await page.evaluate(() => LearningStore.events().length), 0);
  assert.equal(await page.locator('[data-action="resume"]').count(), 0);
  await page.evaluate(() => onAuthChange(null));
  assert.equal(await page.evaluate(() => LearningStore.events().length), 3);
  // Timed unanswered questions lower score but do not create fake learning misses.
  await page.evaluate(() => { App.current = App.exams[0]; startQuiz([App.current.questions[4]], { mode: 'regular', domains: [3], countMode: 'custom', saveProgress: true, showExplain: true, timedMode: true, timerMinutes: 1 }); handleTimerExpiry(); showResults(); });
  assert.equal(await page.evaluate(() => LearningStore.events().length), 3);
  assert.equal(await page.evaluate(() => loadHistory('TEST').length), 1);
  assert.equal(await page.locator('#btn-retry-wrong').isDisabled(), false);
  // Retry a formerly confident error without clearing independent evidence.
  await page.evaluate(() => { App.current = App.exams[0]; startQuiz([App.current.questions[0]], { mode: 'retry', domains: [1], countMode: 'custom', saveProgress: true, showExplain: true, timedMode: false }); });
  await page.locator('input[name="q-ans"][value="A"]').check(); await page.locator('input[name="confidence"][value="confident"]').check();
  await page.locator('#btn-submit').click(); await page.waitForSelector('#btn-next:not(.hidden)');
  await page.locator('#btn-next').click();
  assert.equal(await page.evaluate(() => LearningCore.summarize(App.current.questions, LearningStore.events('TEST')).find(g => g.conceptId === 'permissions').confidentErrors), 1);
  // Local answers persist offline; no Firebase request is necessary.
  await context.setOffline(true);
  await page.evaluate(() => { App.current = App.exams[0]; startQuiz([App.current.questions[3]], { mode: 'focus', domains: [2], countMode: 'custom', saveProgress: true, showExplain: true, timedMode: false }); });
  await page.locator('input[name="q-ans"][value="A"]').check(); await page.locator('input[name="confidence"][value="guess"]').check();
  await page.locator('#btn-submit').click(); await page.waitForSelector('#btn-next:not(.hidden)');
  assert.equal(await page.evaluate(() => LearningStore.events('TEST').length), 5);
  await context.setOffline(false);
  await page.locator('#btn-back-quiz').click(); await page.locator('#btn-progress').click();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.equal(await page.locator('#progress-domains .mini-bar-fill.fail').evaluate(bar => bar.style.width), '0%');
  await page.waitForTimeout(450);
  if (process.env.CERT_STUDY_SCREENSHOT) await page.screenshot({ path: process.env.CERT_STUDY_SCREENSHOT, fullPage: true });
  assert.deepEqual(errors, []);
  console.log('Browser acceptance passed: confidence gating, early-exit persistence, reload/resume, separate modes, hotspot scaling/feedback, weak-area evidence, backup dedupe, profile isolation, timeout handling, retry behavior, offline saving, mobile layout.');
  await context.close();
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
await import('../learning-core.js');
const C = globalThis.LearningCore;
const questions = Array.from({ length: 6 }, (_, i) => ({ id: i + 1, domain: i < 3 ? 1 : 2, domainName: i < 3 ? 'Identity' : 'Networking', conceptId: i < 3 ? 'permissions' : 'dns', conceptName: i < 3 ? 'Permissions' : 'DNS', question: `Question ${i + 1}`, options: { A: 'One', B: 'Two' }, answer: 'A' }));
function event(id, values = {}) {
  return { id: `event-${id}`, examCode: 'TEST', questionId: id, revision: C.revision(questions[id - 1]), domain: questions[id - 1].domain, selected: 'A', correct: true, confidence: 'confident', answeredAt: Date.UTC(2026, 0, 1), sessionId: 'session-1', mode: 'regular', ...values };
}
test('confident errors outrank other misses and correct guesses', () => {
  assert.equal(C.priority(event(1, { correct: false })), 4);
  assert.equal(C.priority(event(1, { correct: false, confidence: 'guess' })), 3);
  assert.equal(C.priority(event(1, { confidence: 'guess' })), 2);
  assert.equal(C.priority(event(1, { confidence: 'unsure' })), 1);
});
test('correct guesses remain a focus area; untested is not weakness', () => {
  const summaries = C.summarize(questions, [event(1, { confidence: 'guess' })]);
  assert.equal(summaries[0].status, 'Needs confirmation');
  assert.equal(summaries[0].uncertain, 1);
  assert.equal(summaries[0].limited, true);
  assert.equal(summaries[1].status, 'Not assessed');
});
test('an immediate retry cannot erase a confident error', () => {
  const records = [event(1, { correct: false }), event(1, { id: 'retry-1', mode: 'retry', answeredAt: Date.UTC(2026, 0, 1, 0, 1) })];
  assert.equal(C.summarize(questions, records)[0].confidentErrors, 1);
});
test('repeat exposure to one question does not imply concept retention', () => {
  const records = [event(1), event(1, { id: 'later-1', answeredAt: Date.UTC(2026, 0, 2) })];
  const summary = C.summarize(questions, records).find(g => g.domain === 1);
  assert.equal(summary.tested, 1); assert.equal(summary.status, 'Limited evidence');
});
test('retention needs all available questions and successful checks on separate dates', () => {
  const records = [1,2,3].flatMap(id => [event(id), event(id, { id: `later-${id}`, answeredAt: Date.UTC(2026, 0, 2) })]);
  assert.equal(C.summarize(questions, records).find(g => g.domain === 1).status, 'Retained in practice');
  const miss = event(1, { id: 'new-miss', correct: false, answeredAt: Date.UTC(2026, 0, 3) });
  assert.equal(C.summarize(questions, [...records, miss])[0].status, 'Needs review');
});
test('changed question content invalidates its old learning evidence', () => {
  const revised = questions.map(q => ({ ...q })); revised[0].answer = 'B';
  assert.equal(C.summarize(revised, [event(1)])[0].tested, 0);
});
test('focused practice prioritizes confident errors, then unseen siblings', () => {
  const pool = C.selectFocus(questions, [event(1, { correct: false }), event(2, { confidence: 'guess' })]);
  assert.deepEqual(pool.map(q => q.id), [1,3,2]);
});
test('same question IDs from other concepts are not leaked into a targeted pool', () => {
  assert.deepEqual(C.selectFocus(questions, [], { conceptKey: '2:dns' }).map(q => q.id), [4,5,6]);
});
test('corrupt confidence, hotspot coordinates, and event IDs are rejected', () => {
  assert.equal(C.validEvent(event(1)), true);
  assert.equal(C.validEvent(event(1, { confidence: 'maybe' })), false);
  assert.equal(C.validEvent(event(1, { id: '../other' })), false);
  assert.equal(C.validEvent(event(1, { selected: { x: 105, y: 10 } })), false);
});
test('store is account-scoped, immutable, deduplicated, and durable in fallback', async () => {
  const disk = new Map();
  const context = vm.createContext({ LearningCore: C, console: { warn() {} }, localStorage: { getItem: k => disk.get(k) || null, setItem: (k,v) => disk.set(k,v) }, indexedDB: { open() { throw new Error('unavailable'); } } });
  vm.runInContext(fs.readFileSync(new URL('../learning-store.js', import.meta.url), 'utf8'), context);
  const S = context.LearningStore; await S.init();
  await S.put([event(1)]); await S.put([event(1, { correct: false })]);
  assert.equal(S.events().length, 1); assert.equal(S.events()[0].correct, true);
  S.setOwner('alice'); assert.equal(S.events().length, 0);
  await S.put([event(1)]); await S.markSynced(['event-1']);
  assert.equal(S.pending().length, 0); S.setOwner('guest'); assert.equal(S.pending().length, 1);
  assert.equal(JSON.parse(disk.get('cs_learning_v1')).length, 2);
});
test('SC-500 has complete, consistent concept mappings without changing question count', () => {
  const data = JSON.parse(fs.readFileSync(new URL('../data/exams/sc-500.json', import.meta.url)));
  assert.equal(data.questions.length, 270);
  assert.equal(new Set(data.questions.map(q => q.id)).size, 270);
  const labels = new Map();
  for (const q of data.questions) { assert.match(q.conceptId, /^[a-z0-9-]+$/); assert.ok(q.conceptName); if (labels.has(q.conceptId)) assert.equal(labels.get(q.conceptId), q.conceptName); labels.set(q.conceptId, q.conceptName); }
});

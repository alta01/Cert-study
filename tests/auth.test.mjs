import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../auth.js', import.meta.url), 'utf8').replace(/import\('https:\/\/www\.gstatic\.com\/firebasejs\/13\.0\.0\/firebase-(app|auth|firestore)\.js'\)/g, "loadSDK('$1')");
function adapter(configured = true) {
  const rows = new Map(), changes = [], scopes = []; let notify, fail = false;
  const sdk = {
    initializeApp: () => ({}), getAuth: () => ({}), getFirestore: () => ({}), browserLocalPersistence: {}, setPersistence: async () => {},
    onAuthStateChanged: (_, fn) => { notify = fn; fn({ uid: 'alice', email: 'alice@example.test' }); },
    doc: (_, ...parts) => parts.join('/'), collection: (_, ...parts) => { scopes.push(parts.join('/')); return parts.join('/'); },
    query: base => base, where: () => {},
    getDocsFromServer: async base => { if (fail) throw new Error('offline'); return { docs: [...rows.entries()].filter(([key]) => key.startsWith(base + '/')).map(([,value]) => ({ data: () => value })) }; },
    runTransaction: async (_, fn) => { if (fail) throw new Error('offline'); return fn({ get: async key => ({ exists: () => rows.has(key), data: () => rows.get(key) }), set: (key, value) => rows.set(key, value) }); },
    writeBatch: () => { const writes = []; return { set: (key, value) => writes.push([key, value]), commit: async () => { if (fail) throw new Error('offline'); writes.forEach(([key,value]) => rows.set(key,value)); } }; },
    GoogleAuthProvider: class {}, signInWithPopup: async () => {}, signOut: async () => notify(null),
  };
  const context = vm.createContext({ Event, console: { warn() {} }, setTimeout: () => 1, clearTimeout() {}, window: { __CS_CONFIG__: configured ? { FIREBASE: { apiKey: 'public', projectId: 'test', appId: 'web', authDomain: 'test.firebaseapp.com' } } : {}, dispatchEvent: e => changes.push(e.type) }, loadSDK: async () => sdk });
  vm.runInContext(source, context);
  return { A: vm.runInContext('Auth', context), rows, scopes, changes, changeUser: uid => notify(uid ? { uid } : null), offline: () => { fail = true; } };
}
test('blank Firebase config makes no cloud calls', async () => {
  const { A, scopes } = adapter(false); await A.init(); assert.equal(A.isEnabled(), false); assert.equal(A.isSignedIn(), false); assert.equal(await A.saveEvents([]), false); assert.equal(scopes.length, 0);
});
test('session transactions retain the newest save and clearing tombstone', async () => {
  const { A, rows } = adapter(); await A.init();
  await A.pushSession({ examCode: 'SC/500', mode: 'regular', savedAt: 10, cleared: false });
  await A.pushSession({ examCode: 'SC/500', mode: 'regular', savedAt: 20, cleared: true });
  await A.pushSession({ examCode: 'SC/500', mode: 'regular', savedAt: 15, cleared: false });
  assert.equal(rows.get('users/alice/sessions/SC%2F500__regular').cleared, true);
  await A.pushSession({ examCode: 'SC/500', mode: 'focus', savedAt: 30, cleared: false });
  assert.equal(rows.size, 2);
});
test('reads and writes are scoped to the signed-in account', async () => {
  const { A, rows, scopes, changeUser } = adapter(); await A.init();
  await A.saveEvents([{ id: 'answer-1', examCode: 'TEST' }]);
  changeUser('bob'); const events = await A.fetchEvents();
  assert.equal(events.length, 0); assert.equal(scopes.at(-1), 'users/bob/answers'); assert.ok(rows.has('users/alice/answers/answer-1'));
});
test('failed network operations report pending, not successful sync', async () => {
  const { A, offline } = adapter(); await A.init(); offline();
  assert.equal(await A.saveEvents([{ id: 'answer-1' }]), false); assert.match(A.getStatus(), /pending/);
  assert.equal(await A.fetchEvents(), null); assert.match(A.getStatus(), /device history/);
});

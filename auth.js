/* Optional Firebase adapter. Local study needs neither configuration nor network. */
const Auth = (() => {
  let auth = null, db = null, sdk = null, user = null, enabled = false, status = 'Local only';
  const callbacks = [];
  function setUser(u) {
    user = u ? { id: u.uid, email: u.email || '', name: u.displayName || u.email || 'Account', avatar: u.photoURL || '' } : null;
    callbacks.forEach(fn => fn(user));
  }
  function report(message, error) {
    status = message;
    if (error) console.warn('[firebase]', error.code || error.message);
    window.dispatchEvent(new Event('cs-sync-status'));
  }
  async function init() {
    const config = window.__CS_CONFIG__?.FIREBASE;
    if (!config?.apiKey || !config?.projectId || !config?.authDomain || !config?.appId) return;
    enabled = true;
    try {
      const modules = Promise.all([
        import('https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js'),
        import('https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js'),
      ]);
      const [appSDK, authSDK, firestoreSDK] = await Promise.race([modules, new Promise((_, reject) => setTimeout(() => reject(new Error('SDK load timed out')), 6000))]);
      sdk = { ...authSDK, ...firestoreSDK };
      const app = appSDK.initializeApp(config);
      auth = sdk.getAuth(app); db = sdk.getFirestore(app);
      await sdk.setPersistence(auth, sdk.browserLocalPersistence);
      await new Promise((resolve, reject) => {
        let first = true;
        const timeout = setTimeout(() => reject(new Error('Auth restoration timed out')), 6000);
        sdk.onAuthStateChanged(auth, u => { setUser(u); if (first) { first = false; clearTimeout(timeout); resolve(); } }, e => { clearTimeout(timeout); reject(e); });
      });
      report(user ? 'Ready to sync' : 'Local only — sign in to sync');
    } catch (e) { report('Firebase unavailable — local study is ready', e); }
  }
  async function signInWithGoogle() {
    if (!auth) { report('Reload while online to enable Firebase sign-in'); return; }
    try { await sdk.signInWithPopup(auth, new sdk.GoogleAuthProvider()); }
    catch (e) { report(e.code === 'auth/popup-blocked' ? 'Allow popups for Google sign-in' : `Sign-in failed (${e.code || 'network error'})`, e); }
  }
  async function signOut() { if (auth) { try { await sdk.signOut(auth); report('Local only'); } catch (e) { report('Sign-out failed', e); } } }
  function ref(uid, bucket, id) { return sdk.doc(db, 'users', uid, bucket, id); }
  function sessionId(s) { return encodeURIComponent(`${s.examCode}__${s.mode || 'regular'}`); }
  async function pushSession(s) {
    const uid = user?.id; if (!uid || !db || !s?.examCode) return false;
    try {
      const target = ref(uid, 'sessions', sessionId(s));
      await sdk.runTransaction(db, async tx => {
        const old = await tx.get(target);
        if (!old.exists() || s.savedAt > old.data().savedAt) tx.set(target, s);
      });
      return true;
    } catch (e) { report('Sync pending — saved on this device', e); return false; }
  }
  async function saveRecords(bucket, records) {
    const uid = user?.id; if (!uid || !db) return false;
    try {
      for (let offset = 0; offset < records.length; offset += 400) {
        const batch = sdk.writeBatch(db);
        records.slice(offset, offset + 400).forEach(r => batch.set(ref(uid, bucket, r.id), r));
        await batch.commit();
      }
      return true;
    } catch (e) { report('Sync pending — saved on this device', e); return false; }
  }
  async function fetchRecords(bucket, examCode) {
    const uid = user?.id; if (!uid || !db) return null;
    try {
      const base = sdk.collection(db, 'users', uid, bucket);
      const query = examCode ? sdk.query(base, sdk.where('examCode', '==', examCode)) : base;
      const snapshot = await sdk.getDocsFromServer(query);
      return snapshot.docs.map(d => d.data());
    } catch (e) { report('Sync pending — using device history', e); return null; }
  }
  return { init, signInWithGoogle, signOut, isEnabled: () => enabled, isSignedIn: () => !!user, getUser: () => user, onChange: fn => callbacks.push(fn), getStatus: () => status, report,
    pushSession, pullSessions: () => fetchRecords('sessions'),
    saveAttempts: r => saveRecords('attempts', r), fetchAttempts: code => fetchRecords('attempts', code),
    saveEvents: r => saveRecords('answers', r), fetchEvents: code => fetchRecords('answers', code),
  };
})();

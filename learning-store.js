/* Account-scoped durable learning log. Firebase is optional. */
globalThis.LearningStore = (() => {
  let db = null, owner = 'guest', records = new Map(), fallback = false;
  let queue = Promise.resolve();
  const eventFields = ['id','examCode','questionId','revision','domain','selected','correct','confidence','answeredAt','sessionId','mode'];
  const listeners = [], fallbackKey = 'cs_learning_v1';
  function changed() { listeners.forEach(fn => fn()); }
  function clean(row) { return Object.fromEntries(eventFields.map(k => [k, k === 'selected' && typeof row[k] === 'object' ? { x: row[k].x, y: row[k].y } : row[k]])); }
  function serialize(fn) { const next = queue.then(fn); queue = next.catch(() => {}); return next; }
  function transaction(rows) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('events', 'readwrite');
      rows.forEach(row => tx.objectStore('events').put(row));
      tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Storage transaction aborted'));
    });
  }
  async function init() {
    try {
      db = await new Promise((resolve, reject) => {
        const r = indexedDB.open('cert-study-learning', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('events', { keyPath: 'key' });
        r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
        r.onblocked = () => reject(new Error('Learning database blocked by another tab'));
      });
      const rows = await new Promise((resolve, reject) => {
        const r = db.transaction('events').objectStore('events').getAll();
        r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
      });
      records = new Map(rows.map(r => [r.key, r]));
      const previous = JSON.parse(localStorage.getItem(fallbackKey) || '[]');
      if (Array.isArray(previous)) {
        const migrated = previous.filter(r => typeof r.owner === 'string' && r.key === `${r.owner}:${r.id}` && LearningCore.validEvent(r) && !records.has(r.key));
        if (migrated.length) { await transaction(migrated); migrated.forEach(r => records.set(r.key, r)); }
        if (previous.length) localStorage.removeItem(fallbackKey);
      }
    } catch (e) {
      fallback = true;
      try { const rows = JSON.parse(localStorage.getItem(fallbackKey) || '[]'); records = new Map(rows.filter(r => LearningCore.validEvent(r)).map(r => [r.key, r])); } catch { records = new Map(); }
      console.warn('[learning] IndexedDB unavailable; using localStorage', e);
    }
  }
  async function putNow(events, { forOwner = owner, synced = false } = {}) {
    if (!events.every(LearningCore.validEvent)) throw new Error('Invalid learning records');
    const fresh = events.map(e => ({ ...clean(e), owner: forOwner, key: `${forOwner}:${e.id}`, synced })).filter(r => !records.has(r.key));
    if (!fresh.length) return;
    if (fallback) localStorage.setItem(fallbackKey, JSON.stringify([...records.values(), ...fresh]));
    else await transaction(fresh);
    fresh.forEach(r => records.set(r.key, r)); changed();
  }
  async function markSyncedNow(ids, forOwner = owner) {
    const rows = ids.map(id => records.get(`${forOwner}:${id}`)).filter(Boolean).map(r => ({ ...r, synced: true }));
    if (fallback) { const next = new Map(records); rows.forEach(r => next.set(r.key, r)); localStorage.setItem(fallbackKey, JSON.stringify([...next.values()])); }
    else if (rows.length) await transaction(rows);
    rows.forEach(r => records.set(r.key, r)); changed();
  }
  function put(events, options = {}) { const forOwner = options.forOwner || owner; return serialize(() => putNow(events, { ...options, forOwner })); }
  function markSynced(ids, forOwner = owner) { return serialize(() => markSyncedNow(ids, forOwner)); }
  function events(code, forOwner = owner) { return [...records.values()].filter(r => r.owner === forOwner && (!code || r.examCode === code)).map(clean); }
  function pending(forOwner = owner) { return [...records.values()].filter(r => r.owner === forOwner && !r.synced).map(clean); }
  return { init, put, markSynced, events, pending, setOwner(value) { owner = value; }, getOwner: () => owner, isFallback: () => fallback, onChange(fn) { listeners.push(fn); } };
})();

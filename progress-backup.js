/* Portable backups never contain auth tokens or account credentials. */
function validAttempt(a) {
  return a && typeof a.id === 'string' && /^[A-Za-z0-9-]{1,100}$/.test(a.id) && typeof a.examCode === 'string' && a.examCode.length > 0 && a.examCode.length <= 100 && Number.isInteger(a.total) && a.total > 0 && a.total <= 10000 && Number.isInteger(a.correct) && a.correct >= 0 && a.correct <= a.total && Number.isInteger(a.pct) && a.pct >= 0 && a.pct <= 100 && Number.isFinite(Date.parse(a.completedAt)) && Array.isArray(a.domains) && a.domains.every(d => Number.isInteger(d.number) && d.number > 0 && Number.isInteger(d.total) && d.total > 0 && Number.isInteger(d.correct) && d.correct >= 0 && d.correct <= d.total);
}
function validSession(s) {
  if (!s || typeof s.examCode !== 'string' || !s.examCode || s.examCode.length > 100 || !['regular', 'focus', 'retry'].includes(s.mode || 'regular') || !Number.isFinite(s.savedAt) || s.savedAt <= 0) return false;
  if (s.cleared !== undefined && typeof s.cleared !== 'boolean') return false;
  if (s.sessionId !== undefined && (typeof s.sessionId !== 'string' || !/^[A-Za-z0-9-]{1,100}$/.test(s.sessionId))) return false;
  if (s.cleared === true) return true;
  return Array.isArray(s.poolIds) && s.poolIds.length > 0 && s.poolIds.length <= 10000 && s.poolIds.every(id => Number.isInteger(id) && id > 0) && Number.isInteger(s.idx) && s.idx >= 0 && s.idx <= s.poolIds.length && s.settings && Array.isArray(s.settings.domains) && s.settings.domains.every(n => Number.isInteger(n) && n > 0) && s.answers && typeof s.answers === 'object' && Object.entries(s.answers).every(([id, a]) => /^\d+$/.test(id) && a && typeof a.correct === 'boolean' && (a.selected === null || typeof a.selected === 'string' && a.selected.length <= 100 || a.selected && Number.isFinite(a.selected.x) && Number.isFinite(a.selected.y) && a.selected.x >= 0 && a.selected.x <= 100 && a.selected.y >= 0 && a.selected.y <= 100)) && (s.timerRemaining == null || Number.isFinite(s.timerRemaining) && s.timerRemaining >= 0 && s.timerRemaining <= 18000);
}
function validateBackup(data) {
  if (!data || data.format !== 'cert-study-progress' || data.version !== 1 || !Array.isArray(data.events) || !Array.isArray(data.attempts) || !Array.isArray(data.sessions) || !data.events.every(LearningCore.validEvent) || !data.attempts.every(validAttempt) || !data.sessions.every(validSession)) throw new Error('Invalid or unsupported progress backup');
  return data;
}
async function mergeBackup(data, owner = storageOwner) {
  validateBackup(data);
  await LearningStore.put(data.events, { forOwner: owner });
  if (storageOwner !== owner) throw new Error('Account changed during import. Please try again.');
  const byExam = new Map();
  [...readAllLocalHistory(), ...data.attempts].forEach(a => { if (!byExam.has(a.examCode)) byExam.set(a.examCode, new Map()); byExam.get(a.examCode).set(a.id, a); });
  for (const [code, m] of byExam) if (!writeHistory(code, [...m.values()].sort((a, b) => new Date(a.completedAt) - new Date(b.completedAt)))) throw new Error('Device storage is full');
  for (const s of data.sessions) {
    const mode = s.mode || 'regular', key = sessionKey(s.examCode, mode), previous = readJSON(key);
    if (!previous || s.savedAt > previous.savedAt) {
      if (!storeJSON(key, { ...s, mode, sessionId: s.sessionId || crypto.randomUUID() })) throw new Error('Device storage is full');
    }
  }
  renderHome(); if (isScreenActive('progress')) openProgress();
  syncMergeOnSignIn();
}
async function importGuestProgress() {
  if (!Auth.isSignedIn()) return;
  const data = { format: 'cert-study-progress', version: 1, events: LearningStore.events(null, 'guest'), attempts: readAllLocalHistory('guest'), sessions: readAllLocalSessions('guest') };
  if (!data.events.length && !data.attempts.length && !data.sessions.length) { showToast('No guest progress to import.', 'info'); return; }
  if (!confirm('Copy this device’s guest progress into your signed-in account? Guest records will also remain on this device.')) return;
  try { await mergeBackup(data); showToast('Guest progress imported. Cloud sync will retry when online.', 'success'); }
  catch (e) { showToast(e.message, 'error', 6000); }
}
function wireProgressBackup() {
  document.getElementById('btn-export-progress').addEventListener('click', () => {
    const data = { format: 'cert-study-progress', version: 1, exportedAt: new Date().toISOString(), events: LearningStore.events(), attempts: readAllLocalHistory(), sessions: readAllLocalSessions() };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'cert-study-progress-' + new Date().toISOString().slice(0, 10) + '.json'; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  document.getElementById('progress-import').addEventListener('change', async e => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('Backup exceeds 10 MiB. Split large backups before importing.');
      const data = validateBackup(JSON.parse(await file.text()));
      await mergeBackup(data); showToast('Progress imported without duplicating answers.', 'success');
    } catch (error) { showToast(error.message, 'error', 7000); }
    finally { e.target.value = ''; }
  });
}

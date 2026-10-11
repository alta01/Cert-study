/* app.js — Cert Study core quiz engine */
/* All innerHTML assignments use esc() for dynamic content — XSS safe. */

// ── Timer ──────────────────────────────────────────────────────
const Timer = {
  _id:       null,
  _rem:      0,
  _onExpire: null,

  start(seconds, onExpire) {
    this.clear();
    this._rem      = seconds;
    this._onExpire = onExpire;
    this._render();
    this._id = setInterval(() => {
      this._rem--;
      this._render();
      if (this._rem <= 0) { this.clear(); if (this._onExpire) this._onExpire(); }
    }, 1000);
  },

  _render() {
    const el = document.getElementById('timer-display');
    if (!el || el.classList.contains('hidden')) return;
    const m = Math.floor(this._rem / 60);
    const s = this._rem % 60;
    el.textContent = `${m}:${String(s).padStart(2, '0')}`;
    el.className   = `timer-display${this._rem <= 60 ? ' urgent' : ''}`;
  },

  pause() {
    if (this._id) { clearInterval(this._id); this._id = null; }
    return this._rem;
  },

  clear() {
    if (this._id) { clearInterval(this._id); this._id = null; }
    this._rem = 0;
    const el = document.getElementById('timer-display');
    if (el) el.className = 'timer-display hidden';
  },

  getRemaining() { return this._rem; },
};

// Local sessions and score history are isolated by guest / Firebase account.
let storageOwner = 'guest';
const HISTORY_CAP = 200;
function storagePrefix(kind, owner = storageOwner) { return 'cs2:' + owner + ':' + kind + ':'; }
function sessionKey(code, mode = 'regular', owner = storageOwner) { return storagePrefix('sess', owner) + encodeURIComponent(code || 'unknown') + ':' + mode; }
function historyKey(code, owner = storageOwner) { return storagePrefix('hist', owner) + encodeURIComponent(code || 'unknown'); }
function storeJSON(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)); return true; }
  catch { showToast('Device storage is full or unavailable. Export progress before leaving.', 'error', 8000); return false; }
}
function readJSON(key, fallback = null) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function saveSession() {
  if (!App.settings?.saveProgress || !App.current?.exam?.code) return;
  const data = { examCode: App.current.exam.code, mode: App.settings.mode || 'regular', sessionId: App.sessionId,
    poolIds: App.pool.map(q => q.id), idx: App.idx, answers: App.answers, settings: App.settings,
    timerRemaining: App.settings.timedMode ? Timer.getRemaining() : null, savedAt: Date.now(), cleared: false };
  if (storeJSON(sessionKey(data.examCode, data.mode), data) && Auth.getUser()?.id === storageOwner) Auth.pushSession(data);
}
function loadSession(code, mode = 'regular') { const s = readJSON(sessionKey(code, mode)); return s?.cleared ? null : s; }
function clearSession(code, mode = App.settings.mode || 'regular') {
  const tombstone = { examCode: code, mode, cleared: true, savedAt: Date.now() };
  if (storeJSON(sessionKey(code, mode), tombstone) && Auth.getUser()?.id === storageOwner) Auth.pushSession(tombstone);
}
function loadHistory(code) { const rows = readJSON(historyKey(code), []); return Array.isArray(rows) ? rows : []; }
function writeHistory(code, records) { return storeJSON(historyKey(code), records.slice(-HISTORY_CAP)); }
function recordAttempt(record) {
  const list = loadHistory(record.examCode);
  if (list.some(r => r.id === record.id)) return;
  if (writeHistory(record.examCode, [...list, record]) && Auth.getUser()?.id === storageOwner) Auth.saveAttempts([record]);
}
function localBuckets(kind, owner = storageOwner) {
  const prefix = storagePrefix(kind, owner), out = [];
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k?.startsWith(prefix)) { const value = readJSON(k); if (value) out.push(value); } }
  return out;
}
function readAllLocalSessions(owner = storageOwner) { return localBuckets('sess', owner).filter(s => s.examCode); }
function readAllLocalHistory(owner = storageOwner) { return localBuckets('hist', owner).flat().filter(r => r.id && r.examCode); }
function migrateLegacyProgress() {
  if (localStorage.getItem('cs2:migrated')) return;
  let ok = true;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i), value = readJSON(key);
    if (key?.startsWith('cs_sess_') && value?.examCode) ok = storeJSON(sessionKey(value.examCode, 'regular', 'guest'), { ...value, mode: 'regular', sessionId: crypto.randomUUID() }) && ok;
    if (key?.startsWith('cs_hist_') && Array.isArray(value)) ok = storeJSON(historyKey(key.slice(8), 'guest'), value) && ok;
  }
  if (ok) localStorage.setItem('cs2:migrated', '1'); // Original keys remain available for recovery.
}

// ── Toast ──────────────────────────────────────────────────────
function showToast(message, type, duration) {
  type     = type     || 'info';
  duration = duration || 3200;
  const el = document.createElement('div');
  el.className   = `toast toast-${type}`;
  el.textContent = message;
  document.body.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('visible')));
  setTimeout(() => {
    el.classList.remove('visible');
    setTimeout(() => el.remove(), 300);
  }, duration);
}

// ── State ──────────────────────────────────────────────────────
const App = {
  exams:    [],
  current:  null,
  pool:     [],
  idx:      0,
  answers:  {},
  settings: {},
  sessionId: null,
  confidence: null,
  selected: null,
  submitting: false,
  recorded: false,
};

// ── Boot and optional cloud sync ────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  wireStaticButtons(); initAIPanel(); migrateLegacyProgress();
  await LearningStore.init();
  if (LearningStore.isFallback()) showToast('Using browser storage fallback. Export progress for a backup.', 'info', 6000);
  await Auth.init();
  storageOwner = Auth.getUser()?.id || 'guest'; LearningStore.setOwner(storageOwner);
  Auth.onChange(user => { authTransition = authTransition.then(() => onAuthChange(user)); });
  renderAccount(Auth.getUser());
  await loadFromManifest(); renderHome(); showScreen('home');
  if (Auth.isSignedIn()) syncMergeOnSignIn();
  window.addEventListener('online', () => syncMergeOnSignIn());
  window.addEventListener('cs-sync-status', renderSyncStatus);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && isScreenActive('quiz')) saveSession();
  });
});
let authTransition = Promise.resolve(), syncing = false;
async function onAuthChange(user) {
  const nextOwner = user?.id || 'guest';
  if (nextOwner !== storageOwner) {
    if (isScreenActive('quiz')) { saveSession(); Timer.clear(); }
    storageOwner = nextOwner; LearningStore.setOwner(storageOwner);
    App.answers = {}; App.pool = []; App.current = null;
    renderHome(); showScreen('home');
  }
  renderAccount(user); renderSyncStatus();
  if (user) await syncMergeOnSignIn();
}
function renderSyncStatus() {
  const message = Auth.getStatus();
  document.getElementById('home-sync-note').textContent = message;
  document.getElementById('progress-sync-note').textContent = message;
}
async function syncMergeOnSignIn() {
  const owner = storageOwner;
  if (syncing || !Auth.isSignedIn() || Auth.getUser().id !== owner || !navigator.onLine) return;
  syncing = true; Auth.report('Syncing progress…');
  try {
    const [remoteAttempts, remoteSessions, remoteEvents] = await Promise.all([Auth.fetchAttempts(), Auth.pullSessions(), Auth.fetchEvents()]);
    if (storageOwner !== owner || Auth.getUser()?.id !== owner) return;
    if (!remoteAttempts || !remoteSessions || !remoteEvents) return;
    const localAttempts = readAllLocalHistory(), remoteIds = new Set(remoteAttempts.map(a => a.id));
    let ok = await Auth.saveAttempts(localAttempts.filter(a => !remoteIds.has(a.id)));
    if (storageOwner !== owner || Auth.getUser()?.id !== owner) return;
    const byExam = new Map();
    [...localAttempts, ...remoteAttempts].forEach(a => { if (!byExam.has(a.examCode)) byExam.set(a.examCode, new Map()); byExam.get(a.examCode).set(a.id, a); });
    byExam.forEach((m, code) => writeHistory(code, [...m.values()].sort((a, b) => new Date(a.completedAt) - new Date(b.completedAt))));
    const sessions = new Map(remoteSessions.map(s => [s.examCode + ':' + (s.mode || 'regular'), s]));
    for (const s of readAllLocalSessions()) {
      const key = s.examCode + ':' + (s.mode || 'regular'), remote = sessions.get(key);
      if (!remote || s.savedAt > remote.savedAt) { ok = await Auth.pushSession(s) && ok; sessions.set(key, s); }
      if (storageOwner !== owner || Auth.getUser()?.id !== owner) return;
    }
    sessions.forEach(s => storeJSON(sessionKey(s.examCode, s.mode || 'regular', owner), s));
    await LearningStore.put(remoteEvents.filter(LearningCore.validEvent), { forOwner: owner, synced: true });
    const remoteEventIds = new Set(remoteEvents.map(e => e.id));
    await LearningStore.markSynced(LearningStore.pending(owner).filter(e => remoteEventIds.has(e.id)).map(e => e.id), owner);
    const pending = LearningStore.pending(owner);
    if (pending.length) {
      if (Auth.getUser()?.id !== owner) return;
      if (await Auth.saveEvents(pending)) await LearningStore.markSynced(pending.map(e => e.id), owner); else ok = false;
    }
    if (storageOwner === owner) { Auth.report(ok ? 'Progress synced' : 'Sync pending — saved on this device'); renderHome(); if (isScreenActive('progress')) openProgress(); }
  } catch (e) { Auth.report('Sync pending — saved on this device', e); }
  finally { syncing = false; }
}

async function loadFromManifest() {
  // Load from registered manifests (manifest.json + optional data/exams/index.json)
  for (const src of ['manifest.json', 'data/exams/index.json']) {
    try {
      const res = await fetch(src);
      if (!res.ok) continue;
      const manifest = await res.json();
      for (const entry of (manifest.exams || [])) {
        try {
          const r = await fetch(entry.file);
          if (!r.ok) continue;
          const data = await r.json();
          data._meta = entry;
          if (!App.exams.find(e => e.exam.code === data.exam.code)) App.exams.push(data);
        } catch { /* skip bad file */ }
      }
    } catch { /* source not found */ }
  }
  // Auto-discover: parse directory listing served by Python http.server / VS Code Live Server
  await scanExamsDir();
}

async function scanExamsDir() {
  try {
    const res = await fetch('data/exams/');
    if (!res.ok) return;
    const html = await res.text();
    // Extract bare .json filenames from href attributes (no path separators = top-level files only)
    const found = [];
    const re = /href="([^"/]+\.json)"/gi;
    let m;
    while ((m = re.exec(html)) !== null) found.push(m[1]);
    for (const name of found) {
      const path = 'data/exams/' + name;
      try {
        const r = await fetch(path);
        if (!r.ok) continue;
        const data = await r.json();
        if (!data?.exam?.code || !Array.isArray(data?.questions)) continue;
        if (!App.exams.find(e => e.exam.code === data.exam.code)) {
          data._meta = { file: path, title: data.exam.name, category: data.exam.category || '' };
          App.exams.push(data);
        }
      } catch { /* skip */ }
    }
  } catch { /* directory listing not available — that's fine */ }
}

// ── Exam loading ───────────────────────────────────────────────
window.loadExamData = function(data) {
  if (!data?.exam || !Array.isArray(data?.questions)) {
    alert('Invalid exam file — missing exam or questions fields.');
    return;
  }
  const exists = App.exams.findIndex(e => e.exam.code === data.exam.code);
  if (exists >= 0) App.exams[exists] = data;
  else App.exams.push(data);
  renderHome();
  showScreen('home');
};

document.getElementById('file-input')?.addEventListener('change', e => {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try { window.loadExamData(JSON.parse(ev.target.result)); }
    catch { alert('Could not parse JSON file.'); }
  };
  reader.readAsText(file);
  e.target.value = '';
});

// ── Home ───────────────────────────────────────────────────────
function renderHome() {
  const grid = document.getElementById('exam-grid'); if (!grid) return;
  renderSyncStatus();
  if (!App.exams.length) { grid.innerHTML = '<p>No exams loaded. Load an exam file to begin.</p>'; return; }
  grid.innerHTML = App.exams.map((exam, i) => {
    const code = exam.exam.code, regular = loadSession(code), focus = loadSession(code, 'focus'), retry = loadSession(code, 'retry');
    const groups = LearningCore.summarize(exam.questions, LearningStore.events(code));
    const weak = groups.filter(g => g.priority > 0).slice(0, 3);
    const summary = weak.length ? 'Focus next: ' + weak.map(g => g.name).join(' · ') : LearningStore.events(code).length ? 'Keep building evidence with a focused practice session.' : 'Start a short assessment to discover your focus areas.';
    return `<div class="exam-card">
      <div class="exam-card-category">${esc(exam._meta?.category || exam.exam.category || '')}</div>
      <div class="exam-card-title">${esc(exam.exam.name)}</div>
      <div class="exam-card-meta">${exam.questions.length} questions · ${(exam.exam.domains || []).length} domains</div>
      <p class="study-summary">${esc(summary)}</p>
      <div class="exam-card-actions">
        ${regular ? `<button class="btn-secondary btn-sm" data-exam-idx="${i}" data-action="resume" data-mode="regular">Continue quiz · ${Object.keys(regular.answers || {}).length}/${regular.poolIds.length}</button>` : ''}
        <button class="btn-primary btn-sm" data-exam-idx="${i}" data-action="${focus ? 'resume' : 'focus'}" data-mode="focus">${focus ? 'Continue focused practice' : weak.length ? 'Study weak areas' : 'Focused practice'} →</button>
        ${retry ? `<button class="btn-secondary btn-sm" data-exam-idx="${i}" data-action="resume" data-mode="retry">Continue retry</button>` : ''}
        <button class="btn-link" data-exam-idx="${i}" data-action="study">${regular ? 'Start new quiz' : 'Custom quiz'}</button>
      </div>
    </div>`;
  }).join('');
}

window.openSetup = function(examIdx) {
  App.current = App.exams[examIdx];
  renderSetup();
  showScreen('setup');
};

// ── Resume saved session ───────────────────────────────────────
function startQuizFromSession(session) {
  App.settings = Object.assign({}, session.settings, { mode: session.mode || 'regular' });
  App.sessionId = session.sessionId || crypto.randomUUID();
  App.recorded = false;
  App.answers  = Object.assign({}, session.answers);
  App.idx      = 0;

  const byId = new Map(App.current.questions.map(q => [q.id, q]));
  App.pool   = session.poolIds.map(id => byId.get(id)).filter(Boolean);
  App.pool.forEach(q => { if (App.answers[q.id]?.revision && App.answers[q.id].revision !== LearningCore.revision(q)) delete App.answers[q.id]; });

  if (App.pool.length === 0) {
    clearSession(App.current.exam.code, App.settings.mode);
    alert('Saved session could not be restored. Starting fresh.');
    openSetup(App.exams.indexOf(App.current));
    return;
  }

  // Advance to first unanswered question
  while (App.idx < App.pool.length && App.answers[App.pool[App.idx] && App.pool[App.idx].id]) App.idx++;

  if (App.idx >= App.pool.length) { showResults(); return; }

  renderQuestion();
  showScreen('quiz');

  if (App.settings.timedMode && session.timerRemaining > 0) {
    document.getElementById('timer-display').classList.remove('hidden');
    Timer.start(session.timerRemaining, handleTimerExpiry);
  }
}

// ── Setup ──────────────────────────────────────────────────────
function renderSetup() {
  const exam = App.current;
  document.getElementById('setup-exam-title').textContent = exam.exam.code
    ? exam.exam.code + ' — ' + exam.exam.name
    : exam.exam.name;

  document.getElementById('domain-filters').innerHTML = (exam.exam.domains || []).map(d =>
    `<label>
      <input type="checkbox" class="domain-cb" value="${d.number}" checked />
      <span class="domain-tag">Domain ${d.number}: ${esc(d.name)}</span>
      <span class="domain-weight">${esc(d.weight || '')}</span>
    </label>`
  ).join('');

  document.getElementById('btn-all').onclick  = () => document.querySelectorAll('.domain-cb').forEach(cb => { cb.checked = true; });
  document.getElementById('btn-none').onclick = () => document.querySelectorAll('.domain-cb').forEach(cb => { cb.checked = false; });

  document.querySelector('input[name="q-count"][value="all"]').checked = true;
  document.getElementById('opt-randomize').checked     = false;
  document.getElementById('opt-explain').checked       = true;
  document.getElementById('opt-show-links').checked    = true;
  document.getElementById('opt-save-progress').checked = true;
  document.getElementById('opt-timed').checked         = false;
  document.getElementById('timer-opts').classList.add('hidden');
}

function gatherSettings() {
  return {
    domains:      Array.from(document.querySelectorAll('.domain-cb:checked')).map(cb => parseInt(cb.value)),
    countMode:    (document.querySelector('input[name="q-count"]:checked') || {}).value || 'all',
    customCount:  parseInt(document.getElementById('custom-count').value) || 20,
    randomize:    document.getElementById('opt-randomize').checked    || false,
    showExplain:  document.getElementById('opt-explain').checked      !== false,
    showLinks:    document.getElementById('opt-show-links').checked   !== false,
    saveProgress: document.getElementById('opt-save-progress').checked !== false,
    timedMode:    document.getElementById('opt-timed').checked        || false,
    mode: 'regular',
    timerMinutes: parseInt(document.getElementById('timer-minutes').value) || 90,
  };
}

// ── Quiz ───────────────────────────────────────────────────────
function startQuiz(retryPool, override) {
  App.settings = override || { ...gatherSettings(), mode: retryPool ? 'retry' : 'regular' };
  App.sessionId = crypto.randomUUID();
  App.recorded = false;
  App.answers  = {};
  App.idx      = 0;

  var pool = retryPool || App.current.questions.filter(q =>
    App.settings.domains.includes(q.domain)
  );

  if (App.settings.randomize) pool = shuffle(pool.slice());
  if (!retryPool && App.settings.countMode === 'custom') {
    pool = pool.slice(0, App.settings.customCount);
  }

  if (pool.length === 0) { alert('No questions match the selected filters.'); return; }

  App.pool = pool;

  if (App.settings.timedMode) {
    document.getElementById('timer-display').classList.remove('hidden');
    Timer.start(App.settings.timerMinutes * 60, handleTimerExpiry);
  } else {
    Timer.clear();
  }

  renderQuestion();
  showScreen('quiz');
  if (App.settings.saveProgress) saveSession();
}

function handleTimerExpiry() {
  // Unanswered questions affect the quiz score, but are not evidence of a concept error.
  showResults();
}
function startFocus(exam, conceptKey = null) {
  App.current = exam;
  const pool = LearningCore.selectFocus(exam.questions, LearningStore.events(exam.exam.code), { conceptKey, count: 10 });
  if (!pool.length) { showToast('No questions available for this focus area.', 'info'); return; }
  const names = [...new Set(pool.map(q => LearningCore.concept(q).name))];
  startQuiz(pool, { mode: 'focus', domains: [...new Set(pool.map(q => q.domain))], countMode: 'custom', customCount: 10, randomize: false, showExplain: true, showLinks: true, saveProgress: true, timedMode: false });
  showToast('Today’s focus: ' + names.join(' · '), 'info', 6000);
}
function renderConfidence() {
  App.confidence = null; App.selected = null;
  document.getElementById('confidence-controls').innerHTML = LearningCore.confidenceValues.map(value => `<label class="confidence-option"><input type="radio" name="confidence" value="${value}" /><span>${value === 'guess' ? 'Guessing' : value === 'unsure' ? 'Unsure' : 'Confident'}</span></label>`).join('');
  document.querySelectorAll('input[name="confidence"]').forEach(input => input.addEventListener('change', () => { App.confidence = input.value; updateSubmit(); }));
}
function updateSubmit() { document.getElementById('btn-submit').disabled = !App.confidence || App.selected === null || App.submitting; }
async function saveQuestionAnswer(q, selected, correct) {
  if (App.submitting || App.answers[q.id] || !App.confidence) return false;
  App.submitting = true; updateSubmit();
  document.getElementById('btn-back-quiz').disabled = true;
  const remaining = App.settings.timedMode ? Timer.pause() : null;
  const owner = storageOwner;
  const event = { id: App.sessionId + '-q-' + q.id, examCode: App.current.exam.code, questionId: q.id,
    revision: LearningCore.revision(q), domain: q.domain, selected, correct, confidence: App.confidence,
    answeredAt: Date.now(), sessionId: App.sessionId, mode: App.settings.mode || 'regular' };
  try {
    await LearningStore.put([event], { forOwner: owner });
    App.answers[q.id] = { selected, correct, confidence: event.confidence, revision: event.revision, eventId: event.id };
    document.querySelectorAll('input[name="confidence"]').forEach(input => { input.disabled = true; });
    if (App.settings.saveProgress) saveSession();
    if (Auth.getUser()?.id === owner) {
      Auth.report('Sync pending — saved on this device');
      Auth.saveEvents([event]).then(async ok => { if (ok) { await LearningStore.markSynced([event.id], owner); if (storageOwner === owner) Auth.report(LearningStore.pending(owner).length ? 'Sync pending — saved on this device' : 'Answers synced'); } }).catch(e => Auth.report('Sync pending — saved on this device', e));
    }
    return true;
  } catch (e) { showToast('Could not save this answer. Free device storage and submit again.', 'error', 8000); return false; }
  finally {
    App.submitting = false; document.getElementById('btn-back-quiz').disabled = false;
    if (remaining !== null && remaining > 0) { document.getElementById('timer-display').classList.remove('hidden'); Timer.start(remaining, handleTimerExpiry); }
    updateSubmit();
  }
}

function renderQuestion() {
  var q        = App.pool[App.idx];
  var total    = App.pool.length;
  var answered = Object.keys(App.answers).length;
  var correct  = Object.values(App.answers).filter(a => a.correct).length;

  document.getElementById('q-label').textContent      = 'Q ' + (App.idx + 1) + ' / ' + total;
  document.getElementById('progress-bar').style.width = ((App.idx / total) * 100) + '%';
  document.getElementById('score-live').textContent   = correct + ' / ' + answered;
  document.getElementById('q-badge').textContent      = 'Domain ' + q.domain;
  document.getElementById('q-topic').textContent      = q.topic || '';
  document.getElementById('q-text').innerHTML         = esc(q.question).replace(/\n/g, '<br>');

  renderConfidence();
  var optWrap = document.getElementById('q-options');
  if (q.type === 'hotspot') {
    renderHotspot(q, optWrap);
    return;
  }
  optWrap.innerHTML = Object.entries(q.options).map(([k, v]) =>
    `<label class="opt-label" data-key="${esc(k)}">
      <input type="radio" name="q-ans" value="${esc(k)}" />
      <span class="opt-key">${esc(k)}</span>
      <span class="opt-text">${esc(v)}</span>
    </label>`
  ).join('');

  optWrap.querySelectorAll('input').forEach(r =>
    r.addEventListener('change', () => {
      App.selected = r.value; updateSubmit();
      optWrap.querySelectorAll('.opt-label').forEach(l => l.classList.remove('opt-selected'));
      r.closest('.opt-label').classList.add('opt-selected');
    })
  );

  var submit = document.getElementById('btn-submit');
  var next   = document.getElementById('btn-next');
  submit.disabled = true;
  submit.classList.remove('hidden');
  next.classList.add('hidden');
  document.getElementById('explanation').classList.add('hidden');
  submit.onclick = submitAnswer;
}

// Hotspot image coordinates are measured on the actual image, not its letterboxed container.
function renderHotspot(q, wrap) {
  wrap.replaceChildren();
  var box = document.createElement('div');
  box.className = 'hotspot-box';
  var img = document.createElement('img');
  img.src = 'data/exams/' + q.image;
  img.alt = 'Portal interface for question ' + q.id;
  img.className = 'hotspot-image';
  img.draggable = false;
  var overlay = document.createElement('div');
  overlay.className = 'hotspot-overlay';
  box.append(img, overlay);
  wrap.append(box);
  var chosen = null, marker = null;
  var submit = document.getElementById('btn-submit');
  var next = document.getElementById('btn-next');
  submit.disabled = true;
  submit.classList.remove('hidden');
  next.classList.add('hidden');
  document.getElementById('explanation').classList.add('hidden');
  img.addEventListener('click', e => {
    if (chosen && chosen.locked) return;
    var rect = img.getBoundingClientRect();
    chosen = { x: Math.max(0,Math.min(100,(e.clientX-rect.left)*100/rect.width)),
               y: Math.max(0,Math.min(100,(e.clientY-rect.top)*100/rect.height)) };
    overlay.replaceChildren();
    marker = document.createElement('span');
    marker.className = 'hotspot-marker';
    marker.style.left = chosen.x + '%';
    marker.style.top = chosen.y + '%';
    overlay.append(marker);
    App.selected = { x: chosen.x, y: chosen.y }; updateSubmit();
  });
  submit.onclick = async () => {
    if (!chosen || chosen.locked || !App.confidence) return;
    chosen.locked = true;
    var tolerance = Number.isFinite(q.tolerance) ? q.tolerance : 1;
    var correct = q.hotspots.some(h => chosen.x >= h.x - tolerance && chosen.x <= h.x + h.w + tolerance && chosen.y >= h.y - tolerance && chosen.y <= h.y + h.h + tolerance);
    if (!await saveQuestionAnswer(q, {x:chosen.x,y:chosen.y}, correct)) { chosen.locked = false; return; }
    q.hotspots.forEach(h => {
      var zone=document.createElement('span');
      zone.className='hotspot-correct-zone';
      Object.assign(zone.style,{left:h.x+'%',top:h.y+'%',width:h.w+'%',height:h.h+'%'});
      overlay.append(zone);
    });
    marker.classList.add(correct ? 'hotspot-right' : 'hotspot-wrong');
    submit.classList.add('hidden');
    // Always show feedback for hotspot tasks, even when explanation display is off.
    showExplanation(q, chosen, correct);
    if (App.settings.saveProgress) saveSession();
    var last=App.idx===App.pool.length-1;
    next.textContent=last?'See results →':'Next →';
    next.classList.remove('hidden');
    next.onclick=last?showResults:function(){ App.idx++; if(App.settings.saveProgress)saveSession(); renderQuestion(); };
  };
}

async function submitAnswer() {
  var radio = document.querySelector('input[name="q-ans"]:checked');
  var sel   = radio && radio.value;
  if (!sel) return;

  var q         = App.pool[App.idx];
  var isCorrect = sel === q.answer;
  if (!await saveQuestionAnswer(q, sel, isCorrect)) return;

  document.querySelectorAll('input[name="q-ans"]').forEach(r => {
    r.disabled = true;
    r.closest('.opt-label').classList.add('locked');
  });
  document.querySelectorAll('.opt-label').forEach(label => {
    var k = label.dataset.key;
    if (k === q.answer)               label.classList.add('opt-correct');
    else if (k === sel && !isCorrect) label.classList.add('opt-incorrect');
  });

  document.getElementById('btn-submit').classList.add('hidden');
  if (App.settings.showExplain) showExplanation(q, sel, isCorrect);
  if (App.settings.saveProgress) saveSession();

  var next   = document.getElementById('btn-next');
  var isLast = App.idx === App.pool.length - 1;
  next.textContent = isLast ? 'See results →' : 'Next →';
  next.classList.remove('hidden');
  next.onclick = isLast ? showResults : function() {
    App.idx++;
    if (App.settings.saveProgress) saveSession();
    renderQuestion();
  };
}

function showExplanation(q, selected, isCorrect) {
  var banner = document.getElementById('exp-banner');
  var body   = document.getElementById('exp-body');

  banner.className  = isCorrect ? 'correct' : 'incorrect';
  banner.textContent = isCorrect
    ? '✓ Correct'
    : q.type === 'hotspot' ? '✗ Incorrect — highlighted region is the correct target' : '✗ Incorrect — correct answer: ' + esc(q.answer);

  var html = '';

  if (q.type === 'hotspot') {
    html = '<p class="exp-fallback">' + esc(q.rationale || '') + '</p>';
  } else if (q.optionRationales) {
    html = Object.entries(q.options).map(([k, text]) => {
      var isAns = k === q.answer;
      var rat   = q.optionRationales[k] || '';
      return `<div class="exp-option ${isAns ? 'exp-correct' : 'exp-wrong'}">
        <strong>${esc(k)}. ${esc(text)}</strong>
        ${rat ? '<p>' + esc(rat) + '</p>' : ''}
      </div>`;
    }).join('');
  } else {
    html = '<p class="exp-fallback">' + esc(q.rationale || '') + '</p>';
  }

  if (App.settings.showLinks && Array.isArray(q.references) && q.references.length > 0) {
    var valid = q.references.filter(r => r && typeof r.url === 'string' && r.url.startsWith('https://'));
    if (valid.length > 0) {
      var links = valid.map(r =>
        `<a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.text || r.url)}</a>`
      ).join('');
      html += '<div class="exp-links"><strong>References</strong>' + links + '</div>';
    }
  }

  body.innerHTML = html;
  document.getElementById('explanation').classList.remove('hidden');
}

// ── Results ────────────────────────────────────────────────────
function showResults() {
  Timer.clear();
  clearSession(App.current && App.current.exam && App.current.exam.code);

  var total   = App.pool.length;
  var correct = Object.values(App.answers).filter(a => a.correct).length;
  var pct     = Math.round((correct / total) * 100);

  var arc = document.getElementById('ring-arc');
  var r = 50, circ = 2 * Math.PI * r;
  arc.style.strokeDasharray  = circ;
  arc.style.strokeDashoffset = circ;
  setTimeout(() => { arc.style.strokeDashoffset = circ * (1 - pct / 100); }, 80);

  document.getElementById('res-pct').textContent      = pct + '%';
  document.getElementById('res-fraction').textContent = correct + ' out of ' + total + ' correct';

  var stats = {};
  App.pool.forEach(q => {
    if (!stats[q.domain]) stats[q.domain] = { name: q.domainName || 'Domain ' + q.domain, c: 0, t: 0 };
    stats[q.domain].t++;
    if (App.answers[q.id] && App.answers[q.id].correct) stats[q.domain].c++;
  });

  // Persist this completed attempt to history (local always, Firebase if signed in).
  recordAttempt({
    id:          App.sessionId,
    examCode:    App.current.exam.code,
    examName:    App.current.exam.name,
    total:       total,
    correct:     correct,
    pct:         pct,
    domains:     Object.entries(stats).map(([num, d]) => ({ number: +num, name: d.name, correct: d.c, total: d.t })),
    settings:    { domains: App.settings.domains, countMode: App.settings.countMode, timedMode: App.settings.timedMode, mode: App.settings.mode },
    completedAt: new Date().toISOString(),
  });

  document.getElementById('domain-breakdown').innerHTML = Object.entries(stats)
    .sort(([a], [b]) => +a - +b)
    .map(([num, d]) => {
      var p = Math.round((d.c / d.t) * 100);
      return `<div class="domain-stat">
        <div class="domain-stat-label">Domain ${num}: ${esc(d.name)}</div>
        <div class="mini-bar"><div class="mini-bar-fill ${p >= 70 ? 'pass' : 'fail'}" data-width="${p}"></div></div>
        <div class="domain-stat-score">${d.c}/${d.t} (${p}%)</div>
      </div>`;
    }).join('');

  document.querySelectorAll('#domain-breakdown [data-width]').forEach(bar => { bar.style.width = bar.dataset.width + '%'; });
  renderLearningFocus(App.current.exam.code, document.getElementById('results-focus'));
  var wrong      = App.pool.filter(q => !App.answers[q.id] || !App.answers[q.id].correct);
  var retryBtn   = document.getElementById('btn-retry-wrong');
  var wrongPanel = document.getElementById('wrong-panel');

  if (wrong.length > 0) {
    retryBtn.disabled = false;
    retryBtn.dataset.wrongIds = JSON.stringify(wrong.map(q => q.id));
    document.getElementById('wrong-list').innerHTML = wrong.map(q => {
      var userAns = App.answers[q.id]?.selected;
      return `<div class="wrong-item">
        <p><strong>Q${q.id}.</strong> ${esc(q.question)}</p>
        ${userAns
          ? q.type === 'hotspot' ? '<p class="wrong-answer">You clicked: ' + esc(userAns.x.toFixed(1)) + '%, ' + esc(userAns.y.toFixed(1)) + '%</p>' : '<p class="wrong-answer">You chose: ' + esc(userAns) + ' — ' + esc(q.options[userAns]) + '</p>'
          : '<p class="wrong-answer">Not answered (time expired)</p>'}
        <p class="correct-answer">${q.type === 'hotspot' ? 'Correct target: ' + esc(q.hotspots.map(h=>h.label).join(', ')) : 'Correct: ' + esc(q.answer) + ' — ' + esc(q.options[q.answer])}</p>
      </div>`;
    }).join('');
    wrongPanel.classList.remove('hidden');
  } else {
    retryBtn.disabled = true;
    wrongPanel.classList.add('hidden');
  }

  showScreen('results');
}

// ── Retry wrong ────────────────────────────────────────────────
function retryWrong() {
  var ids    = JSON.parse(document.getElementById('btn-retry-wrong').dataset.wrongIds || '[]');
  var wrongQ = App.current.questions.filter(q => ids.includes(q.id));
  if (wrongQ.length) startQuiz(wrongQ);
}

// ── Progress dashboard ─────────────────────────────────────────
function openProgress() {
  var sel = document.getElementById('progress-exam-select');
  var withHistory = App.exams.filter(e => loadHistory(e.exam.code).length > 0 || LearningStore.events(e.exam.code).length > 0);
  var list = withHistory.length ? withHistory : App.exams;

  sel.innerHTML = list.map(e =>
    `<option value="${esc(e.exam.code)}">${esc(e.exam.code)} — ${esc(e.exam.name)}</option>`
  ).join('');

  var codes   = list.map(e => e.exam.code);
  var initial = (App.current && codes.includes(App.current.exam.code)) ? App.current.exam.code : codes[0];
  if (initial) sel.value = initial;

  showScreen('progress');
  renderProgress(initial);
}

function renderProgress(code) {
  const body = document.getElementById('progress-body'), empty = document.getElementById('progress-empty');
  renderSyncStatus();
  const attempts = code ? loadHistory(code).sort((a, b) => new Date(a.completedAt) - new Date(b.completedAt)) : [];
  const events = LearningStore.events(code);
  empty.classList.toggle('hidden', attempts.length > 0 || events.length > 0);
  body.classList.toggle('hidden', !attempts.length && !events.length);
  document.getElementById('score-history-card').classList.toggle('hidden', !attempts.length);
  if (attempts.length) { renderProgressSummary(attempts); renderProgressTrend(attempts); renderProgressDomains(attempts); }
  else document.getElementById('progress-domains').innerHTML = '<p class="progress-hint">Complete a quiz to see domain score history.</p>';
  renderLearningFocus(code, document.getElementById('progress-focus'));
}
function renderLearningFocus(code, target) {
  const exam = App.exams.find(e => e.exam.code === code); if (!exam || !target) return;
  const events = LearningStore.events(code), allGroups = LearningCore.summarize(exam.questions, events);
  const assessed = allGroups.filter(g => g.tested), untested = allGroups.filter(g => !g.tested);
  const card = g => {
    const details = g.tested ? `${g.tested}/${g.available} distinct questions · ${g.misses} latest misses · ${g.confidentErrors} confident errors · ${g.uncertain} correct but uncertain` : `${g.available} questions available`;
    return `<div class="learning-focus ${g.priority >= 3 ? 'needs-review' : ''}"><div>
      <strong>${esc(g.name)}</strong><span class="learning-status">${esc(g.status)}${g.limited && g.status !== 'Limited evidence' ? ' · Limited evidence' : ''}</span>
      <p>${esc(details)}</p><p>Domain ${g.domain}${g.lastPracticed ? ' · Last practiced ' + esc(new Date(g.lastPracticed).toLocaleDateString()) : ''}</p>
      </div><button class="btn-secondary btn-sm" data-practice-code="${esc(code)}" data-concept-key="${esc(g.key)}">Practice this area →</button></div>`;
  };
  if (target.id === 'results-focus') {
    target.innerHTML = (assessed.length ? assessed : untested).slice(0, 5).map(card).join('');
    return;
  }
  target.innerHTML = `<p class="progress-hint">${assessed.length} areas assessed · ${untested.length} not assessed</p>` +
    (assessed.length ? assessed.map(card).join('') : '<p class="progress-hint">No current answer-level evidence yet. Older scores are preserved; confidence was not recorded.</p>') +
    (untested.length ? `<details class="untested-areas"><summary>Explore areas not assessed (${untested.length})</summary>${untested.map(card).join('')}</details>` : '');
}

function renderProgressSummary(attempts) {
  var latest = attempts[attempts.length - 1];
  var first  = attempts[0];
  var best    = Math.max.apply(null, attempts.map(a => a.pct));
  var avg     = Math.round(attempts.reduce((s, a) => s + a.pct, 0) / attempts.length);
  var delta   = latest.pct - first.pct;
  var trendStr = attempts.length > 1 ? (delta >= 0 ? '+' : '') + delta + '%' : '—';

  var chips = [
    ['Attempts', attempts.length],
    ['Latest',   latest.pct + '%'],
    ['Best',     best + '%'],
    ['Average',  avg + '%'],
    ['Trend',    trendStr],
  ];
  document.getElementById('progress-summary').innerHTML = chips.map(([label, val]) =>
    `<div class="stat-chip"><span class="stat-chip-val">${esc(String(val))}</span><span class="stat-chip-label">${esc(label)}</span></div>`
  ).join('');
}

function renderProgressTrend(attempts) {
  var W = 320, H = 120, pad = 24, n = attempts.length;
  var xs = i => n <= 1 ? W / 2 : pad + (i * (W - 2 * pad) / (n - 1));
  var ys = p => (H - pad) - (p / 100) * (H - 2 * pad);
  var pts = attempts.map((a, i) => [xs(i), ys(a.pct)]);
  var poly = pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  var y70 = ys(70).toFixed(1);

  var dots = pts.map((p, i) => {
    var a   = attempts[i];
    var when = new Date(a.completedAt).toLocaleDateString();
    return `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.5" class="trend-dot ${a.pct >= 70 ? 'pass' : 'fail'}"><title>${esc(when)}: ${a.pct}%</title></circle>`;
  }).join('');

  document.getElementById('progress-trend').innerHTML =
    `<svg viewBox="0 0 ${W} ${H}" class="trend-svg" role="img" aria-label="Score trend across attempts">
      <line x1="${pad}" y1="${y70}" x2="${W - pad}" y2="${y70}" class="trend-target"/>
      ${n > 1 ? `<polyline points="${poly}" class="trend-line"/>` : ''}
      ${dots}
    </svg>`;
}

function renderProgressDomains(attempts) {
  var agg = {};
  attempts.forEach(a => (a.domains || []).forEach(d => {
    if (!agg[d.number]) agg[d.number] = { name: d.name || ('Domain ' + d.number), c: 0, t: 0 };
    agg[d.number].c += d.correct || 0;
    agg[d.number].t += d.total   || 0;
  }));

  var rows = Object.entries(agg).map(([num, d]) => ({
    num: +num, name: d.name, c: d.c, t: d.t, pct: d.t ? Math.round(d.c / d.t * 100) : 0,
  })).sort((a, b) => a.num - b.num);

  document.getElementById('progress-domains').innerHTML = rows.map(d =>
    `<div class="domain-stat">
      <div class="domain-stat-label">Domain ${d.num}: ${esc(d.name)}</div>
      <div class="mini-bar"><div class="mini-bar-fill ${d.pct >= 70 ? 'pass' : 'fail'}" data-width="${d.pct}"></div></div>
      <div class="domain-stat-score">${d.c}/${d.t} (${d.pct}%)</div>
    </div>`
  ).join('');
  document.querySelectorAll('#progress-domains [data-width]').forEach(bar => { bar.style.width = bar.dataset.width + '%'; });
}

function isScreenActive(name) {
  var s = document.getElementById('screen-' + name);
  return !!(s && s.classList.contains('active'));
}

// ── Static button wiring ───────────────────────────────────────
function wireStaticButtons() {
  // Exam grid — persistent event delegation (survives re-renders, no once:true)
  document.getElementById('exam-grid').addEventListener('click', e => {
    var btn = e.target.closest('[data-exam-idx]');
    if (!btn) return;
    var idx    = parseInt(btn.dataset.examIdx, 10);
    var exam   = App.exams[idx];
    if (!exam) return;
    var action = btn.dataset.action;

    if (action === 'resume') {
      App.current = exam;
      var session = loadSession(exam.exam.code, btn.dataset.mode || 'regular');
      if (session) startQuizFromSession(session);
      else openSetup(idx);
    } else if (action === 'focus') {
      startFocus(exam);
    } else {
      openSetup(idx);
    }
  });

  document.getElementById('btn-start').addEventListener('click', () => startQuiz());
  document.getElementById('btn-back-setup').addEventListener('click', () => { renderHome(); showScreen('home'); });

  // Timed mode toggle
  document.getElementById('opt-timed').addEventListener('change', e => {
    document.getElementById('timer-opts').classList.toggle('hidden', !e.target.checked);
  });

  // Quiz exit — save progress if enabled
  document.getElementById('btn-back-quiz').addEventListener('click', () => {
    var hasProgress = App.idx > 0 || Object.keys(App.answers).length > 0;
    if (App.settings && App.settings.saveProgress) {
      if (hasProgress) {
        Timer.pause();
        saveSession();
        showToast('Progress saved — resume from the home screen', 'success');
      }
      Timer.clear();
      renderHome();
      showScreen('home');
    } else {
      if (confirm('Exit quiz? Progress will be lost.')) {
        Timer.clear();
        clearSession(App.current && App.current.exam && App.current.exam.code);
        renderHome();
        showScreen('home');
      }
    }
  });

  document.getElementById('btn-back-results').addEventListener('click', () => { renderHome(); showScreen('home'); });
  document.getElementById('btn-new-quiz').addEventListener('click', () => { renderSetup(); showScreen('setup'); });
  document.getElementById('btn-retry-wrong').addEventListener('click', retryWrong);

  document.getElementById('btn-retry-conn').addEventListener('click', () => {
    if (typeof AI !== 'undefined') AI.checkConnection();
  });

  // ── Account control ──────────────────────────────────────────
  document.getElementById('btn-signin')?.addEventListener('click', () => {
    if (typeof Auth !== 'undefined') Auth.signInWithGoogle();
  });
  document.getElementById('btn-account')?.addEventListener('click', () => {
    document.getElementById('account-menu')?.classList.toggle('hidden');
  });
  document.getElementById('btn-signout')?.addEventListener('click', () => {
    document.getElementById('account-menu')?.classList.add('hidden');
    if (typeof Auth !== 'undefined') Auth.signOut();
    showToast('Guest mode — account progress stays separate on this device', 'info');
  });
  // Dismiss the account menu when clicking elsewhere.
  document.addEventListener('click', e => {
    var ctrl = document.getElementById('account-control');
    if (ctrl && !ctrl.contains(e.target)) document.getElementById('account-menu')?.classList.add('hidden');
  });

  wireProgressBackup();
  document.getElementById('btn-sync').addEventListener('click', syncMergeOnSignIn);
  document.getElementById('btn-import-guest').addEventListener('click', importGuestProgress);
  document.addEventListener('click', e => {
    const button = e.target.closest('[data-practice-code]'); if (!button) return;
    const exam = App.exams.find(x => x.exam.code === button.dataset.practiceCode);
    if (exam) startFocus(exam, button.dataset.conceptKey);
  });

  // ── Progress ─────────────────────────────────────────────────
  document.getElementById('btn-progress').addEventListener('click', openProgress);
  document.getElementById('btn-back-progress').addEventListener('click', () => { renderHome(); showScreen('home'); });
  document.getElementById('progress-exam-select').addEventListener('change', e => renderProgress(e.target.value));
}

// ── Account rendering ──────────────────────────────────────────
function renderAccount(user) {
  var control = document.getElementById('account-control');
  if (!control) return;
  if (typeof Auth === 'undefined' || !Auth.isEnabled()) { control.classList.add('hidden'); return; }
  control.classList.remove('hidden');

  var signin  = document.getElementById('btn-signin');
  var account = document.getElementById('btn-account');
  var menu    = document.getElementById('account-menu');

  if (user) {
    document.getElementById('btn-import-guest').classList.remove('hidden');
    signin.classList.add('hidden');
    account.classList.remove('hidden');
    document.getElementById('account-name').textContent  = user.name;
    document.getElementById('account-email').textContent = user.email;
    var av = document.getElementById('account-avatar');
    if (user.avatar) { av.src = user.avatar; av.classList.remove('hidden'); }
    else av.classList.add('hidden');
  } else {
    signin.classList.remove('hidden');
    account.classList.add('hidden');
    menu.classList.add('hidden');
  }
}

// ── Screen transitions ─────────────────────────────────────────
let screenTransition = 0;
function showScreen(name) {
  var next    = document.getElementById('screen-' + name);
  if (!next) return;
  const transition = ++screenTransition;
  document.querySelectorAll('.screen').forEach(screen => {
    if (screen !== next) screen.classList.remove('active', 'visible');
  });
  next.classList.add('active');
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (transition === screenTransition) next.classList.add('visible');
  }));
}

// ── Util ───────────────────────────────────────────────────────
function shuffle(arr) {
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}

function esc(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Relative URL so the SW registers at the correct scope under any base path.
    navigator.serviceWorker.register('sw.js').catch(() => { /* ignore — works without SW */ });
  });
}


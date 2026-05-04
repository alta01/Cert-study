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

// ── Session persistence ────────────────────────────────────────
const SESSION_PREFIX = 'cs_sess_';

function sessionKey(code) { return SESSION_PREFIX + (code || 'unknown'); }

function saveSession() {
  if (!App.settings?.saveProgress || !App.current?.exam?.code) return;
  const data = {
    examCode:       App.current.exam.code,
    poolIds:        App.pool.map(q => q.id),
    idx:            App.idx,
    answers:        App.answers,
    settings:       App.settings,
    timerRemaining: App.settings.timedMode ? Timer.getRemaining() : null,
    savedAt:        Date.now(),
  };
  try { localStorage.setItem(sessionKey(App.current.exam.code), JSON.stringify(data)); }
  catch { /* storage full */ }
}

function loadSession(code) {
  try {
    const raw = localStorage.getItem(sessionKey(code));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function clearSession(code) { localStorage.removeItem(sessionKey(code)); }

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
};

// ── Boot ───────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  wireStaticButtons();
  initAIPanel();
  await loadFromManifest();
  renderHome();
  showScreen('home');
});

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
  const grid = document.getElementById('exam-grid');
  if (!grid) return;

  if (App.exams.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = '<p><strong>No exams loaded yet.</strong></p><p>Load a JSON exam file below, or use the AI Assistant to generate one.</p>';
    grid.replaceChildren(empty);
    return;
  }

  grid.innerHTML = App.exams.map((exam, i) => {
    const meta     = exam._meta || {};
    const category = meta.category || exam.exam.category || '';
    const qCount   = exam.questions.length;
    const domains  = (exam.exam.domains || []).length;
    const session  = loadSession(exam.exam.code);
    const catHtml  = category
      ? `<div class="exam-card-category">${esc(category)}</div>`
      : '';
    const sessHtml = session
      ? `<div class="exam-card-session"><span class="resume-badge">In progress · Q${session.idx + 1}/${session.poolIds.length}</span></div>`
      : '';
    const actHtml  = session
      ? `<button class="btn-primary btn-sm" data-exam-idx="${i}" data-action="resume">Resume →</button>
         <button class="btn-secondary btn-sm" data-exam-idx="${i}" data-action="new">New quiz</button>`
      : `<button class="btn-primary" data-exam-idx="${i}" data-action="study">Study →</button>`;
    return `<div class="exam-card">
      ${catHtml}
      <div class="exam-card-title">${esc(exam.exam.name)}</div>
      <div class="exam-card-meta">${qCount} question${qCount !== 1 ? 's' : ''} · ${domains} domain${domains !== 1 ? 's' : ''} · Pass ${exam.exam.passingScore}/${exam.exam.maxScore}</div>
      ${sessHtml}
      <div class="exam-card-actions">${actHtml}</div>
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
  App.settings = Object.assign({}, session.settings);
  App.answers  = Object.assign({}, session.answers);
  App.idx      = session.idx;

  const byId = new Map(App.current.questions.map(q => [q.id, q]));
  App.pool   = session.poolIds.map(id => byId.get(id)).filter(Boolean);

  if (App.pool.length === 0) {
    clearSession(App.current.exam.code);
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
    timerMinutes: parseInt(document.getElementById('timer-minutes').value) || 90,
  };
}

// ── Quiz ───────────────────────────────────────────────────────
function startQuiz(retryPool) {
  App.settings = gatherSettings();
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
  var q = App.pool[App.idx];
  if (q && !App.answers[q.id]) App.answers[q.id] = { selected: null, correct: false };
  clearSession(App.current && App.current.exam && App.current.exam.code);
  showResults();
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

  var optWrap = document.getElementById('q-options');
  optWrap.innerHTML = Object.entries(q.options).map(([k, v]) =>
    `<label class="opt-label" data-key="${esc(k)}">
      <input type="radio" name="q-ans" value="${esc(k)}" />
      <span class="opt-key">${esc(k)}</span>
      <span class="opt-text">${esc(v)}</span>
    </label>`
  ).join('');

  optWrap.querySelectorAll('input').forEach(r =>
    r.addEventListener('change', () => {
      document.getElementById('btn-submit').disabled = false;
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

function submitAnswer() {
  var radio = document.querySelector('input[name="q-ans"]:checked');
  var sel   = radio && radio.value;
  if (!sel) return;

  var q         = App.pool[App.idx];
  var isCorrect = sel === q.answer;
  App.answers[q.id] = { selected: sel, correct: isCorrect };

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
    : '✗ Incorrect — correct answer: ' + esc(q.answer);

  var html = '';

  if (q.optionRationales) {
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

  document.getElementById('domain-breakdown').innerHTML = Object.entries(stats)
    .sort(([a], [b]) => +a - +b)
    .map(([num, d]) => {
      var p = Math.round((d.c / d.t) * 100);
      return `<div class="domain-stat">
        <div class="domain-stat-label">Domain ${num}: ${esc(d.name)}</div>
        <div class="mini-bar"><div class="mini-bar-fill ${p >= 70 ? 'pass' : 'fail'}" style="width:${p}%"></div></div>
        <div class="domain-stat-score">${d.c}/${d.t} (${p}%)</div>
      </div>`;
    }).join('');

  var wrong      = App.pool.filter(q => App.answers[q.id] && !App.answers[q.id].correct);
  var retryBtn   = document.getElementById('btn-retry-wrong');
  var wrongPanel = document.getElementById('wrong-panel');

  if (wrong.length > 0) {
    retryBtn.disabled = false;
    retryBtn.dataset.wrongIds = JSON.stringify(wrong.map(q => q.id));
    document.getElementById('wrong-list').innerHTML = wrong.map(q => {
      var userAns = App.answers[q.id].selected;
      return `<div class="wrong-item">
        <p><strong>Q${q.id}.</strong> ${esc(q.question)}</p>
        ${userAns
          ? '<p class="wrong-answer">You chose: ' + esc(userAns) + ' — ' + esc(q.options[userAns]) + '</p>'
          : '<p class="wrong-answer">Not answered (time expired)</p>'}
        <p class="correct-answer">Correct: ${esc(q.answer)} — ${esc(q.options[q.answer])}</p>
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
      var session = loadSession(exam.exam.code);
      if (session) startQuizFromSession(session);
      else openSetup(idx);
    } else {
      if (action === 'new') clearSession(exam.exam.code);
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
}

// ── Screen transitions ─────────────────────────────────────────
function showScreen(name) {
  var current = document.querySelector('.screen.active');
  var next    = document.getElementById('screen-' + name);
  if (!next || current === next) return;

  if (current) {
    current.classList.remove('visible');
    setTimeout(() => current.classList.remove('active'), 200);
  }
  next.classList.add('active');
  requestAnimationFrame(() => requestAnimationFrame(() => next.classList.add('visible')));
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

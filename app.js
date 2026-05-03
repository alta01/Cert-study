/* app.js — Cert Study core quiz engine */

// ── State ──────────────────────────────────────────────────────
const App = {
  exams:    [],         // all loaded exam data objects
  current:  null,       // active exam
  pool:     [],         // questions for this session
  idx:      0,
  answers:  {},         // questionId → { selected, correct }
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
  try {
    const res = await fetch('manifest.json');
    if (!res.ok) return;
    const manifest = await res.json();
    for (const entry of (manifest.exams || [])) {
      try {
        const r = await fetch(entry.file);
        if (!r.ok) continue;
        const data = await r.json();
        data._meta = entry;
        if (!App.exams.find(e => e.exam.code === data.exam.code)) {
          App.exams.push(data);
        }
      } catch { /* skip bad file */ }
    }
  } catch { /* no manifest — that's fine */ }
}

// ── Exam loading (file picker + AI generator) ──────────────────
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
    try {
      const data = JSON.parse(ev.target.result);
      window.loadExamData(data);
    } catch { alert('Could not parse JSON file.'); }
  };
  reader.readAsText(file);
  e.target.value = '';
});

// ── Home ───────────────────────────────────────────────────────
function renderHome() {
  const grid = document.getElementById('exam-grid');
  if (!grid) return;

  if (App.exams.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <p><strong>No exams loaded yet.</strong></p>
        <p>Load a JSON exam file below, or use the AI Assistant to generate one from study material.</p>
      </div>`;
    return;
  }

  grid.innerHTML = App.exams.map((exam, i) => {
    const meta     = exam._meta || {};
    const category = meta.category || exam.exam.category || '';
    const qCount   = exam.questions.length;
    const domains  = (exam.exam.domains || []).length;
    return `
      <div class="exam-card">
        ${category ? `<div class="exam-card-category">${esc(category)}</div>` : ''}
        <div class="exam-card-title">${esc(exam.exam.name)}</div>
        <div class="exam-card-meta">${qCount} questions · ${domains} domain${domains !== 1 ? 's' : ''} · Pass ${exam.exam.passingScore}/${exam.exam.maxScore}</div>
        <div class="exam-card-actions">
          <button class="btn-primary" data-exam-idx="${i}">Study →</button>
        </div>
      </div>`;
  }).join('');

  grid.addEventListener('click', e => {
    const btn = e.target.closest('[data-exam-idx]');
    if (btn) openSetup(parseInt(btn.dataset.examIdx, 10));
  }, { once: true });
}

window.openSetup = function(examIdx) {
  App.current = App.exams[examIdx];
  renderSetup();
  showScreen('setup');
};

// ── Setup ──────────────────────────────────────────────────────
function renderSetup() {
  const exam = App.current;
  document.getElementById('setup-exam-title').textContent = exam.exam.code
    ? `${exam.exam.code} — ${exam.exam.name}`
    : exam.exam.name;

  const domainEl = document.getElementById('domain-filters');
  domainEl.innerHTML = (exam.exam.domains || []).map(d => `
    <label>
      <input type="checkbox" class="domain-cb" value="${d.number}" checked />
      <span class="domain-tag">Domain ${d.number}: ${esc(d.name)}</span>
      <span class="domain-weight">${esc(d.weight || '')}</span>
    </label>`).join('');

  document.getElementById('btn-all').onclick = () =>
    document.querySelectorAll('.domain-cb').forEach(cb => { cb.checked = true; });
  document.getElementById('btn-none').onclick = () =>
    document.querySelectorAll('.domain-cb').forEach(cb => { cb.checked = false; });

  // Reset to "all" + default options
  document.querySelector('input[name="q-count"][value="all"]').checked = true;
  document.getElementById('opt-randomize').checked = false;
  document.getElementById('opt-explain').checked   = true;
}

function gatherSettings() {
  return {
    domains:   [...document.querySelectorAll('.domain-cb:checked')].map(cb => parseInt(cb.value)),
    countMode: document.querySelector('input[name="q-count"]:checked')?.value || 'all',
    customCount: parseInt(document.getElementById('custom-count')?.value) || 20,
    randomize:    document.getElementById('opt-randomize')?.checked || false,
    showExplain:  document.getElementById('opt-explain')?.checked  !== false,
  };
}

// ── Quiz ───────────────────────────────────────────────────────
function startQuiz(retryPool = null) {
  App.settings = gatherSettings();
  App.answers  = {};
  App.idx      = 0;

  let pool = retryPool || App.current.questions.filter(q =>
    App.settings.domains.includes(q.domain)
  );

  if (App.settings.randomize) pool = shuffle([...pool]);
  if (!retryPool && App.settings.countMode === 'custom') {
    pool = pool.slice(0, App.settings.customCount);
  }

  if (pool.length === 0) {
    alert('No questions match the selected filters.');
    return;
  }

  App.pool = pool;
  renderQuestion();
  showScreen('quiz');
}

function renderQuestion() {
  const q     = App.pool[App.idx];
  const total = App.pool.length;
  const answered = Object.keys(App.answers).length;
  const correct  = Object.values(App.answers).filter(a => a.correct).length;

  document.getElementById('q-label').textContent = `Q ${App.idx + 1} / ${total}`;
  document.getElementById('progress-bar').style.width = `${(App.idx / total) * 100}%`;
  document.getElementById('score-live').textContent = `${correct} / ${answered}`;

  document.getElementById('q-badge').textContent = `Domain ${q.domain}`;
  document.getElementById('q-topic').textContent = q.topic || '';
  document.getElementById('q-text').innerHTML    = esc(q.question).replace(/\n/g, '<br>');

  const optWrap = document.getElementById('q-options');
  optWrap.innerHTML = Object.entries(q.options).map(([k, v]) => `
    <label class="opt-label" data-key="${esc(k)}">
      <input type="radio" name="q-ans" value="${esc(k)}" />
      <span class="opt-key">${esc(k)}</span>
      <span class="opt-text">${esc(v)}</span>
    </label>`).join('');

  optWrap.querySelectorAll('input').forEach(r =>
    r.addEventListener('change', () => { document.getElementById('btn-submit').disabled = false; })
  );

  const submit = document.getElementById('btn-submit');
  const next   = document.getElementById('btn-next');
  submit.disabled = true;
  submit.classList.remove('hidden');
  next.classList.add('hidden');
  document.getElementById('explanation').classList.add('hidden');
  submit.onclick = submitAnswer;
}

function submitAnswer() {
  const sel = document.querySelector('input[name="q-ans"]:checked')?.value;
  if (!sel) return;

  const q         = App.pool[App.idx];
  const isCorrect = sel === q.answer;
  App.answers[q.id] = { selected: sel, correct: isCorrect };

  // Lock inputs and style options
  document.querySelectorAll('input[name="q-ans"]').forEach(r => {
    r.disabled = true;
    r.closest('.opt-label').classList.add('locked');
  });
  document.querySelectorAll('.opt-label').forEach(label => {
    const k = label.dataset.key;
    if (k === q.answer)              label.classList.add('opt-correct');
    else if (k === sel && !isCorrect) label.classList.add('opt-incorrect');
  });

  document.getElementById('btn-submit').classList.add('hidden');

  if (App.settings.showExplain) showExplanation(q, sel, isCorrect);

  const next   = document.getElementById('btn-next');
  const isLast = App.idx === App.pool.length - 1;
  next.textContent = isLast ? 'See results →' : 'Next →';
  next.classList.remove('hidden');
  next.onclick = isLast ? showResults : () => { App.idx++; renderQuestion(); };
}

function showExplanation(q, selected, isCorrect) {
  const banner = document.getElementById('exp-banner');
  const body   = document.getElementById('exp-body');

  banner.className = isCorrect ? 'correct' : 'incorrect';
  banner.textContent = isCorrect
    ? '✓ Correct'
    : `✗ Incorrect — correct answer: ${esc(q.answer)}`;

  if (q.optionRationales) {
    body.innerHTML = Object.entries(q.options).map(([k, text]) => {
      const isAns = k === q.answer;
      const rat   = q.optionRationales[k] || '';
      return `
        <div class="exp-option ${isAns ? 'exp-correct' : 'exp-wrong'}">
          <strong>${esc(k)}. ${esc(text)}</strong>
          ${rat ? `<p>${esc(rat)}</p>` : ''}
        </div>`;
    }).join('');
  } else {
    body.innerHTML = `<p class="exp-fallback">${esc(q.rationale || '')}</p>`;
  }

  document.getElementById('explanation').classList.remove('hidden');
}

// ── Results ────────────────────────────────────────────────────
function showResults() {
  const total   = App.pool.length;
  const correct = Object.values(App.answers).filter(a => a.correct).length;
  const pct     = Math.round((correct / total) * 100);

  // Ring animation
  const arc = document.getElementById('ring-arc');
  const r = 50, circ = 2 * Math.PI * r;
  arc.style.strokeDasharray  = circ;
  arc.style.strokeDashoffset = circ;
  setTimeout(() => {
    arc.style.strokeDashoffset = circ * (1 - pct / 100);
  }, 80);

  document.getElementById('res-pct').textContent     = `${pct}%`;
  document.getElementById('res-fraction').textContent = `${correct} out of ${total} correct`;

  // Domain breakdown
  const stats = {};
  App.pool.forEach(q => {
    if (!stats[q.domain]) stats[q.domain] = { name: q.domainName || `Domain ${q.domain}`, c: 0, t: 0 };
    stats[q.domain].t++;
    if (App.answers[q.id]?.correct) stats[q.domain].c++;
  });

  document.getElementById('domain-breakdown').innerHTML = Object.entries(stats)
    .sort(([a], [b]) => +a - +b)
    .map(([num, d]) => {
      const p = Math.round((d.c / d.t) * 100);
      return `
        <div class="domain-stat">
          <div class="domain-stat-label">Domain ${num}: ${esc(d.name)}</div>
          <div class="mini-bar"><div class="mini-bar-fill ${p >= 70 ? 'pass' : 'fail'}" style="width:${p}%"></div></div>
          <div class="domain-stat-score">${d.c}/${d.t} (${p}%)</div>
        </div>`;
    }).join('');

  // Wrong answers panel
  const wrong = App.pool.filter(q => App.answers[q.id] && !App.answers[q.id].correct);
  const retryBtn   = document.getElementById('btn-retry-wrong');
  const wrongPanel = document.getElementById('wrong-panel');

  if (wrong.length > 0) {
    retryBtn.disabled = false;
    retryBtn.dataset.wrongIds = JSON.stringify(wrong.map(q => q.id));
    document.getElementById('wrong-list').innerHTML = wrong.map(q => {
      const userAns = App.answers[q.id].selected;
      return `
        <div class="wrong-item">
          <p><strong>Q${q.id}.</strong> ${esc(q.question)}</p>
          <p class="wrong-answer">You chose: ${esc(userAns)} — ${esc(q.options[userAns])}</p>
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
  const ids = JSON.parse(document.getElementById('btn-retry-wrong').dataset.wrongIds || '[]');
  const wrongQ = App.current.questions.filter(q => ids.includes(q.id));
  if (wrongQ.length) startQuiz(wrongQ);
}

// ── Static button wiring ───────────────────────────────────────
function wireStaticButtons() {
  document.getElementById('btn-start')?.addEventListener('click', () => startQuiz());
  document.getElementById('btn-back-setup')?.addEventListener('click', () => showScreen('home'));
  document.getElementById('btn-back-quiz')?.addEventListener('click', () => {
    if (confirm('Exit quiz? Progress will be lost.')) showScreen('home');
  });
  document.getElementById('btn-back-results')?.addEventListener('click', () => showScreen('home'));
  document.getElementById('btn-new-quiz')?.addEventListener('click', () => {
    renderSetup();
    showScreen('setup');
  });
  document.getElementById('btn-retry-wrong')?.addEventListener('click', retryWrong);
}

// ── Screen transitions ─────────────────────────────────────────
function showScreen(name) {
  const current = document.querySelector('.screen.active');
  const next    = document.getElementById(`screen-${name}`);
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
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

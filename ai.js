/* ai.js — Local AI assistant via Ollama */

const OLLAMA_BASE = 'http://localhost:11434';

const AI = (() => {
  let _models = [];
  let _ready = false;
  let _abortController = null;

  // ── Connection ─────────────────────────────────────────────

  async function checkConnection() {
    setStatus('checking');
    try {
      const res = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) throw new Error();
      const data = await res.json();
      _models = (data.models || []).map(m => m.name).sort();
      _ready = true;
      setStatus('online');
      populateModelSelect();
      enableInputs();
    } catch {
      _ready = false;
      _models = [];
      setStatus('offline');
      disableInputs();
    }
  }

  function setStatus(state) {
    const dot = document.getElementById('ai-status-dot');
    if (!dot) return;
    dot.className = `status-dot ${state}`;
    dot.title = state === 'online'   ? `Ollama connected (${_models.length} models)`
              : state === 'offline'  ? 'Ollama not found — start Ollama to enable AI features'
              : 'Checking Ollama…';
  }

  function populateModelSelect() {
    const sel = document.getElementById('ai-model-select');
    if (!sel) return;
    sel.innerHTML = _models.length
      ? _models.map(m => `<option value="${m}">${m}</option>`).join('')
      : '<option value="">No models found</option>';
  }

  function enableInputs() {
    const send = document.getElementById('btn-ai-send');
    const gen  = document.getElementById('btn-generate');
    if (send) send.disabled = false;
    if (gen)  gen.disabled  = false;
  }

  function disableInputs() {
    const send = document.getElementById('btn-ai-send');
    const gen  = document.getElementById('btn-generate');
    if (send) send.disabled = true;
    if (gen)  gen.disabled  = true;
  }

  function selectedModel() {
    return document.getElementById('ai-model-select')?.value || _models[0] || '';
  }

  // ── Streaming chat ─────────────────────────────────────────

  async function streamChat(messages, onChunk, onDone, onError) {
    if (!_ready) { onError('Ollama is not available.'); return; }
    if (_abortController) _abortController.abort();
    _abortController = new AbortController();

    try {
      const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: _abortController.signal,
        body: JSON.stringify({
          model: selectedModel(),
          messages,
          stream: true,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value, { stream: true }).split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const obj = JSON.parse(line);
            const chunk = obj.message?.content || '';
            full += chunk;
            onChunk(chunk, full);
          } catch { /* skip malformed */ }
        }
      }
      onDone(full);
    } catch (err) {
      if (err.name !== 'AbortError') onError(err.message);
    }
  }

  // ── Question generation ────────────────────────────────────

  const SCHEMA_EXAMPLE = `{
  "exam": {
    "code": "CODE",
    "name": "Full Exam Name",
    "passingScore": 700,
    "maxScore": 1000,
    "domains": [{"number": 1, "name": "Topic Area", "weight": "100%", "topics": ["sub-topic"]}]
  },
  "questions": [
    {
      "id": 1, "domain": 1, "domainName": "Topic Area", "topic": "specific topic",
      "question": "Question text here?",
      "options": {"A": "First option", "B": "Second option", "C": "Third option", "D": "Fourth option"},
      "answer": "A",
      "rationale": "A is correct because...",
      "optionRationales": {
        "A": "This is correct because...",
        "B": "This is wrong because...",
        "C": "This is wrong because...",
        "D": "This is wrong because..."
      }
    }
  ]
}`;

  async function generateExamQuestions({ examName, examCode, sourceText, count }, onProgress) {
    const prompt = `You are an expert exam question writer. Generate exactly ${count} high-quality multiple-choice exam questions based on the study material below.

Exam name: "${examName}"
Exam code: "${examCode}"

Rules:
- Each question must have exactly 4 options (A, B, C, D)
- Only one option is correct
- Questions should test understanding, not just memorization
- Distractors should be plausible but clearly wrong when you know the material
- Cover different aspects of the material — do not cluster questions on the same sub-topic
- For optionRationales: explain briefly why each option is correct or incorrect

Return ONLY valid JSON matching this schema exactly (no markdown, no code fences, no commentary):
${SCHEMA_EXAMPLE}

For the domains array, group questions by logical topic areas found in the material.

Study material:
---
${sourceText.slice(0, 12000)}
---`;

    let fullResponse = '';
    await streamChat(
      [{ role: 'user', content: prompt }],
      (chunk, full) => { fullResponse = full; onProgress(full); },
      () => {},
      (err) => { throw new Error(err); }
    );
    return fullResponse;
  }

  function parseGeneratedJSON(raw) {
    // Strip markdown code fences if present
    let text = raw.trim();
    text = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
    // Find the first { and last }
    const start = text.indexOf('{');
    const end   = text.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error('No JSON object found in response');
    return JSON.parse(text.slice(start, end + 1));
  }

  return { checkConnection, streamChat, generateExamQuestions, parseGeneratedJSON, isReady: () => _ready };
})();

// ── UI wiring ──────────────────────────────────────────────────

function initAIPanel() {
  const panel   = document.getElementById('ai-panel');
  const overlay = document.getElementById('ai-overlay');
  const toggle  = document.getElementById('btn-ai-toggle');
  const close   = document.getElementById('btn-ai-close');

  function openPanel() {
    panel.classList.add('open');
    overlay.classList.remove('hidden');
    toggle.classList.add('active');
  }
  function closePanel() {
    panel.classList.remove('open');
    overlay.classList.add('hidden');
    toggle.classList.remove('active');
  }

  toggle?.addEventListener('click', () => panel.classList.contains('open') ? closePanel() : openPanel());
  close?.addEventListener('click', closePanel);
  overlay?.addEventListener('click', closePanel);

  // Tabs
  document.querySelectorAll('.ai-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.ai-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.ai-tab-content').forEach(c => c.classList.add('hidden'));
      tab.classList.add('active');
      document.getElementById(`ai-tab-${tab.dataset.tab}`)?.classList.remove('hidden');
    });
  });

  // Chat send
  const input  = document.getElementById('ai-input');
  const sendBtn = document.getElementById('btn-ai-send');

  function sendChat() {
    const text = input?.value.trim();
    if (!text) return;
    appendMessage('user', text);
    input.value = '';
    const thinkingEl = appendMessage('assistant', '…', true);

    const history = buildChatHistory();
    AI.streamChat(
      history,
      (_chunk, full) => { thinkingEl.innerHTML = renderMarkdown(full); scrollMessages(); },
      () => { thinkingEl.classList.remove('ai-thinking'); },
      (err) => { thinkingEl.textContent = `Error: ${err}`; }
    );
  }

  sendBtn?.addEventListener('click', sendChat);
  input?.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } });

  // Generate exam
  const genBtn      = document.getElementById('btn-generate');
  const genStatus   = document.getElementById('gen-status');
  const genOutput   = document.getElementById('gen-output');
  const genPreview  = document.getElementById('gen-preview');
  let _generatedExam = null;

  genBtn?.addEventListener('click', async () => {
    const name   = document.getElementById('gen-exam-name')?.value.trim();
    const code   = document.getElementById('gen-exam-code')?.value.trim();
    const source = document.getElementById('gen-source')?.value.trim();
    const count  = parseInt(document.getElementById('gen-count')?.value) || 10;

    if (!name || !source) { alert('Enter an exam name and paste study material.'); return; }
    if (!AI.isReady()) { alert('Ollama is not available. Please start Ollama first.'); return; }

    genBtn.disabled = true;
    genOutput.classList.add('hidden');
    genStatus.textContent = 'Generating questions — this may take a moment…';
    genStatus.classList.remove('hidden');
    genPreview.textContent = '';
    _generatedExam = null;

    try {
      const raw = await AI.generateExamQuestions(
        { examName: name, examCode: code || name.replace(/\s+/g, '-').toUpperCase().slice(0, 10), sourceText: source, count },
        (partial) => { genPreview.textContent = partial.slice(0, 800) + (partial.length > 800 ? '…' : ''); }
      );
      _generatedExam = AI.parseGeneratedJSON(raw);
      genPreview.textContent = JSON.stringify(_generatedExam, null, 2);
      genOutput.classList.remove('hidden');
      genStatus.textContent = `Generated ${_generatedExam.questions?.length || 0} questions.`;
    } catch (err) {
      genStatus.textContent = `Error: ${err.message}`;
    } finally {
      genBtn.disabled = false;
    }
  });

  document.getElementById('btn-gen-load')?.addEventListener('click', () => {
    if (_generatedExam && window.loadExamData) {
      window.loadExamData(_generatedExam);
      closePanel();
    }
  });

  document.getElementById('btn-gen-download')?.addEventListener('click', () => {
    if (!_generatedExam) return;
    const blob = new Blob([JSON.stringify(_generatedExam, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${_generatedExam.exam?.code || 'exam'}.json`.toLowerCase().replace(/\s+/g, '-');
    a.click();
    URL.revokeObjectURL(a.href);
  });

  // Initial connection check
  AI.checkConnection();
  // Re-check every 30 s
  setInterval(AI.checkConnection, 30000);
}

// ── Chat helpers ───────────────────────────────────────────────

function appendMessage(role, text, thinking = false) {
  const box = document.getElementById('ai-messages');
  const el  = document.createElement('div');
  el.className = `ai-msg ${role}${thinking ? ' ai-thinking' : ''}`;
  el.innerHTML = thinking ? text : renderMarkdown(text);
  box?.appendChild(el);
  scrollMessages();
  return el;
}

function scrollMessages() {
  const box = document.getElementById('ai-messages');
  if (box) box.scrollTop = box.scrollHeight;
}

function buildChatHistory() {
  const msgs = document.querySelectorAll('.ai-msg');
  const history = [];
  msgs.forEach(m => {
    if (m.classList.contains('ai-thinking')) return;
    const role = m.classList.contains('user') ? 'user' : 'assistant';
    history.push({ role, content: m.textContent || '' });
  });
  return history;
}

function renderMarkdown(text) {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
}

# Agents

AI agents in Cert Study span two paths: the **built-in local assistant** (implemented in `ai.js`, powered by Ollama) and the **Claude API agents** (implemented in `scripts/`, requiring an Anthropic API key).

---

## Built-in Local AI (Ollama)

**File:** `ai.js`
**Requires:** [Ollama](https://ollama.com) running locally at `http://localhost:11434`
**API key:** none — fully offline

The vanilla app ships with a sidebar AI panel containing two modes:

### Chat Assistant

A streaming conversational assistant. Maintains message history for the session and sends it with every request so the model has full context. Useful for asking questions about exam material, getting concept explanations, or working through why an answer is correct.

**Endpoint:** `POST /api/chat` (Ollama)
**Model:** any model installed in Ollama (user-selectable at runtime)

### Exam Generator

Accepts pasted study material and produces a complete exam JSON file in the app's flat schema format. Output can be loaded directly into the quiz engine or downloaded.

**Prompt contract:** instructs the model to return valid JSON only (no markdown fences, no commentary) matching the schema below. Strips fences and extracts the JSON object if the model doesn't comply.

**Output schema:**
```json
{
  "exam": {
    "code": "CODE", "name": "...", "passingScore": 700, "maxScore": 1000,
    "domains": [{ "number": 1, "name": "...", "weight": "100%", "topics": ["..."] }]
  },
  "questions": [
    {
      "id": 1, "domain": 1, "domainName": "...", "topic": "...",
      "question": "...",
      "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
      "answer": "A",
      "rationale": "...",
      "optionRationales": { "A": "...", "B": "...", "C": "...", "D": "..." }
    }
  ]
}
```

**Connection check:** pings `/api/tags` every 30 seconds to detect Ollama status; disables inputs and shows an offline indicator when not reachable.

---

## 1. Question Generator Agent

**Purpose:** Generates multiple-choice exam questions for a given certification domain using the Claude API.

**Inputs:**
- Certification name and exam code
- Domain number, name, and weight
- Number of questions to generate
- Optional: existing study content to ground questions

**Outputs:**
- Questions in the app's flat schema format, merged into `data/exams/<slug>.json`

**Behavior:**
- Generates questions with `optionRationales` (per-option A–D explanations)
- Re-numbers IDs sequentially to avoid collisions with existing questions
- Registers the domain in the exam metadata if not already present

**Trigger:** `node scripts/generate-questions.js`

**Model:** `claude-sonnet-4-6` (default); override via `LLM_MODEL` env var. Current options:
- `claude-opus-4-7` — highest quality, slower
- `claude-sonnet-4-6` — balanced (recommended default)
- `claude-haiku-4-5-20251001` — fastest, lowest cost

---

## 2. Content Curator Agent

**Purpose:** Processes uploaded or fetched study material (Markdown) and stores it as domain-organized study notes under `data/exams/<exam-slug>/domains/<domain-slug>/`.

**Inputs:**
- Raw content (file path)
- Target exam slug and domain slug

**Outputs:**
- A `content.md` file in the correct domain folder
- Does not overwrite existing files; creates versioned copies (`content-v2.md`, etc.)

**Trigger:** `node scripts/import-content.js`

---

## 3. Reference Linker Agent

**Purpose:** Enriches answer explanations with authoritative reference links.

**Inputs:**
- A question object (or batch) with an explanation
- The certification vendor (e.g., AWS, Microsoft, CompTIA)

**Outputs:**
- The same question objects with a populated `references` array: `[{ title, url }]`

**Behavior:**
- Never fabricates URLs; marks unresolved references as `{ title: "...", url: null, note: "manual verification required" }`

**Trigger:** `node scripts/generate-questions.js --enrich-refs`

---

## 4. Exam Validator Agent

**Purpose:** Reviews a flat exam JSON file for correctness and schema compliance.

**Inputs:**
- Path to an exam `.json` file (e.g., `data/exams/sc-300.json`)

**Outputs:**
- Validation report to stdout and saved as `<filename>-validation-report.json`
- Non-zero exit code on failure (suitable for CI)

**Checks performed:**
- Top-level `exam` object with required fields
- Each question has `id`, `question`, `options` (A–D), and `answer`
- Answer key matches an existing option
- No duplicate IDs or question text
- Warns on missing `domain`, `domainName`, `rationale`/`optionRationales`

**Trigger:** `node scripts/validate-exam.js <path>`

---

## 5. Adaptive Difficulty Agent *(future)*

**Purpose:** Tracks learner performance across sessions and adjusts the difficulty mix of subsequent question sets.

**Inputs:**
- Learner session history (localStorage or backend)
- Target exam and domain

**Outputs:**
- Weighted question pool configuration (questions per difficulty tier)

**Behavior:**
- Increases harder questions when a learner scores above 80% consistently
- Surfaces weak-domain questions more frequently
- Recommends content sections to review based on wrong answers

**Trigger:** Automatically at session start when adaptive mode is enabled

---

## Agent Communication Protocol

All Claude API agents communicate via structured JSON messages:

```json
{
  "agentId": "question-generator",
  "version": "1.0",
  "exam": "aws-saa-c03",
  "domain": "security",
  "payload": {},
  "metadata": {
    "model": "claude-sonnet-4-6",
    "timestamp": "2026-05-03T00:00:00Z",
    "requestedBy": "cli"
  }
}
```

Agents read from and write to `data/exams/`.

---

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `ANTHROPIC_API_KEY` | Claude API key for CLI scripts | *(required for scripts)* |
| `LLM_MODEL` | Model ID for question generation | `claude-sonnet-4-6` |

The Ollama-based local AI in the vanilla app requires no environment variables — it auto-detects Ollama at `http://localhost:11434`.

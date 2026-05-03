# Agents

AI agents in Cert Study span two paths: the **built-in local assistant** (implemented in `ai.js`, powered by Ollama) and the **Claude API agents** (implemented in `src/services/llm/` and `scripts/`, requiring an Anthropic API key).

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
- Certification name (e.g., `AWS Solutions Architect – Associate`)
- Domain name and weight (e.g., `Domain 2: Security – 30%`)
- Number of questions to generate
- Question style: `single-answer`, `multi-answer`, or `scenario-chain`
- Optional: existing study content (Markdown, PDF excerpt, or URL) to ground questions

**Outputs:**
- A JSON array of question objects conforming to `data/schemas/question-schema.json`
- Each question includes: stem, answer choices, correct answer(s), explanation, and reference links

**Behavior:**
- Produces a mix of difficulty levels (foundational, associate, professional)
- For `scenario-chain` style, generates a shared scenario paragraph followed by 2–5 related questions that build on each other (mimicking Microsoft exam format)
- Validates output against the question schema before returning

**Trigger:** `scripts/generate-questions.js`, the Admin UI upload panel, or API call from the React app

**Model:** `claude-sonnet-4-6` (default); override via `VITE_LLM_MODEL` env var. Current model options:
- `claude-opus-4-7` — highest quality, slower
- `claude-sonnet-4-6` — balanced (recommended default)
- `claude-haiku-4-5-20251001` — fastest, lowest cost

---

## 2. Content Curator Agent

**Purpose:** Processes uploaded or fetched study material (Markdown, PDFs, web pages) and structures it into domain-organized study notes stored under `data/exams/<exam-slug>/domains/<domain-slug>/`.

**Inputs:**
- Raw content (file upload, URL, or pasted text)
- Target exam and domain metadata

**Outputs:**
- A `content.md` file placed in the correct domain folder
- Optionally, a `diagrams/` subfolder with extracted or referenced images
- An updated `exam.json` manifest reflecting the new domain content

**Behavior:**
- Strips irrelevant content (navigation menus, footers, ads)
- Preserves code blocks, tables, and diagrams
- Generates a short summary paragraph prepended to the output file
- Does not overwrite existing files; creates versioned copies (`content-v2.md`, etc.)

**Trigger:** Admin UI "Upload Content" panel or `scripts/import-content.js`

---

## 3. Reference Linker Agent

**Purpose:** Enriches answer explanations with authoritative reference links so learners can verify claims and dig deeper.

**Inputs:**
- A question object (or batch) that already has an explanation
- The certification vendor (e.g., AWS, Microsoft, CompTIA, Google Cloud)

**Outputs:**
- The same question objects with a populated `references` array: `[{ title, url }]`

**Behavior:**
- Queries curated documentation base URLs per vendor (`src/services/llm/referenceMap.js`)
- Falls back to a general search prompt when a specific link can't be resolved
- Never fabricates URLs; marks unresolved references as `{ title: "...", url: null, note: "manual verification required" }`

**Trigger:** Runs automatically after Question Generator, or standalone via `scripts/generate-questions.js --enrich-refs`

---

## 4. Exam Validator Agent

**Purpose:** Reviews a completed exam JSON file for correctness, completeness, and schema compliance before it is made available to learners.

**Inputs:**
- Path to an `exam.json` or `questions.json` file

**Outputs:**
- A validation report (stdout or `validation-report.json`)
- Pass/fail exit code

**Checks performed:**
- Schema validation against `data/schemas/question-schema.json`
- Each question has at least 2 answer choices; multi-answer questions have ≥ 2 correct answers
- No duplicate question stems
- All `references` entries with a `url` return HTTP 2xx
- Scenario-chain questions have consistent `scenarioId` grouping

**Trigger:** `scripts/validate-exam.js <path>` or CI pipeline

---

## 5. Adaptive Difficulty Agent *(future)*

**Purpose:** Tracks learner performance across sessions and adjusts the difficulty mix of subsequent question sets.

**Inputs:**
- Learner session history (localStorage or backend)
- Target exam and domain

**Outputs:**
- Weighted question pool configuration (how many questions per difficulty tier)

**Behavior:**
- Increases harder questions when a learner consistently scores above 80% on a domain
- Surfaces weak-domain questions more frequently
- Recommends specific content sections to review based on wrong answers

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
    "requestedBy": "admin-ui"
  }
}
```

Agents read from and write to `data/exams/`. Orchestration is handled by `src/services/llm/agentOrchestrator.js`.

---

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `ANTHROPIC_API_KEY` | Claude API key (scripts) | *(required for CLI scripts)* |
| `VITE_ANTHROPIC_API_KEY` | Claude API key (React app) | *(required for React app)* |
| `VITE_LLM_MODEL` | Model ID for question generation | `claude-sonnet-4-6` |
| `VITE_LLM_BASE_URL` | Override base URL (proxies / alternative providers) | Anthropic default |
| `VITE_ENABLE_ADAPTIVE` | Enable Adaptive Difficulty Agent | `false` |
| `VITE_DEFAULT_EXAM_MODE` | Default feedback mode (`immediate`, `end`) | `end` |

The Ollama-based local AI in the vanilla app requires no environment variables — it auto-detects Ollama at `http://localhost:11434`.

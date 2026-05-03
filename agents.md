# Agents

This document describes the AI agents used in the Cert-Study application. Each agent has a specific role in generating, validating, and enhancing study content for certification exams.

---

## 1. Question Generator Agent

**Purpose:** Generates multiple-choice exam questions for a given certification domain using an LLM (Claude or compatible model).

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

**Trigger:** Manual via `scripts/generate-questions.js`, via the Admin UI upload panel, or via API call from the app

**Model:** Claude (`claude-3-5-sonnet` by default; configurable via `VITE_LLM_MODEL` env var)

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
- A question object (or batch of objects) that already has an explanation text
- The certification vendor (e.g., AWS, Microsoft, CompTIA, Google Cloud)

**Outputs:**
- The same question objects with a populated `references` array containing `{ title, url }` objects pointing to official documentation or whitepapers

**Behavior:**
- Queries a curated list of documentation base URLs per vendor (see `src/services/llm/referenceMap.js`)
- Falls back to a general web search prompt when a specific link cannot be resolved
- Never fabricates URLs; marks unresolved references as `{ title: "...", url: null, note: "manual verification required" }`

**Trigger:** Runs automatically after the Question Generator Agent produces output, or can be run independently via `scripts/generate-questions.js --enrich-refs`

---

## 4. Exam Validator Agent

**Purpose:** Reviews a completed exam JSON file for correctness, completeness, and schema compliance before it is made available to learners.

**Inputs:**
- Path to an `exam.json` or `questions.json` file

**Outputs:**
- A validation report (stdout or saved as `validation-report.json`)
- A pass/fail status

**Checks performed:**
- Schema validation against `data/schemas/question-schema.json`
- Each question has at least 2 answer choices; multiple-answer questions have at least 2 correct answers marked
- No duplicate question stems
- All `references` entries that have a `url` field return HTTP 2xx (lightweight link check)
- Scenario-chain questions have consistent `scenarioId` grouping

**Trigger:** `scripts/validate-exam.js <path-to-exam-or-questions-file>` or CI pipeline

---

## 5. Adaptive Difficulty Agent *(future)*

**Purpose:** Tracks learner performance across practice sessions and adjusts the difficulty mix of subsequent question sets.

**Inputs:**
- Learner session history (stored in `localStorage` or a backend)
- Target exam and domain

**Outputs:**
- A weighted question pool configuration indicating how many questions to draw from each difficulty tier

**Behavior:**
- Increases proportion of harder questions when a learner consistently scores above 80% on a domain
- Surfaces weak-domain questions more frequently
- Can recommend specific content sections to review based on wrong answers

**Trigger:** Automatically at the start of each practice session (when adaptive mode is enabled in settings)

---

## Agent Communication Protocol

All agents communicate via structured JSON messages. The shared message envelope is:

```json
{
  "agentId": "question-generator",
  "version": "1.0",
  "exam": "aws-saa-c03",
  "domain": "security",
  "payload": { },
  "metadata": {
    "model": "claude-3-5-sonnet-20241022",
    "timestamp": "2026-05-01T00:00:00Z",
    "requestedBy": "admin-ui"
  }
}
```

Agents read from and write to the `data/exams/` directory tree by convention. Inter-agent orchestration is handled by `src/services/llm/agentOrchestrator.js`.

---

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `VITE_ANTHROPIC_API_KEY` | API key for Claude (Anthropic) | *(required)* |
| `VITE_LLM_MODEL` | LLM model identifier | `claude-3-5-sonnet-20241022` |
| `VITE_LLM_BASE_URL` | Override base URL (for proxies or alternative providers) | Anthropic default |
| `VITE_ENABLE_ADAPTIVE` | Enable Adaptive Difficulty Agent | `false` |
| `VITE_DEFAULT_EXAM_MODE` | Default exam feedback mode (`immediate`, `end`) | `end` |

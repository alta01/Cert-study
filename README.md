# Cert Study

> Open-source study hub — any subject, any exam. Load a JSON file and start studying immediately. No account, no cloud, no build step required.

---

## Quick Start (zero setup)

Open `index.html` directly in any browser. That's it.

Exams listed in `manifest.json` load automatically. You can also click **+ Load exam file** on the home screen to load any conforming `.json` file from disk.

The SC-300 (Microsoft Identity and Access Administrator) exam is included and auto-loads on first open.

---

## Features

- **Any subject** — Microsoft certs, AWS, CompTIA, ASVAB, history, premed: if you can write a JSON file, it works
- **Domain filtering** — pick which topic areas to include per session
- **Randomized order** — optional shuffle of the question pool
- **Per-option explanations** — after each answer, see why each choice is right or wrong (`optionRationales`)
- **Retry wrong answers** — end-of-session button replays only the questions you missed
- **Score ring + domain breakdown** — animated results screen with per-domain pass/fail bars
- **Local AI assistant** — conversational chat and exam generation via [Ollama](https://ollama.com) (fully offline, no API key)
- **AI exam generator** — paste any study material; the AI outputs a ready-to-load exam JSON

---

## Project Structure

```
Cert-study/
├── index.html              # Vanilla app — open directly in a browser
├── app.js                  # Quiz engine (state, rendering, navigation)
├── ai.js                   # Ollama AI panel (chat + exam generation)
├── style.css               # App styles
├── manifest.json           # Auto-loaded exam registry
│
├── sc-300.json             # SC-300 exam (120 questions, 4 domains)
│
├── data/
│   ├── exams/
│   │   ├── index.json      # Exam index (React app)
│   │   └── aws-saa-c03/    # AWS SAA-C03 exam data (React app format)
│   └── schemas/
│       ├── exam-schema.json
│       └── question-schema.json
│
├── scripts/
│   ├── generate-questions.js   # CLI: generate questions via Claude API
│   ├── import-content.js       # CLI: import Markdown study notes
│   └── validate-exam.js        # CLI: validate a questions.json file
│
├── public/
│   └── assets/
│       ├── images/             # Exam logos and static images
│       └── diagrams/           # Architecture diagrams
│
├── src/                    # React + Vite scaffold (alternative path)
│   └── ...
│
├── agents.md               # AI agent specifications
├── .env.example            # Environment variables for Claude API / scripts
├── package.json            # Dependencies for React app + CLI scripts
└── vite.config.js          # Vite config for React app
```

---

## Exam JSON Format (vanilla app)

Create a single `.json` file. Add its path to `manifest.json` to auto-load it, or load it manually via the file picker.

```json
{
  "exam": {
    "code": "MY-001",
    "name": "My Subject",
    "passingScore": 700,
    "maxScore": 1000,
    "domains": [
      { "number": 1, "name": "Topic Area One", "weight": "50%", "topics": ["sub-topic"] }
    ]
  },
  "questions": [
    {
      "id": 1,
      "domain": 1,
      "domainName": "Topic Area One",
      "topic": "specific sub-topic",
      "question": "Question text here?",
      "options": { "A": "First option", "B": "Second option", "C": "Third option", "D": "Fourth option" },
      "answer": "B",
      "rationale": "B is correct because…",
      "optionRationales": {
        "A": "Why A is wrong.",
        "B": "Why B is correct.",
        "C": "Why C is wrong.",
        "D": "Why D is wrong."
      }
    }
  ]
}
```

`optionRationales` is optional — if absent the app falls back to `rationale`.

### Register an exam for auto-loading

Add an entry to `manifest.json`:

```json
{
  "version": "1",
  "exams": [
    { "id": "my-001", "file": "my-exam.json", "title": "My Subject", "category": "Custom" }
  ]
}
```

---

## AI Assistant (Ollama — local, no API key)

The built-in AI panel uses [Ollama](https://ollama.com) running on your machine. No data leaves your device.

### Setup

```bash
# Install Ollama (mac / linux)
curl -fsSL https://ollama.com/install.sh | sh

# Pull a model — any instruction-tuned model works
ollama pull llama3.2       # fast, good quality
ollama pull mistral        # alternative
ollama pull phi4           # lightweight

# Start Ollama (if not already running as a service)
ollama serve
```

Open `index.html`, click **AI Assistant** in the header. The status dot turns green when Ollama is detected.

- **Chat tab** — ask anything about your exam material
- **Generate Exam tab** — paste study notes → AI outputs a complete exam JSON → load it directly into the app or download it

---

## CLI Scripts (require Node.js + Claude API key)

The scripts use the Anthropic Claude API to generate and validate content in the `data/exams/` directory structure.

```bash
npm install
cp .env.example .env
# Edit .env: set ANTHROPIC_API_KEY=sk-ant-...
```

### Generate questions

```bash
node scripts/generate-questions.js \
  --exam aws-saa-c03 \
  --domain domain-1-design-secure-architectures \
  --domain-title "Domain 1: Design Secure Architectures" \
  --count 20
```

### Import study content

```bash
node scripts/import-content.js \
  --exam aws-saa-c03 \
  --domain domain-2-design-resilient-architectures \
  --file ~/my-notes.md
```

### Validate a question file

```bash
node scripts/validate-exam.js \
  data/exams/aws-saa-c03/domains/domain-1-design-secure-architectures/questions.json
```

---

## React + Vite App (alternative path)

A full React application scaffold lives in `src/`. It uses the `data/exams/<slug>/domains/<domain>/questions.json` directory structure instead of single flat JSON files.

```bash
npm install
cp .env.example .env   # add VITE_ANTHROPIC_API_KEY
npm run dev            # http://localhost:5173
```

See `data/schemas/` for the question schema used by the React app and CLI scripts.

---

## Mobile (iOS / Android)

The React app supports native builds via [Capacitor](https://capacitorjs.com/).

```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
npm run build
npx cap add ios
npx cap add android
npx cap open ios       # opens Xcode
npx cap open android   # opens Android Studio
```

---

## AI Agents

See [agents.md](./agents.md) for specifications of the AI agents used to generate, enrich, and validate exam content.

---

## Contributing

Drop a JSON exam file in a PR. Any subject welcome — certs, academic, professional licensing, military prep, anything.

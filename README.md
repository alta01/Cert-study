# Cert Study

> Open-source study hub — any subject, any exam. Open `index.html` in a browser and start studying. No build step, no account, no cloud required.

---

## Quick Start

```bash
npm run serve   # starts python3 -m http.server 3000
```

Then open `http://localhost:3000` in your browser.

> **Why a server?** The app fetches `manifest.json` and exam files via `fetch()`, which browsers block on `file://` URLs. The dev server takes care of this. Node.js 18+ is required only for the CLI scripts — the server itself just uses Python 3.

Exams in `manifest.json` load automatically. The SC-300 and AWS SAA-C03 exams are included out of the box. You can also click **+ Load exam file** on the home screen to load any conforming `.json` file from disk.

---

## iPhone / Mobile (PWA)

The app is a Progressive Web App — install it to your iPhone home screen for a native-like offline experience. No App Store required.

1. Open the app URL in **Safari** (must be Safari, not Chrome, for iOS home screen install)
2. Tap the **Share** button (box with arrow pointing up)
3. Scroll down and tap **Add to Home Screen**
4. Name it "Cert Study" and tap **Add**

The app icon appears on your home screen. All exams and static assets are cached offline — you can study with no internet connection. The AI assistant requires a connection to a local Ollama instance, but the quiz engine works fully offline.

### Hosting options

Pick one based on how you want to reach the app from your phone:

1. **GitHub Pages (recommended).** Push to `main` — the `.github/workflows/deploy-pages.yml` workflow publishes the site to `https://<your-gh-user>.github.io/<repo>/`. Open that URL in Safari and Add to Home Screen. The AI tutor is automatically hidden behind a "Run locally to use this" message on hosted builds (it can't reach localhost from your phone).<br>**Heads up — the path is case-sensitive.** If your repo is `Cert-study`, the URL is `https://<your-gh-user>.github.io/Cert-study/` (capital C); `/cert-study/` will 404. Rename the repo to lowercase if you prefer a tidier URL.
2. **Self-host on your LAN.** Run `docker compose up` on your laptop and visit `http://<your-laptop-ip>:8080` in Safari on your iPhone while on the same Wi-Fi. The AI tutor works because both devices share the LAN. Set `OLLAMA_BASE` if Ollama runs on a different host.
3. **Self-host on a VPS.** Deploy the Docker image to any VPS, point a domain at it, add TLS. AI tutor needs a reachable Ollama instance (run it on the same VPS or expose it via WireGuard).

---

## Docker

```bash
# Build and start the app + Ollama together
docker compose up --build

# App runs at http://localhost:8080
# Ollama API at http://localhost:11434
```

Pull a model into the running Ollama container:

```bash
docker compose exec ollama ollama pull gemma4:4b
```

To point at an Ollama instance running elsewhere, set `OLLAMA_BASE`:

```bash
OLLAMA_BASE=http://192.168.1.50:11434 docker compose up --build
```

To enable optional Google sign-in + cross-device sync, set `SUPABASE_URL` and `SUPABASE_ANON_KEY` (e.g. in a `.env` file — see `.env.example`). Leave them unset to run in anonymous mode. See [Accounts & Cross-Device Sync](#accounts--cross-device-sync-supabase--optional) below.

---

## Kubernetes

All manifests are in `k8s/`. Apply in order:

```bash
# 1. Persistent storage for Ollama models
kubectl apply -f k8s/ollama-pvc.yaml

# 2. Ollama service
kubectl apply -f k8s/ollama-deployment.yaml
kubectl apply -f k8s/ollama-service.yaml

# 3. Cert Study app (points to the ollama service by default)
kubectl apply -f k8s/cert-study-deployment.yaml
kubectl apply -f k8s/cert-study-service.yaml

# 4. Optional: Ingress (edit host in k8s/ingress.yaml first)
kubectl apply -f k8s/ingress.yaml
```

Pull a model after Ollama is running:

```bash
kubectl exec -it deploy/ollama -- ollama pull gemma4:4b
```

To use a different Ollama URL, edit the `OLLAMA_BASE` env var in `k8s/cert-study-deployment.yaml`. The entrypoint patches both `ai.js` and the CSP header at startup — no image rebuild needed.

For GPU support, uncomment the `nvidia.com/gpu` resource limit in `k8s/ollama-deployment.yaml`.

For optional Google sign-in + cross-device sync, create the `cert-study-supabase` secret (commented example in `k8s/cert-study-deployment.yaml`) with your Supabase URL and anon key. Omit the secret to run in anonymous mode. See [Accounts & Cross-Device Sync](#accounts--cross-device-sync-supabase--optional) below.

---

## Features

- **Any subject** — Microsoft certs, AWS, CompTIA, ASVAB, history, premed: if you can write a JSON file, it works
- **Domain filtering** — pick which topic areas to include per session
- **Randomized order** — optional shuffle of the question pool
- **Per-option explanations** — after each answer, see why each choice is right or wrong
- **Retry wrong answers** — end-of-session button replays only the questions you missed
- **Score ring + domain breakdown** — animated results screen with per-domain pass/fail bars
- **Local AI assistant** — conversational chat and exam generation via [Ollama](https://ollama.com) (fully offline, no API key)
- **AI exam generator** — paste any study material; the AI outputs a ready-to-load exam JSON
- **Google sign-in + cross-device sync** — optional, via [Supabase](https://supabase.com); resumes in-progress sessions and syncs attempt history across devices
- **Progress dashboard** — score trend, per-domain mastery, and weakest-domain "Focus areas" aggregated across all your attempts
- **Anonymous by default** — with no Supabase configured, everything above still works fully offline via localStorage; accounts are opt-in

---

## Project Structure

```
Cert-study/
├── index.html              # App entry point — open directly in a browser
├── app.js                  # Quiz engine (state, rendering, navigation)
├── ai.js                   # Ollama AI panel (chat + exam generation)
├── auth.js                 # Supabase wrapper — Google sign-in, session/attempt sync
├── config.example.js       # Template for config.js (Supabase + Ollama runtime config)
├── style.css               # App styles
├── manifest.json           # Auto-loaded exam registry
│
├── data/
│   ├── exams/
│   │   ├── sc-300.json             # SC-300: Microsoft Identity & Access Admin (120 questions)
│   │   ├── aws-saa-c03.json        # AWS SAA-C03: Solutions Architect – Associate
│   │   └── aws-saa-c03/            # Study notes and source material (Markdown)
│   └── schemas/
│       ├── exam-schema.json        # JSON Schema for exam metadata
│       └── question-schema.json    # JSON Schema for questions
│
├── scripts/
│   ├── sync-manifest.js        # CLI: auto-update manifest.json from data/exams/
│   ├── generate-questions.js   # CLI: generate questions via Claude API
│   ├── import-content.js       # CLI: import Markdown study notes
│   └── validate-exam.js        # CLI: validate an exam JSON file
│
├── supabase/
│   └── schema.sql          # DB schema (quiz_sessions, quiz_attempts) + Row-Level Security
│
├── public/
│   ├── assets/
│   │   ├── images/             # Exam logos and static images
│   │   └── diagrams/           # Architecture diagrams
│   └── vendor/
│       └── supabase.js         # Vendored supabase-js v2 UMD build (no CDN dependency)
│
├── agents.md               # AI agent specifications
└── .env.example            # Environment variables for CLI scripts + Supabase
```

---

## Exam JSON Format

Create a single `.json` file anywhere in the project. Add its path to `manifest.json` to auto-load it, or load it manually via the file picker.

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

`optionRationales` is optional — the app falls back to `rationale` if absent. Use `\n` in the `question` field to separate a scenario preamble from the question stem.

### Register an exam for auto-loading

Add an entry to `manifest.json`:

```json
{
  "version": "1",
  "exams": [
    { "id": "my-001", "file": "data/exams/my-exam.json", "title": "My Subject", "category": "Custom" }
  ]
}
```

---

## AI Assistant (Ollama — local, no API key)

The built-in AI panel uses [Ollama](https://ollama.com) on your machine. No data leaves your device.

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull a model
ollama pull llama3.2    # fast, good quality
ollama pull mistral     # good alternative

# Start Ollama (if not running as a service)
ollama serve
```

Open `index.html`, click **AI Assistant** in the header. The status dot turns green when Ollama is detected.

- **Chat tab** — ask anything about your exam material
- **Generate Exam tab** — paste study notes → AI outputs a complete exam JSON → load it directly into the app or download it

---

## Accounts & Cross-Device Sync (Supabase — optional)

By default the app runs entirely **anonymously**, storing sessions and history in `localStorage` on that one device — no setup, no account, nothing to configure. If you want to sign in with Google and sync progress across devices, wire up a free [Supabase](https://supabase.com) project:

1. **Create a free Supabase project** at [supabase.com](https://supabase.com).
2. **Run the schema** — open the Supabase SQL Editor and run the contents of [`supabase/schema.sql`](./supabase/schema.sql). This creates the `quiz_sessions` and `quiz_attempts` tables with Row-Level Security so each user can only ever read/write their own rows.
3. **Enable the Google provider** — in Supabase, go to Authentication → Providers → Google. Create a Google Cloud OAuth 2.0 Client ID + secret, paste them into Supabase, and add Supabase's callback URL to the Google console's authorized redirect URIs. Also add your app's URL under Supabase → Authentication → URL Configuration (Site URL / Redirect URLs).
4. **Configure the app**, depending on how you run it:
   - **Local dev (no Docker):**
     ```bash
     cp config.example.js config.js
     # Edit config.js: set SUPABASE_URL and SUPABASE_ANON_KEY
     ```
     Both values come from Supabase → Project Settings → API. `config.js` is gitignored.
   - **Docker / Kubernetes:** set the `SUPABASE_URL` and `SUPABASE_ANON_KEY` environment variables — `docker-entrypoint.sh` generates `config.js` automatically at container start. For `docker compose`, put them in a `.env` file (see `.env.example`). For k8s, create the `cert-study-supabase` secret (see the commented example in `k8s/cert-study-deployment.yaml`).

The Supabase anon key is safe to ship to the browser — Row-Level Security, not the key, is the security boundary. Leaving `SUPABASE_URL` / `SUPABASE_ANON_KEY` blank (the default) silently disables sync and the app behaves exactly as before.

**What you get once configured:**

- A **Sign in with Google** control in the header
- In-progress sessions (resume where you left off) and completed-attempt history synced across every device you sign into
- A **Progress** screen (header button) showing score trend across attempts, per-domain mastery aggregated over all attempts, and a "Focus areas" list of your weakest domains (below 70%)
- Your local anonymous history merges up into your account automatically the first time you sign in

---

## npm Scripts

| Command | What it does |
|---|---|
| `npm run serve` | Start a local HTTP server at `http://localhost:3000` (Python 3 required) |
| `npm run sync` | Scan `data/exams/` and auto-update `manifest.json` |
| `npm run generate` | Generate questions via Claude API (see below) |
| `npm run import` | Import Markdown study notes |
| `npm run validate` | Validate an exam JSON file |

---

## Syncing the Manifest

When you add or remove exam files in `data/exams/`, run:

```bash
npm run sync
```

This scans `data/exams/` for valid exam JSON files and rewrites `manifest.json`, preserving any `category` fields you've set manually. The app auto-loads everything in `manifest.json` on startup.

---

## CLI Scripts (require Node.js + Anthropic API key)

```bash
cp .env.example .env
# Edit .env: set ANTHROPIC_API_KEY=sk-ant-...
```

### Generate questions

```bash
node scripts/generate-questions.js \
  --exam "AWS SAA-C03" \
  --code SAA-C03 \
  --slug aws-saa-c03 \
  --domain 2 \
  --domain-name "Design Resilient Architectures" \
  --domain-weight "26%" \
  --count 15
```

Output is merged into `data/exams/<slug>.json`, preserving existing questions.

### Import study content (Markdown)

```bash
node scripts/import-content.js \
  --exam aws-saa-c03 \
  --domain domain-2-design-resilient-architectures \
  --file ~/my-notes.md
```

Study notes are stored in `data/exams/<slug>/domains/<domain>/content.md`.

### Validate an exam file

```bash
node scripts/validate-exam.js data/exams/aws-saa-c03.json
node scripts/validate-exam.js data/exams/sc-300.json
```

---

## Adding a New Exam

1. Create `data/exams/<slug>.json` following the schema above
2. Register it in `manifest.json`
3. Optionally run `node scripts/validate-exam.js data/exams/<slug>.json` to check for issues

Or use the AI assistant's Generate Exam tab to create one from pasted study material.

---

## AI Agents

See [agents.md](./agents.md) for specifications of the AI agents used to generate, enrich, and validate exam content.

---

## Contributing

Drop a JSON exam file in a PR. Any subject welcome — certs, academic, professional licensing, military prep, anything.

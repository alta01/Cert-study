# Cert Study

> Open-source certification study app with LLM-generated questions, scenario-based exams, and adaptive learning. Designed as a web app (React + Vite) that can be shipped as an iOS or Android app via Capacitor.

---

## Features

- **Multiple exam support** – add any certification under `data/exams/<exam-slug>/`
- **Multiple-choice questions** – single-answer, multi-answer ("select all that apply"), and Microsoft-style scenario-chain questions
- **Exam settings** – choose feedback mode before starting: show answers immediately after each question, or hold all feedback until the end
- **Reference links** – every answer explanation links to official documentation
- **Study Mode** – browse domain-organized Markdown study notes with diagrams
- **LLM integration** – generate questions with Claude via the Admin panel or CLI scripts
- **JSON import** – upload `questions.json` files conforming to the schema
- **Validation** – built-in Exam Validator Agent checks schema compliance and quality

---

## Project Structure

```
Cert-study/
├── agents.md                        # AI agent specifications
├── capacitor.config.json            # iOS / Android (Capacitor) config
├── index.html                       # Vite entry point
├── package.json
├── vite.config.js
├── .env.example                     # Copy to .env and add your API key
│
├── data/
│   ├── exams/
│   │   ├── index.json               # List of available exams shown on Home page
│   │   └── <exam-slug>/
│   │       ├── exam.json            # Exam manifest (domains, passing score, etc.)
│   │       └── domains/
│   │           └── <domain-slug>/
│   │               ├── content.md   # Study notes (Markdown)
│   │               └── questions.json
│   └── schemas/
│       ├── exam-schema.json         # JSON Schema for exam.json
│       └── question-schema.json     # JSON Schema for questions
│
├── scripts/
│   ├── generate-questions.js        # CLI: generate questions with Claude
│   ├── import-content.js            # CLI: import Markdown from file or URL
│   └── validate-exam.js             # CLI: validate a questions.json file
│
├── public/
│   └── assets/
│       ├── images/                  # Exam logos and static images
│       └── diagrams/                # Architecture diagrams
│
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── context/
    │   └── ExamContext.jsx          # Global exam session state (useReducer)
    ├── components/
    │   ├── Layout/                  # App shell + nav bar
    │   ├── ExamSelector/            # Home page exam cards
    │   ├── ExamSettings/            # Pre-exam feedback mode modal
    │   ├── Question/                # Question + MultipleChoice renderer
    │   ├── Results/                 # End-of-exam review with scores + refs
    │   └── ContentUpload/           # Admin: JSON upload / paste / AI generate
    ├── pages/
    │   ├── Home.jsx
    │   ├── ExamPage.jsx             # Active exam session
    │   ├── StudyMode.jsx            # Domain content browser
    │   └── Admin.jsx
    ├── services/
    │   ├── llm/
    │   │   ├── llmService.js        # Anthropic API wrapper
    │   │   ├── referenceMap.js      # Vendor → docs URL map
    │   │   ├── referenceLinkAgent.js
    │   │   ├── validatorAgent.js
    │   │   └── agentOrchestrator.js
    │   ├── questions/
    │   │   └── questionService.js   # Load exam / domain data
    │   └── storage/
    │       └── storageService.js    # localStorage session persistence
    ├── hooks/
    │   ├── useExam.js
    │   └── useQuestions.js
    ├── utils/
    │   ├── questionParser.js        # Normalize raw question objects
    │   └── scoreCalculator.js
    └── styles/
        └── index.css
```

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env and add your VITE_ANTHROPIC_API_KEY

# 3. Start development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Adding a New Exam

1. Create a folder: `data/exams/<exam-slug>/`
2. Add `exam.json` (see `data/schemas/exam-schema.json` for the schema)
3. Add domain sub-folders with `content.md` and `questions.json`
4. Add the exam to `data/exams/index.json`

### Generate questions with Claude

```bash
ANTHROPIC_API_KEY=sk-... node scripts/generate-questions.js \
  --exam aws-saa-c03 \
  --domain domain-1-design-secure-architectures \
  --domain-title "Domain 1: Design Secure Architectures" \
  --count 20 \
  --style scenario-chain
```

### Import study content from a file or URL

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

## Mobile (iOS / Android)

This app uses [Capacitor](https://capacitorjs.com/) for native builds.

```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
npm run build
npx cap add ios
npx cap add android
npx cap open ios      # opens Xcode
npx cap open android  # opens Android Studio
```

---

## AI Agents

See [agents.md](./agents.md) for a full description of the AI agents used to generate and enrich content.

---

## Question JSON Schema

Questions must conform to `data/schemas/question-schema.json`. Example:

```json
{
  "id": "saa-d1-001",
  "stem": "Which S3 encryption option lets you restrict decryption to specific IAM roles?",
  "multiAnswer": false,
  "choices": [
    { "id": "A", "text": "SSE-S3" },
    { "id": "B", "text": "SSE-KMS with a customer-managed CMK" },
    { "id": "C", "text": "SSE-C" },
    { "id": "D", "text": "Client-side encryption" }
  ],
  "correctAnswers": ["B"],
  "explanation": "SSE-KMS with a CMK lets you define key policies restricting kms:Decrypt to specific IAM roles.",
  "references": [
    {
      "title": "SSE-KMS – AWS S3 User Guide",
      "url": "https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingKMSEncryption.html"
    }
  ],
  "domain": "Domain 1: Design Secure Architectures",
  "difficulty": "associate"
}
```

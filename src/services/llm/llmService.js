/**
 * llmService.js
 *
 * Thin wrapper around the Anthropic SDK (or a compatible API) for
 * generating exam questions.
 *
 * Environment variables (set in .env):
 *   VITE_ANTHROPIC_API_KEY – Anthropic API key
 *   VITE_LLM_MODEL         – model to use (default: claude-3-5-sonnet-20241022)
 *   VITE_LLM_BASE_URL      – optional base URL override
 */

const MODEL = import.meta.env.VITE_LLM_MODEL ?? 'claude-3-5-sonnet-20241022';
const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY ?? '';

/**
 * Builds the system prompt for the Question Generator Agent.
 */
function buildSystemPrompt() {
  return `You are an expert certification exam question writer. You produce
high-quality, scenario-based multiple-choice questions that closely mirror the
style of real vendor certification exams (AWS, Microsoft, CompTIA, Google Cloud,
etc.). Every question you produce must be accurate, unambiguous, and include a
concise explanation and at least one authoritative reference link.`;
}

/**
 * Builds the user prompt for a given generation request.
 * @param {object} params
 * @param {string} params.examName
 * @param {string} params.domain
 * @param {number} params.count
 * @param {'single-answer'|'multi-answer'|'scenario-chain'} params.style
 */
function buildUserPrompt({ examName, domain, count, style }) {
  const styleDesc =
    style === 'multi-answer'
      ? 'multiple-answer (select all that apply, with 2+ correct answers)'
      : style === 'scenario-chain'
      ? 'scenario-chain (one shared scenario paragraph followed by 3 related questions that build on each other)'
      : 'single-answer multiple choice';

  return `Generate ${count} ${styleDesc} questions for the "${examName}" exam, specifically
covering "${domain}". Return ONLY a valid JSON array with no markdown fences.
Each object must follow this schema:
{
  "id": "<unique-string>",
  "stem": "<question text>",
  "scenario": "<optional shared scenario – only for scenario-chain style>",
  "scenarioId": "<optional – group id for chained questions>",
  "multiAnswer": <true|false>,
  "choices": [{ "id": "A", "text": "…" }, { "id": "B", "text": "…" }, …],
  "correctAnswers": ["<choice id>", …],
  "explanation": "<why the correct answer(s) are right>",
  "references": [{ "title": "<doc title>", "url": "<https://…>" }],
  "domain": "${domain}",
  "difficulty": "foundational|associate|professional"
}`;
}

/**
 * Calls the Anthropic Messages API to generate questions.
 *
 * In a production app you would call this from a server-side function to
 * keep the API key secret. For local development / prototyping the key can
 * be placed in .env (which is git-ignored).
 *
 * @param {object} params – see buildUserPrompt
 * @returns {Promise<object[]>} – parsed array of question objects
 */
export async function generateQuestionsWithLLM(params) {
  if (!API_KEY) {
    throw new Error(
      'VITE_ANTHROPIC_API_KEY is not set. Add it to your .env file.'
    );
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 8192,
      system: buildSystemPrompt(),
      messages: [{ role: 'user', content: buildUserPrompt(params) }],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LLM API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  const raw = data.content?.[0]?.text ?? '[]';

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('LLM returned invalid JSON. Raw response: ' + raw.slice(0, 200));
  }
}

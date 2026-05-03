/**
 * questionParser.js
 *
 * Parses raw question data from various input formats and normalises it
 * into the internal question schema used by the application.
 */

/**
 * Parses a JSON array or object (with a `questions` array) and returns
 * a flat array of validated, normalised question objects.
 *
 * @param {string|object} input – raw JSON string or parsed object
 * @returns {object[]}
 */
export function parseQuestionsFromJSON(input) {
  let data;
  if (typeof input === 'string') {
    data = JSON.parse(input);
  } else {
    data = input;
  }

  const raw = Array.isArray(data) ? data : (data.questions ?? []);
  return raw.map(normalizeQuestion);
}

/**
 * Ensures a question object has all required fields, filling in
 * safe defaults where values are missing.
 *
 * @param {object} q – raw question object
 * @param {number} idx – array index (used to generate fallback id)
 * @returns {object} – normalised question object
 */
export function normalizeQuestion(q, idx = 0) {
  return {
    id: q.id ?? `q-${idx}-${Date.now()}`,
    stem: q.stem ?? q.question ?? '',
    scenario: q.scenario ?? null,
    scenarioId: q.scenarioId ?? null,
    imageUrl: q.imageUrl ?? null,
    multiAnswer: Boolean(q.multiAnswer),
    choices: (q.choices ?? []).map((c, i) =>
      typeof c === 'string'
        ? { id: String.fromCharCode(65 + i), text: c }
        : { id: c.id ?? String.fromCharCode(65 + i), text: c.text ?? c.label ?? '' }
    ),
    correctAnswers: Array.isArray(q.correctAnswers)
      ? q.correctAnswers
      : q.correctAnswer
      ? [q.correctAnswer]
      : [],
    explanation: q.explanation ?? '',
    references: Array.isArray(q.references) ? q.references : [],
    domain: q.domain ?? '',
    difficulty: q.difficulty ?? 'associate',
  };
}

/**
 * validatorAgent.js
 *
 * Exam Validator Agent – validates an array of question objects against
 * the expected schema and business rules.
 *
 * Returns a report object:
 * {
 *   valid: boolean,
 *   errors: string[],
 *   warnings: string[]
 * }
 */

/**
 * @param {object[]} questions
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validateQuestions(questions) {
  const errors = [];
  const warnings = [];
  const seenIds = new Set();
  const seenStems = new Set();

  if (!Array.isArray(questions) || questions.length === 0) {
    errors.push('Question list is empty or not an array.');
    return { valid: false, errors, warnings };
  }

  questions.forEach((q, idx) => {
    const label = `Q${idx + 1} (id: ${q.id ?? 'undefined'})`;

    // Required fields
    if (!q.id) errors.push(`${label}: missing "id"`);
    if (!q.stem) errors.push(`${label}: missing "stem"`);
    if (!Array.isArray(q.choices) || q.choices.length < 2) {
      errors.push(`${label}: must have at least 2 choices`);
    }
    if (!Array.isArray(q.correctAnswers) || q.correctAnswers.length === 0) {
      errors.push(`${label}: missing "correctAnswers"`);
    }

    // Multi-answer must have 2+ correct answers
    if (q.multiAnswer && q.correctAnswers?.length < 2) {
      errors.push(`${label}: multiAnswer questions must have at least 2 correct answers`);
    }

    // Duplicate IDs
    if (q.id && seenIds.has(q.id)) {
      errors.push(`${label}: duplicate id "${q.id}"`);
    } else if (q.id) {
      seenIds.add(q.id);
    }

    // Duplicate stems (warning only)
    if (q.stem && seenStems.has(q.stem)) {
      warnings.push(`${label}: duplicate question stem`);
    } else if (q.stem) {
      seenStems.add(q.stem);
    }

    // References
    if (!q.explanation) warnings.push(`${label}: missing explanation`);
    if (!q.references?.length) warnings.push(`${label}: no references provided`);

    // Scenario chain consistency
    if (q.scenarioId && !q.scenario) {
      warnings.push(`${label}: has scenarioId but no scenario text`);
    }
  });

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * scoreCalculator.js
 *
 * Calculates the exam score from the questions and answers map.
 */

/**
 * @param {object[]} questions  – array of question objects with `correctAnswers`
 * @param {object}   answers    – map of questionId → { selected: string[], submitted: boolean }
 * @returns {{ score: number, total: number, percentage: number, passed: boolean }}
 */
export function calculateScore(questions, answers, passingScore = 72) {
  let score = 0;
  const total = questions.length;

  for (const q of questions) {
    const ans = answers[q.id] ?? { selected: [] };
    const correct = q.correctAnswers ?? [];
    const selected = ans.selected ?? [];

    // Correct only if selected set exactly matches correct set
    const isCorrect =
      correct.length === selected.length &&
      correct.every((a) => selected.includes(a)) &&
      selected.every((a) => correct.includes(a));

    if (isCorrect) score++;
  }

  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
  return { score, total, percentage, passed: percentage >= passingScore };
}

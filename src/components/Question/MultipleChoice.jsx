/**
 * MultipleChoice
 *
 * Renders the list of answer choices for a question.
 * Handles both single-answer (radio) and multi-answer (checkbox) modes.
 * When `submitted` is true and `correctAnswers` is provided, applies
 * green/red highlight classes to each choice.
 */
export default function MultipleChoice({
  choices,
  selected,
  correctAnswers,
  submitted,
  multiAnswer,
  onSelect,
}) {
  function getChoiceClass(choiceId) {
    if (!submitted || !correctAnswers.length) {
      return selected.includes(choiceId) ? 'choice-item selected' : 'choice-item';
    }
    const isCorrect = correctAnswers.includes(choiceId);
    const isSelected = selected.includes(choiceId);
    if (isCorrect) return 'choice-item correct';
    if (isSelected && !isCorrect) return 'choice-item incorrect';
    return 'choice-item';
  }

  return (
    <ul className="choice-list">
      {choices.map((choice) => (
        <li key={choice.id} className={getChoiceClass(choice.id)}>
          <label>
            <input
              type={multiAnswer ? 'checkbox' : 'radio'}
              name="answer"
              value={choice.id}
              checked={selected.includes(choice.id)}
              disabled={submitted}
              onChange={() => onSelect(choice.id)}
              style={{ marginTop: '2px', flexShrink: 0 }}
            />
            <span>{choice.text}</span>
          </label>
        </li>
      ))}
    </ul>
  );
}

import MultipleChoice from './MultipleChoice.jsx';

/**
 * Question
 *
 * Renders a single exam question. Supports:
 *   - `scenario` blocks (shared narrative for chained questions)
 *   - `single-answer` multiple choice
 *   - `multi-answer` multiple choice (checkboxes)
 *   - Inline image/diagram via `imageUrl`
 *   - Answer explanation + references (shown when feedbackMode === 'immediate' and submitted,
 *     or when the session is complete)
 */
export default function Question({ question, answer, feedbackMode, onSelect, onSubmit }) {
  const showFeedback = answer.submitted && feedbackMode === 'immediate';

  return (
    <div className="card question-card">
      {/* Optional scenario block */}
      {question.scenario && (
        <div className="scenario-block">
          <strong style={{ display: 'block', marginBottom: '0.4rem' }}>Scenario</strong>
          {question.scenario}
        </div>
      )}

      {/* Optional diagram / image */}
      {question.imageUrl && (
        <img
          src={question.imageUrl}
          alt="Question diagram"
          style={{ maxWidth: '100%', borderRadius: '0.375rem', marginBottom: '1rem' }}
        />
      )}

      {/* Question stem */}
      <p className="question-stem">{question.stem}</p>

      {question.multiAnswer && (
        <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.5rem' }}>
          Select all that apply.
        </p>
      )}

      {/* Answer choices */}
      <MultipleChoice
        choices={question.choices}
        selected={answer.selected}
        correctAnswers={showFeedback ? question.correctAnswers : []}
        submitted={answer.submitted}
        multiAnswer={question.multiAnswer}
        onSelect={onSelect}
      />

      {/* Submit button */}
      {!answer.submitted && (
        <button
          className="btn btn-primary"
          style={{ marginTop: '1rem' }}
          disabled={answer.selected.length === 0}
          onClick={onSubmit}
        >
          {feedbackMode === 'immediate' ? 'Check Answer' : 'Confirm'}
        </button>
      )}

      {/* Explanation (immediate mode only) */}
      {showFeedback && question.explanation && (
        <div className="explanation-panel">
          <strong>Explanation</strong>
          <p style={{ marginTop: '0.25rem' }}>{question.explanation}</p>
          {question.references?.length > 0 && (
            <>
              <strong style={{ display: 'block', marginTop: '0.75rem' }}>References</strong>
              <ul className="references-list">
                {question.references.map((ref, i) => (
                  <li key={i}>
                    {ref.url ? (
                      <a href={ref.url} target="_blank" rel="noopener noreferrer">
                        {ref.title}
                      </a>
                    ) : (
                      <span>{ref.title} <em>(link pending)</em></span>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}

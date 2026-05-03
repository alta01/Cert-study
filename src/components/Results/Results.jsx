import { useExamContext } from '../../context/ExamContext.jsx';
import { calculateScore } from '../../utils/scoreCalculator.js';
import { Link } from 'react-router-dom';

/**
 * Results
 *
 * Displays the final score after an exam session, then lists each question
 * with the learner's answer, the correct answer, the explanation, and
 * reference links. Shown when `sessionComplete === true` or navigated to
 * from ExamPage after submitting.
 */
export default function Results() {
  const { state, dispatch } = useExamContext();
  const { questions, answers, exam, feedbackMode } = state;

  if (!exam || !questions.length) {
    return (
      <div>
        <p>No active session. <Link to="/">Return home</Link></p>
      </div>
    );
  }

  const { score, total, percentage, passed } = calculateScore(questions, answers);

  return (
    <div>
      <div className="card" style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h1 style={{ marginBottom: '0.25rem' }}>{exam.title}</h1>
        <p style={{ color: '#64748b' }}>Exam Complete</p>
        <div className={`results-score ${passed ? 'pass' : 'fail'}`}>
          {percentage}%
        </div>
        <p>{score} / {total} correct &nbsp;•&nbsp; {passed ? '✅ Passed' : '❌ Not Passed'}</p>
        <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem' }}>
          Passing score: {exam.passingScore ?? 72}%
        </p>
      </div>

      <h2 style={{ marginBottom: '1rem' }}>Review</h2>
      {questions.map((q, idx) => {
        const ans = answers[q.id] ?? { selected: [], submitted: false };
        const isCorrect = q.correctAnswers.every((a) => ans.selected.includes(a)) &&
          ans.selected.every((a) => q.correctAnswers.includes(a));
        return (
          <div key={q.id} className="card" style={{ marginBottom: '1rem' }}>
            <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.25rem' }}>
              Question {idx + 1} &nbsp;•&nbsp; {isCorrect ? '✅ Correct' : '❌ Incorrect'}
            </p>

            {q.scenario && (
              <div className="scenario-block" style={{ fontSize: '0.9rem' }}>{q.scenario}</div>
            )}
            {q.imageUrl && (
              <img src={q.imageUrl} alt="diagram" style={{ maxWidth: '100%', borderRadius: '0.375rem', marginBottom: '0.75rem' }} />
            )}

            <p style={{ marginBottom: '0.75rem' }}>{q.stem}</p>

            <ul className="choice-list">
              {q.choices.map((c) => {
                const correct = q.correctAnswers.includes(c.id);
                const selected = ans.selected.includes(c.id);
                let cls = 'choice-item';
                if (correct) cls += ' correct';
                else if (selected && !correct) cls += ' incorrect';
                return (
                  <li key={c.id} className={cls}>
                    <label>
                      <input type={q.multiAnswer ? 'checkbox' : 'radio'} checked={selected} readOnly disabled />
                      <span>{c.text}</span>
                    </label>
                  </li>
                );
              })}
            </ul>

            {q.explanation && (
              <div className="explanation-panel" style={{ marginTop: '0.75rem' }}>
                <strong>Explanation</strong>
                <p style={{ marginTop: '0.25rem' }}>{q.explanation}</p>
                {q.references?.length > 0 && (
                  <>
                    <strong style={{ display: 'block', marginTop: '0.5rem' }}>References</strong>
                    <ul className="references-list">
                      {q.references.map((ref, i) => (
                        <li key={i}>
                          {ref.url
                            ? <a href={ref.url} target="_blank" rel="noopener noreferrer">{ref.title}</a>
                            : <span>{ref.title} <em>(link pending)</em></span>
                          }
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}

      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
        <button
          className="btn btn-secondary"
          onClick={() => {
            dispatch({ type: 'RESET_SESSION' });
          }}
        >
          Retake Exam
        </button>
        <Link to="/" className="btn btn-primary">Home</Link>
      </div>
    </div>
  );
}

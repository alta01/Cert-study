import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useExamContext } from '../context/ExamContext.jsx';
import ExamSettings from '../components/ExamSettings/ExamSettings.jsx';
import Question from '../components/Question/Question.jsx';
import { loadExamQuestions } from '../services/questions/questionService.js';

/**
 * ExamPage
 *
 * Entry point for a timed exam session. On first load it shows the
 * ExamSettings modal so the learner can choose feedback mode before any
 * questions are shown.
 */
export default function ExamPage() {
  const { examSlug } = useParams();
  const navigate = useNavigate();
  const { state, dispatch } = useExamContext();
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadExam() {
      setLoading(true);
      try {
        const { exam, questions } = await loadExamQuestions(examSlug);
        dispatch({ type: 'LOAD_EXAM', exam, questions });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadExam();
  }, [examSlug, dispatch]);

  function handleSettingsConfirm(mode) {
    dispatch({ type: 'SET_FEEDBACK_MODE', mode });
    setSettingsOpen(false);
  }

  function handleSessionSubmit() {
    dispatch({ type: 'SUBMIT_SESSION' });
    navigate('/results');
  }

  if (loading) return <p>Loading exam…</p>;
  if (error) return <p style={{ color: 'red' }}>Error: {error}</p>;
  if (!state.exam) return null;

  const { questions, currentIndex, answers, feedbackMode, sessionComplete } = state;
  const currentQuestion = questions[currentIndex];

  return (
    <div>
      {settingsOpen && (
        <ExamSettings onConfirm={handleSettingsConfirm} />
      )}

      {!settingsOpen && currentQuestion && (
        <>
          {/* Progress indicator */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.85rem', color: '#64748b' }}>
            <span>Question {currentIndex + 1} of {questions.length}</span>
            <span>{state.exam.title}</span>
          </div>
          <div className="progress-bar-track">
            <div
              className="progress-bar-fill"
              style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
            />
          </div>

          <Question
            question={currentQuestion}
            answer={answers[currentQuestion.id] ?? { selected: [], submitted: false }}
            feedbackMode={feedbackMode}
            onSelect={(choiceId) =>
              dispatch({
                type: 'SELECT_ANSWER',
                questionId: currentQuestion.id,
                choiceId,
                multiAnswer: currentQuestion.multiAnswer,
              })
            }
            onSubmit={() => dispatch({ type: 'SUBMIT_ANSWER', questionId: currentQuestion.id })}
          />

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
            <button
              className="btn btn-secondary"
              disabled={currentIndex === 0}
              onClick={() => dispatch({ type: 'PREV_QUESTION' })}
            >
              ← Previous
            </button>
            {currentIndex < questions.length - 1 ? (
              <button
                className="btn btn-primary"
                onClick={() => dispatch({ type: 'NEXT_QUESTION' })}
              >
                Next →
              </button>
            ) : (
              <button className="btn btn-primary" onClick={handleSessionSubmit}>
                Submit Exam
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

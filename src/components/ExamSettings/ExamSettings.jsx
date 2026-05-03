/**
 * ExamSettings modal
 *
 * Shown before an exam session begins. Lets the learner choose:
 *   1. Feedback mode: show correct answer immediately after each question, or
 *      hold all feedback until the end of the test.
 */
export default function ExamSettings({ onConfirm }) {
  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <h2>Exam Settings</h2>
        <p style={{ color: '#64748b', marginBottom: '1.25rem', fontSize: '0.9rem' }}>
          Choose how you would like to receive feedback during this session.
        </p>

        <div className="setting-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.75rem' }}>
          <label style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', cursor: 'pointer' }}>
            <input type="radio" name="feedback" value="immediate" defaultChecked style={{ marginTop: '3px' }} />
            <span>
              <strong>Immediate feedback</strong>
              <br />
              <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                Show the correct answer, explanation, and reference links right after you answer each question.
              </span>
            </span>
          </label>

          <label style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', cursor: 'pointer' }}>
            <input type="radio" name="feedback" value="end" style={{ marginTop: '3px' }} />
            <span>
              <strong>Review at the end</strong>
              <br />
              <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                No feedback is shown until you submit the entire exam. This mimics real exam conditions.
              </span>
            </span>
          </label>
        </div>

        <button
          className="btn btn-primary"
          style={{ marginTop: '1.5rem', width: '100%', justifyContent: 'center' }}
          onClick={() => {
            const selected = document.querySelector('input[name="feedback"]:checked')?.value ?? 'end';
            onConfirm(selected);
          }}
        >
          Begin Exam
        </button>
      </div>
    </div>
  );
}

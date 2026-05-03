import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

/**
 * ExamSelector
 *
 * Lists all available certification exams loaded from the data/exams directory.
 * Each exam card links to the exam session page and the study-mode page.
 */
export default function ExamSelector() {
  const [exams, setExams] = useState([]);

  useEffect(() => {
    /**
     * In production this could be a fetch() to an API that enumerates exams.
     * For now we import the index manifest statically.
     */
    import('../../../data/exams/index.json')
      .then((mod) => setExams(mod.default ?? []))
      .catch(() => setExams([]));
  }, []);

  if (!exams.length) {
    return (
      <p style={{ color: '#64748b' }}>
        No exams found. Add exam folders under <code>data/exams/</code> or use the{' '}
        <Link to="/admin">Admin</Link> panel to upload content.
      </p>
    );
  }

  return (
    <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
      {exams.map((exam) => (
        <div key={exam.slug} className="card">
          {exam.logoUrl && (
            <img
              src={exam.logoUrl}
              alt={exam.title}
              style={{ height: '48px', marginBottom: '0.75rem', objectFit: 'contain' }}
            />
          )}
          <h2 style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>{exam.title}</h2>
          <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1rem' }}>{exam.description}</p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Link to={`/exam/${exam.slug}`} className="btn btn-primary" style={{ fontSize: '0.85rem' }}>
              Start Exam
            </Link>
            <Link to={`/study/${exam.slug}`} className="btn btn-secondary" style={{ fontSize: '0.85rem' }}>
              Study Mode
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}

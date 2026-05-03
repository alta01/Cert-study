import { Link } from 'react-router-dom';
import ExamSelector from '../components/ExamSelector/ExamSelector.jsx';

export default function Home() {
  return (
    <div>
      <h1 style={{ marginBottom: '0.5rem' }}>Certification Study App</h1>
      <p style={{ color: '#64748b', marginBottom: '2rem' }}>
        Select an exam below to begin a practice session or browse study content.
      </p>
      <ExamSelector />
    </div>
  );
}

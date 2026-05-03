import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { loadDomainContent } from '../services/questions/questionService.js';

/**
 * StudyMode
 *
 * Displays the raw study content (Markdown) for a given exam's domains,
 * with a sidebar for navigating between domains.
 */
export default function StudyMode() {
  const { examSlug } = useParams();
  const [domains, setDomains] = useState([]);
  const [activeDomain, setActiveDomain] = useState(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchDomains() {
      try {
        const mod = await import(`../../data/exams/${examSlug}/exam.json`);
        const exam = mod.default ?? mod;
        setDomains(exam?.domains ?? []);
        if (exam?.domains?.length) {
          setActiveDomain(exam.domains[0]);
        }
      } catch {
        // exam manifest not found
      }
    }
    fetchDomains();
  }, [examSlug]);

  useEffect(() => {
    if (!activeDomain) return;
    setLoading(true);
    loadDomainContent(examSlug, activeDomain.slug)
      .then(setContent)
      .catch(() => setContent('*No content available for this domain yet.*'))
      .finally(() => setLoading(false));
  }, [examSlug, activeDomain]);

  return (
    <div style={{ display: 'flex', gap: '1.5rem' }}>
      {/* Domain sidebar */}
      <aside style={{ width: '220px', flexShrink: 0 }}>
        <h3 style={{ marginBottom: '0.75rem', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Domains</h3>
        {domains.map((d) => (
          <button
            key={d.slug}
            onClick={() => setActiveDomain(d)}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '0.5rem 0.75rem',
              marginBottom: '0.25rem',
              borderRadius: '0.375rem',
              border: 'none',
              background: activeDomain?.slug === d.slug ? '#eff6ff' : 'transparent',
              color: activeDomain?.slug === d.slug ? '#2563eb' : '#334155',
              fontWeight: activeDomain?.slug === d.slug ? 600 : 400,
              cursor: 'pointer',
            }}
          >
            {d.title}
          </button>
        ))}
      </aside>

      {/* Content area */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {loading ? (
          <p>Loading content…</p>
        ) : (
          <div className="card">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useRef } from 'react';
import { generateQuestionsWithLLM } from '../../services/llm/llmService.js';

/**
 * ContentUpload
 *
 * Admin panel component that provides three ways to add content:
 *   1. Upload a JSON question file directly
 *   2. Paste Markdown study content for a domain
 *   3. Generate questions via LLM (Claude)
 */
export default function ContentUpload() {
  const [activeTab, setActiveTab] = useState('json');
  const [status, setStatus] = useState(null);
  const [generating, setGenerating] = useState(false);
  const fileInputRef = useRef(null);

  // LLM generation form state
  const [llmForm, setLlmForm] = useState({
    examName: '',
    domain: '',
    count: 10,
    style: 'single-answer',
  });

  function handleJsonUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        // In a real app, POST to an API or save to IndexedDB / localStorage
        console.log('Parsed question data:', data);
        setStatus({ type: 'success', message: `Loaded ${data.questions?.length ?? 0} questions from ${file.name}.` });
      } catch {
        setStatus({ type: 'error', message: 'Invalid JSON file.' });
      }
    };
    reader.readAsText(file);
  }

  async function handleGenerate() {
    setGenerating(true);
    setStatus(null);
    try {
      const questions = await generateQuestionsWithLLM(llmForm);
      setStatus({ type: 'success', message: `Generated ${questions.length} questions. Copy the JSON below or download it.` });
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setGenerating(false);
    }
  }

  const tabStyle = (tab) => ({
    padding: '0.5rem 1rem',
    fontWeight: activeTab === tab ? 600 : 400,
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    borderBottom: activeTab === tab ? '2px solid #2563eb' : '2px solid transparent',
    color: activeTab === tab ? '#2563eb' : '#64748b',
  });

  return (
    <div className="card">
      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.25rem', borderBottom: '1px solid #e2e8f0', marginBottom: '1.5rem' }}>
        <button style={tabStyle('json')} onClick={() => setActiveTab('json')}>Upload JSON</button>
        <button style={tabStyle('markdown')} onClick={() => setActiveTab('markdown')}>Paste Content</button>
        <button style={tabStyle('llm')} onClick={() => setActiveTab('llm')}>Generate with AI</button>
      </div>

      {/* Upload JSON */}
      {activeTab === 'json' && (
        <div>
          <p style={{ marginBottom: '1rem', fontSize: '0.9rem', color: '#64748b' }}>
            Upload a <code>questions.json</code> file conforming to{' '}
            <code>data/schemas/question-schema.json</code>.
          </p>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleJsonUpload} style={{ display: 'none' }} />
          <button className="btn btn-primary" onClick={() => fileInputRef.current?.click()}>
            Choose File
          </button>
        </div>
      )}

      {/* Paste Markdown */}
      {activeTab === 'markdown' && (
        <div>
          <p style={{ marginBottom: '0.75rem', fontSize: '0.9rem', color: '#64748b' }}>
            Paste study content (Markdown) for a specific domain. This will be saved as <code>content.md</code>.
          </p>
          <textarea
            rows={12}
            placeholder="# Domain 1: Design Secure Architectures&#10;&#10;Paste your study notes here..."
            style={{ width: '100%', padding: '0.75rem', borderRadius: '0.375rem', border: '1px solid #e2e8f0', fontFamily: 'monospace', resize: 'vertical' }}
          />
          <button className="btn btn-primary" style={{ marginTop: '0.75rem' }}>Save Content</button>
        </div>
      )}

      {/* Generate with AI */}
      {activeTab === 'llm' && (
        <div>
          <p style={{ marginBottom: '1rem', fontSize: '0.9rem', color: '#64748b' }}>
            Use Claude to generate questions. Requires <code>VITE_ANTHROPIC_API_KEY</code> to be set.
          </p>
          <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: '1fr 1fr' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.9rem' }}>
              Certification Name
              <input
                type="text"
                value={llmForm.examName}
                onChange={(e) => setLlmForm({ ...llmForm, examName: e.target.value })}
                placeholder="e.g. AWS SAA-C03"
                style={{ padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #e2e8f0' }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.9rem' }}>
              Domain
              <input
                type="text"
                value={llmForm.domain}
                onChange={(e) => setLlmForm({ ...llmForm, domain: e.target.value })}
                placeholder="e.g. Domain 1: Secure Architectures"
                style={{ padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #e2e8f0' }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.9rem' }}>
              Number of Questions
              <input
                type="number"
                min={1}
                max={50}
                value={llmForm.count}
                onChange={(e) => setLlmForm({ ...llmForm, count: parseInt(e.target.value, 10) })}
                style={{ padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #e2e8f0' }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.9rem' }}>
              Question Style
              <select
                value={llmForm.style}
                onChange={(e) => setLlmForm({ ...llmForm, style: e.target.value })}
                style={{ padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #e2e8f0' }}
              >
                <option value="single-answer">Single Answer</option>
                <option value="multi-answer">Multiple Answer</option>
                <option value="scenario-chain">Scenario Chain</option>
              </select>
            </label>
          </div>
          <button
            className="btn btn-primary"
            style={{ marginTop: '1rem' }}
            onClick={handleGenerate}
            disabled={generating || !llmForm.examName || !llmForm.domain}
          >
            {generating ? 'Generating…' : 'Generate Questions'}
          </button>
        </div>
      )}

      {/* Status message */}
      {status && (
        <p style={{ marginTop: '1rem', color: status.type === 'error' ? '#dc2626' : '#16a34a', fontSize: '0.9rem' }}>
          {status.message}
        </p>
      )}
    </div>
  );
}

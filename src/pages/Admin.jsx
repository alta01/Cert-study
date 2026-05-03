import ContentUpload from '../components/ContentUpload/ContentUpload.jsx';

/**
 * Admin page
 *
 * Allows exam administrators to:
 *  - Upload a JSON question file
 *  - Paste study content (Markdown) for a domain
 *  - Trigger LLM-based question generation (requires API key in .env)
 */
export default function Admin() {
  return (
    <div>
      <h1 style={{ marginBottom: '1.5rem' }}>Admin — Content Management</h1>
      <ContentUpload />
    </div>
  );
}

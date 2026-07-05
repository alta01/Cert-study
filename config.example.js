/* config.example.js — runtime configuration for Cert Study
 *
 * Copy this file to `config.js` and fill in your values:
 *     cp config.example.js config.js
 *
 * `config.js` is gitignored. In Docker/K8s it is generated automatically from
 * the SUPABASE_URL / SUPABASE_ANON_KEY / OLLAMA_BASE environment variables by
 * docker-entrypoint.sh — no manual editing needed there.
 *
 * All values are safe to expose to the browser:
 *   - The Supabase anon key is public by design; Row-Level Security (see
 *     supabase/schema.sql) is the real security boundary.
 *   - If SUPABASE_URL / SUPABASE_ANON_KEY are left blank, account sync is
 *     silently disabled and the app runs in anonymous (localStorage) mode.
 */
window.__CS_CONFIG__ = {
  // From Supabase → Project Settings → API
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',

  // Local Ollama endpoint for the AI assistant (see ai.js)
  OLLAMA_BASE: 'http://localhost:11434',
};

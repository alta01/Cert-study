#!/bin/sh
set -e

OLLAMA_BASE="${OLLAMA_BASE:-http://localhost:11434}"

# Patch the OLLAMA_BASE constant in ai.js
sed -i "s|const OLLAMA_BASE = 'http://localhost:11434';|const OLLAMA_BASE = '${OLLAMA_BASE}';|g" \
  /usr/share/nginx/html/ai.js

# Patch the CSP connect-src in index.html to allow the actual Ollama URL
sed -i "s|http://localhost:11434 http://127.0.0.1:11434|${OLLAMA_BASE}|g" \
  /usr/share/nginx/html/index.html

# Generate config.js from env for the browser app (Supabase account sync).
# Leave SUPABASE_* unset to ship an anonymous, localStorage-only build.
# The Supabase CSP entry is a static wildcard (https://*.supabase.co) in
# index.html, so no CSP patch is needed here. The anon key is public-safe.
cat > /usr/share/nginx/html/config.js <<EOF
window.__CS_CONFIG__ = {
  SUPABASE_URL: '${SUPABASE_URL:-}',
  SUPABASE_ANON_KEY: '${SUPABASE_ANON_KEY:-}',
  OLLAMA_BASE: '${OLLAMA_BASE}',
};
EOF

exec "$@"

#!/bin/sh
set -e

OLLAMA_BASE="${OLLAMA_BASE:-http://localhost:11434}"

# Patch the OLLAMA_BASE constant in ai.js
sed -i "s|const OLLAMA_BASE = 'http://localhost:11434';|const OLLAMA_BASE = '${OLLAMA_BASE}';|g" \
  /usr/share/nginx/html/ai.js

# Patch the CSP connect-src in index.html to allow the actual Ollama URL
sed -i "s|http://localhost:11434 http://127.0.0.1:11434|${OLLAMA_BASE}|g" \
  /usr/share/nginx/html/index.html

exec "$@"

#!/bin/sh
set -eu
# Optional Firebase config and Ollama endpoint, serialized with jq.
/generate-config.sh /usr/share/nginx/html/config.js
# Extend connect-src for a configured Ollama origin. Config stays data, never script.
if [ -n "${OLLAMA_BASE:-}" ]; then
  origin=$(printf '%s' "$OLLAMA_BASE" | sed -n 's|^\(https\{0,1\}://[a-zA-Z0-9.:-]*\).*|\1|p')
  if [ -n "$origin" ]; then
    sed -i "s|http://localhost:11434 http://127.0.0.1:11434|http://localhost:11434 http://127.0.0.1:11434 ${origin}|" /usr/share/nginx/html/index.html
  fi
fi
exec "$@"

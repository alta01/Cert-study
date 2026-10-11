#!/bin/sh
# Serialize values as JSON so quotes, backslashes, and newlines stay data.
set -eu
output="${1:-config.js}"
config_tmp="${output}.tmp"
trap 'rm -f "$config_tmp"' EXIT
printf 'window.__CS_CONFIG__ = ' > "$config_tmp"
jq -n --argjson firebase "${FIREBASE_CONFIG:-null}" --arg ollama "${OLLAMA_BASE-http://localhost:11434}" \
  '{FIREBASE: $firebase, OLLAMA_BASE: $ollama}' >> "$config_tmp"
printf ';\n' >> "$config_tmp"
mv "$config_tmp" "$output"

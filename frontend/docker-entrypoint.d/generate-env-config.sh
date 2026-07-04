#!/bin/sh
cat > /usr/share/nginx/html/env-config.js <<EOF
window.__RUNTIME_CONFIG__ = {
  VITE_API_BASE_URL: "${API_URL:-}"
};
EOF

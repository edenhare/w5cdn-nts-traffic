#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if [ ! -d "node_modules" ]; then
  echo "Installing W5CDN NTS Traffic Manager dependencies..."
  npm install
fi
exec npm start

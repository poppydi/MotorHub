#!/bin/bash
set -euo pipefail

APP_DIR="${1:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$APP_DIR"

echo "==> MotorHub deploy in $APP_DIR"

export NODE_ENV=production

echo "==> npm install"
npm install --omit=dev

echo "==> apply FAQ + product image fixes"
npm run apply-site-fixes

echo "==> restart app"
if command -v pm2 >/dev/null 2>&1; then
  if pm2 describe motorhub >/dev/null 2>&1; then
    pm2 restart motorhub
  elif pm2 describe autonix >/dev/null 2>&1; then
    pm2 restart autonix
  else
    pm2 start server.js --name motorhub
    pm2 save
  fi
  pm2 status
else
  echo "pm2 not found. Restart manually, e.g.:"
  echo "  NODE_ENV=production node server.js"
fi

echo "==> done"
echo "Check FAQ: curl -s http://127.0.0.1:3000/api/faq/parts | head"

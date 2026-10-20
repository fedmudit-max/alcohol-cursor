#!/usr/bin/env bash
# Copy a clean deploy tree to dist/ — no .git, macOS junk, backups, or dev-only folders.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${ROOT}/dist"
rm -rf "$OUT"
mkdir -p "$OUT"

rsync -a \
  --exclude '.git' \
  --exclude '.gitignore' \
  --exclude '.cursor' \
  --exclude '.idea' \
  --exclude '__MACOSX' \
  --exclude '.DS_Store' \
  --exclude 'dist' \
  --exclude 'node_modules' \
  --exclude 'android' \
  --exclude 'tests' \
  --exclude 'src/dev' \
  --exclude 'scripts' \
  --exclude 'alcohol-backend-testing' \
  --exclude '*.backup.html' \
  --exclude 'index.monolith.backup.html' \
  --exclude '*.zip' \
  --exclude 'README.md' \
  --exclude 'package-lock.json' \
  --exclude 'package.json' \
  --exclude 'capacitor.config.json' \
  "${ROOT}/" "${OUT}/"

echo "Release build ready: ${OUT}"
echo "Deploy the contents of dist/ (not the repo root) to GitHub Pages or Capacitor www."

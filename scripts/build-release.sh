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
  --exclude '__MACOSX' \
  --exclude '.DS_Store' \
  --exclude 'dist' \
  --exclude 'tests' \
  --exclude 'scripts' \
  --exclude 'alcohol-backend-testing' \
  --exclude '*.backup.html' \
  --exclude 'index.monolith.backup.html' \
  --exclude 'README.md' \
  "${ROOT}/" "${OUT}/"

echo "Release build ready: ${OUT}"
echo "Deploy the contents of dist/ (not the repo root) to GitHub Pages or Capacitor www."

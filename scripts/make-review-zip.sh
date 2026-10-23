#!/usr/bin/env bash
# Zip source for external LLM review (GPT / Claude). No secrets, no build junk.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${ROOT}/10drinks-review.zip"
STAMP="$(date +%Y-%m-%d)"
TMP="${ROOT}/.review-bundle-meta.txt"

cat > "$TMP" <<EOF
10Drinks — review bundle
Generated: ${STAMP}
Package: com.tendrinks.app (Capacitor Android + PWA)

Focus areas for review:
- Journey score / best score (src/config/app.config.js — laotzu-style)
- Trial locks 15d (src/premium/premium.js)
- Calendar / meter / J3+ panels (src/ui/panels.js, premium.js)
- Data: src/data/local-storage.js, src/journey/*

Tests: npm test
Play checklist: docs/PLAY_INTERNAL_TESTING.md

Excluded: node_modules, dist, .git, keystores, android/build
EOF

rm -f "$OUT"
cd "$ROOT"
zip -r "$OUT" . \
  -x "*.git/*" \
  -x "*/.git/*" \
  -x "*node_modules/*" \
  -x "*dist/*" \
  -x "*/.cursor/*" \
  -x "*/.idea/*" \
  -x "*__MACOSX/*" \
  -x "*.DS_Store" \
  -x "*android/app/build/*" \
  -x "*android/build/*" \
  -x "*android/.gradle/*" \
  -x "*.jks" \
  -x "*keystore.properties" \
  -x "10drinks-review.zip" \
  -x "10drinks-review-gpt.zip" \
  -x "*alcohol-backend-testing/*" \
  -x "*.backup.html" \
  -x "index.monolith.backup.html" \
  -x ".review-bundle-meta.txt" \
  > /dev/null

zip -j "$OUT" "$TMP" > /dev/null
rm -f "$TMP"

ls -lh "$OUT"
echo "Ready for upload: ${OUT}"

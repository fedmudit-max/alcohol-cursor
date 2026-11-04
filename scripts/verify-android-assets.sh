#!/usr/bin/env bash
# Release web layer: source → dist → android/app/src/main/assets/public must match.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST="${ROOT}/dist"
ANDROID="${ROOT}/android/app/src/main/assets/public"

fail() {
  echo "verify-android-assets: $*" >&2
  exit 1
}

ok() {
  echo "verify-android-assets: $*"
}

[[ -d "$DIST" ]] || fail "missing dist/ — run npm run build or cap:sync first"
[[ -d "$ANDROID" ]] || fail "missing ${ANDROID} — run npm run cap:sync"

[[ ! -e "$DIST/.tools" ]] \
  || fail "dist/.tools must not be shipped (dev bundletool) — rebuild with scripts/build-release.sh"
[[ ! -e "$ANDROID/.tools" ]] \
  || fail "android assets contain .tools — npm run cap:sync after a clean build"

# ── 1. Source tree → dist/ (tests exercise src/; Play ships dist/) ──
while IFS= read -r srcfile; do
  rel="${srcfile#$ROOT/}"
  distfile="$DIST/$rel"
  [[ -f "$distfile" ]] || fail "dist missing $rel — run npm run build"
  if ! cmp -s "$srcfile" "$distfile"; then
    fail "$rel differs from source — run npm run build (then cap:sync)"
  fi
done < <(find "$ROOT/src" -type f -name '*.js' \
  ! -path '*/src/dev/*' \
  ! -name '*.bundle.js')

# ── 2. dist/ → Android packaged assets ──
PACKAGED=(
  index.html
  src/config/app.config.js
  src/premium/offering-catalog.js
  src/premium/premium.js
  src/assessment/questions.js
  src/ui/panels.js
  src/capacitor/native.bundle.js
  src/capacitor/revenuecat.bundle.js
)

for rel in "${PACKAGED[@]}"; do
  [[ -f "$DIST/$rel" ]] || fail "missing dist/$rel"
  [[ -f "$ANDROID/$rel" ]] || fail "missing android asset $rel — run npm run cap:sync"
  if ! cmp -s "$DIST/$rel" "$ANDROID/$rel"; then
    fail "$rel differs from dist/ — run npm run cap:sync before building an AAB"
  fi
done

INDEX="${ANDROID}/index.html"
grep -q 'src/premium/offering-catalog.js' "$INDEX" \
  || fail "index.html must load offering-catalog.js"
grep -q 'src/capacitor/revenuecat.bundle.js' "$INDEX" \
  || fail "index.html must load revenuecat.bundle.js"
grep -q 'src/capacitor/native.bundle.js' "$INDEX" \
  || fail "index.html must load native.bundle.js"
if grep -q 'revenuecat.bundle.js" defer' "$INDEX" \
  || grep -q "revenuecat.bundle.js' defer" "$INDEX"; then
  fail "revenuecat.bundle.js must not use defer (load before main.js)"
fi
if grep -q 'native.bundle.js" defer' "$INDEX" \
  || grep -q "native.bundle.js' defer" "$INDEX"; then
  fail "native.bundle.js must not use defer (load before main.js)"
fi

for label in dist android; do
  if [[ "$label" == dist ]]; then
    f="${DIST}/src/premium/premium.js"
  else
    f="${ANDROID}/src/premium/premium.js"
  fi
  grep -q 'rcVerificationAcceptable' "$f" \
    || fail "${label} premium.js outdated (missing rcVerificationAcceptable)"
  grep -q 'isAuditSafetyGuidanceLocked' "$f" \
    || fail "${label} premium.js missing isAuditSafetyGuidanceLocked"
  if grep -q 'AUDIT-C meter and re-tests are Premium after trial' "$f"; then
    fail "${label} premium.js still locks AUDIT-C after trial"
  fi
done

ok "source → dist → android assets in sync"
exit 0

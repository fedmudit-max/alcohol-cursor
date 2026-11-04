#!/usr/bin/env bash
# Validate dist/ before Gradle — trial-only vs store billing release profiles.
# Does not print RevenueCat API keys.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST="${ROOT}/dist"
CONFIG="${DIST}/src/config/app.config.js"
INDEX="${DIST}/index.html"
RC_BUNDLE="${DIST}/src/capacitor/revenuecat.bundle.js"
NATIVE_BUNDLE="${DIST}/src/capacitor/native.bundle.js"

usage() {
  echo "Usage: bash scripts/preflight-release.sh --trial | --store"
  echo "  --trial  local-stub billing, paywall hidden (default internal / trial track)"
  echo "  --store  RevenueCat store billing + subscribe UI (before Play subscription test)"
  exit 1
}

PROFILE=""
case "${1:-}" in
  --trial) PROFILE=trial ;;
  --store) PROFILE=store ;;
  *) usage ;;
esac

fail() {
  echo "preflight-release (${PROFILE}): $*" >&2
  exit 1
}

ok() {
  echo "preflight-release (${PROFILE}): $*"
}

[[ -f "$CONFIG" ]] || fail "missing ${CONFIG} — run npm run build (or cap:sync) first"
[[ -f "$INDEX" ]] || fail "missing ${INDEX}"
[[ -f "$RC_BUNDLE" ]] || fail "missing ${RC_BUNDLE} — run npm run build:native-bridge"
[[ -f "$NATIVE_BUNDLE" ]] || fail "missing ${NATIVE_BUNDLE}"

if [[ -d "${DIST}/src/dev" ]]; then
  fail "dist must not contain src/dev/"
fi
if [[ -e "${DIST}/.tools" ]]; then
  fail "dist must not contain .tools/ (dev bundletool)"
fi
if grep -q 'src/dev/' "$INDEX" 2>/dev/null; then
  fail "index.html must not reference src/dev/ scripts"
fi

PREFLIGHT_NODE="${ROOT}/tests/release-config.mjs"
[[ -f "$PREFLIGHT_NODE" ]] || fail "missing ${PREFLIGHT_NODE}"

if [[ "$PROFILE" == trial ]]; then
  node "$PREFLIGHT_NODE" --trial "$CONFIG" \
    || fail "trial release config validation failed (see release-config output)"
  ok "trial profile OK (local-stub, paywall hidden, RC key empty, dev excluded)"
  exit 0
fi

node "$PREFLIGHT_NODE" --store "$CONFIG" \
  || fail "store release config validation failed (see release-config output)"
ok "RevenueCat Android key present (goog_…, value not logged)"
ok "store profile OK — complete RC dashboard + Play products before upload"
exit 0

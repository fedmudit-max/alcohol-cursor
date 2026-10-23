#!/usr/bin/env bash
# Read versionCode/versionName inside an AAB (Play reads this, not build.gradle).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AAB="${1:-}"
if [[ -z "$AAB" || ! -f "$AAB" ]]; then
  echo "Usage: bash scripts/verify-aab-version.sh path/to/app-release.aab"
  exit 1
fi
GRADLE="${ROOT}/android/app/build.gradle"
EXPECT_CODE="$(sed -n 's/^[[:space:]]*versionCode[[:space:]]*\([0-9]*\).*/\1/p' "$GRADLE" | head -1)"
EXPECT_NAME="$(sed -n 's/^[[:space:]]*versionName[[:space:]]*"\([^"]*\)".*/\1/p' "$GRADLE" | head -1)"
if [[ -x "/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin/java" ]]; then
  export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
fi
BUNDLETOOL="${ROOT}/.tools/bundletool-all.jar"
if [[ ! -f "$BUNDLETOOL" ]]; then
  echo "Downloading bundletool (one-time)…"
  mkdir -p "${ROOT}/.tools"
  curl -fsSL -o "$BUNDLETOOL" \
    "https://github.com/google/bundletool/releases/download/1.17.2/bundletool-all-1.17.2.jar"
fi
MANIFEST="$(java -jar "$BUNDLETOOL" dump manifest --bundle="$AAB")"
ACTUAL_CODE="$(printf '%s\n' "$MANIFEST" | sed -n 's/.*android:versionCode="\([0-9]*\)".*/\1/p' | head -1)"
ACTUAL_NAME="$(printf '%s\n' "$MANIFEST" | sed -n 's/.*android:versionName="\([^"]*\)".*/\1/p' | head -1)"
echo "AAB file: $AAB"
echo "Modified: $(stat -f '%Sm' -t '%Y-%m-%d %H:%M' "$AAB" 2>/dev/null || stat -c '%y' "$AAB" 2>/dev/null | cut -d. -f1)"
echo "Inside the AAB (what Play sees): versionCode=${ACTUAL_CODE} versionName=${ACTUAL_NAME}"
echo "build.gradle (source only):         versionCode=${EXPECT_CODE} versionName=${EXPECT_NAME}"
if [[ "$ACTUAL_CODE" != "$EXPECT_CODE" ]]; then
  echo ""
  echo "ERROR: You are about to upload the WRONG bundle."
  echo "Editing build.gradle does not change an existing .aab file."
  echo "Run: npm run android:bundle"
  echo "Then upload: android/app/build/outputs/bundle/release/app-release-vc${EXPECT_CODE}.aab"
  exit 2
fi
echo "OK — safe to upload this AAB to Play."

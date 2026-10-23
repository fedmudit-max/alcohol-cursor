#!/usr/bin/env bash
# Confirm an AAB was built after the current versionCode in build.gradle (Play upload guard).
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
echo "AAB file: $AAB"
echo "Modified: $(stat -f '%Sm' -t '%Y-%m-%d %H:%M' "$AAB" 2>/dev/null || stat -c '%y' "$AAB" 2>/dev/null | cut -d. -f1)"
echo "Gradle expects: versionCode ${EXPECT_CODE} versionName ${EXPECT_NAME}"

if [[ "$AAB" -ot "$GRADLE" ]]; then
  echo ""
  echo "ERROR: This AAB is OLDER than android/app/build.gradle."
  echo "Play will reject it if the embedded versionCode was already uploaded (e.g. 5)."
  echo "Run: npm run android:bundle"
  echo "Upload: android/app/build/outputs/bundle/release/app-release-vc${EXPECT_CODE}.aab"
  exit 2
fi

if [[ -x "/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin/java" ]]; then
  export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
fi
BUNDLETOOL="${ROOT}/.tools/bundletool-all.jar"
if [[ -f "$BUNDLETOOL" ]]; then
  echo "Manifest (bundletool):"
  java -jar "$BUNDLETOOL" dump manifest --bundle="$AAB" 2>/dev/null | grep -E 'versionCode|versionName' || true
fi

echo "OK — AAB is newer than build.gradle; intended versionCode ${EXPECT_CODE}."

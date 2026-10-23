#!/usr/bin/env bash
# Build a signed release AAB for Google Play (internal / closed / production tracks).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ANDROID="${ROOT}/android"
PROPS="${ANDROID}/keystore.properties"

if [[ -x "/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin/java" ]]; then
  export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
fi
if [[ -d "${ANDROID_HOME:-}" ]]; then
  :
elif [[ -d "$HOME/Library/Android/sdk" ]]; then
  export ANDROID_HOME="$HOME/Library/Android/sdk"
fi
export PATH="${ANDROID_HOME:+$ANDROID_HOME/platform-tools:}$PATH"

if [[ ! -f "$PROPS" ]]; then
  echo "Missing ${PROPS}"
  echo "Copy android/keystore.properties.example → android/keystore.properties and create an upload keystore."
  echo "See docs/PLAY_INTERNAL_TESTING.md"
  exit 1
fi

GRADLE="${ANDROID}/app/build.gradle"
VERSION_CODE="$(sed -n 's/^[[:space:]]*versionCode[[:space:]]*\([0-9]*\).*/\1/p' "$GRADLE" | head -1)"
VERSION_NAME="$(sed -n 's/^[[:space:]]*versionName[[:space:]]*"\([^"]*\)".*/\1/p' "$GRADLE" | head -1)"
if [[ -z "$VERSION_CODE" ]]; then
  echo "Could not read versionCode from ${GRADLE}"
  exit 1
fi
echo "Building release AAB: versionCode=${VERSION_CODE} versionName=${VERSION_NAME}"

cd "${ANDROID}"
./gradlew clean bundleRelease

AAB="${ANDROID}/app/build/outputs/bundle/release/app-release.aab"
AAB_TAGGED="${ANDROID}/app/build/outputs/bundle/release/app-release-vc${VERSION_CODE}.aab"
if [[ -f "$AAB" ]]; then
  cp -f "$AAB" "$AAB_TAGGED"
  ls -lh "$AAB" "$AAB_TAGGED"
  META="$(find "${ANDROID}/app/build/intermediates" -name 'AndroidManifest.xml' 2>/dev/null | grep release | head -1 || true)"
  if [[ -n "$META" && -f "$META" ]]; then
    BUILT_CODE="$(sed -n 's/.*android:versionCode="\([0-9]*\)".*/\1/p' "$META" | head -1)"
    if [[ -n "$BUILT_CODE" && "$BUILT_CODE" != "$VERSION_CODE" ]]; then
      echo "ERROR: Built manifest versionCode=${BUILT_CODE} != build.gradle ${VERSION_CODE}"
      exit 1
    fi
    echo "Verified manifest versionCode=${BUILT_CODE}"
  else
    echo "Built with versionCode=${VERSION_CODE} (upload the -vc${VERSION_CODE} copy to avoid stale AAB mistakes)."
  fi
  echo ""
  echo "Upload ONLY this freshly built file (check the date above):"
  echo "  ${AAB_TAGGED}"
  echo "Play Console → Testing → your track → Create new release."
else
  echo "Expected AAB not found at ${AAB}"
  exit 1
fi

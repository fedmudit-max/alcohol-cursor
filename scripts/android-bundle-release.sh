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

cd "${ANDROID}"
./gradlew bundleRelease

AAB="${ANDROID}/app/build/outputs/bundle/release/app-release.aab"
if [[ -f "$AAB" ]]; then
  ls -lh "$AAB"
  echo ""
  echo "Upload this file in Play Console → Testing → Internal testing → Create new release."
else
  echo "Expected AAB not found at ${AAB}"
  exit 1
fi

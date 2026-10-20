#!/usr/bin/env bash
# Build debug APK and install on the first connected Android device/emulator.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [[ -x "/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin/java" ]]; then
  export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
fi
if [[ -d "${ANDROID_HOME:-}" ]]; then
  :
elif [[ -d "$HOME/Library/Android/sdk" ]]; then
  export ANDROID_HOME="$HOME/Library/Android/sdk"
fi
export PATH="${ANDROID_HOME:+$ANDROID_HOME/platform-tools:}$PATH"

if ! command -v adb >/dev/null 2>&1; then
  echo "adb not found. Install Android SDK platform-tools or open Android Studio once."
  exit 1
fi

DEVICES="$(adb devices | awk 'NR>1 && $2=="device" { print $1 }')"
if [[ -z "$DEVICES" ]]; then
  echo "No Android device connected. Enable USB debugging or wireless debugging, then retry."
  adb devices -l
  exit 1
fi

cd "${ROOT}/android"
./gradlew installDebug

adb shell am start -n com.tendrinks.app/.MainActivity
echo "Installed and launched 10Drinks on device."

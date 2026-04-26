#!/usr/bin/env bash
# Build web export + native shell, then install the debug APK over USB (adb).
# Requires: Android device with USB debugging; JDK 21+ for this Gradle (Homebrew: brew install openjdk@21)
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -z "${JAVA_HOME:-}" ]; then
  if [ -d "/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home" ]; then
    export JAVA_HOME="/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home"
  else
    export JAVA_HOME="$(/usr/libexec/java_home -v 21 2>/dev/null || /usr/libexec/java_home -v 17 2>/dev/null || /usr/libexec/java_home 2>/dev/null)"
  fi
fi
if [ -z "$JAVA_HOME" ] || [ ! -d "$JAVA_HOME" ]; then
  echo "Set JAVA_HOME to a JDK 17+ (e.g. brew install openjdk@21)" >&2
  exit 1
fi
export PATH="$JAVA_HOME/bin:$PATH"
echo "Using Java: $("$JAVA_HOME/bin/java" -version 2>&1 | head -1)"
npm run build:cap
cd android
./gradlew :app:installDebug
adb shell am start -S -n com.terpedia.terproduct/.MainActivity
echo "Launched Terproduct (WebView -> https://terproduct.terpedia.com unless CAPACITOR_LOAD_LOCAL=1)."

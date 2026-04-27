#!/usr/bin/env bash
# Build web export + native shell, then install the debug APK over ADB TCP/IP
# (wireless debugging or "adb tcpip" after a one-time USB session).
#
# Prereqs:
#   - Phone and computer on the same LAN (or VPN).
#   - Either:
#       A) Android 11+ → Developer options → Wireless debugging → Pair with pairing code,
#          then:  adb pair PHONE_IP:PAIR_PORT   (enter code when prompted)
#          then note the "IP address & port" for the connection (often :XXXXX),
#          OR
#       B) Once on USB: adb tcpip 5555 && adb connect PHONE_LAN_IP:5555
#
# Usage:
#   npm run android:wireless -- 192.168.1.50:5555
#   ANDROID_SERIAL=192.168.1.50:37139 bash scripts/install-android-wireless.sh
#
set -euo pipefail
cd "$(dirname "$0")/.."

TARGET="${1:-${ANDROID_SERIAL:-}}"
if [ -z "${TARGET}" ]; then
  echo "Usage: $0 <host:port>" >&2
  echo "  Example: $0 192.168.1.50:5555" >&2
  echo "  Or:      export ANDROID_SERIAL=192.168.1.50:5555 && $0" >&2
  echo >&2
  echo "Pair first (Android 11+):  adb pair PHONE_IP:PAIR_PORT" >&2
  echo "Then connect:              adb connect PHONE_IP:CONNECT_PORT" >&2
  exit 1
fi

if ! command -v adb >/dev/null 2>&1; then
  echo "adb not found (install Android platform-tools)" >&2
  exit 1
fi

echo "Connecting adb to ${TARGET} …"
adb connect "${TARGET}" || true
# Give the daemon a moment to register the transport
sleep 1
if ! adb -s "${TARGET}" get-state 1>/dev/null 2>&1; then
  echo "Device ${TARGET} not reachable. Check Wi‑Fi, pairing, and 'adb devices'." >&2
  adb devices -l
  exit 1
fi

export ANDROID_SERIAL="${TARGET}"

if [ -z "${JAVA_HOME:-}" ]; then
  if [ -d "/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home" ]; then
    export JAVA_HOME="/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home"
  else
    export JAVA_HOME="$(/usr/libexec/java_home -v 21 2>/dev/null || /usr/libexec/java_home -v 17 2>/dev/null || /usr/libexec/java_home 2>/dev/null)"
  fi
fi
if [ -z "${JAVA_HOME}" ] || [ ! -d "${JAVA_HOME}" ]; then
  echo "Set JAVA_HOME to a JDK 17+ (e.g. brew install openjdk@21)" >&2
  exit 1
fi
export PATH="${JAVA_HOME}/bin:${PATH}"
echo "Using Java: $("${JAVA_HOME}/bin/java" -version 2>&1 | head -1)"
echo "Using device: ${ANDROID_SERIAL}"

npm run build:cap
cd android
./gradlew :app:installDebug
adb -s "${TARGET}" shell am start -S -n com.terpedia.terproduct/.MainActivity
echo "Launched Terproduct on ${TARGET} (WebView -> https://terproduct.terpedia.com unless CAPACITOR_LOAD_LOCAL=1)."

#!/usr/bin/env bash
# Ad-hoc test intents (USB debugging) for Terproduct. Requires: adb, app installed: com.terpedia.terproduct
# Run individual lines in your shell, or: bash scripts/adb-test-intents.sh run-https
set -euo pipefail
PKG="com.terpedia.terproduct"

case "${1:-}" in
  run-https)
    adb shell am start -a android.intent.action.VIEW -d "https://terproduct.terpedia.com/device-test/" "$PKG"
    ;;
  run-terproduct)
    adb shell am start -a android.intent.action.VIEW -d "terproduct://app/scan/" "$PKG"
    ;;
  run)
    "$0" run-https
    ;;
  *)
    cat <<EOF
Package: $PKG
Set NEXT_PUBLIC_DISABLE_DEEPLINKS=1 in the web build only if you need to disable the client handler (rare).

HTTPS (in-app, uses https://terproduct.terpedia.com/ pathPrefix)
  adb shell am start -a android.intent.action.VIEW -d "https://terproduct.terpedia.com/device-test/" $PKG
  adb shell am start -a android.intent.action.VIEW -d "https://terproduct.terpedia.com/field/" $PKG

Plant QR + optional auto-build + system print (Android TerproductDevice plugin)
  adb shell am start -a android.intent.action.VIEW -d "https://terproduct.terpedia.com/qr/?u=0038000100096&auto=1" $PKG
  adb shell am start -a android.intent.action.VIEW -d "https://terproduct.terpedia.com/qr/?text=https%3A%2F%2Fterpedia.com&auto=1&print=1" $PKG
  adb shell am start -a android.intent.action.VIEW -d "https://terproduct.terpedia.com/qr/?u=0038000100096&auto=1&print=1&horizontal=1" $PKG

Custom scheme (host must be "app" per android/app/.../AndroidManifest.xml)
  adb shell am start -a android.intent.action.VIEW -d "terproduct://app/scan/" $PKG
  adb shell am start -a android.intent.action.VIEW -d "terproduct://app/lookup/" $PKG
  adb shell am start -a android.intent.action.VIEW -d "terproduct://app/qr/?u=0038000100096&auto=1&print=1" $PKG

Launcher
  adb shell am start -n $PKG/.MainActivity

Convenience
  $0 run-https            # run device-test deep link
  $0 run-terproduct      # run terproduct://app/scan/
EOF
    ;;
esac

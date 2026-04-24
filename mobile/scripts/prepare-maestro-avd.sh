#!/usr/bin/env bash
set -euo pipefail

APP_ID="${APP_ID:-com.lsimaocosta.calculadorapricesac}"
APK_PATH="${APK_PATH:-android/app/build/outputs/apk/debug/app-debug.apk}"
SNAPSHOT_NAME="${SNAPSHOT_NAME:-maestro-ready}"
SAVE_SNAPSHOT=false
FORCE_INSTALL="${FORCE_INSTALL:-false}"

for arg in "$@"; do
  case "$arg" in
    --save-snapshot)
      SAVE_SNAPSHOT=true
      ;;
    --force-install)
      FORCE_INSTALL=true
      ;;
    *)
      echo "Usage: $0 [--save-snapshot] [--force-install]" >&2
      exit 2
      ;;
  esac
done

echo "Waiting for Android device..."
adb wait-for-device

echo "Waiting for boot completion..."
until [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; do
  sleep 2
done

echo "Unlocking emulator and disabling Android animations..."
adb shell input keyevent 82 >/dev/null || true
adb shell settings put global window_animation_scale 0
adb shell settings put global transition_animation_scale 0
adb shell settings put global animator_duration_scale 0

if [ "$FORCE_INSTALL" = "true" ] || ! adb shell pm path "$APP_ID" >/dev/null 2>&1; then
  if [ ! -f "$APK_PATH" ]; then
    echo "Dev build APK not found at $APK_PATH" >&2
    echo "Build it first, or set APK_PATH=/path/to/app-debug.apk." >&2
    exit 1
  fi

  echo "Installing dev build..."
  adb install -r "$APK_PATH"
else
  echo "Dev build already installed."
fi

if [ "$SAVE_SNAPSHOT" = "true" ]; then
  echo "Saving emulator snapshot '$SNAPSHOT_NAME'..."
  adb emu avd snapshot save "$SNAPSHOT_NAME"
fi

cat <<EOF
Maestro AVD is ready.

Start Metro:
  npx expo start --dev-client --host localhost --port 8081

Run the full suite:
  npm run ui:maestro:all
EOF

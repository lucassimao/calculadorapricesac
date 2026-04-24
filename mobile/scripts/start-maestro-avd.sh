#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-cold}"
ANDROID_HOME="${ANDROID_HOME:-$HOME/ProgrammingTools/Android}"
AVD_NAME="${AVD_NAME:-Small_Phone_360x640}"
GPU_MODE="${GPU_MODE:-swiftshader}"
SNAPSHOT_NAME="${SNAPSHOT_NAME:-maestro-ready}"
EMULATOR_BIN="${EMULATOR_BIN:-$ANDROID_HOME/emulator/emulator}"

common_args=(
  "@$AVD_NAME"
  -gpu "$GPU_MODE"
  -no-boot-anim
  -no-audio
  -netfast
  -no-snapshot-save
)

case "$MODE" in
  cold)
    exec "$EMULATOR_BIN" "${common_args[@]}" -no-snapshot-load
    ;;
  fast)
    exec "$EMULATOR_BIN" "${common_args[@]}" -snapshot "$SNAPSHOT_NAME"
    ;;
  *)
    echo "Usage: $0 [cold|fast]" >&2
    exit 2
    ;;
esac

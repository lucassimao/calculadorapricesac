#!/usr/bin/env bash
set -euo pipefail

MOBILE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CAPTURE_DIR="$MOBILE_DIR/../marketing/public/recursos/_captures"
APP_ID="${APP_ID:-com.lsimaocosta.calculadorapricesac}"
MAESTRO_BIN="${MAESTRO_BIN:-$HOME/.maestro/bin/maestro}"

mkdir -p "$CAPTURE_DIR"
find "$CAPTURE_DIR" -maxdepth 1 -type f -name '*.png' -delete
adb shell pm clear "$APP_ID" >/dev/null

for flow in "$MOBILE_DIR"/maestro/screenshots/*.yaml; do
  echo "===== ${flow#"$MOBILE_DIR/"} ====="
  "$MAESTRO_BIN" test "$flow"
done

bash "$MOBILE_DIR/scripts/prepare-marketing-screenshots.sh"

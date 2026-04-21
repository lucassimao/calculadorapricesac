#!/usr/bin/env bash
set -euo pipefail

APP_ID="${APP_ID:-com.lsimaocosta.calculadorapricesac}"
MAESTRO_BIN="${MAESTRO_BIN:-$HOME/.maestro/bin/maestro}"

run_suite() {
  local suite_dir="$1"

  for flow in $(find "$suite_dir" -maxdepth 1 -type f -name '*.yaml' | sort); do
    echo "===== $flow ====="
    adb shell pm clear "$APP_ID" >/dev/null
    "$MAESTRO_BIN" test "$flow"
  done
}

case "${1:-top-level}" in
  top-level)
    run_suite maestro
    ;;
  readback)
    run_suite maestro/readback
    ;;
  all)
    run_suite maestro
    run_suite maestro/readback
    ;;
  *)
    echo "Usage: $0 [top-level|readback|all]" >&2
    exit 2
    ;;
esac

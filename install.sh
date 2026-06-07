#!/usr/bin/env bash
set -euo pipefail

CHANNEL="stable"
APP_DIR="/Applications"
INSTALL_CLI=1
BOOTSTRAP=1
JSON=0
REPO="patleeman/neon-pilot"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --channel)
      CHANNEL="${2:?--channel requires stable or rc}"
      shift 2
      ;;
    --app-dir)
      APP_DIR="${2:?--app-dir requires a path}"
      shift 2
      ;;
    --repo)
      REPO="${2:?--repo requires owner/name}"
      shift 2
      ;;
    --install-cli)
      INSTALL_CLI=1
      shift
      ;;
    --no-install-cli)
      INSTALL_CLI=0
      shift
      ;;
    --bootstrap)
      BOOTSTRAP=1
      shift
      ;;
    --no-bootstrap)
      BOOTSTRAP=0
      shift
      ;;
    --json)
      JSON=1
      shift
      ;;
    -h|--help)
      cat <<'USAGE'
Usage: install.sh [--channel stable|rc] [--app-dir /Applications] [--install-cli] [--bootstrap] [--json]

Installs the signed Neon Pilot macOS app from GitHub releases, launches it once,
installs the neon-pilot CLI when requested, and runs bootstrap doctor when the
CLI is available.
USAGE
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Neon Pilot packaged install currently supports macOS only." >&2
  exit 1
fi

require() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require curl
require ditto
require python3

TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/neon-pilot-install.XXXXXX")"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

if [[ -n "${XDG_STATE_HOME:-}" ]]; then
  STATE_PARENT="$XDG_STATE_HOME"
else
  STATE_PARENT="$HOME/.local/state"
fi
if [[ "$CHANNEL" == "rc" ]]; then
  STATE_ROOT="$STATE_PARENT/neon-pilot-rc"
else
  STATE_ROOT="$STATE_PARENT/neon-pilot"
fi
STATE_CLI="$STATE_ROOT/bin/neon-pilot"

run_neon_pilot() {
  if command -v neon-pilot >/dev/null 2>&1; then
    neon-pilot "$@"
    return
  fi
  "$STATE_CLI" "$@"
}

API_URL="https://api.github.com/repos/${REPO}/releases"
if [[ "$CHANNEL" == "rc" ]]; then
  RELEASE_JSON="$(curl -fsSL "$API_URL" | python3 -c 'import json,sys; releases=json.load(sys.stdin); print(json.dumps(next((r for r in releases if r.get("prerelease")), releases[0])))')"
else
  RELEASE_JSON="$(curl -fsSL "${API_URL}/latest")"
fi

ASSET_URL="$(python3 -c '
import json,sys
release=json.loads(sys.argv[1])
assets=release.get("assets", [])
preferred=[a for a in assets if a.get("name","").endswith(".zip") and ".blockmap" not in a.get("name","")]
if not preferred:
    raise SystemExit("No macOS zip artifact found in release")
print(preferred[0]["browser_download_url"])
' "$RELEASE_JSON")"

ASSET_NAME="$(basename "$ASSET_URL")"
ARCHIVE_PATH="$TMP_DIR/$ASSET_NAME"
curl -fL "$ASSET_URL" -o "$ARCHIVE_PATH"

UNPACK_DIR="$TMP_DIR/unpack"
mkdir -p "$UNPACK_DIR"
ditto -x -k "$ARCHIVE_PATH" "$UNPACK_DIR"

APP_PATH="$(find "$UNPACK_DIR" -maxdepth 2 -name 'Neon Pilot*.app' -type d | head -n 1)"
if [[ -z "$APP_PATH" ]]; then
  echo "Downloaded artifact did not contain Neon Pilot.app." >&2
  exit 1
fi

mkdir -p "$APP_DIR"
TARGET_APP="$APP_DIR/$(basename "$APP_PATH")"
rm -rf "$TARGET_APP"
ditto "$APP_PATH" "$TARGET_APP"

if command -v spctl >/dev/null 2>&1; then
  spctl --assess --type execute "$TARGET_APP" >/dev/null
fi

open -g "$TARGET_APP"

CLI_READY=0
CLI_STATUS_ERROR=""
for attempt in {1..60}; do
  if { command -v neon-pilot >/dev/null 2>&1 || [[ -x "$STATE_CLI" ]]; } && CLI_STATUS_ERROR="$(run_neon_pilot cli status --json 2>&1 >/dev/null)"; then
    CLI_READY=1
    break
  fi
  if [[ "$JSON" != "1" && $((attempt % 10)) -eq 0 ]]; then
    echo "Waiting for Neon Pilot CLI launcher at $STATE_CLI..." >&2
  fi
  sleep 1
done
if [[ "$CLI_READY" != "1" && -z "$CLI_STATUS_ERROR" ]]; then
  CLI_STATUS_ERROR="Neon Pilot CLI launcher was not found at $STATE_CLI after 60 seconds."
fi

CLI_INSTALLED=0
if [[ "$INSTALL_CLI" == "1" && "$CLI_READY" == "1" ]]; then
  run_neon_pilot cli install --json >/dev/null
  CLI_INSTALLED=1
fi

BOOTSTRAP_READY=0
if [[ "$BOOTSTRAP" == "1" && "$CLI_READY" == "1" ]]; then
  if run_neon_pilot bootstrap doctor --json >/dev/null 2>&1; then
    BOOTSTRAP_READY=1
  fi
fi

if [[ "$JSON" == "1" ]]; then
  python3 -c '
import json,sys
print(json.dumps({
  "installed": True,
  "appPath": sys.argv[1],
  "stateRoot": sys.argv[2],
  "stateCli": sys.argv[3],
  "cliReady": sys.argv[4] == "1",
  "cliInstalled": sys.argv[5] == "1",
  "bootstrapDoctorReady": sys.argv[6] == "1",
  "cliError": None if sys.argv[7] == "" else sys.argv[7],
  "mcp": {"mcpServers": {"neon-pilot": {"command": "neon-pilot", "args": ["protocol", "neon-pilot-agent-mcp"]}}},
}, indent=2))
' "$TARGET_APP" "$STATE_ROOT" "$STATE_CLI" "$CLI_READY" "$CLI_INSTALLED" "$BOOTSTRAP_READY" "$CLI_STATUS_ERROR"
else
  echo "Installed $TARGET_APP"
  echo "State root: $STATE_ROOT"
  echo "CLI ready: $CLI_READY"
  echo "CLI installed: $CLI_INSTALLED"
  echo "Bootstrap doctor ready: $BOOTSTRAP_READY"
  if [[ "$CLI_READY" != "1" ]]; then
    echo "CLI error: $CLI_STATUS_ERROR" >&2
  fi
fi

#!/usr/bin/env bash
# run_dev.sh — serve project/ over HTTP for local testing.
#
# Usage:
#   ./run_dev.sh                # port 8000, all interfaces, no browser
#   ./run_dev.sh -p 8080        # custom port
#   ./run_dev.sh -b 127.0.0.1   # localhost only
#   ./run_dev.sh -o             # open default browser to the page
#   ./run_dev.sh -h             # help
#
# `file://` doesn't work because config-loader.jsx does fetch("./config.json").
# This script picks the first available static server: python3 → busybox → npx serve.
#
# HA token (first load):
#   • paste a long-lived token in the TokenPrompt modal — saved to localStorage; OR
#   • set connection.haLongLivedToken in project/config.json for a kiosk default
#     (localStorage still wins, so the prompt overrides it).
#   HA must allow this origin in http.cors_allowed_origins (then restart HA).
#
# To push project/ to the kiosk: see ./deploy.sh (-k installs SSH key for
# passwordless deploys; -n dry-run; remote config.json preserved unless -f).

set -euo pipefail

PORT=8000
BIND=0.0.0.0
OPEN_BROWSER=0
PAGE="index.html"

usage() {
  sed -n '2,21p' "$0" | sed 's/^# \{0,1\}//'
  exit 0
}

while getopts ":p:b:oh" opt; do
  case "$opt" in
    p) PORT="$OPTARG" ;;
    b) BIND="$OPTARG" ;;
    o) OPEN_BROWSER=1 ;;
    h) usage ;;
    \?) echo "unknown flag: -$OPTARG" >&2; exit 2 ;;
    :)  echo "flag -$OPTARG needs a value" >&2; exit 2 ;;
  esac
done

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR/project"

if [[ ! -d "$PROJECT_DIR" ]]; then
  echo "✕ project/ not found at $PROJECT_DIR" >&2
  exit 1
fi
if [[ ! -f "$PROJECT_DIR/$PAGE" ]]; then
  echo "✕ $PAGE not found in project/" >&2
  exit 1
fi
if [[ ! -f "$PROJECT_DIR/config.json" ]]; then
  echo "✕ config.json not found in project/ — generate it first" >&2
  exit 1
fi

if command -v lsof >/dev/null && lsof -iTCP:"$PORT" -sTCP:LISTEN -Pn >/dev/null 2>&1; then
  echo "✕ port $PORT already in use" >&2
  echo "  hint: ./run_dev.sh -p 8001" >&2
  exit 1
fi

LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}' || true)"
URL_LOCAL="http://localhost:$PORT/"
URL_LAN=""
if [[ -n "$LAN_IP" && "$BIND" == "0.0.0.0" ]]; then
  URL_LAN="http://$LAN_IP:$PORT/"
fi

cat <<EOF
─── Holo Home OS dev server ─────────────────────────────────────
  serving: $PROJECT_DIR
  bind:    $BIND
  port:    $PORT
  local:   $URL_LOCAL
EOF
[[ -n "$URL_LAN" ]] && echo "  LAN:     $URL_LAN"
cat <<'EOF'
  stop:    Ctrl-C
  notes:   first load shows TokenPrompt — paste a long-lived HA token.
           HA needs this origin in http.cors_allowed_origins (then restart HA).
─────────────────────────────────────────────────────────────────
EOF

if [[ "$OPEN_BROWSER" == "1" ]]; then
  ( sleep 0.6 && (xdg-open "$URL_LOCAL" >/dev/null 2>&1 || open "$URL_LOCAL" >/dev/null 2>&1 || true) ) &
fi

cd "$PROJECT_DIR"

if command -v python3 >/dev/null; then
  exec python3 -m http.server "$PORT" --bind "$BIND"
elif command -v python >/dev/null; then
  exec python -m http.server "$PORT" --bind "$BIND"
elif command -v busybox >/dev/null; then
  exec busybox httpd -f -p "$BIND:$PORT"
elif command -v npx >/dev/null; then
  if [[ "$BIND" == "0.0.0.0" ]]; then
    exec npx --yes serve -l "$PORT" .
  else
    exec npx --yes serve -l "tcp://$BIND:$PORT" .
  fi
else
  echo "✕ no static server found (need python3, busybox, or npx)" >&2
  exit 1
fi

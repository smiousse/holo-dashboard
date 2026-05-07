#!/usr/bin/env bash
# deploy.sh — push project/ to the lighttpd kiosk over SSH (no remote rsync).
#
# Target host/path: HOST and REMOTE_PATH (defaults: root@10.40.30.250:/var/www/holohome/).
# Source order: defaults → .env (next to deploy.sh) → -H/-P flags.
# config.json is preserved on the target (it holds haLongLivedToken).
#
# Transport: tar piped over ssh — works on minimal hosts (DietPi, busybox).
# Requires locally: ssh, scp, tar.
# Requires remotely: ssh shell + tar (BusyBox tar is fine).
#
# Usage:
#   ./deploy.sh                 # deploy to default host/path
#   ./deploy.sh -n              # dry-run (list files, no transfer)
#   ./deploy.sh -H host -P path # override target
#   ./deploy.sh -f              # force overwrite of remote config.json
#   ./deploy.sh -k              # install your SSH key on the remote, then exit
#                               # (one-time setup so future runs need no password)
#   ./deploy.sh -h              # help
#
# Multiple password prompts are avoided via SSH ControlMaster (single auth per run).
# For zero prompts, run `./deploy.sh -k` once.

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

# Load .env if present (HOST, REMOTE_PATH). CLI flags still win.
ENV_FILE="${ENV_FILE:-$SCRIPT_DIR/.env}"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

HOST="${HOST:-root@127.0.0.1}"
REMOTE_PATH="${REMOTE_PATH:-/var/www/}"
DRY_RUN=0
FORCE_CONFIG=0
INSTALL_KEY=0

usage() { sed -n '2,21p' "$0" | sed 's/^# \{0,1\}//'; exit 0; }

while getopts ":H:P:nfkh" opt; do
  case "$opt" in
    H) HOST="$OPTARG" ;;
    P) REMOTE_PATH="$OPTARG" ;;
    n) DRY_RUN=1 ;;
    f) FORCE_CONFIG=1 ;;
    k) INSTALL_KEY=1 ;;
    h) usage ;;
    \?) echo "unknown flag: -$OPTARG" >&2; exit 2 ;;
    :)  echo "flag -$OPTARG needs a value" >&2; exit 2 ;;
  esac
done

# -k: install local SSH pubkey on remote so future runs are passwordless.
if [[ "$INSTALL_KEY" == "1" ]]; then
  if ! ls "$HOME"/.ssh/id_*.pub >/dev/null 2>&1; then
    echo "✕ no SSH pubkey found in ~/.ssh/. Generate one: ssh-keygen -t ed25519" >&2
    exit 1
  fi
  if command -v ssh-copy-id >/dev/null; then
    ssh-copy-id "$HOST"
  else
    cat "$HOME"/.ssh/id_*.pub | ssh "$HOST" "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
  fi
  echo "✓ key installed on $HOST — future deploys need no password"
  exit 0
fi

PROJECT_DIR="$SCRIPT_DIR/project"

[[ -d "$PROJECT_DIR"             ]] || { echo "✕ project/ not found at $PROJECT_DIR" >&2; exit 1; }
[[ -f "$PROJECT_DIR/index.html"  ]] || { echo "✕ project/index.html missing" >&2; exit 1; }
[[ -f "$PROJECT_DIR/config.json" ]] || { echo "✕ project/config.json missing — generate it first" >&2; exit 1; }

command -v ssh >/dev/null || { echo "✕ ssh not installed locally" >&2; exit 1; }
command -v scp >/dev/null || { echo "✕ scp not installed locally" >&2; exit 1; }
command -v tar >/dev/null || { echo "✕ tar not installed locally" >&2; exit 1; }

EXCLUDES=( --exclude='config.json' --exclude='.DS_Store' )

# Connection multiplexing: open one SSH master, reuse it for every ssh/scp
# call below — only one password prompt per deploy run.
SSH_CTL="$(mktemp -u "${TMPDIR:-/tmp}/holohome-ssh.XXXXXX")"
SSH_OPTS=( -o "ControlMaster=auto" -o "ControlPath=$SSH_CTL" -o "ControlPersist=60s" )
cleanup() {
  ssh "${SSH_OPTS[@]}" -O exit "$HOST" 2>/dev/null || true
  rm -f "$SSH_CTL"
}
trap cleanup EXIT
# Prime the master connection (single password prompt happens here).
ssh "${SSH_OPTS[@]}" -fN "$HOST"

cat <<EOF
─── Holo Home OS deploy ─────────────────────────────────────────
  source:  $PROJECT_DIR/
  target:  $HOST:$REMOTE_PATH/
  dry-run: $DRY_RUN
  force config.json: $FORCE_CONFIG
─────────────────────────────────────────────────────────────────
EOF

if [[ "$DRY_RUN" == "1" ]]; then
  echo "[dry-run] files that would be transferred:"
  tar -C "$PROJECT_DIR" "${EXCLUDES[@]}" -cvf /dev/null . | sed 's|^\./|  |'
  echo "[dry-run] config.json: would $( [[ "$FORCE_CONFIG" == "1" ]] && echo overwrite || echo "preserve if remote exists, else upload" )"
  exit 0
fi

# Ensure remote dir exists, then wipe everything inside EXCEPT config.json so
# stale assets don't accumulate (mirrors rsync --delete semantics).
ssh "${SSH_OPTS[@]}" "$HOST" "mkdir -p '$REMOTE_PATH' && find '$REMOTE_PATH' -mindepth 1 -maxdepth 1 ! -name config.json -exec rm -rf {} +"

# Pipe a tar of project/ (minus config.json) into a tar -x on the remote.
tar -C "$PROJECT_DIR" "${EXCLUDES[@]}" -cf - . \
  | ssh "${SSH_OPTS[@]}" "$HOST" "tar -C '$REMOTE_PATH' -xf -"

# Handle config.json separately: only copy if missing remotely (or -f).
if [[ "$FORCE_CONFIG" == "1" ]]; then
  echo "→ force-overwriting config.json"
  scp "${SSH_OPTS[@]}" "$PROJECT_DIR/config.json" "$HOST:$REMOTE_PATH/config.json"
elif ssh "${SSH_OPTS[@]}" "$HOST" "test -f '$REMOTE_PATH/config.json'"; then
  echo "✓ remote config.json exists — preserved (use -f to overwrite)"
else
  echo "→ remote config.json missing — uploading"
  scp "${SSH_OPTS[@]}" "$PROJECT_DIR/config.json" "$HOST:$REMOTE_PATH/config.json"
fi

echo "✓ deploy complete"

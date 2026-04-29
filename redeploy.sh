#!/usr/bin/env bash
# Cheltuieli - Redeploy Script
# Syncs local changes to the Proxmox LXC, rebuilds the frontend, and restarts the service.
#
# Usage:
#   ./redeploy.sh                      # deploy to default host (172.16.10.26)
#   ./redeploy.sh 172.16.10.26         # deploy to specified host
#   CHELT_HOST=1.2.3.4 ./redeploy.sh   # deploy to host from env var
#
# Authentication:
#   - SSH key auth is preferred (set up with `ssh-copy-id root@HOST`).
#   - If key auth is not set up, you'll be prompted for the root password
#     on each SSH/rsync call (3-4 prompts total).
#   - To avoid prompts, export CHELT_SSHPASS='yourpassword' and install sshpass.

set -euo pipefail

# ── Configuration ────────────────────────────────────────────────────────────
HOST="${1:-${CHELT_HOST:-172.16.10.26}}"
USER="${CHELT_USER:-root}"
REMOTE_DIR="${CHELT_REMOTE_DIR:-/opt/cheltuieli}"
SERVICE_NAME="${CHELT_SERVICE:-cheltuieli}"
SERVICE_USER="${CHELT_SERVICE_USER:-cheltuieli}"
APP_PORT="${CHELT_PORT:-3001}"

# Color output
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

log()  { echo -e "${BLUE}→${NC} $*"; }
ok()   { echo -e "${GREEN}✓${NC} $*"; }
warn() { echo -e "${YELLOW}⚠${NC} $*"; }
fail() { echo -e "${RED}✗${NC} $*" >&2; exit 1; }

# ── SSH wrapper (supports CHELT_SSHPASS for non-interactive use) ─────────────
SSH_OPTS=(-o StrictHostKeyChecking=accept-new -o ConnectTimeout=10)

ssh_cmd() {
    if [[ -n "${CHELT_SSHPASS:-}" ]] && command -v sshpass >/dev/null 2>&1; then
        SSHPASS="$CHELT_SSHPASS" sshpass -e ssh "${SSH_OPTS[@]}" "$USER@$HOST" "$@"
    else
        ssh "${SSH_OPTS[@]}" "$USER@$HOST" "$@"
    fi
}

rsync_cmd() {
    if [[ -n "${CHELT_SSHPASS:-}" ]] && command -v sshpass >/dev/null 2>&1; then
        SSHPASS="$CHELT_SSHPASS" sshpass -e rsync -avz -e "ssh ${SSH_OPTS[*]}" "$@"
    else
        rsync -avz -e "ssh ${SSH_OPTS[*]}" "$@"
    fi
}

# ── Banner ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}╔════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║  Cheltuieli — Redeploy                 ║${NC}"
echo -e "${BOLD}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Host:       ${BOLD}$USER@$HOST${NC}"
echo -e "  Remote dir: ${BOLD}$REMOTE_DIR${NC}"
echo -e "  Service:    ${BOLD}$SERVICE_NAME${NC}"
echo ""

# ── Pre-flight checks ────────────────────────────────────────────────────────
[[ -d "backend" && -d "frontend" ]] || fail "Run this script from the project root (backend/ and frontend/ must exist)"

if [[ -n "${CHELT_SSHPASS:-}" ]] && ! command -v sshpass >/dev/null 2>&1; then
    warn "CHELT_SSHPASS is set but sshpass is not installed — falling back to interactive auth"
fi

log "Checking SSH connectivity..."
if ! ssh_cmd "echo ok" >/dev/null 2>&1; then
    fail "SSH connection failed. Verify host, credentials, or set up key auth with: ssh-copy-id $USER@$HOST"
fi
ok "SSH reachable"

# ── Sync source files ────────────────────────────────────────────────────────
log "Syncing source files to $USER@$HOST:$REMOTE_DIR..."
rsync_cmd \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='data' \
    --exclude='frontend/dist' \
    --exclude='*.log' \
    --exclude='.env' \
    --exclude='*.xlsx' \
    --exclude='*.xls' \
    --exclude='*.db' \
    ./ "$USER@$HOST:$REMOTE_DIR/"
ok "Source synced"

# ── Install backend dependencies ─────────────────────────────────────────────
log "Installing backend dependencies..."
ssh_cmd "cd $REMOTE_DIR/backend && npm install --omit=dev --no-audit --no-fund 2>&1 | tail -3"
ok "Backend deps installed"

# ── Build frontend ───────────────────────────────────────────────────────────
log "Installing frontend dependencies..."
ssh_cmd "cd $REMOTE_DIR/frontend && npm install --no-audit --no-fund 2>&1 | tail -3"

log "Building frontend..."
ssh_cmd "cd $REMOTE_DIR/frontend && npm run build 2>&1 | tail -5"
ok "Frontend built"

# ── Fix ownership ────────────────────────────────────────────────────────────
log "Fixing ownership..."
ssh_cmd "chown -R $SERVICE_USER:$SERVICE_USER $REMOTE_DIR"
ok "Ownership set to $SERVICE_USER"

# ── Restart service ──────────────────────────────────────────────────────────
log "Restarting $SERVICE_NAME service..."
ssh_cmd "systemctl restart $SERVICE_NAME && sleep 2"

# ── Verify ───────────────────────────────────────────────────────────────────
log "Verifying service is healthy..."
STATUS=$(ssh_cmd "systemctl is-active $SERVICE_NAME" 2>&1 || echo "unknown")

if [[ "$STATUS" == "active" ]]; then
    ok "Service is ${GREEN}active${NC}"
    echo ""
    ssh_cmd "journalctl -u $SERVICE_NAME -n 5 --no-pager" || true
    echo ""
    ok "Deploy complete — app available at ${BOLD}http://$HOST:$APP_PORT${NC}"
else
    warn "Service status: $STATUS"
    echo ""
    echo "Recent logs:"
    ssh_cmd "journalctl -u $SERVICE_NAME -n 30 --no-pager" || true
    fail "Service is not healthy. Check logs above."
fi

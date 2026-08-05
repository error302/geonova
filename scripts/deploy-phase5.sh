#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# METARDU Phase 5 — Production Deployment Script
# Run this on the GCP VM after SSH'ing in.
#
# Usage:
#   cd ~/metardu && bash scripts/deploy-phase5.sh
#
# What this does:
#   1. Pulls latest code from GitHub
#   2. Applies pending database migrations
#   3. Ensures NVIDIA_API_KEY is in .env.local
#   4. Rebuilds and restarts via Docker Compose
#   5. Verifies AI endpoint, health, and key routes
#   6. Sets up backup cron if not already present
# ═══════════════════════════════════════════════════════════════════════════

set -eo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; }

# ─── Step 1: Pull latest code ────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════"
echo "  METARDU Phase 5 — Production Deployment"
echo "═══════════════════════════════════════════════════════"
echo ""

echo "[1/7] Pulling latest code from GitHub..."
git stash --include-untracked 2>/dev/null || true
git pull origin main
log "Code updated"

# ─── Step 2: Apply pending database migrations ───────────────────────────────
echo ""
echo "[2/7] Checking database migrations..."

# Source .env.local for DATABASE_URL
if [ -f .env.local ]; then
  set -a; source .env.local; set +a
else
  err ".env.local not found! Create it first."
  exit 1
fi

node scripts/run-migrations.js --status

echo ""
read -p "Apply pending migrations? [Y/n] " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Nn]$ ]]; then
  node scripts/run-migrations.js
  log "Migrations applied"
else
  warn "Skipping migrations"
fi

# ─── Step 3: Ensure NVIDIA_API_KEY in .env.local ────────────────────────────
echo ""
echo "[3/7] Checking NVIDIA_API_KEY in .env.local..."

if grep -q 'NVIDIA_API_KEY=nvapi-' .env.local 2>/dev/null; then
  log "NVIDIA_API_KEY is configured"
else
  warn "NVIDIA_API_KEY is not set or empty"
  echo ""
  read -p "Enter your NVIDIA API key (nvapi-...): " NVIDIA_KEY
  if [[ "$NVIDIA_KEY" == nvapi-* ]]; then
    # Remove any existing empty line or key, then add
    sed -i '/^NVIDIA_API_KEY=/d' .env.local 2>/dev/null || true
    echo "" >> .env.local
    echo "# ─── AI: NVIDIA NIM ───" >> .env.local
    echo "NVIDIA_API_KEY=$NVIDIA_KEY" >> .env.local
    log "NVIDIA_API_KEY added to .env.local"
  else
    err "Invalid key format — must start with 'nvapi-'"
    echo "You can set it manually later: echo 'NVIDIA_API_KEY=your-key' >> .env.local"
  fi
fi

# ─── Step 4: Ensure required env vars ────────────────────────────────────────
echo ""
echo "[4/7] Verifying required environment variables..."

MISSING=0
for VAR in DATABASE_URL AUTH_SECRET; do
  if ! grep -q "${VAR}=.affer" .env.local 2>/dev/null && ! printenv $VAR > /dev/null 2>&1; then
    err "$VAR is not set"
    MISSING=1
  else
    log "$VAR is set"
  fi
done

if [ $MISSING -eq 1 ]; then
  err "Required variables missing. Set them in .env.local before continuing."
  exit 1
fi

# ─── Step 5: Rebuild and restart Docker ──────────────────────────────────────
echo ""
echo "[5/7] Rebuilding Docker container..."

# Fix DATABASE_URL for Docker (use host.docker.internal instead of localhost)
if grep -q '@localhost:5432' .env.local 2>/dev/null; then
  warn "DATABASE_URL uses localhost — updating for Docker (host.docker.internal)..."
  sed -i 's|@localhost:5432|@host.docker.internal:5432|g' .env.local
fi

docker compose up -d --build

echo "Waiting for container to become healthy..."
for i in $(seq 1 24); do
  sleep 5
  if docker inspect --format='{{.State.Health.Status}}' metardu_nextjs 2>/dev/null | grep -q "healthy"; then
    log "Container healthy after $((i * 5)) seconds"
    break
  fi
  if [ $i -eq 24 ]; then
    err "Container did not become healthy within 2 minutes"
    docker logs --tail 50 metardu_nextjs 2>&1
    exit 1
  fi
  echo "  Waiting... ($((i * 5))s)"
done

# ─── Step 6: Verify endpoints ────────────────────────────────────────────────
echo ""
echo "[6/7] Verifying production endpoints..."

# Health check
HEALTH=$(curl -sf http://localhost:3000/api/public/health 2>/dev/null || echo '{"status":"error"}')
if echo "$HEALTH" | grep -q '"healthy"'; then
  log "Health endpoint: OK"
else
  err "Health endpoint: FAILED — $HEALTH"
fi

# AI configuration check
AI_STATUS=$(curl -sf http://localhost:3000/api/ai/chat 2>/dev/null || echo '{"configured":false}')
if echo "$AI_STATUS" | grep -q '"configured":true'; then
  log "AI endpoint: Configured (NVIDIA API key active)"
else
  warn "AI endpoint: Not configured (NVIDIA_API_KEY may be missing)"
fi

# External check
EXTERNAL=$(curl -sf -o /dev/null -w "%{http_code}" https://metardu.space/ --max-time 15 2>/dev/null || echo "000")
if [ "$EXTERNAL" = "200" ]; then
  log "External site: HTTP 200"
else
  warn "External site: HTTP $EXTERNAL"
fi

# ─── Step 7: Set up backup cron ──────────────────────────────────────────────
echo ""
echo "[7/7] Checking backup cron..."

BACKUP_SCRIPT="$APP_DIR/scripts/backup.sh"
if [ -f "$BACKUP_SCRIPT" ]; then
  chmod +x "$BACKUP_SCRIPT"
  
  if crontab -l 2>/dev/null | grep -q "backup.sh"; then
    log "Backup cron already scheduled"
  else
    echo ""
    read -p "Set up daily backup at 2:00 AM? [Y/n] " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
      (crontab -l 2>/dev/null; echo "0 2 * * * $BACKUP_SCRIPT >> /var/log/metardu-backup.log 2>&1") | crontab -
      log "Backup cron scheduled: daily at 2:00 AM"
    fi
  fi
else
  warn "backup.sh not found — skipping cron setup"
fi

# ─── Summary ─────────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════"
echo "  Phase 5 Deployment Complete!"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "  Site:      https://metardu.space"
echo "  Health:    https://metardu.space/api/public/health"
echo "  AI status: https://metardu.space/api/ai/chat (GET)"
echo ""
echo "  Next steps:"
echo "  - Set up Sentry DSN in .env.local for error monitoring"
echo "  - Configure UPSTASH_REDIS_REST_URL for production rate limiting"
echo "  - Review AI call limits per tier in /api/ai/chat route"
echo ""

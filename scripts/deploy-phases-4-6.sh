#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# METARDU Deploy Script — Phases 4, 5, 6
# ─────────────────────────────────────────────────────────────────────────────
# Run this on the GCP instance: bash scripts/deploy-phases-4-6.sh
# ═══════════════════════════════════════════════════════════════════════════════

set -e

METARDU_DIR="$HOME/metardu"
MIGRATION_FILE="src/lib/db/migrations/007_phase4_5_6_tables.sql"

echo "============================================================"
echo " METARDU Deployment — Phases 4/5/6"
echo " $(date)"
echo "============================================================"

# ── Step 1: Pull latest code ─────────────────────────────────────────────
echo ""
echo "[1/5] Pulling latest code from GitHub..."
cd "$METARDU_DIR"
git fetch origin
git reset --hard origin/main
echo "  → Code updated to $(git log --oneline -1)"

# ── Step 2: Install dependencies ────────────────────────────────────────
echo ""
echo "[2/5] Installing Node.js dependencies..."
npm install --legacy-peer-deps 2>&1 | tail -5
echo "  → Node.js dependencies installed"

# ── Step 3: Run database migration ──────────────────────────────────────
echo ""
echo "[3/5] Running database migration 007..."
# Read DATABASE_URL from .env if it exists
if [ -f .env ]; then
  export $(grep DATABASE_URL .env | head -1)
fi

if [ -z "$DATABASE_URL" ]; then
  echo "  ⚠ DATABASE_URL not found, trying local postgres..."
  DATABASE_URL="postgres://metardu:metardu@localhost:5432/metardu"
fi

echo "  → Running $MIGRATION_FILE ..."
psql "$DATABASE_URL" -f "$MIGRATION_FILE" 2>&1
echo "  → Migration complete"

# ── Step 4: Install Python dependencies (for worker) ────────────────────
echo ""
echo "[4/5] Installing Python dependencies for worker..."
if [ -f requirements.txt ]; then
  pip3 install -r requirements.txt 2>&1 | tail -5
  echo "  → Python dependencies installed"
else
  echo "  ⚠ requirements.txt not found, skipping Python setup"
fi

# ── Step 5: Restart services ────────────────────────────────────────────
echo ""
echo "[5/5] Restarting services..."

# Stop existing PM2 processes
if command -v pm2 &>/dev/null; then
  echo "  → Stopping PM2 processes..."
  pm2 stop metardu 2>/dev/null || true
  pm2 delete metardu 2>/dev/null || true
  pm2 stop metardu-worker 2>/dev/null || true
  pm2 delete metardu-worker 2>/dev/null || true
fi

# Rebuild and restart with PM2
echo "  → Starting METARDU (2 cluster instances)..."
pm2 start ecosystem.config.cjs --only metardu
echo "  → Starting worker..."
pm2 start ecosystem.config.cjs --only metardu-worker
pm2 save
echo "  → PM2 processes started"

# Show status
echo ""
echo "============================================================"
echo " Deployment Complete!"
echo "============================================================"
pm2 list
echo ""
echo "  → App:  http://localhost:3000 (proxied via Nginx)"
echo "  → HTTPS: https://metardu.space"
echo "  → Worker: Running (polling every 5s)"
echo ""
echo "  API endpoints added:"
echo "    POST /api/compute/export/shapefile   (Phase 5)"
echo "    POST/GET /api/workers/job            (Phase 6)"
echo ""
echo "  Tables created by migration 007:"
echo "    submission_sequences, peer_reviews, payment_intents,"
echo "    payment_logs, background_jobs, form_c22_audits"
echo ""

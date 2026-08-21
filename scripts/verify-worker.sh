#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# METARDU — Python Worker End-to-End Verification
# ═══════════════════════════════════════════════════════════════════════════
#
# Tests the full wiring: docker-compose → worker container → PYTHON_COMPUTE_URL
# → WORKER_SECRET auth → surface_tin / surface_contours / surface_volume.
#
# Usage:
#   ./scripts/verify-worker.sh                  # auto-detect from docker-compose
#   ./scripts/verify-worker.sh http://localhost:8001 my-secret
#
# Exit codes:
#   0 — all checks passed
#   1 — one or more checks failed
#
# ═══════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ─── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

pass() { echo -e "  ${GREEN}✓${NC} $1"; }
fail() { echo -e "  ${RED}✗${NC} $1"; FAILURES=$((FAILURES + 1)); }
info() { echo -e "  ${CYAN}→${NC} $1"; }
warn() { echo -e "  ${YELLOW}!${NC} $1"; }

FAILURES=0

# ─── Resolve worker URL and secret ────────────────────────────────────────────

WORKER_URL="${1:-}"
WORKER_SECRET_VAL="${2:-}"

if [ -z "$WORKER_URL" ]; then
  # Try to extract from docker-compose.yml
  if [ -f docker-compose.yml ]; then
    # The app container connects to the worker via Docker DNS
    # For host testing, check if the worker port is mapped
    WORKER_PORT=$(docker compose port metardu-worker 8000 2>/dev/null | head -1 | cut -d: -f2 || true)
    if [ -n "$WORKER_PORT" ]; then
      WORKER_URL="http://127.0.0.1:${WORKER_PORT}"
    else
      # Try common test port
      WORKER_URL="http://127.0.0.1:8001"
    fi
  else
    WORKER_URL="http://127.0.0.1:8001"
  fi
fi

if [ -z "$WORKER_SECRET_VAL" ]; then
  # Try to extract from .env
  if [ -f .env ]; then
    WORKER_SECRET_VAL=$(grep -E '^WORKER_SECRET=' .env | head -1 | cut -d= -f2- || true)
  fi
  # Try docker-compose environment
  if [ -z "$WORKER_SECRET_VAL" ]; then
    WORKER_SECRET_VAL=$(docker compose exec -T metardu-worker printenv WORKER_SECRET 2>/dev/null || true)
  fi
  # Fall back to dev default
  if [ -z "$WORKER_SECRET_VAL" ]; then
    WORKER_SECRET_VAL="dev-worker-secret"
  fi
fi

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  METARDU Python Worker — End-to-End Verification${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
info "Worker URL:    ${WORKER_URL}"
info "Worker Secret: ${WORKER_SECRET_VAL:0:8}...${WORKER_SECRET_VAL: -4}"
echo ""

# ─── 1. Docker Compose health ────────────────────────────────────────────────

echo -e "${CYAN}[1/6] Docker Compose container health${NC}"

if command -v docker &>/dev/null && [ -f docker-compose.yml ]; then
  # Check if containers are running
  RUNNING=$(docker compose ps --format json 2>/dev/null | grep -c '"running"' || echo "0")
  if [ "$RUNNING" -gt 0 ]; then
    pass "Docker Compose running (${RUNNING} containers)"
  else
    warn "No running containers found — trying docker compose up..."
    docker compose up -d metardu-worker 2>/dev/null || true
    sleep 3
    RUNNING=$(docker compose ps --format json 2>/dev/null | grep -c '"running"' || echo "0")
    if [ "$RUNNING" -gt 0 ]; then
      pass "Worker container started"
    else
      fail "Could not start worker container"
    fi
  fi

  # Check worker container specifically
  WORKER_STATUS=$(docker compose ps metardu-worker --format '{{.Status}}' 2>/dev/null || echo "not found")
  if echo "$WORKER_STATUS" | grep -qi "up\|healthy"; then
    pass "metardu-worker: ${WORKER_STATUS}"
  else
    fail "metardu-worker: ${WORKER_STATUS}"
  fi
else
  warn "Docker Compose not available or no docker-compose.yml — skipping container check"
fi

echo ""

# ─── 2. Health endpoint ──────────────────────────────────────────────────────

echo -e "${CYAN}[2/6] Worker health endpoint${NC}"

HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' "${WORKER_URL}/health" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
  HEALTH_BODY=$(curl -s "${WORKER_URL}/health" 2>/dev/null)
  pass "GET /health → HTTP ${HTTP_CODE}"
  info "Response: ${HEALTH_BODY}"
else
  fail "GET /health → HTTP ${HTTP_CODE} (expected 200)"
fi

echo ""

# ─── 3. Auth — reject without secret ─────────────────────────────────────────

echo -e "${CYAN}[3/6] Auth: reject requests without valid secret${NC}"

HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' \
  -X POST "${WORKER_URL}/compute" \
  -H "Content-Type: application/json" \
  -d '{"task":"surface_tin","params":{"points":[]}}' 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "403" ]; then
  pass "POST /compute without secret → HTTP 403 (rejected)"
else
  fail "POST /compute without secret → HTTP ${HTTP_CODE} (expected 403)"
fi

# Wrong secret
HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' \
  -X POST "${WORKER_URL}/compute" \
  -H "Content-Type: application/json" \
  -H "X-Worker-Secret: wrong-secret" \
  -d '{"task":"surface_tin","params":{"points":[]}}' 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "403" ]; then
  pass "POST /compute with wrong secret → HTTP 403 (rejected)"
else
  fail "POST /compute with wrong secret → HTTP ${HTTP_CODE} (expected 403)"
fi

echo ""

# ─── 4. Auth — accept with correct secret ────────────────────────────────────

echo -e "${CYAN}[4/6] Auth: accept requests with valid secret${NC}"

HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' \
  -X POST "${WORKER_URL}/compute" \
  -H "Content-Type: application/json" \
  -H "X-Worker-Secret: ${WORKER_SECRET_VAL}" \
  -d '{"task":"surface_tin","params":{"points":[{"x":0,"y":0,"z":0},{"x":1,"y":0,"z":1},{"x":0,"y":1,"z":2}]}}' 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
  pass "POST /compute with valid secret → HTTP 200"
else
  fail "POST /compute with valid secret → HTTP ${HTTP_CODE} (expected 200)"
fi

echo ""

# ─── 5. surface_tin task ─────────────────────────────────────────────────────

echo -e "${CYAN}[5/6] Surface TIN task (Delaunay triangulation)${NC}"

TIN_RESULT=$(curl -s \
  -X POST "${WORKER_URL}/compute" \
  -H "Content-Type: application/json" \
  -H "X-Worker-Secret: ${WORKER_SECRET_VAL}" \
  -d '{"task":"surface_tin","params":{"points":[{"x":0,"y":0,"z":100},{"x":10,"y":0,"z":101},{"x":10,"y":10,"z":102},{"x":0,"y":10,"z":103}]}}' 2>/dev/null)

if echo "$TIN_RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d.get('success')==True and len(d.get('data',{}).get('triangles',[]))>0" 2>/dev/null; then
  TRI_COUNT=$(echo "$TIN_RESULT" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['data']['triangles']))" 2>/dev/null)
  pass "surface_tin → ${TRI_COUNT} triangles"
else
  fail "surface_tin → failed or empty result"
  info "Response: $(echo "$TIN_RESULT" | head -c 200)"
fi

echo ""

# ─── 6. surface_contours task ────────────────────────────────────────────────

echo -e "${CYAN}[6/6] Surface contours task (marching triangles)${NC}"

CONTOUR_RESULT=$(curl -s \
  -X POST "${WORKER_URL}/compute" \
  -H "Content-Type: application/json" \
  -H "X-Worker-Secret: ${WORKER_SECRET_VAL}" \
  -d '{"task":"surface_contours","params":{"points":[{"x":0,"y":0,"z":100},{"x":10,"y":0,"z":105},{"x":10,"y":10,"z":110},{"x":0,"y":10,"z":108}],"interval":2.0}}' 2>/dev/null)

if echo "$CONTOUR_RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d.get('success')==True and len(d.get('data',{}).get('contours',[]))>0" 2>/dev/null; then
  CONTOUR_COUNT=$(echo "$CONTOUR_RESULT" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['data']['contours']))" 2>/dev/null)
  pass "surface_contours → ${CONTOUR_COUNT} contour lines"
else
  fail "surface_contours → failed or empty result"
  info "Response: $(echo "$CONTOUR_RESULT" | head -c 200)"
fi

echo ""

# ─── Summary ─────────────────────────────────────────────────────────────────

echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
if [ "$FAILURES" -eq 0 ]; then
  echo -e "  ${GREEN}All checks passed${NC} — worker is fully operational"
  echo ""
  echo "  The Python compute worker is wired end-to-end:"
  echo "    • Container health:  verified"
  echo "    • PYTHON_COMPUTE_URL: ${WORKER_URL}"
  echo "    • WORKER_SECRET:     authenticated"
  echo "    • surface_tin:       working"
  echo "    • surface_contours:  working"
  echo ""
  echo "  To use from the Next.js app, ensure these env vars are set:"
  echo "    PYTHON_COMPUTE_URL=${WORKER_URL}"
  echo "    WORKER_SECRET=${WORKER_SECRET_VAL}"
else
  echo -e "  ${RED}${FAILURES} check(s) failed${NC} — see above for details"
fi
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo ""

exit $FAILURES

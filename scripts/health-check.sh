#!/usr/bin/env bash
# METARDU Production Health Check
# Run via cron every 5 minutes: */5 * * * * /home/mohameddosho20/metardu/scripts/health-check.sh >> /home/mohameddosho20/metardu/logs/health-check.log 2>&1

set -euo pipefail

LOG_TAG="[HEALTH-$(date '+%Y-%m-%d %H:%M:%S')]"
APP_URL="http://localhost:3000"
HEALTH_ENDPOINT="${APP_URL}/api/health"
ALERT_WEBHOOK="${ALERT_WEBHOOK_URL:-}"  # Slack/Discord webhook for alerts
STATUS=0

log() { echo "$LOG_TAG $1"; }

alert() {
  log "ALERT: $1"
  if [ -n "$ALERT_WEBHOOK" ]; then
    curl -s -X POST "$ALERT_WEBHOOK" -H 'Content-type: application/json' --data "{\"text\":\"🚨 METARDU Alert: $1\"}" > /dev/null 2>&1 || true
  fi
}

# 1. Check PM2 process
log "Checking PM2 process..."
if pm2 describe metardu > /dev/null 2>&1; then
  PM2_STATUS=$(pm2 describe metardu | grep 'status' | head -1 | awk '{print $4}')
  if [ "$PM2_STATUS" != "online" ]; then
    alert "PM2 process is $PM2_STATUS — attempting restart"
    pm2 restart metardu
    STATUS=1
  else
    log "PM2: online ✓"
  fi
else
  alert "PM2 process not found — attempting start"
  cd /home/mohameddosho20/metardu && pm2 start ecosystem.config.cjs
  STATUS=1
fi

# 2. Check HTTP health endpoint
log "Checking HTTP endpoint..."
HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$HEALTH_ENDPOINT" 2>/dev/null || echo "000")
RESPONSE_TIME=$(curl -s -o /dev/null -w '%{time_total}' --max-time 10 "$HEALTH_ENDPOINT" 2>/dev/null || echo "99")
if [ "$HTTP_CODE" = "200" ]; then
  log "HTTP: $HTTP_CODE (${RESPONSE_TIME}s) ✓"
  # Check response time threshold (5 seconds)
  if [ "$(echo "$RESPONSE_TIME > 5" | bc -l 2>/dev/null || echo 0)" = "1" ]; then
    alert "HTTP response time ${RESPONSE_TIME}s exceeds 5s threshold"
    STATUS=1
  fi
else
  alert "HTTP health check failed with code $HTTP_CODE"
  STATUS=1
fi

# 3. Check database connectivity
log "Checking database..."
if [ -f /home/mohameddosho20/metardu/.env.local ]; then
  DB_URL=$(grep DATABASE_URL /home/mohameddosho20/metardu/.env.local | cut -d= -f2- | tr -d '"' | tr -d "'")
  if [ -n "$DB_URL" ]; then
    DB_CHECK=$(psql "$DB_URL" -c 'SELECT 1' -t -A 2>/dev/null || echo "FAIL")
    if [ "$DB_CHECK" = "1" ]; then
      DB_CONNS=$(psql "$DB_URL" -c 'SELECT count(*) FROM pg_stat_activity' -t -A 2>/dev/null || echo "?")
      log "Database: connected ($DB_CONNS active connections) ✓"
    else
      alert "Database connection failed"
      STATUS=1
    fi
  else
    log "Database: skipped (no DATABASE_URL)"
  fi
else
  log "Database: skipped (no .env.local)"
fi

# 4. Check disk space
log "Checking disk space..."
DISK_USAGE=$(df -h / | awk 'NR==2{print $5}' | tr -d '%')
DISK_AVAIL=$(df -h / | awk 'NR==2{print $4}')
if [ "$DISK_USAGE" -gt 90 ]; then
  alert "Disk usage at ${DISK_USAGE}% — only ${DISK_AVAIL} available"
  STATUS=1
elif [ "$DISK_USAGE" -gt 80 ]; then
  log "Disk usage at ${DISK_USAGE}% — warning threshold"
else
  log "Disk: ${DISK_USAGE}% used (${DISK_AVAIL} available) ✓"
fi

# 5. Check RAM
log "Checking memory..."
FREE_RAM=$(free -m | awk '/^Mem:/{print $7}')
TOTAL_RAM=$(free -m | awk '/^Mem:/{print $2}')
RAM_PCT=$(awk "BEGIN {printf \"%.0f\", ($FREE_RAM/$TOTAL_RAM)*100}")
if [ "$FREE_RAM" -lt 200 ]; then
  alert "Available RAM critically low: ${FREE_RAM}MB free"
  STATUS=1
else
  log "Memory: ${FREE_RAM}MB free / ${TOTAL_RAM}MB total ✓"
fi

# 6. Check swap
log "Checking swap..."
SWAP_USED=$(free -m | awk '/^Swap:/{print $3}')
if [ "$SWAP_USED" -gt 3000 ]; then
  alert "Swap usage critically high: ${SWAP_USED}MB"
  STATUS=1
elif [ "$SWAP_USED" -gt 1000 ]; then
  log "Swap: ${SWAP_USED}MB used — warning"
else
  log "Swap: ${SWAP_USED}MB used ✓"
fi

# 7. Check CPU load
log "Checking CPU load..."
LOAD_1M=$(awk '{print $1}' /proc/loadavg)
CPU_COUNT=$(nproc)
LOAD_PCT=$(awk "BEGIN {printf \"%.0f\", ($LOAD_1M/$CPU_COUNT)*100}")
if [ "$LOAD_PCT" -gt 200 ]; then
  alert "CPU load ${LOAD_1M} (>${CPU_COUNT}×2 cores) is critically high"
  STATUS=1
else
  log "CPU load: ${LOAD_1M} across ${CPU_COUNT} cores ✓"
fi

# 8. Check SSL certificate expiry (if domain configured)
log "Checking SSL..."
DOMAIN="metardu.space"
if command -v openssl &>/dev/null; then
  SSL_EXPIRY=$(echo | openssl s_client -servername "$DOMAIN" -connect "$DOMAIN":443 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
  if [ -n "$SSL_EXPIRY" ]; then
    EXPIRY_EPOCH=$(date -d "$SSL_EXPIRY" +%s 2>/dev/null || echo 0)
    NOW_EPOCH=$(date +%s)
    DAYS_LEFT=$(( (EXPIRY_EPOCH - NOW_EPOCH) / 86400 ))
    if [ "$DAYS_LEFT" -lt 7 ]; then
      alert "SSL certificate expires in ${DAYS_LEFT} days"
      STATUS=1
    else
      log "SSL: expires in ${DAYS_LEFT} days ✓"
    fi
  else
    log "SSL: could not check (domain may not resolve)"
  fi
else
  log "SSL: skipped (openssl not available)"
fi

# 9. Check backup freshness
log "Checking backup freshness..."
LATEST_BACKUP=$(ls -t /home/mohameddosho20/metardu/backups/*.dump.gz 2>/dev/null | head -1)
if [ -n "$LATEST_BACKUP" ]; then
  BACKUP_AGE=$(( ($(date +%s) - $(stat -c %Y "$LATEST_BACKUP" 2>/dev/null || echo 0)) / 3600 ))
  if [ "$BACKUP_AGE" -gt 48 ]; then
    alert "Latest backup is ${BACKUP_AGE}h old — may not have run"
    STATUS=1
  else
    log "Backup: latest is ${BACKUP_AGE}h old ✓"
  fi
else
  log "Backup: no backups found (first run?)"
fi

# Summary
if [ "$STATUS" = "0" ]; then
  log "All checks passed ✓"
else
  log "Some checks failed — see alerts above"
fi

exit $STATUS

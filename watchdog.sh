#!/bin/bash
# METARDU Watchdog — auto-restarts metardu-app if it becomes unhealthy
# Deployed to /home/opc/metardu/watchdog.sh
# Runs via cron every minute: * * * * * /home/opc/metardu/watchdog.sh >> /tmp/metardu-watchdog.log 2>&1

set -euo pipefail
LOG_TAG="[metardu-watchdog]"
APP_CONTAINER="metardu-app"
HEALTH_URL="http://localhost:3000/api/public/health"

# Check if the container is running
STATUS=$(docker inspect --format='{{.State.Status}}' "$APP_CONTAINER" 2>/dev/null || echo "missing")

if [ "$STATUS" != "running" ]; then
  echo "$(date -u +"%Y-%m-%dT%H:%M:%SZ") $LOG_TAG Container $APP_CONTAINER is $STATUS. Restarting..."
  cd /home/opc/metardu && docker compose up -d metardu-app
  sleep 10
fi

# Check HTTP health
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$HEALTH_URL" 2>/dev/null || echo "000")

if [ "$HTTP_CODE" != "200" ]; then
  echo "$(date -u +"%Y-%m-%dT%H:%M:%SZ") $LOG_TAG Health check returned HTTP $HTTP_CODE. Restarting $APP_CONTAINER..."
  docker restart "$APP_CONTAINER"
  sleep 15
  # Re-check
  HTTP_CODE2=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$HEALTH_URL" 2>/dev/null || echo "000")
  echo "$(date -u +"%Y-%m-%dT%H:%M:%SZ") $LOG_TAG Post-restart health: HTTP $HTTP_CODE2"
else
  echo "$(date -u +"%Y-%m-%dT%H:%M:%SZ") $LOG_TAG OK (HTTP $HTTP_CODE)"
fi

#!/bin/bash
# Permanent admin-recognition fix (run on VM as opc)
set -e
cd /home/opc/metardu

echo "== 1. Patch docker-compose.yml =="
cp docker-compose.yml docker-compose.yml.bak.adminfix
if ! grep -q '^      - ADMIN_EMAILS=' docker-compose.yml; then
  sed -i 's|^      - NVIDIA_API_KEY=|      - ADMIN_EMAILS=${ADMIN_EMAILS:-}\n      - PLATFORM_OWNER_EMAIL=${PLATFORM_OWNER_EMAIL:-}\n      - NVIDIA_API_KEY=|' docker-compose.yml
fi
grep -n 'ADMIN_EMAILS\|PLATFORM_OWNER' docker-compose.yml

echo "== 2. Recreate app container only (cloudflared untouched) =="
docker compose up -d --no-deps metardu-app
sleep 5

echo "== 3. Verify env inside container =="
docker exec metardu-app printenv | grep -E '^(ADMIN_EMAILS|PLATFORM_OWNER_EMAIL)=' || echo "STILL MISSING"

echo "== 4. DB belt-and-braces: owner role -> super_admin =="
docker exec metardu-postgres psql -U metardu -d metardu -Atc \
  "UPDATE users SET role='super_admin' WHERE email=LOWER('${OWNER_EMAIL:-mohameddosho20@gmail.com}'); SELECT email||' => '||role FROM users WHERE email=LOWER('${OWNER_EMAIL:-mohameddosho20@gmail.com}');"
docker exec metardu-postgres psql -U metardu -d metardu -Atc \
  "UPDATE surveyor_profiles sp SET role='super_admin' FROM users u WHERE u.id=sp.user_id AND u.email=LOWER('${OWNER_EMAIL:-mohameddosho20@gmail.com}'); SELECT 'profiles updated: '||count(*) FROM surveyor_profiles sp JOIN users u ON u.id=sp.user_id WHERE u.email=LOWER('${OWNER_EMAIL:-mohameddosho20@gmail.com}') AND sp.role='super_admin';"

echo "== DONE. Sign out and back in once to refresh the JWT role. =="

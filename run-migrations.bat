@echo off
cd /d C:\Users\user\Desktop\METARDU
docker compose exec metardu-app node /app/migrate-unified.mjs
echo Done
pause
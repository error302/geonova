@echo off
REM Copy fixed migration 017 to container and restart app
cd /d C:\Users\user\Desktop\METARDU
echo Copying fixed migration to container...
docker.exe cp src\lib\db\migrations\017_version_fieldbook_entries.sql metardu-app:/app/migrations/017_version_fieldbook_entries.sql
echo Restarting metardu-app...
docker.exe compose restart metardu-app
echo Done. Check logs with: docker compose logs -f metardu-app
pause
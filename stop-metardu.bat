@echo off
echo ==========================================
echo   METARDU - Stopping
echo ==========================================
echo.
echo Stopping cloudflared quick-tunnel (if running)...
taskkill /IM cloudflared.exe /F 2>nul
echo Stopping Docker containers...
cd /d "%~dp0"
docker compose -f docker-compose.yml down
echo.
echo ==========================================
echo   METARDU has been stopped.
echo   Note: If using a named tunnel service, it will still be running.
echo ==========================================
pause

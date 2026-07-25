@echo off
echo ==========================================
echo   METARDU - Full Startup
echo ==========================================
echo.
echo Starting METARDU stack (PowerShell script)...
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0start-metardu.ps1"
echo.
echo METARDU stack has stopped.
pause

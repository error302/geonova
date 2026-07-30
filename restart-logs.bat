@echo off
cd /d C:\Users\user\Desktop\METARDU
echo Restarting metardu-app...
docker.exe restart metardu-app
echo Restarted. Showing logs (Ctrl+C to stop):
docker.exe logs -f metardu-app
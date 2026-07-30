@echo off
cd /d C:\Users\user\Desktop\METARDU
echo Stopping metardu-app...
docker.exe stop metardu-app
echo Starting metardu-app...
docker.exe start metardu-app
echo Done.
@echo off
echo Adding Windows Firewall rules for METARDU...
echo Note: These rules are for reverse-proxy deployments only.
echo With Cloudflare tunnels, inbound 80/443 rules are typically not needed.
echo.
set /p ENABLE_INBOUND="Enable inbound HTTP/HTTPS on 80/443? (Y/N): "
if /i "%ENABLE_INBOUND%"=="Y" (
  netsh advfirewall firewall delete rule name="METARDU-HTTP" >nul 2>&1
  netsh advfirewall firewall delete rule name="METARDU-HTTPS" >nul 2>&1
  netsh advfirewall firewall delete rule name="METARDU-HTTPS-UDP" >nul 2>&1
  netsh advfirewall firewall add rule name="METARDU-HTTP" dir=in action=allow protocol=TCP localport=80
  netsh advfirewall firewall add rule name="METARDU-HTTPS" dir=in action=allow protocol=TCP localport=443
  netsh advfirewall firewall add rule name="METARDU-HTTPS-UDP" dir=in action=allow protocol=UDP localport=443
  echo Inbound firewall rules added for ports 80 and 443.
) else (
  echo Skipped inbound firewall rules. App traffic uses Cloudflare tunnel (127.0.0.1:3000).
)
pause

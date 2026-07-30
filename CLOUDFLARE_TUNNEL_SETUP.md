# Cloudflare Named Tunnel Setup (METARDU)

> **Canonical topology (P0-7, 2026-07-24):** Production `metardu.space` runs
> behind Cloudflare DNS/protection → Nginx (TLS via Certbot) → Next.js on
> port 3000. This document is the **Windows-dev alternative** for surveyors
> running METARDU on a Windows machine without Nginx — it uses a Cloudflare
> named tunnel directly to `localhost:3000`. For the Linux/DuckDNS production
> guide, see `docs/deployment/duckdns-cloudflare-tunnel.md`. The `bore.pub`
> tunnel has been removed (was redundant with Cloudflare).

## Why a named tunnel?
- Provides a **stable hostname** (e.g. `https://<YOUR_DOMAIN>.com`).
- No need to rewrite environment variables on every restart.
- Runs as a Windows service, so it stays alive even if the app container restarts.
- Avoids the `530` error you saw when the quick tunnel’s host header did not match the app’s `NEXTAUTH_URL`.

## Steps (run once)
1. **Create a Cloudflare account** (free tier is fine) and add a domain you own (free options: Freenom, .tk, .ml, etc.) or use an existing domain you control.
2. Install the Cloudflare CLI (`cloudflared`) if not already installed.
3. Open a PowerShell terminal **as the same user** that runs the METARDU scripts.
4. Create the tunnel and generate a credential file:
   ```powershell
   cloudflared tunnel create metardu
   ```
   This prints a tunnel ID and writes a JSON credential file to `%USERPROFILE%\.cloudflared\<NAME>.json`.
5. **Reserve a DNS name** for the tunnel (replace `<YOUR_DOMAIN>.com` with the name you want):
   ```powershell
   cloudflared tunnel route dns metardu <YOUR_DOMAIN>.com
   ```
6. Create a config file (`%USERPROFILE%\.cloudflared\config.yml`) that points to the credential:
   ```yaml
   tunnel: <TUNNEL-ID-from-step-4>
   credentials-file: C:\Users\user\.cloudflared\<NAME>.json
   ingress:
     - hostname: <YOUR_DOMAIN>.com
       service: http://127.0.0.1:3000
     - service: http_status:404
   ```
7. **Install the tunnel as a Windows service** so it starts automatically on login:
   ```powershell
   cloudflared service install
   ```
   The service will be named `cloudflared`. Verify it is running with `Get-Service cloudflared`.
8. **Update METARDU configuration**:
   - The `docker-compose.yml` already contains static URLs (`https://<YOUR_DOMAIN>.com`). If you chose a different hostname, replace `<YOUR_DOMAIN>.com` in the three `NEXT*` variables.
   - No further URL‑capture is needed.
9. Restart METARDU:
   ```powershell
   .\stop-metardu.bat   # stops Docker and any quick-tunnel processes
   .\start-metardu.bat  # starts Docker containers and creates a new quick tunnel for this session
   ```
   The app will be reachable at the tunnel URL printed in the console.

   **Note:** `start-metardu.ps1` creates a temporary quick tunnel on each run, updates `docker-compose.yml` with the new tunnel URL, and rebuilds the app container. Each session gets a fresh tunnel URL, which is written to `tunnel-url.txt`. If you prefer a stable hostname, use the named-tunnel approach described above and manage `start-metardu.ps1` to skip the quick-tunnel creation when the named tunnel is already running as a service.

## Verifying the setup
- Open a browser to the hostname (e.g. `https://<YOUR_DOMAIN>.com`).
- You should see the METARDU UI with HTTP 200 responses.
- `curl -I https://<YOUR_DOMAIN>.com` should return `200 OK`.

## Troubleshooting
- **530 errors**: ensure the hostname in `docker-compose.yml` matches the DNS entry you created.
- **Service not running**: `Get-Service cloudflared` → `Start-Service cloudflared`.
- **Port conflict**: the tunnel forwards to `127.0.0.1:3000`; make sure no other process uses that port.

Once the service is up, you can simply run `start-metardu.bat` to spin up the containers; the tunnel will stay active in the background.

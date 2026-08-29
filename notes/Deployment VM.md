---
title: Deployment VM
tags: [deployment, vm, docker, production]
---

# Deployment VM

Production deployment procedures for METARDU.

## Infrastructure
- **VM**: address managed via environment/password manager (audit C-01), user `opc`
- **SSH key**: `~/.ssh/oracle-metardu.key`
- **Project dir**: `/home/opc/metardu`
- **Containers**: `metardu-postgres`, `metardu-worker`, `metardu-app`, `metardu-redis`
- **Tunnel**: `metardu-cloudflared` → cloudflared tunnel to `https://metardu.space`

## Deploy Flow
```bash
# 1. Build + verify locally
docker compose build metardu-app

# 2. Push to git (after commit)
git push

# 3. On VM
ssh -i ~/.ssh/oracle-metardu.key opc@$VM_HOST
cd /home/opc/metardu
git pull
docker compose up -d --no-deps metardu-app
```

## Critical Warnings
- **NEVER restart `metardu-cloudflared`** — causes ~30s outage.
- **Do NOT run** `docker compose down` or `up -d` broadly (would restart cloudflared).

## External Verify
From a non-VM machine:
```bash
curl -sS -o /dev/null -w "%{http_code}" https://metardu.space/
```
Expect `200`.

## Related
- [[Cloudflare Observability]]
- [[Docker Build]]

# METARDU — Going Live Checklist

This guide covers everything needed to switch from development/sandbox to production with paying customers.

---

## 1. PayPal: Sandbox → Live

### Current State
- `PAYPAL_MODE=sandbox` (or not set — defaults to sandbox)
- Sandbox test credentials are in `.env.local`

### Steps to Go Live

1. **Get Live Credentials**
   - Go to https://developer.paypal.com/dashboard/applications/live
   - Create a new Live app
   - Copy the **Live** Client ID and Client Secret (different from sandbox)

2. **Update `.env.local` on the VM**
   ```bash
   ssh mohameddosho20@34.170.248.156
   cd /home/mohameddosho20/metardu
   nano .env.local
   ```
   Update these values:
   ```
   PAYPAL_CLIENT_ID=AXxxxxx_live_client_id_here
   PAYPAL_CLIENT_SECRET=Exxxxxx_live_secret_here
   PAYPAL_MODE=live
   ```

3. **Restart the application**
   ```bash
   pm2 restart metardu
   ```

4. **Test with a real small payment** (e.g., KES 1)
   - Use your personal card/M-Pesa
   - Verify the transaction appears in https://www.paypal.com/mep/dashboard

5. **Verify webhook**
   - Go to https://developer.paypal.com/dashboard/webhooks
   - Ensure webhook URL points to: `https://metardu.space/api/webhooks/paypal`
   - Events to listen for:
     - `PAYMENT.CAPTURE.COMPLETED`
     - `PAYMENT.CAPTURE.REFUNDED`
     - `BILLING.SUBSCRIPTION.ACTIVATED`
     - `BILLING.SUBSCRIPTION.CANCELLED`

### Rollback
If anything goes wrong, set `PAYPAL_MODE=sandbox` and restart.

---

## 2. SSL Certificate Verification

### Check Current Certificate
```bash
# Check certificate details
openssl s_client -servername metardu.space -connect metardu.space:443 2>/dev/null | openssl x509 -noout -text

# Check expiry date
echo | openssl s_client -servername metardu.space -connect metardu.space:443 2>/dev/null | openssl x509 -noout -enddate

# Quick check via certbot
sudo certbot certificates
```

### Auto-Renewal Setup
Let's Encrypt certificates expire every 90 days. Verify auto-renewal:

```bash
# Check if certbot timer is active
sudo systemctl status certbot.timer

# Dry run renewal to verify it works
sudo certbot renew --dry-run

# If the timer doesn't exist, create it
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

### If Certificate is Expired
```bash
sudo certbot renew --force-renewal
sudo systemctl reload nginx
```

### Nginx SSL Configuration
Verify `/etc/nginx/sites-available/metardu` includes:
```nginx
server {
    listen 443 ssl http2;
    server_name metardu.space;

    ssl_certificate /etc/letsencrypt/live/metardu.space/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/metardu.space/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # HSTS header
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

server {
    listen 80;
    server_name metardu.space;
    return 301 https://$host$request_uri;
}
```

---

## 3. M-Pesa (Safaricom Daraja) Configuration

### Current State
- M-Pesa integration code exists in `src/lib/payments/mpesa.ts`
- Environment variables needed but not yet configured on VM

### Steps to Configure

1. **Register on Daraja Portal**
   - Go to https://developer.safaricom.co.ke/
   - Create a production app
   - Get production Consumer Key and Consumer Secret

2. **Get Production Credentials**
   - Short Code (Paybill/Till number)
   - Passkey (from Safaricom)
   - Initiator Name (from Safaricom)
   - Security Credential (encrypted)

3. **Update `.env.local` on the VM**
   ```
   MPESA_CONSUMER_KEY=your_production_consumer_key
   MPESA_CONSUMER_SECRET=your_production_consumer_secret
   MPESA_SHORT_CODE=174379
   MPESA_PASSKEY=your_production_passkey
   MPESA_INITIATOR_NAME=your_initiator_name
   MPESA_SECURITY_CREDENTIAL=your_security_credential
   ```

4. **Register C2B URLs**
   - Validation URL: `https://metardu.space/api/payments/mpesa/validate`
   - Confirmation URL: `https://metardu.space/api/payments/mpesa/callback`

5. **Test with KES 1 STK Push**

---

## 4. Environment Variables Checklist

Verify all env vars are set on the production VM:

```bash
# On the VM, check:
cat /home/mohameddosho20/metardu/.env.local

# Required for paying customers:
DATABASE_URL=postgresql://...           # ✅ Should be set
NEXTAUTH_SECRET=...                     # ✅ Should be set
NEXTAUTH_URL=https://metardu.space  # ✅ Should be set
PAYPAL_CLIENT_ID=...                    # ✅ Set
PAYPAL_CLIENT_SECRET=...                # ✅ Set
PAYPAL_MODE=live                        # ⚠️ Verify set on the VM (defaults to sandbox if omitted!)
PAYPAL_WEBHOOK_ID=...                   # ⚠️ REQUIRED in live mode — webhooks fail closed without it
STRIPE_SECRET_KEY=...                   # Optional
STRIPE_WEBHOOK_SECRET=...               # Optional
MPESA_CONSUMER_KEY=...                  # ❌ Not yet configured (the ONLY remaining blocker)
MPESA_CONSUMER_SECRET=...               # ❌ Not yet configured
MPESA_SHORT_CODE=...                    # ❌ Not yet configured (underscore, NOT MPESA_SHORTCODE)
MPESA_PASSKEY=...                       # ❌ Not yet configured
MPESA_INITIATOR_NAME=...                # ❌ Not yet configured
MPESA_SECURITY_CREDENTIAL=...           # ❌ Not yet configured
MPESA_ENV=production                    # ❌ Set together with the keys above (NOT MPESA_ENVIRONMENT)
NVIDIA_API_KEY=...                      # ✅ Set (for AI features)
NEXT_PUBLIC_SENTRY_DSN=...             # ✅ Should be set
SENTRY_ENVIRONMENT=production           # ❌ Should be set
GCS_BUCKET_NAME=...                     # Optional (for cloud backups)
ALERT_WEBHOOK_URL=...                   # Optional (for Slack/Discord alerts)
```

---

## 5. Pre-Launch Verification

Run this checklist before announcing to paying customers:

```bash
# 1. Health check
curl https://metardu.space/api/health
# Expected: {"status":"ok","db":"connected"}

# 2. SSL check
curl -vI https://metardu.space 2>&1 | grep -E "subject:|expire|SSL"

# 3. Test login flow
# Open https://metardu.space/login and verify login works

# 4. Test subscription flow
# Go through checkout with a test payment

# 5. Verify backup is running
ls -la /home/mohameddosho20/metardu/backups/
# Should see recent .dump.gz files

# 6. Verify cron jobs
crontab -l
# Should see backup and health-check entries

# 7. Run the operations setup (if not done)
cd /home/mohameddosho20/metardu
chmod +x scripts/setup-operations.sh
./scripts/setup-operations.sh

# 8. Run load test (from local machine)
# k6 run --vus 10 --duration 30s -e BASE_URL=https://metardu.space scripts/load-test.js
```

---

## 6. Post-Launch Monitoring

After going live, monitor for the first 48 hours:

1. **Sentry** — Check for new errors at your Sentry dashboard
2. **PM2** — `pm2 status` and `pm2 logs` on the VM
3. **Health check logs** — `tail -f /home/mohameddosho20/metardu/logs/health-check.log`
4. **Backup verification** — Confirm daily backup runs at 2 AM
5. **Payment monitoring** — Verify PayPal/M-Pesa webhooks are received
6. **Disk space** — `df -h` — watch for log growth
7. **User feedback** — Watch for support emails at support@metardu.app

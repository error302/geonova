#!/bin/bash
# VM Full Deployment & Fix Script for METARDU
# Run this script on the Google Cloud VM via SSH

set -e

echo "============================================="
echo " METARDU VM FIX SCRIPT"
echo "============================================="

APP_DIR="/home/mohameddosho20/metardu"

echo "1. Checking Nginx setup..."
sudo cp $APP_DIR/nginx-metardu /etc/nginx/sites-available/metardu || true
sudo ln -sf /etc/nginx/sites-available/metardu /etc/nginx/sites-enabled/ || true
sudo nginx -t || echo "Nginx syntax check failed, investigate before reloading!"
# Restart nginx only if syntax is ok
if sudo nginx -t &> /dev/null; then
    sudo systemctl reload nginx
    echo "✅ Nginx reloaded"
else
    echo "⚠️ Nginx syntax check failed, keeping old config"
fi

echo "2. Setting up systemd service for Next.js..."
cat << 'EOF' | sudo tee /etc/systemd/system/metardu.service
[Unit]
Description=METARDU Next.js App
After=network.target postgresql.service

[Service]
Type=simple
User=mohameddosho20
WorkingDirectory=/home/mohameddosho20/metardu
EnvironmentFile=/home/mohameddosho20/metardu/.env.local
ExecStart=/home/mohameddosho20/metardu/node_modules/.bin/next start -p 3000
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable metardu || true
echo "✅ metardu.service created and enabled"

echo "3. Updating .env.local..."
if [ ! -f $APP_DIR/.env.local ]; then
    echo "⚠️ .env.local not found in $APP_DIR!"
else
    # Automatically add missing required NextAuth vars if not present
    if ! grep -q "NEXTAUTH_URL=" $APP_DIR/.env.local; then
        echo "NEXTAUTH_URL=https://metardu.duckdns.org" >> $APP_DIR/.env.local
    fi
    if ! grep -q "AUTH_TRUST_HOST=" $APP_DIR/.env.local; then
        echo "AUTH_TRUST_HOST=true" >> $APP_DIR/.env.local
    fi
    # Don't auto-generate AUTH_SECRET here, as it might invalidate existing sessions if regenerated.
    # We leave that step to manual verification.
    echo "✅ .env.local checked"
fi

echo "4. Running pending database migrations..."
if command -v npm &> /dev/null; then
    cd $APP_DIR
    # This assumes there's a migration script, otherwise you need to run SQL manually via psql
    echo "Running seed script to ensure admin exists..."
    npx tsx scripts/seed-admin.ts || echo "⚠️ Admin seed failed (maybe config error or already exists)"
fi

echo "============================================="
echo " DONE. Next steps:"
echo " 1. Make sure .env.local has a valid AUTH_SECRET"
echo " 2. Restart the app: sudo systemctl restart metardu"
echo " 3. Verify logs: journalctl -u metardu -f"
echo "============================================="

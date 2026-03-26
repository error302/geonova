# GeoNova — Production Deployment Guide

## Prerequisites

- Supabase project (database + auth)
- Vercel account (Next.js hosting)
- Upstash account (Redis rate limiting) — free tier works
- Resend account (transactional email) — free tier works
- Railway or Render account (Python engine hosting)

---

## 1. Supabase Setup

1. Create a new Supabase project
2. Run migrations in order:
   ```bash
   # From the Supabase dashboard SQL editor, run:
   supabase/migrations/000_core_projects_and_survey_points.sql
   supabase/migrations/001_postgis_spatial_index.sql
   # ... through to the latest migration
   ```
3. Enable Row Level Security on all tables
4. Copy your project URL and anon key

## 2. Environment Variables (Vercel)

Add these in Vercel → Project → Settings → Environment Variables:

```bash
# Required
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=https://your-domain.com

# Rate limiting (https://upstash.com → create Redis DB)
UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token

# Email (https://resend.com)
RESEND_API_KEY=re_your_key

# Python compute engine (after step 4)
PYTHON_COMPUTE_URL=https://your-engine.railway.app

# Optional but recommended
NEXT_PUBLIC_SENTRY_DSN=https://your-dsn@sentry.io/project-id
GOOGLE_SITE_VERIFICATION=your-code

# Payments (add when ready)
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
MPESA_CONSUMER_KEY=...
MPESA_CONSUMER_SECRET=...
MPESA_SHORT_CODE=...
MPESA_PASSKEY=...
```

## 3. Deploy Next.js to Vercel

```bash
# Connect repo in Vercel dashboard, or:
npx vercel --prod
```

Set build command: `npm run build`
Set output directory: `.next`

## 4. Deploy Python Engine

### Option A: Railway (recommended)
1. Go to railway.app → New Project → Deploy from GitHub
2. Select root directory: `services/geospatial-engine`
3. Railway auto-detects the Dockerfile
4. Add env var: `ALLOWED_ORIGINS=https://your-domain.com`
5. Copy the Railway URL → set as `PYTHON_COMPUTE_URL` in Vercel

### Option B: Render
1. New Web Service → Docker → root: `services/geospatial-engine`
2. Add env var: `ALLOWED_ORIGINS=https://your-domain.com`

## 5. GitHub Actions CI

The token needs `workflow` scope to push CI files. Add `.github/workflows/ci.yml` manually:

1. Go to GitHub → repository → Add file → Create new file
2. Path: `.github/workflows/ci.yml`
3. Paste the workflow from the generated `geonova_fix_prompt.md`
4. Add secrets in GitHub → Settings → Secrets:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 6. PWA Icons

Replace the placeholder icons with real ones:
- `public/icons/icon-192.png` (192×192)
- `public/icons/icon-512.png` (512×512)

These icons appear on the home screen when users install the PWA.

## 7. Custom Domain

1. In Vercel: Settings → Domains → Add your domain
2. Update DNS at your registrar (Vercel provides the records)
3. Update `NEXT_PUBLIC_APP_URL` to your real domain
4. Update `ALLOWED_ORIGINS` in the Python engine

## 8. Pre-launch Checklist

- [ ] All env vars set in Vercel
- [ ] Supabase migrations run
- [ ] RLS policies verified (test with a non-admin user)
- [ ] Python engine deployed and `PYTHON_COMPUTE_URL` set
- [ ] Upstash Redis configured (check Vercel logs for rate limiter warnings)
- [ ] Resend domain verified (check your Resend dashboard)
- [ ] PWA icons replaced with real branding
- [ ] Custom domain set + SSL working
- [ ] Sentry DSN configured (test by triggering an error)
- [ ] OG image visible (check opengraph.xyz or Twitter card validator)
- [ ] Google Search Console verified + sitemap submitted
- [ ] Test M-Pesa payment in sandbox mode
- [ ] Test Stripe payment in test mode
- [ ] Load test with ≥10 concurrent users on calculate endpoints

---

## Monitoring

- **Errors**: Sentry dashboard (sentry.io)
- **Analytics**: Supabase dashboard → `analytics_events` table
- **Rate limits**: Upstash dashboard → Redis metrics
- **Uptime**: Vercel dashboard → Deployments

## Support

Email: support@geonova.app

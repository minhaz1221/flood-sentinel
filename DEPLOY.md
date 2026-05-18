# Flood Sentinel — Deployment Checklist

## Pre-Deploy

- [ ] All env vars filled in `.env.local`
- [ ] Supabase schema applied (`001_initial_schema.sql`)
- [ ] River stations seeded (`001_river_stations.sql`)
- [ ] `npm run build` passes with 0 errors
- [ ] `node -e "require('./vercel.json')"` returns no error
- [ ] GitLab repo created and code pushed

## Vercel Setup

### 1. Connect Repository
1. Go to [vercel.com/new](https://vercel.com/new)
2. Import from **GitLab** (not GitHub — required for GitLab partner integration)
3. Select `flood-sentinel` repository
4. Framework preset: **Next.js** (auto-detected)

### 2. Environment Variables
Add all variables from `.env.local` in Vercel dashboard:
- Settings → Environment Variables
- Add each key/value pair
- Set scope: Production + Preview + Development
- **Do NOT** add `NEXT_PUBLIC_APP_URL` as localhost — use your Vercel URL

### 3. Deploy Settings
- Root Directory: `/` (default)
- Build Command: `npm run build` (default)
- Output Directory: `.next` (default)
- Node.js Version: 20.x

### 4. First Deploy
```bash
# Option A: via Vercel CLI
npm i -g vercel
vercel --prod

# Option B: push to main branch (auto-deploys)
git push origin main
```

### 5. Post-Deploy Steps

After first successful deploy to `https://your-app.vercel.app`:

```bash
PROD_URL=https://your-app.vercel.app

# a) Seed historical flood data (one-time)
curl -X POST "$PROD_URL/api/seed/historical" \
  -H "x-seed-key: flood_sentinel_seed_2026"

# b) Run initial data sync
curl -X POST "$PROD_URL/api/sync/all"

# c) Run first agent predictions
curl -X POST "$PROD_URL/api/agent" \
  -H "Content-Type: application/json" \
  -d '{"mode":"all"}'

# d) Verify health
curl "$PROD_URL/api/health"
# Expected: {"status":"ok","db":"connected"}
```

### 6. Verify Cron Jobs
1. Vercel Dashboard → your project → **Cron Jobs** tab
2. You should see 3 jobs:
   - `/api/cron/sync` — `0 * * * *` (top of each hour)
   - `/api/cron/predict` — `15 * * * *` (:15 each hour)
   - `/api/cron/alert` — `30 * * * *` (:30 each hour)
3. Click **Trigger** on `/api/cron/sync` to test manually

### 7. Verify Dashboard
- Open `https://your-app.vercel.app`
- Dark navy dashboard should render
- CartoDB map of Bangladesh visible
- DB Connected indicator (green dot) in header
- Click **Sync** button → should trigger data fetch

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `Invalid supabaseUrl` | Check `NEXT_PUBLIC_SUPABASE_URL` in Vercel env vars |
| Cron jobs not running | Verify `CRON_SECRET` matches requests; check Vercel cron logs |
| Gemini errors | Verify `GEMINI_API_KEY` has billing enabled for 1.5 Pro |
| Map not loading | CartoDB tiles are free/keyless — check browser console for CORS |
| Alerts not sending | Check `ALERT_RECIPIENTS` format: `+8801XXXXXXXXX,+8801XXXXXXXXX` |
| GitLab incidents fail | Ensure `GITLAB_TOKEN` has `api` scope |

## Environment Variable Reference

```bash
# Core (required)
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
GEMINI_API_KEY=AIza...

# Alerts (required for Twilio)
TWILIO_ACCOUNT_SID=ACxx...
TWILIO_AUTH_TOKEN=xx...
TWILIO_PHONE_NUMBER=+1415...
TWILIO_WHATSAPP_NUMBER=14155238886
ALERT_RECIPIENTS=+8801XXXXXXXXX

# Observability (required for Arize)
ARIZE_API_KEY=xx...
ARIZE_SPACE_ID=xx...

# GitLab incidents
GITLAB_TOKEN=glpat-xx...
GITLAB_PROJECT_ID=12345678

# System
CRON_SECRET=your_random_secret_32chars
SEED_SECRET=flood_sentinel_seed_2026
NEXT_PUBLIC_APP_URL=https://flood-sentinel.vercel.app
NEXT_PUBLIC_ARIZE_DASHBOARD_URL=https://app.arize.com/organizations/xx/spaces/xx
```

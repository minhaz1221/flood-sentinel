# Flood Sentinel — Deployment Checklist

## Pre-Deploy

- [ ] All env vars filled in `.env.local`
- [ ] Supabase schema applied (`001_initial_schema.sql`)
- [ ] River stations seeded (`001_river_stations.sql`)
- [ ] `npm run build` passes with 0 errors
- [ ] GitHub repo created and code pushed

## Vercel Setup

### 1. Connect Repository
1. Go to [vercel.com/new](https://vercel.com/new)
2. Import from **GitHub**
3. Select `flood-sentinel` repository
4. Framework preset: **Next.js** (auto-detected)

### 2. Environment Variables
Add all variables in the Vercel dashboard:
- Settings → Environment Variables
- Set scope: Production + Preview + Development
- **Do NOT** add `NEXT_PUBLIC_APP_URL` as localhost — use your production URL
- **ElevenLabs:** use `ELEVENLABS_API_KEY` (no `NEXT_PUBLIC_` prefix — server-side only)

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

After first successful deploy to `https://flood-sentinel.devixus.com`:

```bash
PROD_URL=https://flood-sentinel.devixus.com

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
2. You should see 3 jobs (daily UTC schedule per `vercel.json`):
   - `/api/cron/sync` — `0 0 * * *` (00:00 UTC daily)
   - `/api/cron/predict` — `0 1 * * *` (01:00 UTC daily)
   - `/api/cron/alert` — `0 2 * * *` (02:00 UTC daily)
3. Click **Trigger** on `/api/cron/sync` to test manually

### 7. Verify Dashboard
- Open `https://flood-sentinel.devixus.com`
- Dark navy dashboard should render
- CartoDB map of Bangladesh visible
- DB Connected indicator (green dot) in header
- Click **Sync** button → should trigger data fetch

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `Invalid supabaseUrl` | Check `NEXT_PUBLIC_SUPABASE_URL` in Vercel env vars |
| Cron jobs not running | Verify `CRON_SECRET` matches request header; check Vercel cron logs |
| Gemini errors | Verify `GEMINI_API_KEY` has billing enabled for Gemini 2.5 Flash Lite |
| Map not loading | CartoDB tiles are free/keyless — check browser console for CORS |
| Alerts not sending | Check `ALERT_RECIPIENTS` format: `+8801XXXXXXXXX,+8801XXXXXXXXX` |
| GitLab incidents fail | Ensure `GITLAB_TOKEN` has `api` scope on the correct project |
| Voice not playing | Ensure `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` are set (no `NEXT_PUBLIC_` prefix) |
| Fivetran MCP errors | `FIVETRAN_API_KEY`/`FIVETRAN_API_SECRET` are optional — absence triggers graceful fallback |

## Environment Variable Reference

```bash
# Core — Supabase (required)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# AI — Gemini (required)
GEMINI_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

# Voice — ElevenLabs (optional; server-side only — do NOT use NEXT_PUBLIC_ prefix)
ELEVENLABS_API_KEY=sk_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
ELEVENLABS_VOICE_ID=XXXXXXXXXXXXXXXXXXXXXXXX

# Alerts — Twilio (optional)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+14155552671
TWILIO_WHATSAPP_NUMBER=14155238886
ALERT_RECIPIENTS=+8801XXXXXXXXX,+8801YYYYYYYYY

# Observability — Arize Phoenix (optional; enables OTel tracing in production)
ARIZE_API_KEY=ak-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
ARIZE_SPACE_ID=XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
NEXT_PUBLIC_ARIZE_DASHBOARD_URL=https://app.arize.com/organizations/xxx/spaces/xxx

# Incident management — GitLab (optional)
GITLAB_TOKEN=glpat-XXXXXXXXXXXXXXXXXXXX
GITLAB_PROJECT_ID=12345678

# Pipeline — Fivetran MCP (optional; graceful fallback if absent)
FIVETRAN_API_KEY=XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
FIVETRAN_API_SECRET=XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
FIVETRAN_GROUP_ID=xxxxxxxxxxxxxxxx

# System
CRON_SECRET=your_random_secret_at_least_32_chars
SEED_SECRET=flood_sentinel_seed_2026
NEXT_PUBLIC_APP_URL=https://flood-sentinel.devixus.com
```

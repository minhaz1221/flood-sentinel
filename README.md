# 🌊 Flood Sentinel
### AI-Powered Hyperlocal Flood Warning System for Bangladesh

> Built for the **Google Cloud Rapid Agent Hackathon 2026**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs)](https://nextjs.org)
[![Gemini](https://img.shields.io/badge/Gemini-1.5_Pro-4285F4?logo=google)](https://ai.google.dev)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase)](https://supabase.com)
[![Arize](https://img.shields.io/badge/Arize-Phoenix-7C3AED)](https://arize.com)
[![GitLab](https://img.shields.io/badge/GitLab-Incidents-FC6D26?logo=gitlab)](https://gitlab.com)
[![Twilio](https://img.shields.io/badge/Twilio-SMS_+_WhatsApp-F22F46?logo=twilio)](https://twilio.com)
[![Vercel](https://img.shields.io/badge/Vercel-Deployed-000000?logo=vercel)](https://vercel.com)

---

## The Problem

Bangladesh experiences severe flooding every monsoon season (June–October), killing hundreds and displacing millions annually. The 2022 Sylhet floods — the worst in 120 years — submerged 4 million people with only hours of warning. Current government systems issue district-level warnings covering thousands of square kilometres, leaving upazila-level communities (200,000–500,000 people each) with no actionable intelligence. By the time water reaches dangerous levels at downstream gauges, evacuation windows have already closed.

## The Solution

Flood Sentinel is a hyperlocal, AI-powered flood risk prediction system that delivers 72-hour risk forecasts at the upazila level — roughly 20× more granular than existing government warnings. It fuses real-time BWDB river gauge readings, Open-Meteo rainfall and GFS weather forecasts, and upstream propagation models into a Gemini 1.5 Pro reasoning engine that explains **why** a flood is coming in both English and Bengali — dispatching alerts via SMS and WhatsApp before water levels breach danger thresholds.

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         DATA SOURCES                             │
│  BWDB/FFWC river gauges   Open-Meteo rainfall  GFS forecast       │
│        (scraped hourly)      (API, free)          (7-day daily)  │
└──────────┬────────────────────┬─────────────────────┬───────────┘
           │                   │                     │
           ▼                   ▼                     ▼
┌──────────────────────────────────────────────────────────────────┐
│            Supabase PostgreSQL  (9 tables, RLS)                  │
│  river_readings · rainfall_data · weather_forecasts · sync_logs  │
│  flood_predictions · flood_events · alerts_sent · river_stations │
└──────────────────────────────┬───────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                     GEMINI AGENT LAYER                           │
│  aggregator.ts → 7 parallel queries + upstream topology          │
│  prompts.ts    → Bangladesh flood context + escalation rules     │
│  predict.ts    → Gemini 1.5 Pro JSON prediction (72h horizon)    │
└──────────┬───────────────────────────────────┬───────────────────┘
           │                                   │
     ┌─────▼──────┐                    ┌───────▼───────┐
     │   ARIZE    │                    │ ALERT ENGINE  │
     │  OTel spans│                    │ Twilio SMS    │
     │  eval loop │                    │ Twilio WA     │
     └────────────┘                    │ GitLab issues │
                                       └───────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────────┐
│                  DASHBOARD  (Next.js App Router)                  │
│  CartoDB dark map · Risk markers · River charts · Bengali alerts  │
│  UpazilaPanel · Arize panel · Historical 2022 replay scrubber    │
└──────────────────────────────────────────────────────────────────┘
```

## Partner Integrations

### Google Cloud + Gemini 1.5 Pro
Gemini 1.5 Pro is the **prediction brain**. `buildUpazilaContext()` assembles 7 parallel Supabase queries into a structured context — river gauge readings, upstream station states, 72-hour rainfall totals, GFS forecasts, and derived signals (water level % of danger threshold, trend direction, upstream threat flag). The system prompt encodes monsoon seasonality, corridor lag times (Surma: 6–14h, Jamuna: 8–20h), and Meghalaya's extreme Indian catchment effects. Gemini responds with structured JSON including bilingual reasoning and key signals.

### Arize Phoenix
Every prediction generates an OpenTelemetry span with **OpenInference semantic conventions** (`openinference.span.kind: "CHAIN"`, `input.value`, `output.value`). When flood events are confirmed in the database, `logAccuracyAnnotation()` logs evaluator spans (`eval.label: "correct" | "false_positive" | "missed"`, `eval.score`). This creates a **self-improving feedback loop** — Arize surfaces accuracy by risk level and `generateImprovementSuggestions()` recommends prompt tuning based on error patterns.

### GitLab — Incident Management
When Gemini returns `risk_level: "critical"`, `createFloodIncident()` automatically opens a GitLab issue with a structured signal table, bilingual assessment, and a 6-item recommended actions checklist (EOC activation, evacuation orders, rescue boat pre-positioning). The hourly cron catches any unalerted critical predictions from the past 90 minutes, ensuring no event is missed.

### Twilio — SMS + WhatsApp
Bengali-language alerts dispatched to configurable recipient list. HIGH template gives 48h outlook; CRITICAL demands immediate evacuation. WhatsApp alerts sent only for CRITICAL via Twilio sandbox. All dispatched alerts logged to `alerts_sent` for full audit trail.

## Demo: 2022 Sylhet Flood Replay

**To run the historical demo:**
1. Seed historical data: `curl -X POST http://localhost:3000/api/seed/historical`
2. Click **⏪ Replay 2022 Sylhet Floods** at the bottom of the dashboard
3. Press **Play** — timeline advances 1 day per 2 seconds
4. Watch Sylhet Sadar escalate from LOW → MEDIUM → **CRITICAL** as the Surma River breaches 11.8m on June 16–17 (danger level ~8.5m)
5. Peak flood dates (June 15–18) display a red banner: *"HISTORICAL FLOOD EVENT — Worst flooding in 120 years"*

Expected predictions for `2022-06-16`:
- **Sylhet Sadar**: CRITICAL (85–95/100)
- **Sunamganj Sadar**: HIGH/CRITICAL (6h downstream lag)

## Local Setup

```bash
# 1. Clone and install
git clone https://gitlab.com/your-org/flood-sentinel.git
cd flood-sentinel
npm install

# 2. Configure environment
cp .env.local .env.local.backup
# Edit .env.local with your credentials

# 3. Apply database schema (Supabase SQL editor)
# supabase/migrations/001_initial_schema.sql
# supabase/seeds/001_river_stations.sql

# 4. Run dev server
npm run dev

# 5. Seed and test
curl -X POST http://localhost:3000/api/seed/historical
curl -X POST http://localhost:3000/api/sync/all
curl -X POST http://localhost:3000/api/agent \
  -H "Content-Type: application/json" -d '{"mode":"all"}'
```

### Required Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `GEMINI_API_KEY` | Google AI Studio key |
| `TWILIO_ACCOUNT_SID` | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TWILIO_PHONE_NUMBER` | From number (E.164) |
| `ALERT_RECIPIENTS` | Comma-separated E.164 recipient numbers |
| `ARIZE_API_KEY` | Arize Cloud API key (production OTel) |
| `ARIZE_SPACE_ID` | Arize space ID |
| `GITLAB_TOKEN` | GitLab personal access token |
| `GITLAB_PROJECT_ID` | GitLab project ID |
| `CRON_SECRET` | Bearer token for Vercel cron auth |
| `SEED_SECRET` | `flood_sentinel_seed_2026` |

## API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/agent` | GET | Latest predictions (last 6h, deduplicated) |
| `/api/agent` | POST | `{mode:"single"\|"all"\|"historical",targetDate?}` |
| `/api/agent/evaluate` | GET | Accuracy report vs ground truth |
| `/api/stations` | GET | All active river stations |
| `/api/alerts` | GET | Last 20 alerts sent |
| `/api/alerts/dispatch` | POST | Dispatch alerts (manual or `{mode:"auto"}`) |
| `/api/sync/all` | POST | Full data sync (BWDB + rainfall + forecast) |
| `/api/seed/historical` | POST | Seed 2022 Sylhet flood data |
| `/api/gitlab/incidents` | GET | Critical prediction incident URLs |
| `/api/health` | GET | DB connectivity check |
| `/api/cron/sync` | GET | Hourly :00 — sync all sources |
| `/api/cron/predict` | GET | Hourly :15 — run agent predictions |
| `/api/cron/alert` | GET | Hourly :30 — dispatch unalerted predictions |

## Impact

| Metric | Current System | Flood Sentinel |
|--------|---------------|----------------|
| Warning granularity | District (5,000–15,000 km²) | Upazila (50–500 km²) |
| Forecast horizon | 24h at danger level | 72h with trajectory |
| Language | English broadcast | English + Bengali direct |
| Alert channel | TV/radio | SMS + WhatsApp |
| Upstream lead time | At breach | 6–20h before breach |
| Feedback loop | None | Arize accuracy tracking |

A 24-hour improvement in evacuation lead time is estimated to reduce flood fatalities by 30–50% (BDRCS historical data).

## Team

**Minhaz Uddin** — Devixus · Chittagong, Bangladesh

---
*Cron pipeline: sync :00 · predict :15 · alert :30 every hour*
*All predictions traced in Arize Phoenix for continuous improvement*

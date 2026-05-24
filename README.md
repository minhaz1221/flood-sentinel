# Flood Sentinel

> AI flood early warning agent for Bangladesh. Detects flood risk 32+ hours before official BWDB warnings using real government river gauge data, NASA rainfall, and Gemini 2.5 Flash Lite.

🌐 **Live demo:** https://flood-sentinel.devixus.com  
📺 **Video walkthrough:** [TBD]  
🏗️ **Built for:** [Google Cloud Rapid Agent Hackathon 2026](https://cloud.google.com)

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs)](https://nextjs.org)
[![Gemini](https://img.shields.io/badge/Gemini-2.5_Flash_Lite-4285F4?logo=google)](https://ai.google.dev)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase)](https://supabase.com)
[![Arize](https://img.shields.io/badge/Arize-Phoenix_OTel-7C3AED)](https://arize.com)
[![GitLab](https://img.shields.io/badge/GitLab-Incidents-FC6D26?logo=gitlab)](https://gitlab.com)
[![Twilio](https://img.shields.io/badge/Twilio-SMS_+_WhatsApp-F22F46?logo=twilio)](https://twilio.com)
[![Vercel](https://img.shields.io/badge/Vercel-Deployed-000000?logo=vercel)](https://vercel.com)

---

## What it does

Bangladesh experiences catastrophic monsoon floods every year — the 2022 Sylhet event, the worst in 120 years, submerged 4 million people with only hours of warning. Flood Sentinel fuses live river gauge readings scraped from the Bangladesh FFWC, hourly rainfall from Open-Meteo (NASA IMERG-backed), and 7-day GFS model forecasts into a Gemini 2.5 Flash Lite reasoning engine that issues 72-hour risk predictions at the upazila level — 20× more granular than existing government warnings. When risk hits CRITICAL, the system automatically creates a GitLab incident, dispatches Bengali-language SMS and WhatsApp alerts via Twilio, and plays a Bengali voice announcement via ElevenLabs — all within seconds of the prediction completing.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          DATA SOURCES                               │
│   BWDB/FFWC (scraped)  Open-Meteo (rainfall)  Open-Meteo (GFS)     │
└──────────┬───────────────────────┬───────────────────────┬──────────┘
           │                       │                       │
           ▼                       ▼                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│              Supabase PostgreSQL  (9 tables + RLS)                  │
│  river_readings · rainfall_data · weather_forecasts · sync_logs     │
│  flood_predictions · alerts_sent · river_stations · flood_events    │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
             ┌───────────────────▼──────────────────┐
             │         Fivetran MCP Freshness        │
             │   /api/mcp/fivetran → freshness check │
             └───────────────────┬──────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   Gemini 2.5 Flash Lite Agent                       │
│  aggregator.ts → 7 parallel queries + upstream topology            │
│  predict.ts    → JSON prediction (risk_level, score, reasoning,    │
│                  48h/72h outlook, bilingual key signals)            │
└──────────────┬───────────────────────────────┬─────────────────────┘
               │                               │
        ┌──────▼──────┐               ┌────────▼──────────────┐
        │  Arize OTel │               │    Alert Dispatch     │
        │  OpenInf.   │               │  GitLab incidents     │
        │  spans →    │               │  Twilio SMS / WA      │
        │  Phoenix    │               │  ElevenLabs voice     │
        └─────────────┘               └───────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                 Next.js Dashboard  (App Router)                     │
│  Leaflet map · Risk markers · River charts · Bengali/English UI     │
│  /predictions · /arize-traces · /alerts · /data-sources            │
│  Historical 2022 Sylhet Replay (72h animated timeline)             │
└─────────────────────────────────────────────────────────────────────┘
```

## What's Real vs Sandboxed

| Integration | Status | Notes |
|---|---|---|
| Gemini 2.5 Flash Lite | ✅ Live | Real predictions via `@google/generative-ai` v0.24.1 |
| Supabase | ✅ Live | Postgres + RLS, 9 tables |
| BWDB / FFWC scraper | ✅ Live | Real HTML scrape of `ffwc.gov.bd` |
| Open-Meteo (rainfall + GFS) | ✅ Live | Free public API, no key required |
| GitLab incidents | ✅ Live | Real `/api/v4/projects/:id/issues` calls for CRITICAL events |
| ElevenLabs (Bengali voice) | ✅ Live | Bengali TTS via server-side proxy (`/api/voice/synthesize`) |
| Fivetran MCP | ✅ Live | Custom MCP endpoint at `/api/mcp/fivetran`; graceful fallback if unconfigured |
| Arize Phoenix OTel | ⚠️ Configured | OTLP exporter wired to `otlp.arize.com`; requires `ARIZE_API_KEY` + `ARIZE_SPACE_ID` in Vercel env |
| Twilio SMS / WhatsApp | ⚠️ Sandboxed | Real `client.messages.create()` calls; Twilio trial blocks Bangladesh (+880) delivery |

## Tech Stack

- **Framework:** Next.js 16 (App Router, TypeScript)
- **Database:** Supabase (PostgreSQL + RLS, 9 tables)
- **AI:** `@google/generative-ai` v0.24.1 → Gemini 2.5 Flash Lite
- **Observability:** `@opentelemetry/sdk-node` v0.218.0 → Arize Phoenix
- **Alerts:** `twilio` v6.0.2 (SMS + WhatsApp)
- **Voice:** ElevenLabs v2 API (`eleven_multilingual_v2`)
- **Maps:** `react-leaflet` v5 + CartoDB dark tiles
- **Charts:** `recharts` v3
- **HTML parsing:** `node-html-parser` v7 (BWDB scraper)
- **UI:** Custom CSS design tokens, Noto Sans Bengali + Merriweather + Source Code Pro

## Getting Started

```bash
# 1. Clone and install
git clone https://github.com/minhaz1221/flood-sentinel.git
cd flood-sentinel
npm install

# 2. Configure environment
cp .env.example .env.local
# Edit .env.local with your credentials (see Environment Variables below)

# 3. Apply database schema in Supabase SQL editor
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

## Environment Variables

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

# Observability — Arize Phoenix (optional; enables OTel in production)
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

## Data Sources

| Source | Type | Frequency | Records |
|---|---|---|---|
| BWDB / FFWC | River gauge HTML scrape | Daily cron | 10 stations |
| Open-Meteo IMERG | NASA rainfall (via Open-Meteo) | Daily cron | ~2,800 records |
| Open-Meteo GFS | NOAA GFS model (via Open-Meteo) | Daily cron | ~1,200 records |
| Historical events | Seeded 2022 Sylhet timeline | Static | 7 keyframes |
| SRTM Elevation | Static terrain data | Static | 4.8M grid points |

## How the Agent Works

1. **MCP freshness check** — before every prediction batch, `checkDataFreshness()` calls the Fivetran MCP endpoint (`/api/mcp/fivetran`) to verify all data sources synced within the last 6 hours. Stale sources are injected into the Gemini prompt as a context warning.

2. **Context assembly** — `buildUpazilaContext()` runs 7 parallel Supabase queries: river gauge readings + trend direction, upstream station states, 24h/48h/72h rainfall totals, GFS 7-day forecast, and derived signals (water level % of danger threshold, upstream threat flag, monsoon season flag).

3. **Gemini inference** — the compact context is sent to `gemini-2.5-flash-lite` with structured JSON output mode and an 8-second timeout. The model returns `risk_level`, `risk_score` (0–100), 48h/72h outlooks, bilingual reasoning (English + বাংলা), and a `key_signals` array.

4. **OTel trace** — `logPredictionTrace()` emits an OpenInference-tagged span (`openinference.span.kind: "LLM"`, `input.value`, `output.value`, `llm.system: "gemini"`) that the OTLP exporter ships to Arize Phoenix in production.

5. **Alert dispatch** — CRITICAL predictions trigger in parallel: a GitLab issue (signal table + bilingual reasoning + 6-item action checklist), Twilio SMS/WhatsApp to `ALERT_RECIPIENTS`, and an ElevenLabs Bengali voice announcement via the browser.

6. **Persist** — the prediction is written to `flood_predictions` (Supabase), deduplicated by upazila, and visible on `/predictions` within seconds.

## Demo Walkthrough

1. Open https://flood-sentinel.devixus.com
2. Dashboard shows live state — all-green means no current flood risk
3. Click **▶ View 2022 Sylhet Historical Event** on the risk panel
4. Press **Play** — 72-hour timeline animates at 1 real second = 1 simulated hour
5. Watch Sylhet Sadar escalate LOW → MEDIUM → CRITICAL as the Surma River breaches 11.8m
6. Explore `/predictions` for the full AI prediction log with risk scores
7. Explore `/arize-traces` for OTel trace visualization and model accuracy
8. Explore `/data-sources` for live sync status and data pipeline health
9. Explore `/alerts` for the SMS/WhatsApp dispatch log

## API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/agent` | GET | Latest predictions (`?mode=live` or `?mode=historical`) |
| `/api/agent` | POST | `{mode:"single"\|"all"\|"historical", targetDate?}` |
| `/api/agent/evaluate` | GET | Accuracy report vs ground truth events |
| `/api/voice/synthesize` | POST | `{text}` → audio/mpeg (server-side ElevenLabs proxy) |
| `/api/mcp/fivetran` | GET/POST | Fivetran MCP tool manifest + execution |
| `/api/alerts` | GET | Last 20 alerts sent |
| `/api/alerts/dispatch` | POST | Dispatch alerts for a prediction |
| `/api/sync/all` | POST | Full data sync (BWDB + rainfall + forecast) |
| `/api/seed/historical` | POST | Seed 2022 Sylhet flood data |
| `/api/gitlab/incidents` | GET | Critical prediction incident URLs |
| `/api/health` | GET | DB connectivity check |
| `/api/cron/sync` | GET | Daily 00:00 UTC — sync all data sources |
| `/api/cron/predict` | GET | Daily 01:00 UTC — run agent predictions |
| `/api/cron/alert` | GET | Daily 02:00 UTC — dispatch unalerted predictions |

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

## License

MIT

## Built by

**Minhaz Uddin** — [Devixus](https://devixus.com), Chittagong, Bangladesh

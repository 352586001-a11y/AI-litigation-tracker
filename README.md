# Global AI Copyright Risk Tracker

Monitoring database, API, and black WorldMonitor-style dashboard for global AI copyright litigation and legislation risk. Europe remains a first-class selectable region, with France/SACD/Figaro treated as P0 monitoring targets.

## Run

```powershell
python app.py --init-db
python app.py --host 127.0.0.1 --port 8876
```

Or start it in the background on Windows:

```powershell
powershell -ExecutionPolicy Bypass -File .\start-background.ps1
```

Open http://127.0.0.1:8876

Admin review console:

```text
http://127.0.0.1:8876/admin.html
```

The admin console includes monitor run history, source health, review queue filters, manual card creation, official document capture, and publish/reject controls. Published cards are synced to the public dashboard automatically on the next refresh.

Start the 24h monitor loop:

```powershell
powershell -ExecutionPolicy Bypass -File .\start-monitor.ps1
```

The monitor loop currently runs every 60 minutes.

## Global Case Map

The dashboard now defaults to a global copyright litigation map and supports region filters for:

- 全球
- 欧洲
- 美洲
- 亚太

The backend imports the embedded AI Copyright Case Tracker data from `https://chatgptiseatingtheworld.com/aicopyrightcasetracker/`, including CourtListener docket links and decision/document links. The current import covers global U.S., European, Canadian, Chinese, Korean, Japanese, Indian, Brazilian and other tracker cases.

## API

- `GET /api/health`
- `GET /api/organizations`
- `GET /api/cases`
- `GET /api/cases/{id}`
- `GET /api/documents`
- `GET /api/video-intel`
- `GET /api/market-indicators`
- `GET /api/calendar-events`
- `POST /api/documents/capture`
- `GET /api/intel?status=published`
- `GET /api/admin/intel`
- `POST /api/admin/intel`
- `POST /api/admin/intel/publish`
- `POST /api/admin/intel/reject`
- `GET /api/sources`
- `GET /api/source-health`
- `GET /api/ai-analysis`
- `GET /api/monitor/keywords`
- `POST /api/monitor/run`
- `POST /api/official-documents/run`

## CourtListener / RECAP

CourtListener API access is configured through:

```text
COURTLISTENER_API_TOKEN
```

Without this token, the app still imports all public docket/document links exposed by the AI Copyright Case Tracker. With the token, `/api/official-documents/run` also calls CourtListener/RECAP APIs to enrich the database with public RECAP documents.

Safety boundary: the current implementation only reads already-public CourtListener/RECAP records. It does not call RECAP Fetch or any PACER purchase endpoint.

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md).
See [Data Sources](docs/data-sources.md) for the configured monitoring sources and credential-gated sources.

The repository includes:

- `Dockerfile` for Render Docker deployment
- `render.yaml` for a web service, a 1 GB persistent SQLite disk, and hourly cron
- `.github/workflows/monitor.yml` for GitHub Actions monitoring
- `scripts/run_monitor_once.py` for triggering the deployed monitor

For Render, keep `TRACKER_DB_PATH=/var/data/tracker.db` so approved cards, imported cases, and document records survive service restarts. Add `COURTLISTENER_API_TOKEN` in the Render service environment after you generate the token.

For GitHub Actions, set repository secret `TRACKER_BASE_URL` to the deployed Render URL. The workflow runs hourly and calls both `/api/monitor/run` and `/api/official-documents/run`, so it continues while your computer is off.

## Intelligence Types

- `news`: 新闻
- `law_firm_statement`: 律所表态
- `rights_holder_statement`: 权利人声明
- `official_court_document`: 官方法院文件
- `legislation_update`: 立法动态
- `video_intelligence`: 官方/权利人视频、听证、采访和活动源
- `market_indicator`: AI 平台、出版方和权利人相关上市公司延迟行情指标
- `calendar_event`: 立法节点、听证、投票、判决预期和政策截止日

## WorldMonitor-Style Layers

The main dashboard is a Chinese-first black map console with separate layers for litigation, official documents, rights-holder statements, legislation, video intelligence, market indicators, and risk calendar events. It also renders live chart cards for P0-P3 distribution, layer mix, jurisdiction heat, source confidence, AI risk scoring, and source coverage. The market layer uses Yahoo Finance delayed chart data as a risk-sensitivity signal only; it is not treated as legal evidence.

Published seed intelligence is source-audited before release: dead links and non-copyright adjacent IP items are removed from the public layers, while official documents such as UK Judiciary PDFs are stored in the documents layer.

`/api/ai-analysis` returns rule-based organization and rights-holder risk analysis: score, P0-P3 level, drivers, document gaps, and recommended next action. It is designed so a model-backed analyzer can replace the scoring function later without changing the frontend contract.

`POST /api/documents/capture` downloads an official document URL, stores the raw payload under `data/raw`, calculates a SHA-256 hash, and inserts a document row.

Example:

```powershell
Invoke-RestMethod http://127.0.0.1:8876/api/documents/capture -Method Post -ContentType "application/json" -Body '{"source_url":"https://www.data.gouv.fr/dataservices/api-judilibre","source_id":"source_judilibre","title":"Judilibre API reference","jurisdiction":"France","confidence":"official"}'
```

The monitor runner currently ships with official-source connector stubs, deterministic seed data, and a document capture path. Source-specific production adapters should be enabled with official API credentials/configuration and legal review.

## Git

```powershell
git init
git add .
git commit -m "Build global AI copyright risk tracker"
git branch -M main
git remote add origin <your-github-repo-url>
git push -u origin main
```

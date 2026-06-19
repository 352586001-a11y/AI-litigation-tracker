# Europe AI Copyright Risk Tracker

Prototype monitoring database, API, and dashboard for European AI copyright litigation risk, with France as the first-class jurisdiction.

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

Start the 24h monitor loop:

```powershell
powershell -ExecutionPolicy Bypass -File .\start-monitor.ps1
```

The monitor loop currently runs every 60 minutes.

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
- `GET /api/monitor/keywords`
- `POST /api/monitor/run`
- `POST /api/official-documents/run`

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md).
See [Data Sources](docs/data-sources.md) for the configured monitoring sources and credential-gated sources.

The repository includes:

- `Dockerfile` for Render Docker deployment
- `render.yaml` for a web service and hourly cron
- `.github/workflows/monitor.yml` for GitHub Actions monitoring
- `scripts/run_monitor_once.py` for triggering the deployed monitor

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

The main dashboard is a Chinese-first map console with separate layers for litigation, official documents, rights-holder statements, legislation, video intelligence, market indicators, and risk calendar events. The market layer uses Yahoo Finance delayed chart data as a risk-sensitivity signal only; it is not treated as legal evidence.

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
git commit -m "Build Europe AI copyright risk tracker"
git branch -M main
git remote add origin <your-github-repo-url>
git push -u origin main
```

# Deployment

This project can run as a Docker web service on Render and can be triggered hourly by either Render Cron or GitHub Actions.

## Render Web Service

Create a new Render Web Service from this repository.

- Environment: Docker
- Plan: Free or the smallest paid plan
- Health check path: `/api/health`

The included `Dockerfile` starts:

```bash
python app.py --host 0.0.0.0 --port ${PORT:-10000}
```

## Render Cron

The included `render.yaml` defines a cron job. Set this environment variable in Render:

```text
TRACKER_BASE_URL=https://your-render-service.onrender.com
```

The cron command is:

```bash
python scripts/run_monitor_once.py $TRACKER_BASE_URL
```

It calls:

- `POST /api/monitor/run`
- `POST /api/official-documents/run`

## GitHub Actions

The workflow `.github/workflows/monitor.yml` can also trigger the deployed monitor hourly.

Add this repository secret:

```text
TRACKER_BASE_URL=https://your-render-service.onrender.com
```

Then run the workflow manually once from GitHub Actions to verify it.

## Official API Credentials

Do not commit API credentials.

For local development, copy:

```text
config/official-sources.example.json
```

to:

```text
config/official-sources.local.json
```

For Render, use environment variables or Render secret files. The app supports:

- direct bearer token
- OAuth client credentials

Judilibre can be configured with:

```json
{
  "judilibre": {
    "enabled": true,
    "search_url": "https://api.piste.gouv.fr/cassation/judilibre/v1.0/search",
    "token_url": "PASTE_PISTE_OAUTH_TOKEN_URL_HERE",
    "client_id": "PASTE_PISTE_APPLICATION_CLIENT_ID_HERE",
    "client_secret": "PASTE_PISTE_APPLICATION_CLIENT_SECRET_HERE",
    "scope": "openid",
    "auth_style": "body",
    "query_limit": 5,
    "headers": {}
  }
}
```

## Persistence

The current MVP uses SQLite at:

```text
data/tracker.db
```

On free ephemeral hosting, the database may be recreated on redeploy. For long-term operation, add persistent storage or migrate to Postgres/Supabase.

## Cost Controls

- Keep instance count at 1.
- Do not enable autoscaling.
- Keep cron frequency hourly.
- Set billing alerts in Render.
- Do not create paid databases until needed.

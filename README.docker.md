# MarketIQ — Docker deployment

The marketing dashboard runs as a single Node.js (Express) container on port **3000**.

## Prerequisites

- **Docker Desktop** installed and running. Download: https://www.docker.com/products/docker-desktop/
  (Verify with `docker --version` and `docker compose version`.)

## 1. Configure credentials

Edit `.env` (created from `.env.example`) and fill in real values:

```
OPENAI_API_KEY=sk-...
GADS_CUSTOMER_IDS=...
GADS_DEVELOPER_TOKEN=...
GADS_CLIENT_ID=...
GADS_CLIENT_SECRET=...
GADS_REFRESH_TOKEN=...
FB_ACCOUNT_ID=act_...
FB_ACCESS_TOKEN=...
GA_PROPERTY_ID=...
GA_REFRESH_TOKEN=...
```

> The app may rewrite `.env` at runtime (e.g. saving the Google OAuth
> refresh token). Because `.env` is bind-mounted, those changes persist on
> the host and survive container restarts.

## 2. Build and run

```bash
docker compose up -d --build
```

Open http://localhost:3000

## Common commands

```bash
docker compose logs -f          # tail logs
docker compose restart          # restart
docker compose down             # stop and remove the container
docker compose up -d --build    # rebuild after pulling new code
```

## Persistence

- `./.env`  — credentials (bind-mounted file)
- `./data/` — runtime-written `<platform>.json` data (bind-mounted dir)

Both live on the host, so rebuilding the image never loses data.

## External agent markdown

If another agent writes a markdown report in a separate folder, point the dashboard
at that folder in `.env`:

```env
AGENT_MARKDOWN_HOST_DIR=C:/Users/RodGayacao/Developer/Marketing/ads-reports
AGENT_MARKDOWN_PATH=
```

`AGENT_MARKDOWN_HOST_DIR` is the host folder that contains the markdown file.
Leave `AGENT_MARKDOWN_PATH` blank to use the newest `.md` file in that folder.
To force a specific file, set it to a container path like
`/app/agent-sync/nexgen-google-ads-report-2026-06-12.md`.

The AI panel has an **Agent report** chip that reads the latest markdown file.
The AI chat also includes that report as context for follow-up questions.

## Notes

- `GOOGLE_OAUTH_REDIRECT` defaults to `http://localhost:3000/auth/google/callback`.
  If you serve this behind a domain, set it in `.env` to the public callback URL
  and register that URL in the Google Cloud console.

# CEUR PDF Check

Dockerized web and CLI service for checking CEUR-WS manuscript PDFs with the
official `check-pdf-errors` tool and saving the result as Markdown.

## Web UI

Configure deployment defaults in `.env`, then build and start the service with
Docker Compose:

```bash
docker compose --env-file .env up --build -d
```

Open `http://localhost:${APP_PORT}`. With the default `.env`, that is
`http://localhost:3000`.

Stop the service:

```bash
docker compose --env-file .env down
```

Sign in with Google, upload a PDF, run the check, read the generated Markdown
report, and download `report.md`. The dashboard and `/api/check` require an
authenticated Google session; `/api/health` stays public for Docker health
checks.

Configure Google OAuth in `.env` before deployment:

- `AUTH_SECRET`: a high-entropy secret, for example from `openssl rand -base64 32`
- `AUTH_GOOGLE_ID`: Google OAuth client ID
- `AUTH_GOOGLE_SECRET`: Google OAuth client secret
- `AUTH_TRUST_HOST=true`: required for containerized deployments

Register `http://localhost:3000/api/auth/callback/google` as a local Google
OAuth redirect URI, and use the matching production URL for deployed hosts.
Any Google account with a verified email address can use the app.

The GitHub link uses `NEXT_PUBLIC_GITHUB_REPO_URL` at build time. Rebuild the
image after changing it in `.env`.

```bash
docker compose --env-file .env build --no-cache
docker compose --env-file .env up -d
```

## CLI

The image also keeps the command-line checker available:

```bash
docker compose --env-file .env run --rm ceur-pdf-check ceur-pdf-check --help
```

For host-owned output files, run the CLI with your user and a mounted workdir:

```bash
docker compose --env-file .env run --rm --user "$(id -u):$(id -g)" \
  -v "$PWD:/work" ceur-pdf-check \
  ceur-pdf-check /work/Malakhov_et_al_UkrPROG_2026_id_22_revised.pdf \
  --output /work/report.md
```

Check all PDFs in a directory:

```bash
docker compose --env-file .env run --rm --user "$(id -u):$(id -g)" \
  -v "$PWD:/work" ceur-pdf-check \
  ceur-pdf-check /work --output /work/report.md
```

Run a subset of CEUR checks:

```bash
docker compose --env-file .env run --rm --user "$(id -u):$(id -g)" \
  -v "$PWD:/work" ceur-pdf-check \
  ceur-pdf-check /work \
  --tests "readable copyright genai libertinus pagecount" \
  --output /work/report.md
```

## Parallel Requests

The web API limits concurrent CEUR checker processes per container. Tune the
limits in `.env`:

- `CEUR_MAX_CONCURRENT_CHECKS`, default `2`
- `CEUR_MAX_QUEUED_CHECKS`, default `8`
- `CEUR_QUEUE_TIMEOUT_MS`, default `15000`

Requests over the active and queued limits return `429` with a retry-friendly
error message. These limits are per container; use external queueing if multiple
replicas need a shared global limit.

## Local Development

Install dependencies and run the UI locally:

```bash
npm install
npm run dev
```

Run checks:

```bash
bash -n bin/ceur-pdf-check
AUTH_SECRET=dev-only-auth-secret-change-me-minimum-32-chars \
AUTH_GOOGLE_ID=test-client-id \
AUTH_GOOGLE_SECRET=test-client-secret \
AUTH_TEST_MODE=true \
AUTH_TEST_LOGIN_TOKEN=test-login-token \
  docker compose --env-file .env build
AUTH_SECRET=dev-only-auth-secret-change-me-minimum-32-chars \
AUTH_GOOGLE_ID=test-client-id \
AUTH_GOOGLE_SECRET=test-client-secret \
AUTH_TEST_MODE=true \
AUTH_TEST_LOGIN_TOKEN=test-login-token \
  docker compose --env-file .env up -d
docker compose --env-file .env ps
docker compose --env-file .env exec -T ceur-pdf-check ceur-pdf-check --help
docker run --rm --network host \
  -v "$PWD:/work" \
  -v ceur-pdf-check-node-modules:/work/node_modules \
  -w /work \
  mcr.microsoft.com/playwright:v1.60.0-noble npm ci
docker run --rm --network host \
  -v "$PWD:/work" \
  -v ceur-pdf-check-node-modules:/work/node_modules \
  -w /work \
  -e PLAYWRIGHT_BASE_URL="${PLAYWRIGHT_BASE_URL:-http://127.0.0.1:3000}" \
  mcr.microsoft.com/playwright:v1.60.0-noble npm run test:e2e
docker compose --env-file .env down
```

The local API route expects `ceur-pdf-check` to be available on `PATH`. The
Docker image provides that automatically.

## CEUR Scripts

The image downloads the CEUR scripts during build:

- `https://ceur-ws.org/ceurtools/check-pdf-errors`
- `https://ceur-ws.org/ceurtools/check-libbyhead.py`

## Exit Status

The CLI exits with status `0` when the CEUR checker completes and no likely
finding lines are detected. It exits nonzero when the checker fails or when the
output contains likely errors, warnings, or CEUR remediation lines.

The web UI treats nonzero checker exits as completed validations when a Markdown
report is produced, because CEUR findings are the expected output for invalid
manuscripts.

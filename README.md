# CEUR PDF Check

Dockerized web and CLI service for checking CEUR-WS manuscripts in PDF, DOCX,
DOC, and ODT formats. DOCX, DOC, and ODT manuscripts are converted to PDF with
LibreOffice before the official `check-pdf-errors` tool and rendered
CEURART-style reference validation generate a Markdown report.

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

Sign in with Google, upload or drag-and-drop a PDF, DOCX, DOC, or ODT
manuscript, run the check, read the generated Markdown report, and download
`report_<manuscript-stem>.md`,
for example `report_paper.md`. The report panel renders Markdown by default and
includes a preview/source switcher. Ukrainian preview localizes report
headings/metadata for reading, while source mode and downloads keep the raw
Markdown emitted by the checker.

The dashboard header includes project links, localized developer credit, a
localized Info modal, a persisted light/dark theme switcher, and a matching
compact `UA`/`EN` language switcher. The larger Info modal explains supported
checks, Reference mistake repair, and the ChatGPT prompt workflow in Ukrainian
and English. The theme choice is stored in the browser and both pill-style
header switchers avoid full visible labels while keeping accessible names. The
dashboard localizes checker/API errors in Ukrainian and English, including
upload parsing, queue, timeout, and missing report failures. Unauthenticated protected API errors
include a `requestId` for consistent troubleshooting across proxy and route
responses.

It keeps the fixed-shell layout with a compact control panel, an enlarged
full-width report workspace, and internal scrolling for long reports and
compact mobile viewports. The upload dropzone preserves its active state during
nested drag movement and clears the highlight after file selection. The notes
panel has been removed so the report remains the primary workspace. The
dashboard and `/api/check` require an authenticated Google session; `/api/health`
stays public for Docker health checks.

The Info modal links to `/ceur_ws_reference_prompt.md`, served from
`public/ceur_ws_reference_prompt.md`. To generate CEUR-WS references, download
that Markdown file, upload it to a ChatGPT dialog, paste a list of URLs or DOIs
in the message field, review the generated references, and copy them into the
manuscript References section.

Configure Google OAuth in `.env` before deployment:

- `AUTH_SECRET`: a high-entropy secret, for example from `openssl rand -base64 32`
- `AUTH_GOOGLE_ID`: Google OAuth client ID
- `AUTH_GOOGLE_SECRET`: Google OAuth client secret
- `AUTH_TRUST_HOST=true`: required for containerized deployments
- `AUTH_URL`: the browser-visible app origin, for example `http://localhost:3000` locally or `https://your-domain.com` in production

Register `http://localhost:3000/api/auth/callback/google` as a local Google
OAuth redirect URI, and use the matching production URL for deployed hosts.
Do not use `0.0.0.0` in Google OAuth redirect URIs; it is only a server bind
address and is not a valid browser callback host.
Any Google account with a verified email address can use the app.

For local Google Console setup, use:

- Authorized JavaScript origin: `http://localhost:3000`
- Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`

For production, set `AUTH_URL` to the public HTTPS origin and register the
matching `/api/auth/callback/google` redirect URI.

The dashboard GitHub badge points to the project repository at
`https://github.com/malakhovks/ceur-pdf-check-service`; the developer credit
links to `https://linktr.ee/malakhovks`.

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

DOCX, DOC, and ODT inputs are accepted the same way and converted before the PDF
checker runs:

```bash
docker compose --env-file .env run --rm --user "$(id -u):$(id -g)" \
  -v "$PWD:/work" ceur-pdf-check \
  ceur-pdf-check /work/Malakhov_et_al_UkrPROG_2026_id_22_revised.docx \
  --output /work/report.md
```

Check all supported manuscripts in a directory:

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

Reports also include a reference check implemented by `ceur-reference-check`.
The helper extracts each checked PDF's rendered text with Poppler and validates
that the References section follows CEURART-style output: bracketed numbered
entries, sequential labels, publication years, and rendered DOI/URL prefixes
such as `doi:` and `URL:`. Reference errors are included in
`## Reference Check` and fail the overall report status.

## Parallel Requests

The web API limits concurrent CEUR checker processes per container. Tune the
limits in `.env`:

- `CEUR_MAX_CONCURRENT_CHECKS`, default `2`
- `CEUR_MAX_QUEUED_CHECKS`, default `8`
- `CEUR_QUEUE_TIMEOUT_MS`, default `15000`

Requests over the active and queued limits return `429` with a retry-friendly
error message. These limits are per container; use external queueing if multiple
replicas need a shared global limit.

Successful queue-drain coverage lives in `tests/concurrent-processing.spec.ts`.
Start the app with test authentication and a longer queue timeout such as
`CEUR_QUEUE_TIMEOUT_MS=600000`, then run the spec in the required Playwright
image to submit the required ODT, PDF, and DOCX manuscripts in 2-, 4-, and
8-request batches:

```bash
docker run --rm --network host \
  -v "$PWD:/work" \
  -v ceur-pdf-check-node-modules:/work/node_modules \
  -w /work \
  -e PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 \
  mcr.microsoft.com/playwright:v1.60.0-noble \
  npx playwright test tests/concurrent-processing.spec.ts --project=chromium
```

## Local Development

Install dependencies and run the UI locally:

```bash
npm install
npm run dev
```

Run checks:

```bash
bash -n bin/ceur-pdf-check
python3 -m py_compile bin/ceur-reference-check
AUTH_SECRET=dev-only-auth-secret-change-me-minimum-32-chars \
AUTH_GOOGLE_ID=test-client-id \
AUTH_GOOGLE_SECRET=test-client-secret \
AUTH_TEST_MODE=true \
AUTH_TEST_LOGIN_TOKEN=test-login-token \
AUTH_URL=http://127.0.0.1:3000 \
  docker compose --env-file .env build
AUTH_SECRET=dev-only-auth-secret-change-me-minimum-32-chars \
AUTH_GOOGLE_ID=test-client-id \
AUTH_GOOGLE_SECRET=test-client-secret \
AUTH_TEST_MODE=true \
AUTH_TEST_LOGIN_TOKEN=test-login-token \
AUTH_URL=http://127.0.0.1:3000 \
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
  -e PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 \
  mcr.microsoft.com/playwright:v1.60.0-noble npm run test:e2e
docker compose --env-file .env down
```

The e2e suite authenticates with the disabled-by-default test provider. Enable
it only for local or CI verification by setting `AUTH_TEST_MODE=true` and
`AUTH_TEST_LOGIN_TOKEN` on the app container before running Playwright. The
web tests cover authentication, request-id-bearing protected API errors,
localized server-side error handling, fixed-shell layout, compact
dashboard/report alignment, compact viewport reachability, stable upload
dropzone drag state, Info modal Reference guidance and prompt download link,
persisted dark theme, matched theme/language switch semantics and sizing,
rendered Markdown reports, source-mode Markdown, raw report downloads with
analyzed-file-based filenames, internal report scrolling, stale response
handling, supported manuscript selection, converted-manuscript regressions,
real PDF checks, and dedicated 2/4/8 concurrent document-processing requests.

The local API route expects `ceur-pdf-check` to be available on `PATH`. The
Docker image provides that automatically.

## CEUR Scripts

The image downloads the CEUR scripts during build:

- `https://ceur-ws.org/ceurtools/check-pdf-errors`
- `https://ceur-ws.org/ceurtools/check-libbyhead.py`

The image also installs LibreOffice Writer for DOCX, DOC, and ODT conversion,
and the project-local `ceur-reference-check` helper, which uses `pdftotext`
from Poppler to validate rendered CEURART-style references.

## Exit Status

The CLI exits with status `0` when manuscript conversion succeeds, the CEUR
checker completes, no likely finding lines are detected, and the reference check
passes. It exits nonzero when conversion fails, when the checker fails, when the
output contains likely errors, warnings, or CEUR remediation lines, or when
reference-format errors are found.

The web UI treats nonzero checker exits as completed validations when a Markdown
report is produced, because CEUR findings are the expected output for invalid
manuscripts.

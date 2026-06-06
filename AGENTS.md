# Repository Guidelines

## Project Structure & Module Organization

This repository packages a Dockerized CLI and authenticated web UI for the
official CEUR-WS `check-pdf-errors` checker.

- `Dockerfile` builds the Debian/Node runtime, installs PDF tooling, downloads
  CEUR helper scripts, builds the Next.js app, and serves it on port `3000`.
- `docker-compose.yml` builds/runs the web service, exposes `${APP_PORT:-3000}`,
  and passes Auth.js, Google OAuth, and checker queue env.
- `bin/ceur-pdf-check` is the Bash CLI. It validates arguments, copies input PDFs
  to a temporary work directory, runs CEUR checks, and writes a Markdown report.
- `app/` contains the Next.js App Router UI, Auth.js routes, health/check API
  routes, sign-in page, and protected dashboard.
- `auth.ts` configures Auth.js Google Sign-In, JWT sessions, and disabled-by-
  default test authentication. `proxy.ts` protects the dashboard and `/api/check`.
- `tests/` contains Playwright and queue tests. `playwright.config.ts` targets
  desktop and mobile Chromium against `PLAYWRIGHT_BASE_URL`.
- `README.md`, `CHANGELOG.md`, and `AGENTS.md` document usage and project state.
- `report.md` is a generated sample output. Treat new reports as artifacts unless
  they are intentionally used as fixtures.
- `.dockerignore` excludes PDFs, logs, generated reports, Playwright artifacts,
  `.next`, and dependency directories from the Docker build context.

## Build, Test, and Development Commands

```bash
docker compose --env-file .env up --build -d
```

Builds and starts the authenticated web service.

```bash
bash -n bin/ceur-pdf-check
```

Checks the Bash entrypoint syntax.

```bash
docker compose --env-file .env run --rm --user "$(id -u):$(id -g)" \
  -v "$PWD:/work" ceur-pdf-check \
  ceur-pdf-check /work/Malakhov_et_al_UkrPROG_2026_id_22_revised.pdf \
  --output /work/report.md
```

Runs the sample PDF check and writes a host-owned Markdown report.

```bash
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
```

Runs the e2e suite in the required Microsoft Playwright browser image. Enable
`AUTH_TEST_MODE=true` and set `AUTH_TEST_LOGIN_TOKEN` on the app container for
test sign-in.

## Coding Style & Naming Conventions

Use Bash for the CLI and keep existing idioms such as `[[ ... ]]`, process
substitution, and lowercase parameter expansion. Indent Bash with two spaces.
Quote variable expansions unless word splitting is required. Keep constants and
derived paths in uppercase variables (`WORKDIR`, `RAW_LOG`); use lowercase
function names such as `usage` and `error`.

Return `2` for usage or input validation errors. Preserve nonzero exits for
findings or checker failures.

Use TypeScript/React for the web UI. Keep Auth.js server-only code in server
files (`auth.ts`, route handlers, server pages) and client-only browser behavior
in `"use client"` components such as `app/checker-ui.tsx`.

## Testing Guidelines

For `bin/ceur-pdf-check` changes, run `bash -n`, rebuild the image, and perform
at least one container run against a single PDF. For directory handling changes,
test a mounted directory with multiple PDFs and optional `index.html` or
`watermark-log.txt` companions.

For web or API changes, rebuild with Docker Compose and run Playwright in
`mcr.microsoft.com/playwright:v1.60.0-noble`. Keep `/api/health` public and
verify unauthenticated `/api/check` requests return `401`.

## Commit & Pull Request Guidelines

Use concise, imperative commit subjects such as `Add report output validation`
or `Update CEUR checker image setup`.

Pull requests should describe behavior changes, list verification commands, and
include report snippets when output formatting or finding detection changes.
Link related issues when available. Avoid adding large PDFs or generated reports
unless they are intentional fixtures.

## Security & Configuration Tips

The image downloads executable CEUR scripts during build. Review URL or checksum
changes carefully. Do not bake private manuscripts into the image; mount inputs
at runtime with `-v "$PWD:/work"`.

Google Sign-In requires runtime-only secrets: `AUTH_SECRET`, `AUTH_GOOGLE_ID`,
and `AUTH_GOOGLE_SECRET`. Set `AUTH_URL` to the browser-visible origin, for
example `http://localhost:3000` locally or the production HTTPS origin. Never use
`0.0.0.0` as a Google OAuth origin or redirect URI. Keep `AUTH_TEST_MODE=false`
outside local/CI tests.

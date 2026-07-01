# Repository Guidelines

## Project Structure & Module Organization

This repository packages a Dockerized CLI and authenticated web UI for the
official CEUR-WS `check-pdf-errors` checker.

- `Dockerfile` builds the Debian/Node runtime, installs PDF tooling and
  LibreOffice Writer, downloads CEUR helper scripts, builds the Next.js app, and
  serves it on port `3000`.
- `docker-compose.yml` builds/runs the web service, exposes `${APP_PORT:-3000}`,
  and passes Auth.js, Google OAuth, and checker queue env.
- `next.config.ts` enables standalone output and raises the Next.js proxy
  upload body cap above the app's 30 MB manuscript limit so valid large
  uploads reach `/api/check`.
- `bin/ceur-pdf-check` is the Bash CLI. It validates arguments, accepts PDF,
  DOCX, DOC, and ODT manuscripts, converts office formats with LibreOffice in a
  separate scratch directory, runs CEUR checks plus supplemental font/reference
  checkers, writes a Markdown report, can show opt-in font evidence through
  `--font-evidence`, and can write structured reference extraction JSON through
  `--reference-json-output` for API repair features.
- `bin/ceur-font-check` is the Python helper that inspects rendered PDF glyph
  fonts with pdfminer, reports non-Libertinus body/heading text once by default,
  and emits `--> Page ... font ... renders ...` evidence lines only when
  requested.
- `bin/ceur-reference-check` is the Python helper that extracts rendered PDF text
  with Poppler, validates CEURART-style numbered reference sections, and can
  emit structured JSON with the extracted section, parsed entries, and per-entry
  errors.
- `app/` contains the Next.js App Router UI, Auth.js routes, health/check API
  routes, the testable check handler, structured logging helper, reference-fix
  worker, sign-in page, protected compact `CEURCheck` dashboard with a
  localized MonoBank donation link, resilient drag-and-drop upload control,
  stable-size localized Settings modal with App features/Settings tabs,
  Reference repair guidance, prompt download, persisted
  theme/settings/latest-analysis state, opt-in DejaVu/font evidence setting,
  matched compact theme/language pill switchers, and full-width tabbed
  rendered/source Markdown report panel.
- `auth.ts` configures Auth.js Google Sign-In, JWT sessions, and disabled-by-
  default test authentication. `proxy.ts` protects the dashboard and `/api/check`;
  `proxy-auth-response.ts` keeps proxy-originated API authentication errors
  traceable and logged.
- `tests/` contains Playwright UI/API tests, structured logging coverage,
  reference extraction and repair worker coverage, dedicated concurrent
  processing coverage, and checker queue tests. `playwright.config.ts` targets
  desktop and mobile Chromium against `PLAYWRIGHT_BASE_URL`.
- `public/ceur_ws_reference_prompt.md` is the static ChatGPT prompt downloaded
  from the Settings modal for generating CEUR-WS references from URLs or DOIs.
- `README.md` is bilingual, with a top-level language chooser and mirrored
  English/Ukrainian sections. `CHANGELOG.md` and `AGENTS.md` document usage
  and project state.
- Published evaluation artifacts for the ProfIT AI 2026 manuscript live in the
  Hugging Face dataset `malakhovks/ceurcheck-profitai2026-evaluation-artifacts`
  with DOI `10.57967/hf/9380`. Treat local `eval/` directories as disposable
  generated artifacts and do not commit them.
- `report.md` is a generated sample output. Treat new reports as artifacts unless
  they are intentionally used as fixtures.
- `.dockerignore` excludes PDFs, DOCX, DOC, ODT, logs, generated reports,
  local `eval/` artifacts, Playwright artifacts, `.next`, and dependency
  directories from the Docker build context.

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

Runs the sample PDF check, including the rendered reference check, and writes a
host-owned Markdown report. DOCX, DOC, and ODT samples should be checked the same
way when conversion behavior changes.

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
`AUTH_TEST_MODE=true`, set `AUTH_TEST_LOGIN_TOKEN`, and use a local `AUTH_URL`
such as `http://127.0.0.1:3000` on the app container for test sign-in.

```bash
docker run --rm --network host \
  -v "$PWD:/work" \
  -v ceur-pdf-check-node-modules:/work/node_modules \
  -w /work \
  -e PLAYWRIGHT_BASE_URL="${PLAYWRIGHT_BASE_URL:-http://127.0.0.1:3000}" \
  mcr.microsoft.com/playwright:v1.60.0-noble \
  npx playwright test tests/concurrent-processing.spec.ts --project=chromium
```

Runs the dedicated 2, 4, and 8 concurrent request document-processing test.
Start the app with test authentication and `CEUR_QUEUE_TIMEOUT_MS=600000` for
successful queue-drain validation.

## Coding Style & Naming Conventions

Use Bash for the CLI and keep existing idioms such as `[[ ... ]]`, process
substitution, and lowercase parameter expansion. Indent Bash with two spaces.
Quote variable expansions unless word splitting is required. Keep constants and
derived paths in uppercase variables (`WORKDIR`, `RAW_LOG`); use lowercase
function names such as `usage` and `error`. Keep converted-office scratch output
outside the checker work directory so generated PDFs are not detected as
duplicates. Keep reference parsing in the Python helper rather than expanding
complex text parsing in Bash.

Return `2` for usage or input validation errors. Preserve nonzero exits for
findings or checker failures. Keep structured reference JSON compatible when
changing reference parsing because the web repair worker consumes it.

Keep server operational logs structured through `app/logging.ts`. Include
traceable fields such as `requestId`, queue snapshots, status, exit code, and
output lengths, but do not log raw manuscripts or full checker output. Keep the
`/api/check` route as an Auth.js wrapper and put testable request/checker logic
in the check handler.

Use TypeScript/React for the web UI. Keep Auth.js server-only code in server
files (`auth.ts`, route handlers, server pages) and client-only browser behavior
in `"use client"` components such as `app/checker-ui.tsx`. Render checker
reports through the existing Markdown preview/source toggle; downloads should
still save raw Markdown source and use analyzed-file-based names such as
`report_paper.md`. Reference repair downloads should likewise save the raw
repair Markdown, while previews may localize headings and explanatory text.
Keep README changes synchronized across the English and Ukrainian sections.
The top language chooser should continue linking to both sections, copied
commands/env vars/URLs must stay identical between languages, and technical
identifiers such as route names, filenames, and setting labels should remain
literal when that avoids ambiguity.

Keep dashboard layout changes report-first: compact controls above an
equal-width, full-width report surface, no notes surface, and no document
scroll. Header controls should preserve the `CEURCheck` title, localized MonoBank
donation link, localized Settings modal, Reference repair guidance, static
`ceur_ws_reference_prompt.md` download link, localStorage-backed light/dark
theme switcher, persisted automatic reference fix
and font evidence settings/latest analysis, matching compact `UA`/`EN`
language switcher, localized developer credit, and accessible labels even when
visible labels are intentionally short. When backend error strings change, update the client
`errorTranslations` map and Ukrainian/English copy together so server-origin
failures remain localized.

## Testing Guidelines

For `bin/ceur-pdf-check`, `bin/ceur-font-check`, or `bin/ceur-reference-check`
changes, run `bash -n`, run `python3 -m py_compile bin/ceur-font-check bin/ceur-reference-check`, rebuild the image, and perform container runs against
the sample PDF plus DOCX/ODT manuscripts when conversion paths or font/reference
reporting are touched. For font-check changes, verify evidence lines stay hidden
by default and appear with `--font-evidence`. For reference-check changes, verify
that reports include
`## Reference Check`, `Reference status`, `Reference errors`, and the standard
`doi:`/`URL:` guidance line before failing reference error entries. For directory
handling changes, test a mounted directory with multiple supported manuscripts
and optional `index.html` or `watermark-log.txt` companions.

For web or API changes, rebuild with Docker Compose and run Playwright in
`mcr.microsoft.com/playwright:v1.60.0-noble`. Keep `/api/health` public and
verify unauthenticated `/api/check` requests return `401` with a `requestId`
for traceable proxy-originated errors. For structured logging changes, run the
focused logging specs covering logger serialization, route/API log events,
checker queue decisions, checker subprocess lifecycle, reference-fix fallback
paths, and proxy authentication logs. For reference-fix changes, cover the
worker with mocked metadata responses, verify Crossref/DataCite timeout fallback,
verify low-confidence suggestions are still generated with review notes, and
verify preview localization does not alter raw Source/download Markdown. For
font evidence changes, verify the Settings checkbox persists, `/api/check` sends
the setting to the CLI, and report Source/download content remains raw Markdown.
For upload/request handling changes, verify a valid PDF larger than 10 MB but below
30 MB, such as local `1111.pdf` when available, reaches checker processing
instead of failing multipart parsing.
For queue or concurrent-processing changes, run
`tests/concurrent-processing.spec.ts` with `CEUR_QUEUE_TIMEOUT_MS=600000` and
`--project=chromium`; verify it uses `CEUR-Template-1col.odt`, the sample PDF,
and the sample DOCX at 2, 4, and 8 concurrent requests without duplicating load
across desktop and mobile projects.
For dashboard layout changes, preserve the no-document-scroll app shell, compact
scrollable controls, equal dashboard/report widths, the enlarged report surface,
and stable upload dropzone drag highlighting during nested drag movement.
Verify compact viewports use internal scrolling for controls and report
content. For header control changes, verify the Settings modal, Reference
repair guidance, ChatGPT prompt instructions, prompt download link, modal size
stability across tabs, persisted dark/light theme, persisted automatic reference
fix and font evidence settings, wordless theme switcher, compact `UA`/`EN`
language switcher, localized developer credit, `role="switch"` and
`aria-checked` semantics,
theme/language switcher size parity, and accessible labels in both Ukrainian and
English. For report rendering changes, verify rendered Markdown preview, raw
source mode, the conditional `Література`/References fix tab, and latest-analysis
restoration. For API error changes, verify localized server-side errors in both
Ukrainian and English. For report download changes, verify both raw Markdown
content and the suggested filename derived from the analyzed manuscript.

## Commit & Pull Request Guidelines

Use concise, imperative commit subjects such as `Add report output validation`
or `Update CEUR checker image setup`.

Pull requests should describe behavior changes, list verification commands, and
include report snippets when output formatting or finding detection changes.
Link related issues when available. Avoid adding large PDFs or generated reports
unless they are intentional fixtures.

## Security & Configuration Tips

The image downloads executable CEUR scripts during build, relies on LibreOffice
for office-manuscript conversion, uses pdfminer for supplemental rendered font
inspection, and uses Poppler's `pdftotext` for rendered reference extraction.
Automatic reference repair may contact Crossref and DataCite from the API route
when enabled by the user; keep metadata lookup timeouts/fallbacks in place so
external services cannot block checker results.
Review URL, checksum, conversion, PDF text-extraction, or metadata lookup
changes carefully. Do not bake private manuscripts into the image; mount inputs
at runtime with `-v "$PWD:/work"`.

Google Sign-In requires runtime-only secrets: `AUTH_SECRET`, `AUTH_GOOGLE_ID`,
and `AUTH_GOOGLE_SECRET`. Set `AUTH_URL` to the browser-visible origin, for
example `http://localhost:3000` locally or the production HTTPS origin. Never use
`0.0.0.0` as a Google OAuth origin or redirect URI. Keep `AUTH_TEST_MODE=false`
outside local/CI tests.

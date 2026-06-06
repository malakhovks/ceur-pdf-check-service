# Changelog

All notable changes to this project are documented here.

## Unreleased

- Added CEURART-style rendered reference validation for checked PDFs, using Poppler text extraction and a new `ceur-reference-check` helper.
- Added `## Reference Check` report output with reference status/error counts; reference-format errors now fail the overall report status.
- Added Playwright coverage for valid and invalid reference sections plus CLI report integration.
- Added the protected Next.js web dashboard for CEUR PDF validation, including upload, localized report display, Markdown download, and internal report scrolling.
- Added Auth.js Google Sign-In so the dashboard and `/api/check` require a verified Google account, while `/api/health` remains public for Docker health checks.
- Added runtime OAuth configuration through `.env` and Docker Compose, including `AUTH_URL` to keep Google callbacks on the browser-visible host instead of the container bind address.
- Added bounded checker queue settings for concurrent web requests.
- Added Playwright coverage for authentication gating, layout, color, upload validation, queue handling, report translation, stale response handling, and real PDF checks.
- Documented the required `mcr.microsoft.com/playwright:v1.60.0-noble` browser image for e2e testing.

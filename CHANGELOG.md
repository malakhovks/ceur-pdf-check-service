# Changelog

All notable changes to this project are documented here.

## Unreleased

- Added PDF, DOCX, DOC, and ODT manuscript checking across the CLI, API, and web dashboard.
- Added LibreOffice Writer conversion for DOCX, DOC, and ODT manuscripts before CEUR PDF checks.
- Fixed false `ERROR (P2) with duplicate PDF files!!!!` findings for converted manuscripts by keeping conversion scratch files outside the checker work directory.
- Added localized upload validation and dashboard copy for supported manuscript formats.
- Added Playwright regression coverage for converted single-file manuscripts and mixed directory inputs.
- Added rendered Markdown report preview in the web dashboard, backed by `react-markdown` and `remark-gfm`.
- Added a report view switcher for rendered preview and raw Markdown source while keeping `report.md` downloads as Markdown.
- Updated the Ukrainian dashboard subtitle to “Перевірка рукопису для CEUR-WS”.
- Added Playwright coverage for rendered report headings/tables, source-mode Markdown syntax, and report view toggle state.
- Improved dashboard error handling so server-side checker, upload parsing, queue wait, and timeout errors are localized in Ukrainian and English.
- Aligned PDF validation error text between `/api/check` and the client-side upload flow.
- Improved fixed-shell dashboard sizing with dynamic viewport height and internal panel scrolling for short mobile screens.
- Compact dashboard workspace by reducing the main title to 1.5rem, shrinking the top controls, removing the notes surface, and expanding the report panel to the full dashboard width.
- Added Playwright coverage for compact dashboard/report alignment, removed notes surface, title sizing, server-origin error localization, and compact viewport reachability.
- Added CEURART-style rendered reference validation for checked PDFs, using Poppler text extraction and a new `ceur-reference-check` helper.
- Added `## Reference Check` report output with reference status/error counts; reference-format errors now fail the overall report status.
- Added Playwright coverage for valid and invalid reference sections plus CLI report integration.
- Added the protected Next.js web dashboard for CEUR PDF validation, including upload, localized report display, Markdown download, and internal report scrolling.
- Added Auth.js Google Sign-In so the dashboard and `/api/check` require a verified Google account, while `/api/health` remains public for Docker health checks.
- Added runtime OAuth configuration through `.env` and Docker Compose, including `AUTH_URL` to keep Google callbacks on the browser-visible host instead of the container bind address.
- Added bounded checker queue settings for concurrent web requests.
- Added Playwright coverage for authentication gating, layout, color, upload validation, queue handling, report translation, stale response handling, and real PDF checks.
- Documented the required `mcr.microsoft.com/playwright:v1.60.0-noble` browser image for e2e testing.

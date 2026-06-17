# Changelog

All notable changes to this project are documented here.

## Unreleased

- Added opt-in automatic CEUR reference repair bundles from the Settings modal, with generated Markdown replacement sections, per-reference confidence/provenance, review notes, and BibTeX/CSL-JSON exports.
- Added structured reference extraction JSON output across `ceur-reference-check`, `ceur-pdf-check --reference-json-output`, and `/api/check` so the web API can build reference repair suggestions after conversion.
- Added a tabbed report surface with localized `Література`/References fix output shown only when reference issues are detected.
- Added persisted Settings and latest-analysis state in `localStorage`, including the automatic reference fix setting, latest report, active report tab, report view, and generated reference repair bundle.
- Added Crossref/DataCite metadata lookup with Citation.js normalization/export and timeout-backed fallback to extracted-text repair suggestions.
- Fixed Ukrainian localization for the generated reference-fix preview while preserving raw Markdown in Source mode and downloads.
- Stabilized the Settings modal size across App features and Settings tabs with internal tab-panel scrolling.

- Fixed valid web uploads larger than Next.js default 10 MB body handling, including `1111.pdf`, by configuring the proxy upload cap above the app's 30 MB manuscript limit.
- Kept the dedicated concurrent-processing Playwright load test on Chromium only so the desktop and mobile projects do not duplicate load against the same checker queue.
- Redesigned the compact `UA`/`EN` language control as a single accessible pill
  switch that matches the theme switcher sizing and sliding-thumb interaction.
- Added Playwright coverage for the language switch role, checked state,
  compact labels, and size parity with the theme switcher.
- Hardened the dashboard upload dropzone so nested drag movement keeps the
  active state stable and file selection resets drag highlighting.
- Added `requestId` values to unauthenticated `/api/check` proxy errors so
  protected API failures keep the same traceable JSON shape as route errors.
- Added desktop and mobile Playwright coverage for dropzone drag-state handling
  and request-id-bearing authentication errors.
- Added dedicated Playwright concurrency coverage for 2, 4, and 8 authenticated
  `/api/check` document-processing requests using the required ODT, PDF, and
  DOCX manuscript samples.
- Expanded the localized dashboard Info modal with Reference mistake repair guidance and a larger responsive panel.
- Added a public `ceur_ws_reference_prompt.md` ChatGPT prompt download for creating CEUR-WS references from URLs or DOIs.
- Added bilingual Info modal instructions for downloading the prompt, uploading it to ChatGPT, pasting URLs/DOIs, and copying generated CEUR-WS references into the manuscript.
- Added Playwright coverage for the larger Info modal, localized Reference guidance, and prompt download link.
- Added a localized dashboard Info modal describing supported uploads, CEUR checks, report views, and Markdown downloads.
- Added persistent light/dark dashboard themes with a compact wordless sun/moon header switcher.
- Added a compact `UA`/`EN` language switcher and localized the developer credit label in Ukrainian.
- Removed the standalone action-panel “all tests” pill and aligned the status and run controls to the same width and height.
- Added Playwright coverage for the Info modal, theme persistence, wordless header switchers, localized developer credit, and action-panel sizing.
- Added PDF, DOCX, DOC, and ODT manuscript checking across the CLI, API, and web dashboard.
- Added LibreOffice Writer conversion for DOCX, DOC, and ODT manuscripts before CEUR PDF checks.
- Fixed false `ERROR (P2) with duplicate PDF files!!!!` findings for converted manuscripts by keeping conversion scratch files outside the checker work directory.
- Added localized upload validation and dashboard copy for supported manuscript formats.
- Added Playwright regression coverage for converted single-file manuscripts and mixed directory inputs.
- Added rendered Markdown report preview in the web dashboard, backed by `react-markdown` and `remark-gfm`.
- Added a report view switcher for rendered preview and raw Markdown source while keeping downloads as raw Markdown.
- Renamed web report downloads to `report_<manuscript-stem>.md`, based on the analyzed upload filename.
- Updated the Ukrainian dashboard subtitle to “Перевірка рукопису для CEUR-WS”.
- Added Playwright coverage for rendered report headings/tables, source-mode Markdown syntax, raw download content, dynamic download filenames, and report view toggle state.
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

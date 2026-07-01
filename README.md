# CEUR PDF Check

[![Evaluation Dataset DOI](https://img.shields.io/badge/DOI-10.57967%2Fhf%2F9380-blue)](https://doi.org/10.57967/hf/9380)
[![Hugging Face Dataset](https://img.shields.io/badge/Hugging%20Face-Dataset-yellow)](https://huggingface.co/datasets/malakhovks/ceurcheck-profitai2026-evaluation-artifacts)

## Contents / Зміст

Choose a README language / Оберіть мову README:

- [English](#english)
- [Українська](#українська)

## English

Dockerized web and CLI service for checking CEUR-WS manuscripts in PDF, DOCX,
DOC, and ODT formats. DOCX, DOC, and ODT manuscripts are converted to PDF with
LibreOffice before the official `check-pdf-errors` tool and rendered
CEURART-style reference validation generate a Markdown report. The checker
also adds supplemental non-Libertinus font detection, with detailed evidence
lines hidden by default. When enabled in Settings, the web app can generate a
manual CEUR reference repair bundle for manuscripts with reference issues and
show DejaVu/font evidence lines for font findings.

### Evaluation Artifacts

The evaluation artifacts for the ProfIT AI 2026 article "CEURCheck: An
Explainable Rule-Based System for Multi-Format CEUR-WS Manuscript Compliance
Validation" are published as a Hugging Face dataset:

- DOI: <https://doi.org/10.57967/hf/9380>
- Dataset: <https://huggingface.co/datasets/malakhovks/ceurcheck-profitai2026-evaluation-artifacts>

Generated evaluation corpora, reports, logs, draft exports, and diagram renders
are intentionally not stored in this repository. Keep local `eval/` directories
as disposable generated artifacts and use the dataset DOI for citation and
reproducibility.

### Web UI

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
Markdown emitted by the checker. When automatic reference fix is enabled, the
same report surface adds a `Література`/References fix tab for detected
reference issues and downloads the repair bundle as `references_fix_<stem>.md`.

The dashboard header shows the `CEURCheck` title and includes the project
repository link, a localized MonoBank donation link, localized developer credit,
a localized Settings modal, a persisted light/dark theme switcher, and a
matching compact `UA`/`EN` language switcher. The stable-size Settings modal has App
features and Settings tabs: App features explains supported checks, Reference
mistake repair, and the ChatGPT prompt workflow; Settings contains opt-in
checkboxes for automatic reference fix and DejaVu/font evidence lines. Font
evidence is hidden by default; enabling it appends `--> Page ... font ...
renders ...` lines to reports when supplemental font findings are present. The
theme choice, automatic reference fix setting, font evidence setting, and latest
analysis state are stored in the browser. Both pill-style
header switchers avoid full visible labels while keeping accessible names. The
dashboard localizes checker/API errors in Ukrainian and English, including
upload parsing, queue, timeout, and missing report failures. Unauthenticated protected API errors
include a `requestId` for consistent troubleshooting across proxy and route
responses. The API emits structured JSON logs for request receipt/rejection,
accepted uploads, checker queue slot decisions, checker subprocess lifecycle,
report production or fallback, reference-fix metadata fallback, and cleanup
failures. Logs include correlation fields such as `requestId`, filename, queue
snapshot, status, exit code, and output lengths without writing raw manuscripts
or full checker output to the log stream. The Next.js proxy upload body cap is configured above the app's
30 MB manuscript limit, so valid larger PDFs such as `1111.pdf` reach the
checker instead of failing during multipart parsing.

It keeps the fixed-shell layout with a compact control panel, an enlarged
full-width report workspace, and internal scrolling for long reports and
compact mobile viewports. The upload dropzone preserves its active state during
nested drag movement and clears the highlight after file selection. The notes
panel has been removed so the report remains the primary workspace. The
dashboard and `/api/check` require an authenticated Google session; `/api/health`
stays public for Docker health checks.

The Settings modal links to `/ceur_ws_reference_prompt.md`, served from
`public/ceur_ws_reference_prompt.md`. To generate CEUR-WS references manually,
download that Markdown file, upload it to a ChatGPT dialog, paste a list of URLs
or DOIs in the message field, review the generated references, and copy them
into the manuscript References section.

Automatic reference fix is a repair-bundle workflow, not document rewriting. If
the setting is enabled and the checker finds reference issues, `/api/check`
uses structured rendered-reference extraction, DOI/URL cleanup, Crossref and
DataCite metadata lookup, Citation.js BibTeX/CSL-JSON export, and a confidence
triage policy to produce CEUR-formatted suggestions. Low-confidence suggestions
are still generated but marked for review. The Ukrainian preview localizes the
repair-bundle headings and notes, while Source mode and downloads keep the raw
Markdown bundle unchanged for sharing and auditability.

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

### CLI

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

Include supplemental font evidence lines when investigating non-Libertinus
findings:

```bash
docker compose --env-file .env run --rm --user "$(id -u):$(id -g)" \
  -v "$PWD:/work" ceur-pdf-check \
  ceur-pdf-check /work/paper.pdf \
  --font-evidence \
  --output /work/report.md
```

Reports also include supplemental font validation implemented by
`ceur-font-check`. The helper inspects rendered PDF glyph fonts with pdfminer and
reports unexpected non-Libertinus body or heading text as a single finding by
default. Use `--font-evidence` to include up to five `--> Page ... font ...
renders ...` evidence lines per file; the web UI exposes the same behavior in
Settings as Show DejaVu/font evidence lines.

Reports also include a reference check implemented by `ceur-reference-check`.
The helper extracts each checked PDF's rendered text with Poppler and validates
that the References section follows CEURART-style output: bracketed numbered
entries, sequential labels, publication years, and rendered DOI/URL prefixes
such as `doi:` and `URL:`. Reference errors are included in
`## Reference Check` with a standard reminder to use `doi:` before DOI codes
and `URL:` before other links, and fail the overall report status. For API repair
features, `ceur-pdf-check --reference-json-output references.json` writes the
structured extracted reference section and parsed entries next to the Markdown
report.

### Parallel Requests

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
8-request batches. Run this load test on Chromium only because it exercises the
shared backend checker queue:

```bash
docker run --rm --network host \
  -v "$PWD:/work" \
  -v ceur-pdf-check-node-modules:/work/node_modules \
  -w /work \
  -e PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 \
  mcr.microsoft.com/playwright:v1.60.0-noble \
  npx playwright test tests/concurrent-processing.spec.ts --project=chromium
```

### Local Development

Install dependencies and run the UI locally:

```bash
npm install
npm run dev
```

Run checks:

```bash
bash -n bin/ceur-pdf-check
python3 -m py_compile bin/ceur-font-check bin/ceur-reference-check
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
  mcr.microsoft.com/playwright:v1.60.0-noble \
  ./node_modules/.bin/playwright test tests/logging.spec.ts tests/checker-queue.spec.ts tests/reference-fix.spec.ts tests/checker-process-logging.spec.ts tests/check-route-logging.spec.ts tests/proxy-logging.spec.ts --project=chromium
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
dropzone drag state, Settings modal Reference guidance, prompt download link,
modal size stability, persisted dark theme, persisted automatic reference fix
and font evidence settings/latest analysis, matched theme/language switch
semantics and sizing,
rendered Markdown reports, source-mode Markdown, raw report downloads with
analyzed-file-based filenames, localized References fix preview/source/download
behavior, internal report scrolling, stale response handling, supported
manuscript selection, converted-manuscript regressions, real PDF checks, and
dedicated 2/4/8 concurrent document-processing requests. Focused logging specs
cover structured JSON serialization, route/API log events, queue decisions,
checker subprocess lifecycle, reference-fix fallback paths, and proxy-originated
authentication rejection logs.

The local API route expects `ceur-pdf-check` to be available on `PATH`. The
Docker image provides that automatically.

### CEUR Scripts

The image downloads the CEUR scripts during build:

- `https://ceur-ws.org/ceurtools/check-pdf-errors`
- `https://ceur-ws.org/ceurtools/check-libbyhead.py`

The image also installs LibreOffice Writer for DOCX, DOC, and ODT conversion,
the project-local `ceur-font-check` helper, which uses pdfminer to inspect
rendered font names, and the project-local `ceur-reference-check` helper, which
uses `pdftotext` from Poppler to validate rendered CEURART-style references.
Automatic reference repair metadata lookup contacts Crossref and DataCite from
the Node API route when the user enables the feature.

### Exit Status

The CLI exits with status `0` when manuscript conversion succeeds, the CEUR
checker completes, no likely finding lines are detected, and the reference check
passes. It exits nonzero when conversion fails, when the checker fails, when the
output contains likely errors, warnings, or CEUR remediation lines, or when
reference-format errors are found.

The web UI treats nonzero checker exits as completed validations when a Markdown
report is produced, because CEUR findings are the expected output for invalid
manuscripts.

## Українська

Сервіс із вебінтерфейсом і CLI, запакований у Docker, для перевірки рукописів
CEUR-WS у форматах PDF, DOCX, DOC і ODT. Рукописи DOCX, DOC і ODT спочатку
конвертуються в PDF через LibreOffice, після чого офіційний інструмент
`check-pdf-errors` і перевірка відрендерених посилань у стилі CEURART створюють
Markdown-звіт. Інструмент також додає допоміжне виявлення шрифтів не з родини
Libertinus; докладні рядки доказів приховані за замовчуванням. Якщо ввімкнути
відповідні налаштування, вебдодаток може створити ручний пакет виправлення
CEUR references для рукописів із проблемами в списку літератури та показувати
DejaVu/font evidence lines для знахідок щодо шрифтів.

### Артефакти оцінювання

Артефакти оцінювання для статті ProfIT AI 2026 "CEURCheck: An
Explainable Rule-Based System for Multi-Format CEUR-WS Manuscript Compliance
Validation" опубліковано як набір даних Hugging Face:

- DOI: <https://doi.org/10.57967/hf/9380>
- Набір даних: <https://huggingface.co/datasets/malakhovks/ceurcheck-profitai2026-evaluation-artifacts>

Згенеровані корпуси оцінювання, звіти, журнали, чернетки експорту та рендери
діаграм навмисно не зберігаються в цьому репозиторії. Локальні каталоги
`eval/` вважайте одноразовими згенерованими артефактами та використовуйте DOI
набору даних для цитування й відтворюваності.

### Вебінтерфейс

Налаштуйте параметри розгортання за замовчуванням у `.env`, потім зберіть і
запустіть сервіс через Docker Compose:

```bash
docker compose --env-file .env up --build -d
```

Відкрийте `http://localhost:${APP_PORT}`. Із типовим `.env` це
`http://localhost:3000`.

Зупинити сервіс:

```bash
docker compose --env-file .env down
```

Увійдіть через Google, завантажте або перетягніть PDF, DOCX, DOC чи ODT
рукопис, запустіть перевірку, прочитайте згенерований Markdown-звіт і
завантажте `report_<manuscript-stem>.md`, наприклад `report_paper.md`. Панель
звіту за замовчуванням рендерить Markdown і має перемикач перегляду/джерела
(preview/source). Український preview локалізує заголовки та метадані звіту для
читання, тоді як source mode і завантаження зберігають сирий Markdown, створений
інструментом перевірки. Коли ввімкнено automatic reference fix, та сама
поверхня звіту додає вкладку `Література`/References fix для виявлених проблем
із літературою та завантажує пакет виправлень як `references_fix_<stem>.md`.

У шапці dashboard відображається назва `CEURCheck`; там також є посилання на
репозиторій проєкту, локалізоване посилання для донату MonoBank, локалізований
підпис розробника, локалізоване модальне вікно Settings, збережений перемикач
світлої/темної теми і відповідний компактний перемикач мови `UA`/`EN`. Модальне
вікно Settings стабільного розміру має вкладки App features і Settings: App
features пояснює підтримувані перевірки, Reference mistake repair і процес
роботи з ChatGPT prompt; Settings містить прапорці для automatic reference fix і
DejaVu/font evidence lines. Font evidence приховано за замовчуванням; якщо його
ввімкнути, до звітів додаються рядки `--> Page ... font ... renders ...`, коли є
додаткові знахідки щодо шрифтів. Вибір теми, налаштування automatic reference
fix, налаштування font evidence і стан latest analysis зберігаються у браузері.
Обидва компактні перемикачі у шапці не мають повних видимих підписів, але
зберігають доступні назви. Dashboard локалізує помилки checker/API українською
й англійською, зокрема помилки розбору завантаження, черги, тайм-ауту та
відсутнього звіту. Помилки захищеного API для неавтентифікованих запитів
містять `requestId` для узгодженого відлагодження у proxy та route responses.
API виводить structured JSON logs для отримання або відхилення запитів,
прийнятих завантажень, рішень про слоти черги checker, життєвого циклу
підпроцесу checker, створення звіту або fallback, fallback для metadata
reference-fix і помилок cleanup. Logs містять correlation fields, як-от
`requestId`, filename, queue snapshot, status, exit code і output lengths, не
записуючи raw manuscripts або повний checker output у log stream. Ліміт тіла
завантаження в Next.js proxy налаштовано вище за 30 MB manuscript limit додатка,
тому валідні більші PDF, наприклад `1111.pdf`, доходять до checker замість
помилки під час multipart parsing.

Вебінтерфейс зберігає макет із фіксованою оболонкою, компактною панеллю
керування, збільшеною повноширинною робочою областю звіту та внутрішнім
прокручуванням для довгих звітів і компактних мобільних viewport. Upload
dropzone зберігає активний стан під час вкладеного drag movement і прибирає
highlight після вибору файлу. Notes panel видалено, щоб report залишався
основною робочою областю. Dashboard і `/api/check` потребують автентифікованої
Google session; `/api/health` лишається публічним для Docker health checks.

Модальне вікно Settings посилається на `/ceur_ws_reference_prompt.md`, який
подається з `public/ceur_ws_reference_prompt.md`. Щоб вручну згенерувати
CEUR-WS references, завантажте цей Markdown-файл, додайте його до діалогу
ChatGPT, вставте список URL або DOI в поле повідомлення, перевірте згенеровані
references і скопіюйте їх у References section рукопису.

Automatic reference fix - це процес підготовки пакета виправлень, а не
переписування документа. Якщо налаштування ввімкнено і checker знаходить
reference issues, `/api/check` використовує structured rendered-reference
extraction, DOI/URL cleanup, Crossref and DataCite metadata lookup, експорт
Citation.js BibTeX/CSL-JSON і confidence triage policy, щоб створити пропозиції
у форматі CEUR. Пропозиції з низькою впевненістю теж генеруються, але
позначаються для review. Український preview локалізує headings і notes пакета
виправлень, тоді як Source mode і downloads зберігають raw Markdown bundle без
змін для sharing і auditability.

Налаштуйте Google OAuth у `.env` перед розгортанням:

- `AUTH_SECRET`: секрет із високою ентропією, наприклад з `openssl rand -base64 32`
- `AUTH_GOOGLE_ID`: Google OAuth client ID
- `AUTH_GOOGLE_SECRET`: Google OAuth client secret
- `AUTH_TRUST_HOST=true`: потрібно для containerized deployments
- `AUTH_URL`: видимий для браузера app origin, наприклад `http://localhost:3000` локально або `https://your-domain.com` у production

Зареєструйте `http://localhost:3000/api/auth/callback/google` як локальний
Google OAuth redirect URI та використовуйте відповідний production URL для
розгорнутих hosts. Не використовуйте `0.0.0.0` у Google OAuth redirect URIs; це
лише server bind address, а не валідний browser callback host. Будь-який Google
account із verified email address може користуватися додатком.

Для локального налаштування Google Console використовуйте:

- Authorized JavaScript origin: `http://localhost:3000`
- Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`

Для production встановіть `AUTH_URL` на public HTTPS origin і зареєструйте
відповідний `/api/auth/callback/google` redirect URI.

GitHub badge на dashboard веде на репозиторій проєкту
`https://github.com/malakhovks/ceur-pdf-check-service`; developer credit веде на
`https://linktr.ee/malakhovks`.

### CLI

Образ також залишає доступним інструмент перевірки командного рядка:

```bash
docker compose --env-file .env run --rm ceur-pdf-check ceur-pdf-check --help
```

Щоб вихідні файли належали користувачу хоста, запускайте CLI зі своїм користувачем і змонтованим
робочим каталогом:

```bash
docker compose --env-file .env run --rm --user "$(id -u):$(id -g)" \
  -v "$PWD:/work" ceur-pdf-check \
  ceur-pdf-check /work/Malakhov_et_al_UkrPROG_2026_id_22_revised.pdf \
  --output /work/report.md
```

Вхідні файли DOCX, DOC і ODT приймаються так само та конвертуються перед
запуском PDF checker:

```bash
docker compose --env-file .env run --rm --user "$(id -u):$(id -g)" \
  -v "$PWD:/work" ceur-pdf-check \
  ceur-pdf-check /work/Malakhov_et_al_UkrPROG_2026_id_22_revised.docx \
  --output /work/report.md
```

Перевірити всі підтримувані рукописи у каталозі:

```bash
docker compose --env-file .env run --rm --user "$(id -u):$(id -g)" \
  -v "$PWD:/work" ceur-pdf-check \
  ceur-pdf-check /work --output /work/report.md
```

Запустити підмножину CEUR checks:

```bash
docker compose --env-file .env run --rm --user "$(id -u):$(id -g)" \
  -v "$PWD:/work" ceur-pdf-check \
  ceur-pdf-check /work \
  --tests "readable copyright genai libertinus pagecount" \
  --output /work/report.md
```

Додати supplemental font evidence lines під час дослідження non-Libertinus
findings:

```bash
docker compose --env-file .env run --rm --user "$(id -u):$(id -g)" \
  -v "$PWD:/work" ceur-pdf-check \
  ceur-pdf-check /work/paper.pdf \
  --font-evidence \
  --output /work/report.md
```

Звіти також містять supplemental font validation, реалізовану
`ceur-font-check`. Helper перевіряє rendered PDF glyph fonts через pdfminer і за замовчуванням
повідомляє unexpected non-Libertinus body або heading text як одну знахідку. Використовуйте `--font-evidence`, щоб додати до п'яти рядків evidence
`--> Page ... font ... renders ...` на файл; web UI надає ту саму поведінку в
Settings як Show DejaVu/font evidence lines.

Звіти також містять reference check, реалізовану `ceur-reference-check`. Helper витягує rendered text кожного перевіреного PDF через Poppler і
перевіряє, що References section відповідає CEURART-style output: numbered
entries у квадратних дужках, послідовні labels, publication years і rendered
DOI/URL prefixes, як-от `doi:` та `URL:`. Reference errors додаються до
`## Reference Check` зі стандартним нагадуванням використовувати `doi:` перед
DOI codes і `URL:` перед іншими links, а також призводять до failed overall
report status. Для API repair features `ceur-pdf-check --reference-json-output references.json` записує structured extracted reference section і parsed entries поруч із Markdown report.

### Паралельні запити

Web API обмежує кількість одночасних процесів CEUR checker на контейнер.
Налаштуйте ліміти у `.env`:

- `CEUR_MAX_CONCURRENT_CHECKS`, default `2`
- `CEUR_MAX_QUEUED_CHECKS`, default `8`
- `CEUR_QUEUE_TIMEOUT_MS`, default `15000`

Запити понад active і queued limits повертають `429` із повідомленням про
помилку, придатним для повторної спроби. Ці limits діють на один контейнер;
використовуйте external queueing, якщо кільком replicas потрібен shared global
limit.

Покриття успішного спорожнення черги міститься в
`tests/concurrent-processing.spec.ts`. Запустіть app із test authentication і
довшим queue timeout, наприклад `CEUR_QUEUE_TIMEOUT_MS=600000`, потім виконайте
spec у required Playwright image, щоб подати required ODT, PDF і DOCX
manuscripts у batches на 2, 4 і 8 requests. Запускайте цей load test лише на
Chromium, бо він перевіряє shared backend checker queue:

```bash
docker run --rm --network host \
  -v "$PWD:/work" \
  -v ceur-pdf-check-node-modules:/work/node_modules \
  -w /work \
  -e PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 \
  mcr.microsoft.com/playwright:v1.60.0-noble \
  npx playwright test tests/concurrent-processing.spec.ts --project=chromium
```

### Локальна розробка

Встановіть залежності та запустіть UI локально:

```bash
npm install
npm run dev
```

Запустіть перевірки:

```bash
bash -n bin/ceur-pdf-check
python3 -m py_compile bin/ceur-font-check bin/ceur-reference-check
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
  mcr.microsoft.com/playwright:v1.60.0-noble \
  ./node_modules/.bin/playwright test tests/logging.spec.ts tests/checker-queue.spec.ts tests/reference-fix.spec.ts tests/checker-process-logging.spec.ts tests/check-route-logging.spec.ts tests/proxy-logging.spec.ts --project=chromium
docker run --rm --network host \
  -v "$PWD:/work" \
  -v ceur-pdf-check-node-modules:/work/node_modules \
  -w /work \
  -e PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 \
  mcr.microsoft.com/playwright:v1.60.0-noble npm run test:e2e
docker compose --env-file .env down
```

E2e suite автентифікується через test provider, вимкнений за замовчуванням.
Вмикайте його лише для local або CI verification, встановивши
`AUTH_TEST_MODE=true` і `AUTH_TEST_LOGIN_TOKEN` на app container перед запуском
Playwright. Web tests покривають authentication, protected API errors із
`requestId`, localized server-side error handling, fixed-shell layout, compact
dashboard/report alignment, досяжність compact viewport, стабільний drag state
upload dropzone, Settings modal Reference guidance, prompt download link, modal
size stability, persisted dark theme, persisted automatic reference fix and font
evidence settings/latest analysis, matched theme/language switch semantics and
sizing, rendered Markdown reports, source-mode Markdown, raw report downloads із
filenames на основі analyzed file, localized References fix
preview/source/download behavior, internal report scrolling, stale response
handling, supported manuscript selection, converted-manuscript regressions, real
PDF checks і dedicated 2/4/8 concurrent document-processing requests. Focused
logging specs покривають structured JSON serialization, route/API log events,
queue decisions, checker subprocess lifecycle, reference-fix fallback paths і
proxy-originated authentication rejection logs.

Local API route очікує, що `ceur-pdf-check` доступний у `PATH`. Docker image
надає це автоматично.

### CEUR-скрипти

Образ завантажує CEUR scripts під час build:

- `https://ceur-ws.org/ceurtools/check-pdf-errors`
- `https://ceur-ws.org/ceurtools/check-libbyhead.py`

Образ також встановлює LibreOffice Writer для конвертації DOCX, DOC і ODT,
project-local helper `ceur-font-check`, який використовує pdfminer для перевірки
rendered font names, і project-local helper `ceur-reference-check`, який
використовує `pdftotext` з Poppler для validation rendered CEURART-style
references. Automatic reference repair metadata lookup звертається до Crossref і
DataCite з Node API route, коли user вмикає feature.

### Статус завершення

CLI завершується зі статусом `0`, коли manuscript conversion успішна, CEUR
checker завершується, likely finding lines не виявлено, а reference check
проходить. Він завершується з nonzero, коли conversion fails, checker fails,
output містить likely errors, warnings або CEUR remediation lines, або коли
знайдено reference-format errors.

Web UI сприймає nonzero checker exits як completed validations, якщо Markdown
report створено, бо CEUR findings є очікуваним результатом для invalid
manuscripts.

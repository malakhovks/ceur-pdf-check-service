# CEUR PDF Check

Dockerized web and CLI service for checking CEUR-WS manuscript PDFs with the
official `check-pdf-errors` tool and saving the result as Markdown.

## Web UI

Build the image:

```bash
docker build -t ceur-pdf-check .
```

Run the web UI:

```bash
docker run --rm -p 3000:3000 ceur-pdf-check
```

Open `http://localhost:3000`, upload a PDF, run the check, read the generated
Markdown report, and download `report.md`.

The GitHub badge uses `NEXT_PUBLIC_GITHUB_REPO_URL` at build time. If it is not
provided, the UI shows a placeholder GitHub repo link.

```bash
docker build \
  --build-arg NEXT_PUBLIC_GITHUB_REPO_URL="https://github.com/your-org/ceur-pdf-check" \
  -t ceur-pdf-check .
```

## CLI

The image also keeps the command-line checker available:

```bash
docker run --rm ceur-pdf-check ceur-pdf-check --help
```

For host-owned output files, run the CLI with your user and a mounted workdir:

```bash
docker run --rm --user "$(id -u):$(id -g)" -v "$PWD:/work" ceur-pdf-check \
  ceur-pdf-check /work/Malakhov_et_al_UkrPROG_2026_id_22_revised.pdf \
  --output /work/report.md
```

Check all PDFs in a directory:

```bash
docker run --rm --user "$(id -u):$(id -g)" -v "$PWD:/work" ceur-pdf-check \
  ceur-pdf-check /work --output /work/report.md
```

Run a subset of CEUR checks:

```bash
docker run --rm --user "$(id -u):$(id -g)" -v "$PWD:/work" ceur-pdf-check \
  ceur-pdf-check /work \
  --tests "readable copyright genai libertinus pagecount" \
  --output /work/report.md
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
docker build -t ceur-pdf-check .
docker run --rm -d --name ceur-pdf-check-web -p 3000:3000 ceur-pdf-check
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
docker rm -f ceur-pdf-check-web
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

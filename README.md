# CEUR PDF Check

Dockerized CLI service for checking CEUR-WS manuscript PDFs with the official
`check-pdf-errors` tool and saving the result as Markdown.

## Build

```bash
docker build -t ceur-pdf-check .
```

The image downloads the CEUR scripts during build:

- `https://ceur-ws.org/ceurtools/check-pdf-errors`
- `https://ceur-ws.org/ceurtools/check-libbyhead.py`

## Run

The examples use `--user "$(id -u):$(id -g)"` so generated reports are owned by the host user.

Check one PDF:

```bash
docker run --rm --user "$(id -u):$(id -g)" -v "$PWD:/work" ceur-pdf-check \
  /work/Malakhov_et_al_UkrPROG_2026_id_22_revised.pdf \
  --output /work/report.md
```

Check all PDFs in a directory:

```bash
docker run --rm --user "$(id -u):$(id -g)" -v "$PWD:/work" ceur-pdf-check /work --output /work/report.md
```

Run a subset of CEUR checks:

```bash
docker run --rm --user "$(id -u):$(id -g)" -v "$PWD:/work" ceur-pdf-check \
  /work \
  --tests "readable copyright genai libertinus pagecount" \
  --output /work/report.md
```

The report defaults to `./ceur-pdf-check-report.md` inside the container work
directory when `--output` is not supplied.

## Exit Status

The CLI exits with status `0` when the CEUR checker completes and no likely
finding lines are detected. It exits nonzero when the checker fails or when the
output contains likely errors, warnings, or CEUR remediation lines.

# Repository Guidelines

## Project Structure & Module Organization

This repository packages a Dockerized CLI wrapper for the official CEUR-WS
`check-pdf-errors` checker.

- `Dockerfile` builds the Debian runtime, installs PDF tooling, downloads CEUR
  helper scripts, and sets `ceur-pdf-check` as the entrypoint.
- `bin/ceur-pdf-check` is the Bash CLI. It validates arguments, copies input PDFs
  to a temporary work directory, runs CEUR checks, and writes a Markdown report.
- `README.md` documents build and usage examples.
- `report.md` is a generated sample output. Treat new reports as artifacts unless
  they are intentionally used as fixtures.
- `.dockerignore` excludes PDFs, logs, `report.md`, and default generated
  reports from the Docker build context.

## Build, Test, and Development Commands

```bash
docker build -t ceur-pdf-check .
```

Builds the image and downloads the CEUR checker scripts.

```bash
bash -n bin/ceur-pdf-check
```

Checks the Bash entrypoint syntax.

```bash
docker run --rm --user "$(id -u):$(id -g)" -v "$PWD:/work" ceur-pdf-check \
  /work/Malakhov_et_al_UkrPROG_2026_id_22_revised.pdf --output /work/report.md
```

Runs the sample PDF check and writes a host-owned Markdown report.

## Coding Style & Naming Conventions

Use Bash for the CLI and keep existing idioms such as `[[ ... ]]`, process
substitution, and lowercase parameter expansion. Indent with two spaces. Quote
variable expansions unless word splitting is required. Keep constants and
derived paths in uppercase variables (`WORKDIR`, `RAW_LOG`); use lowercase function names such as `usage` and `error`.

Return `2` for usage or input validation errors. Preserve nonzero exits for
findings or checker failures.

## Testing Guidelines

There is no dedicated test framework in this checkout. For
`bin/ceur-pdf-check` changes, run `bash -n`, rebuild the image, and perform at
least one container run against a single PDF. For directory handling changes,
test a mounted directory with multiple PDFs and optional `index.html` or
`watermark-log.txt` companions.

## Commit & Pull Request Guidelines

This checkout has no Git history, so no repository-specific commit pattern can
be inferred. Use concise, imperative commit subjects such as
`Add report output validation` or `Update CEUR checker image setup`.

Pull requests should describe behavior changes, list verification commands, and
include report snippets when output formatting or finding detection changes.
Link related issues when available. Avoid adding large PDFs or generated reports
unless they are intentional fixtures.

## Security & Configuration Tips

The image downloads executable CEUR scripts during build. Review URL or checksum
changes carefully. Do not bake private manuscripts into the image; mount inputs
at runtime with `-v "$PWD:/work"`.

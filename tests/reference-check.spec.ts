import { chmod, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { expect, test } from "@playwright/test";

const execFileAsync = promisify(execFile);
const checkerPath = path.resolve("bin/ceur-reference-check");

async function writeTextFixture(content: string) {
  const directory = await mkdtemp(path.join(tmpdir(), "ceur-reference-test-"));
  const filePath = path.join(directory, "references.txt");
  await writeFile(filePath, content, "utf8");
  return filePath;
}

async function runReferenceCheck(content: string) {
  const fixturePath = await writeTextFixture(content);

  try {
    const result = await execFileAsync("python3", [checkerPath, "--text-file", fixturePath], {
      cwd: path.resolve("."),
    });
    return { exitCode: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    const failure = error as { code?: number; stdout?: string; stderr?: string };
    return {
      exitCode: failure.code ?? 1,
      stdout: failure.stdout ?? "",
      stderr: failure.stderr ?? "",
    };
  }
}

async function writePassingFakeCheckerBin(directory: string) {
  const fakeBin = path.join(directory, "bin");
  await mkdir(fakeBin);

  const checkPdfErrors = path.join(fakeBin, "check-pdf-errors");
  await writeFile(checkPdfErrors, [
    "#!/usr/bin/env bash",
    "top_level=\"$(find . -maxdepth 1 -type f -name '*.pdf' | wc -l | tr -d ' ')\"",
    "recursive=\"$(find . -type f -name '*.pdf' | wc -l | tr -d ' ')\"",
    'if [[ "$recursive" != "$top_level" ]]; then',
    "  echo 'ERROR (P2) with duplicate PDF files!!!!'",
    "  exit 1",
    "fi",
    "echo 'CEUR checker ok'",
    "",
  ].join("\n"), "utf8");
  await chmod(checkPdfErrors, 0o755);

  const referenceCheck = path.join(fakeBin, "ceur-reference-check");
  await writeFile(referenceCheck, [
    "#!/usr/bin/env bash",
    "echo 'No reference errors were detected.'",
    'for pdf in "$@"; do',
    "  echo",
    '  echo "### $pdf"',
    "  echo '- Status: pass'",
    "  echo '- References detected: 1'",
    "  echo '- No CEURART-style reference errors detected.'",
    "done",
    "",
  ].join("\n"), "utf8");
  await chmod(referenceCheck, 0o755);

  const libreOffice = path.join(fakeBin, "libreoffice");
  await writeFile(libreOffice, [
    "#!/usr/bin/env bash",
    "outdir=''",
    "source=''",
    "while [[ $# -gt 0 ]]; do",
    '  case "$1" in',
    "    --outdir)",
    '      outdir="$2"',
    "      shift 2",
    "      ;;",
    "    --convert-to)",
    "      shift 2",
    "      ;;",
    "    --headless|-env:UserInstallation=*)",
    "      shift",
    "      ;;",
    "    *)",
    '      source="$1"',
    "      shift",
    "      ;;",
    "  esac",
    "done",
    'base="$(basename "$source")"',
    'stem="${base%.*}"',
    "printf '%s\\n' '%PDF-1.4' '% converted fixture' > \"$outdir/$stem.pdf\"",
    "",
  ].join("\n"), "utf8");
  await chmod(libreOffice, 0o755);

  return fakeBin;
}

test("passes CEURART-style numbered references", async () => {
  const result = await runReferenceCheck([
    "A manuscript body.",
    "",
    "References",
    "[1] L. Lamport, LaTeX: A Document Preparation System, Addison-Wesley, Reading, MA., 1986.",
    "[2] P. S. Abril, R. Plant, The patent holder's dilemma: Buy, sell, or troll?, Communications of the ACM 50 (2007) 36-44. doi:10.1145/1188913.1188915.",
    "[3] H. Thornburg, Introduction to bayesian statistics, 2001. URL: http://ccrma.stanford.edu/~jos/bayes/bayes.html.",
  ].join("\n"));

  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain("No reference errors were detected.");
  expect(result.stdout).toContain("- Status: pass");
  expect(result.stdout).toContain("- References detected: 3");
});

test("fails when the reference section is missing", async () => {
  const result = await runReferenceCheck("A manuscript body without a bibliography.");

  expect(result.exitCode).toBe(1);
  expect(result.stdout).toContain("- ERROR: Reference section was not found.");
});

test("fails unnumbered or APA-style references", async () => {
  const result = await runReferenceCheck([
    "References",
    "Lamport, L. (1986). LaTeX: A Document Preparation System. Addison-Wesley.",
  ].join("\n"));

  expect(result.exitCode).toBe(1);
  expect(result.stdout).toContain("Reference section does not contain numbered reference entries.");
});

test("fails non-sequential labels", async () => {
  const result = await runReferenceCheck([
    "References",
    "[1] L. Lamport, LaTeX: A Document Preparation System, Addison-Wesley, Reading, MA., 1986.",
    "[3] P. S. Abril, R. Plant, The patent holder's dilemma: Buy, sell, or troll?, Communications of the ACM 50 (2007) 36-44. doi:10.1145/1188913.1188915.",
  ].join("\n"));

  expect(result.exitCode).toBe(1);
  expect(result.stdout).toContain("Reference labels must be sequential from [1]; found [1], [3].");
});

test("fails raw BibTeX or LaTeX artifacts", async () => {
  const result = await runReferenceCheck([
    "References",
    String.raw`\bibitem{Lamport:LaTeX} L. Lamport, LaTeX: A Document Preparation System, Addison-Wesley, Reading, MA., 1986.`,
  ].join("\n"));

  expect(result.exitCode).toBe(1);
  expect(result.stdout).toContain("Reference section contains raw LaTeX or BibTeX markup.");
});

test("fails DOI and URL values without CEURART prefixes", async () => {
  const result = await runReferenceCheck([
    "References",
    "[1] P. S. Abril, R. Plant, The patent holder's dilemma: Buy, sell, or troll?, Communications of the ACM 50 (2007) 36-44. https://doi.org/10.1145/1188913.1188915.",
    "[2] H. Thornburg, Introduction to bayesian statistics, 2001. http://ccrma.stanford.edu/~jos/bayes/bayes.html.",
  ].join("\n"));

  expect(result.exitCode).toBe(1);
  expect(result.stdout).toContain("DOI values must be rendered with the CEURART prefix");
  expect(result.stdout).toContain("URLs must be rendered with the CEURART prefix");
});

test("converts supported single-file manuscript formats before building reports", async () => {
  for (const extension of ["docx", "doc", "odt"]) {
    const directory = await mkdtemp(path.join(tmpdir(), `ceur-${extension}-test-`));
    const fakeBin = await writePassingFakeCheckerBin(directory);
    const manuscriptPath = path.join(directory, `paper.${extension}`);
    const reportPath = path.join(directory, "report.md");
    await writeFile(manuscriptPath, "manuscript fixture", "utf8");

    await execFileAsync("bash", [path.resolve("bin/ceur-pdf-check"), manuscriptPath, "--output", reportPath], {
      env: { ...process.env, PATH: `${fakeBin}:${process.env.PATH || ""}` },
      cwd: path.resolve("."),
    });

    const report = await readFile(reportPath, "utf8");
    expect(report).toContain("| Status | pass |");
    expect(report).toContain("| Manuscript count | 1 |");
    expect(report).toContain("| PDF count | 1 |");
    expect(report).toContain("## Input Manuscripts");
    expect(report).toContain(`- paper.${extension}`);
    expect(report).toContain("## Checked PDFs");
    expect(report).toContain("- paper.pdf");
    expect(report).toContain("## Reference Check");
    expect(report).not.toContain("ERROR (P2) with duplicate PDF files!!!!");
  }
});

test("checks directory manuscripts and avoids duplicate generated PDF names", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "ceur-directory-test-"));
  const fakeBin = await writePassingFakeCheckerBin(directory);
  const reportPath = path.join(directory, "report.md");
  await writeFile(path.join(directory, "paper.docx"), "manuscript fixture", "utf8");
  await writeFile(path.join(directory, "paper.pdf"), Buffer.from("%PDF-1.4\n% fake fixture\n"));
  await writeFile(path.join(directory, "notes.txt"), "ignored", "utf8");

  await execFileAsync("bash", [path.resolve("bin/ceur-pdf-check"), directory, "--output", reportPath], {
    env: { ...process.env, PATH: `${fakeBin}:${process.env.PATH || ""}` },
    cwd: path.resolve("."),
  });

  const report = await readFile(reportPath, "utf8");
  expect(report).toContain("| Status | pass |");
  expect(report).toContain("| Manuscript count | 2 |");
  expect(report).toContain("| PDF count | 2 |");
  expect(report).toContain("- paper.docx");
  expect(report).toContain("- paper.pdf");
  expect(report).toContain("- paper_2.pdf");
  expect(report).not.toContain("notes.txt");
  expect(report).not.toContain("ERROR (P2) with duplicate PDF files!!!!");
});

test("fails with a validation error when manuscript conversion fails", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "ceur-conversion-fail-test-"));
  const fakeBin = await writePassingFakeCheckerBin(directory);
  const libreOffice = path.join(fakeBin, "libreoffice");
  await writeFile(libreOffice, "#!/usr/bin/env bash\necho 'conversion failed' >&2\nexit 1\n", "utf8");
  await chmod(libreOffice, 0o755);

  const manuscriptPath = path.join(directory, "paper.docx");
  const reportPath = path.join(directory, "report.md");
  await writeFile(manuscriptPath, "manuscript fixture", "utf8");

  try {
    await execFileAsync("bash", [path.resolve("bin/ceur-pdf-check"), manuscriptPath, "--output", reportPath], {
      env: { ...process.env, PATH: `${fakeBin}:${process.env.PATH || ""}` },
      cwd: path.resolve("."),
    });
    throw new Error("Expected ceur-pdf-check to fail when conversion fails.");
  } catch (error) {
    const failure = error as { code?: number; stderr?: string };
    expect(failure.code).toBe(2);
    expect(failure.stderr).toContain("cannot convert manuscript to PDF");
  }
});

test("adds reference check failures to the Markdown report", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "ceur-report-test-"));
  const fakeBin = path.join(directory, "bin");
  await mkdir(fakeBin);

  const checkPdfErrors = path.join(fakeBin, "check-pdf-errors");
  await writeFile(checkPdfErrors, "#!/usr/bin/env bash\necho 'CEUR checker ok'\n", "utf8");
  await chmod(checkPdfErrors, 0o755);

  const referenceCheck = path.join(fakeBin, "ceur-reference-check");
  await writeFile(referenceCheck, [
    "#!/usr/bin/env bash",
    "cat <<'EOF'",
    "1 reference error(s) detected.",
    "",
    "### paper.pdf",
    "- Status: fail",
    "- References detected: 0",
    "- ERROR: Reference section was not found.",
    "EOF",
    "exit 1",
    "",
  ].join("\n"), "utf8");
  await chmod(referenceCheck, 0o755);

  const pdfPath = path.join(directory, "paper.pdf");
  const reportPath = path.join(directory, "report.md");
  await writeFile(pdfPath, Buffer.from("%PDF-1.4\n% fake fixture\n"));

  try {
    await execFileAsync("bash", [path.resolve("bin/ceur-pdf-check"), pdfPath, "--output", reportPath], {
      env: { ...process.env, PATH: `${fakeBin}:${process.env.PATH || ""}` },
      cwd: path.resolve("."),
    });
    throw new Error("Expected ceur-pdf-check to fail when references fail.");
  } catch (error) {
    const failure = error as { code?: number };
    expect(failure.code).toBe(1);
  }

  const report = await readFile(reportPath, "utf8");
  expect(report).toContain("| Status | fail |");
  expect(report).toContain("| Reference status | fail |");
  expect(report).toContain("| Reference errors | 1 |");
  expect(report).toContain("## Reference Check");
  expect(report).toContain("- ERROR: Reference section was not found.");
});

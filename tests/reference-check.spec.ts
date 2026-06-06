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

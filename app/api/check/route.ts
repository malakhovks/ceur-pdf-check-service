import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_UPLOAD_BYTES = 30 * 1024 * 1024;
const CHECKER_TIMEOUT_MS = 110_000;
const MAX_PROCESS_OUTPUT_CHARS = 1_000_000;

type CheckResult = {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
};

function sanitizeFilename(name: string) {
  const basename = name.split(/[/\\]/).pop() || "manuscript.pdf";
  const normalized = basename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const withoutExtension = normalized.toLowerCase().endsWith(".pdf") ? normalized.slice(0, -4) : normalized;
  const stem = withoutExtension.replace(/^\.+$/, "") || "manuscript";
  return `${stem.slice(0, 120)}.pdf`;
}

function looksLikePdf(bytes: Buffer) {
  return bytes.subarray(0, 5).toString("latin1") === "%PDF-";
}

function appendProcessOutput(current: string, chunk: Buffer) {
  if (current.length >= MAX_PROCESS_OUTPUT_CHARS) {
    return current;
  }

  const next = current + chunk.toString();
  if (next.length <= MAX_PROCESS_OUTPUT_CHARS) {
    return next;
  }

  return `${next.slice(0, MAX_PROCESS_OUTPUT_CHARS)}\n[output truncated]\n`;
}

function checkerErrorStatus(error: unknown) {
  if (error instanceof Error && error.name === "CheckerTimeoutError") {
    return 504;
  }

  return 500;
}

function checkerErrorMessage(error: unknown) {
  const code = error && typeof error === "object" && "code" in error
    ? String((error as { code?: unknown }).code)
    : "";

  if (code === "ENOENT") {
    return "The ceur-pdf-check executable is not available on PATH.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unexpected checker failure.";
}

function runChecker(inputPath: string, outputPath: string): Promise<CheckResult> {
  return new Promise((resolve, reject) => {
    const child = spawn("ceur-pdf-check", [inputPath, "--output", outputPath], {
      env: process.env,
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const timeout = setTimeout(() => {
      settled = true;
      child.kill("SIGTERM");

      const error = new Error(`The checker timed out after ${CHECKER_TIMEOUT_MS / 1000} seconds.`);
      error.name = "CheckerTimeoutError";
      reject(error);
    }, CHECKER_TIMEOUT_MS);

    const finish = (callback: () => void) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      callback();
    };

    child.stdout.on("data", (chunk: Buffer) => {
      stdout = appendProcessOutput(stdout, chunk);
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr = appendProcessOutput(stderr, chunk);
    });

    child.on("error", (error) => {
      finish(() => reject(error));
    });

    child.on("close", (exitCode, signal) => {
      finish(() => resolve({ exitCode, signal, stdout, stderr }));
    });
  });
}

function readFindingCount(report: string) {
  const match = report.match(/\| Finding lines \| (\d+) \|/);
  return match ? Number(match[1]) : null;
}

function readStatus(report: string) {
  const match = report.match(/\| Status \| ([^|]+) \|/);
  return match ? match[1].trim() : "unknown";
}

export async function POST(request: NextRequest) {
  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "The upload could not be parsed." }, { status: 400 });
  }

  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Upload a PDF file to run the check." }, { status: 400 });
  }

  if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
    return NextResponse.json({ error: "Only PDF files are supported." }, { status: 400 });
  }

  if (file.size <= 0) {
    return NextResponse.json({ error: "The uploaded PDF is empty." }, { status: 400 });
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "PDF uploads are limited to 30 MB." }, { status: 413 });
  }

  const workDir = path.join(tmpdir(), `ceur-web-${randomUUID()}`);
  await mkdir(workDir, { recursive: true });

  const filename = sanitizeFilename(file.name || "manuscript.pdf");
  const inputPath = path.join(workDir, filename);
  const outputPath = path.join(workDir, "report.md");

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    if (!looksLikePdf(bytes)) {
      return NextResponse.json({ error: "The uploaded file does not look like a PDF." }, { status: 400 });
    }

    await writeFile(inputPath, bytes);

    const result = await runChecker(inputPath, outputPath);

    try {
      const report = await readFile(outputPath, "utf8");
      return NextResponse.json({
        filename,
        status: readStatus(report),
        findingCount: readFindingCount(report),
        exitCode: result.exitCode,
        report,
      });
    } catch {
      const report = [
        "# CEUR PDF Check Report",
        "",
        "The checker did not produce a Markdown report.",
        "",
        "## Process Output",
        "",
        "```text",
        result.stdout,
        result.stderr,
        "```",
      ].join("\n");

      return NextResponse.json({
        error: "The checker finished without producing a Markdown report.",
        filename,
        status: "unknown",
        findingCount: null,
        exitCode: result.exitCode,
        signal: result.signal,
        report,
      }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json({ error: checkerErrorMessage(error) }, { status: checkerErrorStatus(error) });
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

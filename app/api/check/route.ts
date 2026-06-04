import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { NextRequest, NextResponse } from "next/server";
import {
  getCheckerQueueSnapshot,
  isCheckerQueueFull,
  isQueueOverloadError,
  runWithCheckerSlot,
  type CheckerQueueLease,
} from "./checker-queue";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_UPLOAD_BYTES = 30 * 1024 * 1024;
const MAX_REQUEST_BYTES = MAX_UPLOAD_BYTES + 1024 * 1024;
const CHECKER_TIMEOUT_MS = 110_000;
const CHECKER_KILL_GRACE_MS = 5_000;
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
  if (isQueueOverloadError(error)) {
    return error.status;
  }

  if (error instanceof Error && error.name === "CheckerTimeoutError") {
    return 504;
  }

  return 500;
}

function checkerErrorMessage(error: unknown) {
  if (isQueueOverloadError(error)) {
    return error.message;
  }

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

function contentLengthTooLarge(request: NextRequest) {
  const value = request.headers.get("content-length");
  if (!value) {
    return false;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > MAX_REQUEST_BYTES;
}

function killCheckerProcess(child: ReturnType<typeof spawn>, signal: NodeJS.Signals) {
  if (!child.pid) {
    return;
  }

  if (process.platform !== "win32") {
    try {
      process.kill(-child.pid, signal);
      return;
    } catch {
      // Fall back to the direct child if the process group is already gone.
    }
  }

  child.kill(signal);
}

function runChecker(inputPath: string, outputPath: string): Promise<CheckResult> {
  return new Promise((resolve, reject) => {
    const child = spawn("ceur-pdf-check", [inputPath, "--output", outputPath], {
      detached: process.platform !== "win32",
      env: process.env,
    });

    let stdout = "";
    let stderr = "";
    let settled = false;
    let forceKillTimer: NodeJS.Timeout | null = null;

    const timeout = setTimeout(() => {
      const error = new Error(`The checker timed out after ${CHECKER_TIMEOUT_MS / 1000} seconds.`);
      error.name = "CheckerTimeoutError";

      killCheckerProcess(child, "SIGTERM");
      forceKillTimer = setTimeout(() => {
        killCheckerProcess(child, "SIGKILL");
      }, CHECKER_KILL_GRACE_MS);

      finish(() => reject(error), { keepForceKillTimer: true });
    }, CHECKER_TIMEOUT_MS);

    const finish = (callback: () => void, options?: { keepForceKillTimer?: boolean }) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      if (!options?.keepForceKillTimer && forceKillTimer) {
        clearTimeout(forceKillTimer);
      }
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
      if (settled) {
        if (forceKillTimer) {
          clearTimeout(forceKillTimer);
        }
        return;
      }

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

function overloadResponse(requestId: string, message: string) {
  return NextResponse.json({
    requestId,
    status: "error",
    error: message,
    queue: getCheckerQueueSnapshot(),
  }, { status: 429 });
}

export async function POST(request: NextRequest) {
  const requestId = randomUUID();

  if (contentLengthTooLarge(request)) {
    return NextResponse.json({ requestId, status: "error", error: "PDF uploads are limited to 30 MB." }, { status: 413 });
  }

  if (isCheckerQueueFull()) {
    return overloadResponse(requestId, "The checker is busy. Try again shortly.");
  }

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ requestId, status: "error", error: "The upload could not be parsed." }, { status: 400 });
  }

  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ requestId, status: "error", error: "Upload a PDF file to run the check." }, { status: 400 });
  }

  if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
    return NextResponse.json({ requestId, status: "error", error: "Only PDF files are supported." }, { status: 400 });
  }

  if (file.size <= 0) {
    return NextResponse.json({ requestId, status: "error", error: "The uploaded PDF is empty." }, { status: 400 });
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ requestId, status: "error", error: "PDF uploads are limited to 30 MB." }, { status: 413 });
  }

  const workDir = path.join(tmpdir(), `ceur-web-${requestId}`);
  const filename = sanitizeFilename(file.name || "manuscript.pdf");
  const inputPath = path.join(workDir, filename);
  const outputPath = path.join(workDir, "report.md");

  try {
    await mkdir(workDir, { recursive: true });

    const bytes = Buffer.from(await file.arrayBuffer());
    if (!looksLikePdf(bytes)) {
      return NextResponse.json({ requestId, status: "error", error: "The uploaded file does not look like a PDF." }, { status: 400 });
    }

    await writeFile(inputPath, bytes);

    const { result, lease } = await runWithCheckerSlot(requestId, async (lease: CheckerQueueLease) => ({
      lease,
      result: await runChecker(inputPath, outputPath),
    }));

    try {
      const report = await readFile(outputPath, "utf8");
      return NextResponse.json({
        requestId,
        filename,
        status: readStatus(report),
        findingCount: readFindingCount(report),
        exitCode: result.exitCode,
        queuedMs: lease.queuedMs,
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
        requestId,
        error: "The checker finished without producing a Markdown report.",
        filename,
        status: "unknown",
        findingCount: null,
        exitCode: result.exitCode,
        signal: result.signal,
        queuedMs: lease.queuedMs,
        report,
      }, { status: 500 });
    }
  } catch (error) {
    if (isQueueOverloadError(error)) {
      return overloadResponse(requestId, checkerErrorMessage(error));
    }

    return NextResponse.json({ requestId, status: "error", error: checkerErrorMessage(error) }, { status: checkerErrorStatus(error) });
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

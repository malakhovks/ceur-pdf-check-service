import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { NextRequest, NextResponse } from "next/server";
import { buildReferenceFix, type ReferenceCheckJson } from "./reference-fix";
import {
  getCheckerQueueSnapshot,
  isCheckerQueueFull,
  isQueueOverloadError,
  runWithCheckerSlot,
  type CheckerQueueLease,
} from "./checker-queue";
import { errorLogFields, logger as defaultLogger, type AppLogger, type LogFields } from "../../logging";

const MAX_UPLOAD_BYTES = 30 * 1024 * 1024;
const MAX_REQUEST_BYTES = MAX_UPLOAD_BYTES + 1024 * 1024;
const CHECKER_TIMEOUT_MS = 110_000;
const CHECKER_KILL_GRACE_MS = 5_000;
const MAX_PROCESS_OUTPUT_CHARS = 1_000_000;
const SUPPORTED_FORMAT_LABEL = "PDF, DOCX, DOC, or ODT";

const SUPPORTED_FORMATS = [
  { extension: ".pdf", mimeTypes: ["application/pdf"] },
  { extension: ".docx", mimeTypes: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"] },
  { extension: ".doc", mimeTypes: ["application/msword"] },
  { extension: ".odt", mimeTypes: ["application/vnd.oasis.opendocument.text"] },
] as const;

type SupportedFormat = (typeof SUPPORTED_FORMATS)[number];
type SupportedExtension = SupportedFormat["extension"];

type CheckResult = {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
};

export type RunCheckerOptions = {
  referenceJsonPath?: string;
  fontEvidence?: boolean;
  requestId?: string;
  filename?: string;
  logger?: AppLogger;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  killGraceMs?: number;
};

type RunChecker = (inputPath: string, outputPath: string, options?: RunCheckerOptions) => Promise<CheckResult>;
type CheckSession = { user?: unknown } | null | undefined;
type RunWithCheckerSlot = <T>(requestId: string, task: (lease: CheckerQueueLease) => Promise<T>) => Promise<T>;

export type CheckRouteDependencies = {
  auth: () => Promise<CheckSession>;
  createRequestId: () => string;
  getTempDir: () => string;
  mkdir: typeof mkdir;
  readFile: typeof readFile;
  writeFile: typeof writeFile;
  removeWorkDir: typeof rm;
  isCheckerQueueFull: () => boolean;
  getCheckerQueueSnapshot: typeof getCheckerQueueSnapshot;
  runWithCheckerSlot: RunWithCheckerSlot;
  runChecker: RunChecker;
  buildReferenceFix: typeof buildReferenceFix;
  logger: AppLogger;
};

const formatByExtension = new Map<string, SupportedFormat>(SUPPORTED_FORMATS.map((format) => [format.extension, format]));
const formatByMimeType = new Map<string, SupportedFormat>(SUPPORTED_FORMATS.flatMap((format) => format.mimeTypes.map((mimeType) => [mimeType, format] as const)));

function supportedExtensionFromName(name: string): SupportedExtension | null {
  const lowerName = name.toLowerCase();
  return SUPPORTED_FORMATS.find((format) => lowerName.endsWith(format.extension))?.extension ?? null;
}

function formatForUpload(file: File): SupportedFormat | null {
  const extension = supportedExtensionFromName(file.name);
  if (extension) {
    return formatByExtension.get(extension) ?? null;
  }

  const mimeType = file.type.toLowerCase();
  return formatByMimeType.get(mimeType) ?? null;
}

function sanitizeFilename(name: string, fallbackExtension: SupportedExtension) {
  const basename = name.split(/[/\\]/).pop() || `manuscript${fallbackExtension}`;
  const normalized = basename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const extension = supportedExtensionFromName(normalized) ?? fallbackExtension;
  const withoutExtension = normalized.toLowerCase().endsWith(extension) ? normalized.slice(0, -extension.length) : normalized;
  const stem = withoutExtension.replace(/^\.+$/, "") || "manuscript";
  return `${stem.slice(0, 120)}${extension}`;
}

function startsWithBytes(bytes: Buffer, signature: readonly number[]) {
  if (bytes.length < signature.length) {
    return false;
  }

  return signature.every((value, index) => bytes[index] === value);
}

function looksLikePdf(bytes: Buffer) {
  return bytes.subarray(0, 5).toString("latin1") === "%PDF-";
}

function looksLikeZip(bytes: Buffer) {
  return startsWithBytes(bytes, [0x50, 0x4b, 0x03, 0x04])
    || startsWithBytes(bytes, [0x50, 0x4b, 0x05, 0x06])
    || startsWithBytes(bytes, [0x50, 0x4b, 0x07, 0x08]);
}

function looksLikeDoc(bytes: Buffer) {
  return startsWithBytes(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
}

function containsLatin1(bytes: Buffer, value: string) {
  return bytes.includes(Buffer.from(value, "latin1"));
}

function looksLikeSupportedManuscript(bytes: Buffer, format: SupportedFormat) {
  switch (format.extension) {
    case ".pdf":
      return looksLikePdf(bytes);
    case ".docx":
      return looksLikeZip(bytes) && containsLatin1(bytes, "word/");
    case ".doc":
      return looksLikeDoc(bytes);
    case ".odt":
      return looksLikeZip(bytes) && containsLatin1(bytes, "application/vnd.oasis.opendocument.text");
    default:
      return false;
  }
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

function contentLengthLogValue(request: NextRequest) {
  const value = request.headers.get("content-length");
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : value;
}

function uploadLogFields(file: File, format?: SupportedFormat | null): LogFields {
  return {
    uploadExtension: supportedExtensionFromName(file.name) || undefined,
    mimeType: file.type || undefined,
    fileSizeBytes: file.size,
    format: format?.extension,
  };
}

function processLogFields(options?: RunCheckerOptions): LogFields {
  return {
    requestId: options?.requestId,
    filename: options?.filename,
    referenceJsonRequested: Boolean(options?.referenceJsonPath),
    fontEvidence: Boolean(options?.fontEvidence),
  };
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

export function runChecker(inputPath: string, outputPath: string, options?: RunCheckerOptions): Promise<CheckResult> {
  const logFields = processLogFields(options);
  const checkerLogger = options?.logger || defaultLogger;
  const timeoutMs = options?.timeoutMs ?? CHECKER_TIMEOUT_MS;
  const killGraceMs = options?.killGraceMs ?? CHECKER_KILL_GRACE_MS;

  return new Promise((resolve, reject) => {
    const args = [inputPath, "--output", outputPath];
    if (options?.referenceJsonPath) {
      args.push("--reference-json-output", options.referenceJsonPath);
    }
    if (options?.fontEvidence) {
      args.push("--font-evidence");
    }

    checkerLogger.info("checker.process.started", logFields);

    const child = spawn("ceur-pdf-check", args, {
      detached: process.platform !== "win32",
      env: options?.env || process.env,
    });

    let stdout = "";
    let stderr = "";
    let settled = false;
    let forceKillTimer: NodeJS.Timeout | null = null;

    const timeout = setTimeout(() => {
      const error = new Error(`The checker timed out after ${timeoutMs / 1000} seconds.`);
      error.name = "CheckerTimeoutError";

      checkerLogger.warn("checker.process.timeout", {
        ...logFields,
        timeoutMs,
        killGraceMs,
      });
      killCheckerProcess(child, "SIGTERM");
      forceKillTimer = setTimeout(() => {
        checkerLogger.error("checker.process.force_killed", logFields);
        killCheckerProcess(child, "SIGKILL");
      }, killGraceMs);

      finish(() => reject(error), { keepForceKillTimer: true });
    }, timeoutMs);

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
      checkerLogger.error("checker.process.error", {
        ...logFields,
        ...errorLogFields(error),
      });
      finish(() => reject(error));
    });

    child.on("close", (exitCode, signal) => {
      if (settled) {
        if (forceKillTimer) {
          clearTimeout(forceKillTimer);
        }
        return;
      }

      const completionFields = {
        ...logFields,
        exitCode,
        signal,
        stdoutChars: stdout.length,
        stderrChars: stderr.length,
        stdoutTruncated: stdout.includes("[output truncated]"),
        stderrTruncated: stderr.includes("[output truncated]"),
      };
      const completionLevel = exitCode === 0 && !signal ? "info" : "warn";
      checkerLogger[completionLevel]("checker.process.completed", completionFields);
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

function readReferenceStatus(report: string) {
  const match = report.match(/\| Reference status \| ([^|]+) \|/);
  return match ? match[1].trim() : "unknown";
}

function logCheckRejection(
  dependencies: Pick<CheckRouteDependencies, "logger">,
  requestId: string,
  reason: string,
  status: number,
  fields: LogFields = {},
) {
  dependencies.logger.warn("check.request.rejected", {
    requestId,
    reason,
    status,
    ...fields,
  });
}

function overloadResponse(
  requestId: string,
  message: string,
  dependencies: Pick<CheckRouteDependencies, "getCheckerQueueSnapshot" | "logger">,
  reason = "queue_full",
) {
  const queue = dependencies.getCheckerQueueSnapshot();
  logCheckRejection(dependencies, requestId, reason, 429, { queue });
  return NextResponse.json({
    requestId,
    status: "error",
    error: message,
    queue,
  }, { status: 429 });
}

export const defaultCheckRouteDependencies: CheckRouteDependencies = {
  auth: async () => null,
  createRequestId: randomUUID,
  getTempDir: tmpdir,
  mkdir,
  readFile,
  writeFile,
  removeWorkDir: rm,
  isCheckerQueueFull,
  getCheckerQueueSnapshot,
  runWithCheckerSlot,
  runChecker,
  buildReferenceFix,
  logger: defaultLogger,
};

export async function handleCheckPost(request: NextRequest, dependencies: Partial<CheckRouteDependencies> = {}) {
  const deps: CheckRouteDependencies = { ...defaultCheckRouteDependencies, ...dependencies };
  const requestId = deps.createRequestId();

  deps.logger.info("check.request.received", {
    requestId,
    contentLengthBytes: contentLengthLogValue(request),
  });

  const session = await deps.auth();

  if (!session?.user) {
    logCheckRejection(deps, requestId, "authentication_required", 401);
    return NextResponse.json({ requestId, status: "error", error: "Authentication required." }, { status: 401 });
  }

  if (contentLengthTooLarge(request)) {
    logCheckRejection(deps, requestId, "request_too_large", 413, {
      contentLengthBytes: contentLengthLogValue(request),
      maxRequestBytes: MAX_REQUEST_BYTES,
    });
    return NextResponse.json({ requestId, status: "error", error: "Manuscript uploads are limited to 30 MB." }, { status: 413 });
  }

  if (deps.isCheckerQueueFull()) {
    return overloadResponse(requestId, "The checker is busy. Try again shortly.", deps);
  }

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch (error) {
    logCheckRejection(deps, requestId, "form_parse_failed", 400, errorLogFields(error));
    return NextResponse.json({ requestId, status: "error", error: "The upload could not be parsed." }, { status: 400 });
  }

  const file = formData.get("file");
  const referenceFixRequested = formData.get("referenceFix") === "1";
  const fontEvidenceRequested = formData.get("fontEvidence") === "1";

  if (!(file instanceof File)) {
    logCheckRejection(deps, requestId, "missing_file", 400);
    return NextResponse.json({ requestId, status: "error", error: `Upload a ${SUPPORTED_FORMAT_LABEL} file to run the check.` }, { status: 400 });
  }

  const format = formatForUpload(file);

  if (!format) {
    logCheckRejection(deps, requestId, "unsupported_format", 400, uploadLogFields(file));
    return NextResponse.json({ requestId, status: "error", error: `Only ${SUPPORTED_FORMAT_LABEL} files can be checked.` }, { status: 400 });
  }

  if (file.size <= 0) {
    logCheckRejection(deps, requestId, "empty_file", 400, uploadLogFields(file, format));
    return NextResponse.json({ requestId, status: "error", error: "The uploaded manuscript is empty." }, { status: 400 });
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    logCheckRejection(deps, requestId, "file_too_large", 413, {
      ...uploadLogFields(file, format),
      maxUploadBytes: MAX_UPLOAD_BYTES,
    });
    return NextResponse.json({ requestId, status: "error", error: "Manuscript uploads are limited to 30 MB." }, { status: 413 });
  }

  const workDir = path.join(deps.getTempDir(), `ceur-web-${requestId}`);
  const filename = sanitizeFilename(file.name || `manuscript${format.extension}`, format.extension);
  const inputPath = path.join(workDir, filename);
  const outputPath = path.join(workDir, "report.md");
  const referenceJsonPath = path.join(workDir, "references.json");

  try {
    await deps.mkdir(workDir, { recursive: true });

    const bytes = Buffer.from(await file.arrayBuffer());
    if (!looksLikeSupportedManuscript(bytes, format)) {
      logCheckRejection(deps, requestId, "invalid_signature", 400, uploadLogFields(file, format));
      return NextResponse.json({ requestId, status: "error", error: "The uploaded file does not look like a supported manuscript." }, { status: 400 });
    }

    await deps.writeFile(inputPath, bytes);
    deps.logger.info("check.request.accepted", {
      requestId,
      filename,
      format: format.extension,
      fileSizeBytes: file.size,
      referenceFixRequested,
      fontEvidenceRequested,
    });

    const { result, lease } = await deps.runWithCheckerSlot(requestId, async (lease: CheckerQueueLease) => ({
      lease,
      result: await deps.runChecker(inputPath, outputPath, {
        requestId,
        filename,
        referenceJsonPath: referenceFixRequested ? referenceJsonPath : undefined,
        fontEvidence: fontEvidenceRequested,
        logger: deps.logger,
      }),
    }));

    try {
      const report = await deps.readFile(outputPath, "utf8");
      const status = readStatus(report);
      const referenceStatus = readReferenceStatus(report);
      const findingCount = readFindingCount(report);
      let referenceFix;

      if (referenceFixRequested && referenceStatus === "fail") {
        deps.logger.info("reference_fix.requested", { requestId, filename, referenceStatus });
        try {
          const referenceData = JSON.parse(await deps.readFile(referenceJsonPath, "utf8")) as ReferenceCheckJson;
          referenceFix = await deps.buildReferenceFix(referenceData, { filename, logger: deps.logger, requestId });
          deps.logger.info("reference_fix.route_completed", {
            requestId,
            filename,
            status: referenceFix.status,
          });
        } catch (error) {
          deps.logger.warn("reference_fix.unavailable", {
            requestId,
            filename,
            reason: "structured_data_unavailable",
            ...errorLogFields(error),
          });
          referenceFix = {
            status: "unavailable",
            warning: "Structured reference data was not available for repair generation.",
          };
        }
      } else if (referenceFixRequested) {
        deps.logger.info("reference_fix.skipped", {
          requestId,
          filename,
          reason: "reference_status_not_failed",
          referenceStatus,
        });
        referenceFix = {
          status: "skipped",
          warning: "No reference issues were detected.",
        };
      }

      deps.logger.info("check.report.produced", {
        requestId,
        filename,
        status,
        referenceStatus,
        findingCount,
        exitCode: result.exitCode,
        queuedMs: lease.queuedMs,
      });

      return NextResponse.json({
        requestId,
        filename,
        status,
        referenceStatus,
        findingCount,
        exitCode: result.exitCode,
        queuedMs: lease.queuedMs,
        report,
        referenceFix,
      });
    } catch (error) {
      deps.logger.error("check.report.missing", {
        requestId,
        filename,
        exitCode: result.exitCode,
        signal: result.signal,
        queuedMs: lease.queuedMs,
        stdoutChars: result.stdout.length,
        stderrChars: result.stderr.length,
        ...errorLogFields(error),
      });
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
      return overloadResponse(requestId, checkerErrorMessage(error), deps, "queue_overload");
    }

    const status = checkerErrorStatus(error);
    deps.logger.error("check.request.failed", {
      requestId,
      status,
      error: checkerErrorMessage(error),
      ...errorLogFields(error),
    });
    return NextResponse.json({ requestId, status: "error", error: checkerErrorMessage(error) }, { status });
  } finally {
    try {
      await deps.removeWorkDir(workDir, { recursive: true, force: true });
    } catch (error) {
      deps.logger.warn("check.workdir.cleanup_failed", {
        requestId,
        ...errorLogFields(error),
      });
    }
  }
}


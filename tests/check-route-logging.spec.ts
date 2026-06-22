import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { expect, test } from "@playwright/test";
import { NextRequest } from "next/server";
import { QueueOverloadError } from "../app/api/check/checker-queue";
import { handleCheckPost, type CheckRouteDependencies } from "../app/api/check/handler";
import { createMemoryLogger, findLog, type CapturedLog } from "./logging-test-utils";

function sampleReport(status = "pass", referenceStatus = "pass", findingCount = 0) {
  return [
    "# CEUR PDF Check Report",
    "",
    "| Field | Value |",
    "| --- | --- |",
    `| Status | ${status} |`,
    `| Finding lines | ${findingCount} |`,
    `| Reference status | ${referenceStatus} |`,
    "",
    "## Raw CEUR Output",
    "",
    "```text",
    "CEUR checker ok",
    "```",
  ].join("\n");
}

function pdfFile(name = "paper.pdf", body: BlobPart = "%PDF-1.4\n% test\n") {
  return new File([body], name, { type: "application/pdf" });
}

function checkRequest(file?: File, fields: Record<string, string> = {}) {
  const formData = new FormData();
  if (file) {
    formData.set("file", file);
  }

  for (const [name, value] of Object.entries(fields)) {
    formData.set(name, value);
  }

  return new NextRequest("http://localhost/api/check", {
    method: "POST",
    body: formData,
  });
}

function fakeLargeFile() {
  const file = Object.create(File.prototype) as File;
  Object.defineProperties(file, {
    name: { value: "large.pdf" },
    type: { value: "application/pdf" },
    size: { value: 31 * 1024 * 1024 },
  });
  return file;
}

function fakeFormRequest(file: File | null) {
  return {
    headers: new Headers(),
    formData: async () => ({
      get: (name: string) => (name === "file" ? file : null),
    }),
  } as unknown as NextRequest;
}

function createRouteDependencies(
  logs: CapturedLog[],
  overrides: Partial<CheckRouteDependencies> = {},
): Partial<CheckRouteDependencies> {
  const requestId = `route-${randomUUID()}`;

  return {
    auth: async () => ({ user: { email: "test.user@example.com" } }),
    createRequestId: () => requestId,
    getTempDir: tmpdir,
    isCheckerQueueFull: () => false,
    getCheckerQueueSnapshot: () => ({
      active: 0,
      pending: 0,
      maxConcurrent: 2,
      maxQueued: 8,
      queueTimeoutMs: 15_000,
    }),
    runWithCheckerSlot: async (id, task) => task({
      requestId: id,
      queuedMs: 12,
      release: () => {},
    }),
    logger: createMemoryLogger(logs),
    ...overrides,
  };
}

test("check route logs validation and queue rejections with reasons", async () => {
  const cases: Array<{
    name: string;
    status: number;
    reason: string;
    request: () => NextRequest;
    overrides?: Partial<CheckRouteDependencies>;
  }> = [
    {
      name: "authentication",
      status: 401,
      reason: "authentication_required",
      request: () => checkRequest(pdfFile()),
      overrides: { auth: async () => null },
    },
    {
      name: "content length",
      status: 413,
      reason: "request_too_large",
      request: () => new NextRequest("http://localhost/api/check", {
        method: "POST",
        headers: { "content-length": String(32 * 1024 * 1024) },
      }),
    },
    {
      name: "queue full",
      status: 429,
      reason: "queue_full",
      request: () => checkRequest(pdfFile()),
      overrides: {
        isCheckerQueueFull: () => true,
        getCheckerQueueSnapshot: () => ({
          active: 2,
          pending: 8,
          maxConcurrent: 2,
          maxQueued: 8,
          queueTimeoutMs: 15_000,
        }),
      },
    },
    {
      name: "form parse",
      status: 400,
      reason: "form_parse_failed",
      request: () => ({
        headers: new Headers(),
        formData: async () => {
          throw new Error("bad multipart boundary");
        },
      } as unknown as NextRequest),
    },
    {
      name: "missing file",
      status: 400,
      reason: "missing_file",
      request: () => checkRequest(),
    },
    {
      name: "unsupported format",
      status: 400,
      reason: "unsupported_format",
      request: () => checkRequest(new File(["not supported"], "paper.txt", { type: "text/plain" })),
    },
    {
      name: "empty file",
      status: 400,
      reason: "empty_file",
      request: () => checkRequest(pdfFile("empty.pdf", "")),
    },
    {
      name: "file too large",
      status: 413,
      reason: "file_too_large",
      request: () => fakeFormRequest(fakeLargeFile()),
    },
    {
      name: "invalid signature",
      status: 400,
      reason: "invalid_signature",
      request: () => checkRequest(pdfFile("not-a-pdf.pdf", "plain text")),
    },
  ];

  for (const scenario of cases) {
    const logs: CapturedLog[] = [];
    const response = await handleCheckPost(
      scenario.request(),
      createRouteDependencies(logs, scenario.overrides),
    );

    expect(response.status, scenario.name).toBe(scenario.status);
    expect(findLog(logs, "check.request.received"), scenario.name).toBeTruthy();
    expect(
      findLog(logs, "check.request.rejected", {
        reason: scenario.reason,
        status: scenario.status,
      }),
      scenario.name,
    ).toBeTruthy();
  }
});

test("check route logs accepted uploads, skipped reference fixes, and produced reports", async () => {
  const logs: CapturedLog[] = [];
  let checkerOptions: Parameters<CheckRouteDependencies["runChecker"]>[2];

  const response = await handleCheckPost(
    checkRequest(pdfFile("paper.pdf"), { referenceFix: "1", fontEvidence: "1" }),
    createRouteDependencies(logs, {
      runChecker: async (_inputPath, outputPath, options) => {
        checkerOptions = options;
        await writeFile(outputPath, sampleReport("pass", "pass", 0), "utf8");
        return { exitCode: 0, signal: null, stdout: "", stderr: "" };
      },
    }),
  );

  await expect(response.json()).resolves.toEqual(expect.objectContaining({
    filename: "paper.pdf",
    status: "pass",
    referenceStatus: "pass",
    findingCount: 0,
    queuedMs: 12,
  }));
  expect(checkerOptions).toEqual(expect.objectContaining({
    filename: "paper.pdf",
    fontEvidence: true,
    logger: expect.any(Object),
  }));
  expect(checkerOptions?.referenceJsonPath).toContain("references.json");
  expect(findLog(logs, "check.request.accepted", { filename: "paper.pdf", referenceFixRequested: true, fontEvidenceRequested: true })).toBeTruthy();
  expect(findLog(logs, "reference_fix.skipped", { filename: "paper.pdf", reason: "reference_status_not_failed" })).toBeTruthy();
  expect(findLog(logs, "check.report.produced", { filename: "paper.pdf", status: "pass", referenceStatus: "pass" })).toBeTruthy();
});

test("check route logs missing reports and returns fallback process output", async () => {
  const logs: CapturedLog[] = [];

  const response = await handleCheckPost(
    checkRequest(pdfFile("paper.pdf")),
    createRouteDependencies(logs, {
      runChecker: async () => ({ exitCode: 2, signal: null, stdout: "stdout text", stderr: "stderr text" }),
    }),
  );

  expect(response.status).toBe(500);
  await expect(response.json()).resolves.toEqual(expect.objectContaining({
    error: "The checker finished without producing a Markdown report.",
    status: "unknown",
    exitCode: 2,
    report: expect.stringContaining("stdout text"),
  }));
  expect(findLog(logs, "check.report.missing", { filename: "paper.pdf", exitCode: 2, stdoutChars: 11, stderrChars: 11 })).toBeTruthy();
});

test("check route logs unavailable structured reference data", async () => {
  const logs: CapturedLog[] = [];

  const response = await handleCheckPost(
    checkRequest(pdfFile("paper.pdf"), { referenceFix: "1" }),
    createRouteDependencies(logs, {
      runChecker: async (_inputPath, outputPath) => {
        await writeFile(outputPath, sampleReport("fail", "fail", 0), "utf8");
        return { exitCode: 1, signal: null, stdout: "", stderr: "" };
      },
    }),
  );

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual(expect.objectContaining({
    referenceFix: expect.objectContaining({ status: "unavailable" }),
  }));
  expect(findLog(logs, "reference_fix.requested", { filename: "paper.pdf", referenceStatus: "fail" })).toBeTruthy();
  expect(findLog(logs, "reference_fix.unavailable", { filename: "paper.pdf", reason: "structured_data_unavailable" })).toBeTruthy();
  expect(findLog(logs, "check.report.produced", { filename: "paper.pdf", status: "fail", referenceStatus: "fail" })).toBeTruthy();
});

test("check route logs queued overloads and cleanup failures", async () => {
  const overloadLogs: CapturedLog[] = [];
  const overloadResponse = await handleCheckPost(
    checkRequest(pdfFile("paper.pdf")),
    createRouteDependencies(overloadLogs, {
      runWithCheckerSlot: async () => {
        throw new QueueOverloadError("The checker is busy and this request waited too long for a slot.");
      },
    }),
  );

  expect(overloadResponse.status).toBe(429);
  expect(findLog(overloadLogs, "check.request.rejected", { reason: "queue_overload", status: 429 })).toBeTruthy();

  const cleanupLogs: CapturedLog[] = [];
  const cleanupResponse = await handleCheckPost(
    checkRequest(pdfFile("not-a-pdf.pdf", "plain text")),
    createRouteDependencies(cleanupLogs, {
      removeWorkDir: async () => {
        throw new Error("cleanup denied");
      },
    }),
  );

  expect(cleanupResponse.status).toBe(400);
  expect(findLog(cleanupLogs, "check.request.rejected", { reason: "invalid_signature", status: 400 })).toBeTruthy();
  expect(findLog(cleanupLogs, "check.workdir.cleanup_failed", { errorMessage: "cleanup denied" })).toBeTruthy();
});


test("check route logs generated reference fixes and generic request failures", async () => {
  const referenceLogs: CapturedLog[] = [];
  const referenceResponse = await handleCheckPost(
    checkRequest(pdfFile("paper.pdf"), { referenceFix: "1" }),
    createRouteDependencies(referenceLogs, {
      runChecker: async (_inputPath, outputPath, options) => {
        await writeFile(outputPath, sampleReport("fail", "fail", 1), "utf8");
        await writeFile(options?.referenceJsonPath || "", JSON.stringify({ results: [] }), "utf8");
        return { exitCode: 1, signal: null, stdout: "", stderr: "" };
      },
      buildReferenceFix: async () => ({
        status: "generated",
        markdown: "# CEUR Reference Fix\n",
      }),
    }),
  );

  expect(referenceResponse.status).toBe(200);
  await expect(referenceResponse.json()).resolves.toEqual(expect.objectContaining({
    referenceFix: expect.objectContaining({ status: "generated" }),
  }));
  expect(findLog(referenceLogs, "reference_fix.requested", { filename: "paper.pdf", referenceStatus: "fail" })).toBeTruthy();
  expect(findLog(referenceLogs, "reference_fix.route_completed", { filename: "paper.pdf", status: "generated" })).toBeTruthy();

  const failureLogs: CapturedLog[] = [];
  const failureResponse = await handleCheckPost(
    checkRequest(pdfFile("paper.pdf")),
    createRouteDependencies(failureLogs, {
      runWithCheckerSlot: async () => {
        throw new Error("worker crashed");
      },
    }),
  );

  expect(failureResponse.status).toBe(500);
  await expect(failureResponse.json()).resolves.toEqual(expect.objectContaining({
    status: "error",
    error: "worker crashed",
  }));
  expect(findLog(failureLogs, "check.request.failed", { status: 500, error: "worker crashed", errorMessage: "worker crashed" })).toBeTruthy();
});

import { randomUUID } from "node:crypto";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { runChecker } from "../app/api/check/handler";
import { createMemoryLogger, findLog, type CapturedLog } from "./logging-test-utils";

async function writeExecutableScript(contents: string) {
  const directory = await mkdtemp(path.join(tmpdir(), "ceur-process-log-"));
  const script = path.join(directory, "ceur-pdf-check");
  await writeFile(script, contents, "utf8");
  await chmod(script, 0o755);
  return { directory, script };
}

test("checker process logs start and nonzero completion", async () => {
  const logs: CapturedLog[] = [];
  const { directory } = await writeExecutableScript([
    "#!/usr/bin/env bash",
    "echo process stdout",
    "echo process stderr >&2",
    "exit 2",
    "",
  ].join("\n"));

  try {
    const result = await runChecker("/tmp/input.pdf", path.join(directory, "report.md"), {
      env: { ...process.env, PATH: `${directory}:${process.env.PATH || ""}` },
      logger: createMemoryLogger(logs),
      requestId: "process-request",
      filename: "paper.pdf",
    });

    expect(result).toEqual({
      exitCode: 2,
      signal: null,
      stdout: "process stdout\n",
      stderr: "process stderr\n",
    });
    expect(findLog(logs, "checker.process.started", { requestId: "process-request", filename: "paper.pdf" })).toBeTruthy();
    expect(findLog(logs, "checker.process.completed", { requestId: "process-request", exitCode: 2, stdoutChars: 15, stderrChars: 15 })).toBeTruthy();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("checker process logs spawn errors", async () => {
  const logs: CapturedLog[] = [];
  const directory = await mkdtemp(path.join(tmpdir(), `missing-ceur-${randomUUID()}-`));

  try {
    await expect(runChecker("/tmp/input.pdf", "/tmp/report.md", {
      env: { ...process.env, PATH: directory },
      logger: createMemoryLogger(logs),
      requestId: "spawn-error-request",
      filename: "paper.pdf",
    })).rejects.toMatchObject({ code: "ENOENT" });

    expect(findLog(logs, "checker.process.started", { requestId: "spawn-error-request" })).toBeTruthy();
    expect(findLog(logs, "checker.process.error", { requestId: "spawn-error-request", errorCode: "ENOENT" })).toBeTruthy();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("checker process logs timeout and forced kill", async () => {
  const logs: CapturedLog[] = [];
  const { directory } = await writeExecutableScript([
    "#!/usr/bin/env bash",
    "trap '' TERM",
    "sleep 2",
    "",
  ].join("\n"));

  try {
    await expect(runChecker("/tmp/input.pdf", path.join(directory, "report.md"), {
      env: { ...process.env, PATH: `${directory}:${process.env.PATH || ""}` },
      logger: createMemoryLogger(logs),
      requestId: "timeout-request",
      filename: "paper.pdf",
      timeoutMs: 30,
      killGraceMs: 20,
    })).rejects.toThrow("The checker timed out after 0.03 seconds.");

    expect(findLog(logs, "checker.process.timeout", { requestId: "timeout-request", timeoutMs: 30, killGraceMs: 20 })).toBeTruthy();
    await expect.poll(() => Boolean(findLog(logs, "checker.process.force_killed", { requestId: "timeout-request" }))).toBe(true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

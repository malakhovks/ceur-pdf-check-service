import { expect, test } from "@playwright/test";
import { createCheckerQueue, QueueOverloadError } from "../app/api/check/checker-queue";
import { createMemoryLogger, findLog, type CapturedLog } from "./logging-test-utils";

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

test("checker queue rejects immediately when the queue is full", async () => {
  const logs: CapturedLog[] = [];
  const queue = createCheckerQueue({ maxConcurrent: 1, maxQueued: 0, queueTimeoutMs: 1_000 }, createMemoryLogger(logs));

  const first = queue.run("first", async () => {
    await delay(40);
    return "first";
  });

  await expect(queue.run("second", async () => "second")).rejects.toThrow(QueueOverloadError);
  await expect(first).resolves.toBe("first");
  expect(queue.snapshot()).toMatchObject({ active: 0, pending: 0 });
  expect(findLog(logs, "checker.queue.slot_acquired", { requestId: "first" })).toBeTruthy();
  expect(findLog(logs, "checker.queue.rejected_full", { requestId: "second" })).toBeTruthy();
  expect(findLog(logs, "checker.queue.slot_released", { requestId: "first" })).toBeTruthy();
});

test("checker queue bounds active work and drains queued work", async () => {
  const logs: CapturedLog[] = [];
  const queue = createCheckerQueue({ maxConcurrent: 2, maxQueued: 4, queueTimeoutMs: 1_000 }, createMemoryLogger(logs));
  let active = 0;
  let maxActive = 0;

  const results = await Promise.all(["a", "b", "c", "d"].map((id) => queue.run(id, async () => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await delay(20);
    active -= 1;
    return id;
  })));

  expect(results).toEqual(["a", "b", "c", "d"]);
  expect(maxActive).toBeLessThanOrEqual(2);
  expect(queue.snapshot()).toMatchObject({ active: 0, pending: 0 });
  expect(findLog(logs, "checker.queue.enqueued", { requestId: "c", queuePosition: 1 })).toBeTruthy();
  expect(findLog(logs, "checker.queue.enqueued", { requestId: "d", queuePosition: 2 })).toBeTruthy();
  expect(findLog(logs, "checker.queue.dequeued", { requestId: "c" })).toBeTruthy();
  expect(findLog(logs, "checker.queue.dequeued", { requestId: "d" })).toBeTruthy();
});

test("checker queue rejects a queued job that waits past its timeout", async () => {
  const logs: CapturedLog[] = [];
  const queue = createCheckerQueue({ maxConcurrent: 1, maxQueued: 1, queueTimeoutMs: 10 }, createMemoryLogger(logs));

  const first = queue.run("first", async () => {
    await delay(50);
    return "first";
  });

  await expect(queue.run("second", async () => "second")).rejects.toThrow(QueueOverloadError);
  await expect(first).resolves.toBe("first");
  expect(queue.snapshot()).toMatchObject({ active: 0, pending: 0 });
  expect(findLog(logs, "checker.queue.enqueued", { requestId: "second" })).toBeTruthy();
  expect(findLog(logs, "checker.queue.timed_out", { requestId: "second" })).toBeTruthy();
});

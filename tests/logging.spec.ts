import { expect, test } from "@playwright/test";
import { createConsoleLogger, errorLogFields } from "../app/logging";

test("console logger emits structured JSON with safe fields", () => {
  const messages: string[] = [];
  const originalInfo = console.info;
  console.info = (message?: unknown) => {
    messages.push(String(message));
  };

  try {
    const logger = createConsoleLogger(() => new Date("2026-06-22T12:00:00.000Z"));
    logger.info("check.test", {
      requestId: "request-1",
      event: "overridden",
      level: "overridden",
      timestamp: "overridden",
      ignored: undefined,
      nested: {
        at: new Date("2026-06-22T12:01:00.000Z"),
      },
      error: new Error("boom"),
    });
  } finally {
    console.info = originalInfo;
  }

  expect(messages).toHaveLength(1);
  expect(JSON.parse(messages[0])).toEqual({
    timestamp: "2026-06-22T12:00:00.000Z",
    level: "info",
    event: "check.test",
    requestId: "request-1",
    nested: {
      at: "2026-06-22T12:01:00.000Z",
    },
    error: {
      errorName: "Error",
      errorMessage: "boom",
    },
  });
});

test("error fields preserve names, messages, and error codes", () => {
  const error = new Error("missing executable") as Error & { code: string };
  error.name = "SpawnError";
  error.code = "ENOENT";

  expect(errorLogFields(error)).toEqual({
    errorName: "SpawnError",
    errorMessage: "missing executable",
    errorCode: "ENOENT",
  });
});

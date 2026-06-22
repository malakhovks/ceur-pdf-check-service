import { expect, test } from "@playwright/test";
import { authRequiredCheckResponse } from "../proxy-auth-response";
import { createMemoryLogger, findLog, type CapturedLog } from "./logging-test-utils";

test("proxy auth rejection logs the request id and path", async () => {
  const logs: CapturedLog[] = [];
  const response = authRequiredCheckResponse("proxy-request", "/api/check", createMemoryLogger(logs));

  expect(response.status).toBe(401);
  await expect(response.json()).resolves.toEqual({
    requestId: "proxy-request",
    status: "error",
    error: "Authentication required.",
  });
  expect(findLog(logs, "proxy.request.rejected", {
    requestId: "proxy-request",
    pathname: "/api/check",
    reason: "authentication_required",
    status: 401,
  })).toBeTruthy();
});

import { expect, test } from "@playwright/test";

test("health endpoint responds", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.ok()).toBeTruthy();
  expect(response.headers()["content-type"]).toContain("application/json");
  expect(await response.json()).toEqual({ ok: true, service: "ceur-pdf-check" });
});

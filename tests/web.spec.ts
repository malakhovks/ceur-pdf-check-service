import path from "node:path";
import { expect, test } from "@playwright/test";

const samplePdfPath = path.resolve("Malakhov_et_al_UkrPROG_2026_id_22_revised.pdf");

function pdfFixture(name: string) {
  return {
    name,
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n% test fixture\n"),
  };
}

test("shows the initial upload and report state", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "CEUR PDF Check" })).toBeVisible();
  await expect(page.getByRole("link", { name: "GitHub Repo" })).toBeVisible();
  await expect(page.getByText("Official CEUR checker", { exact: true })).toBeVisible();
  await expect(page.getByText("Upload manuscript")).toBeVisible();
  await expect(page.getByText("Markdown validation output")).toBeVisible();
  await expect(page.getByText("No file selected")).toBeVisible();
  await expect(page.getByRole("button", { name: "Run check" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Download report.md" })).toBeDisabled();
});

test("rejects non-PDF selections and leaves no stale report", async ({ page }) => {
  await page.goto("/");

  await page.locator('input[type="file"]').setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not a pdf"),
  });

  await expect(page.getByRole("alert").filter({ hasText: "Only PDF files can be checked." })).toBeVisible();
  await expect(page.getByText("No file selected")).toBeVisible();
  await expect(page.getByRole("button", { name: "Run check" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Download report.md" })).toBeDisabled();
});

test("clears stale results when selecting another PDF and surfaces API errors", async ({ page }) => {
  let requestCount = 0;

  await page.route("/api/check", async (route) => {
    requestCount += 1;

    if (requestCount === 1) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          filename: "first.pdf",
          status: "pass",
          findingCount: 0,
          exitCode: 0,
          report: "# CEUR PDF Check Report\n\nFirst report",
        }),
      });
      return;
    }

    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({
        error: "The checker finished without producing a Markdown report.",
        filename: "second.pdf",
        status: "unknown",
        findingCount: null,
        exitCode: 2,
        report: "# CEUR PDF Check Report\n\nFallback process output",
      }),
    });
  });

  await page.goto("/");

  await page.locator('input[type="file"]').setInputFiles(pdfFixture("first.pdf"));
  await page.getByRole("button", { name: "Run check" }).click();
  await expect(page.getByText("First report")).toBeVisible();
  await expect(page.getByText("Passed").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Download report.md" })).toBeEnabled();

  await page.locator('input[type="file"]').setInputFiles(pdfFixture("second.pdf"));
  await expect(page.getByText("First report")).not.toBeVisible();
  await expect(page.getByText("Waiting").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Download report.md" })).toBeDisabled();

  await page.getByRole("button", { name: "Run check" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "The checker finished without producing a Markdown report." })).toBeVisible();
  await expect(page.getByText("Fallback process output")).toBeVisible();
  await expect(page.getByText("Unknown").first()).toBeVisible();
});

test("checks a PDF and downloads the Markdown report", async ({ page }) => {
  await page.goto("/");

  await page.locator('input[type="file"]').setInputFiles(samplePdfPath);
  await expect(page.getByText("Malakhov_et_al_UkrPROG_2026_id_22_revised.pdf")).toBeVisible();

  await page.getByRole("button", { name: "Run check" }).click();
  await expect(page.getByText("CEUR PDF Check Report")).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText("Finding lines")).toBeVisible();
  await expect(page.getByText("Can't open index.html: No such file or directory.")).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download report.md" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("report.md");
});

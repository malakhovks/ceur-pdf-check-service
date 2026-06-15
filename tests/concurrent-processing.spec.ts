import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type APIResponse, type Page } from "@playwright/test";

type UploadFixture = {
  name: string;
  mimeType: string;
  buffer: Buffer;
};

const requiredManuscripts = [
  {
    path: path.resolve("CEUR-Template-1col.odt"),
    name: "CEUR-Template-1col.odt",
    mimeType: "application/vnd.oasis.opendocument.text",
  },
  {
    path: path.resolve("Malakhov_et_al_UkrPROG_2026_id_22_revised.pdf"),
    name: "Malakhov_et_al_UkrPROG_2026_id_22_revised.pdf",
    mimeType: "application/pdf",
  },
  {
    path: path.resolve("Malakhov_et_al_UkrPROG_2026_id_22_revised.docx"),
    name: "Malakhov_et_al_UkrPROG_2026_id_22_revised.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
] as const;

const concurrencyScenarios = [
  {
    label: "2 concurrent requests",
    batches: [
      [0, 1],
      [2, 0],
    ],
  },
  {
    label: "4 concurrent requests",
    batches: [
      [0, 1, 2, 0],
    ],
  },
  {
    label: "8 concurrent requests",
    batches: [
      [0, 1, 2, 0, 1, 2, 0, 1],
    ],
  },
] as const;

async function signInForTests(page: Page) {
  await page.goto("/sign-in");
  await expect(page.getByTestId("sign-in-panel")).toBeVisible();
  await page.getByRole("button", { name: "Use test account" }).click();
  await expect(page.getByTestId("app-shell")).toBeVisible();
}

async function readRequiredManuscripts(): Promise<UploadFixture[]> {
  return Promise.all(requiredManuscripts.map(async (manuscript) => ({
    name: manuscript.name,
    mimeType: manuscript.mimeType,
    buffer: await readFile(manuscript.path),
  })));
}

async function readResponse(response: APIResponse) {
  const text = await response.text();

  try {
    return {
      status: response.status(),
      body: JSON.parse(text) as Record<string, unknown>,
      text,
    };
  } catch {
    return {
      status: response.status(),
      body: null,
      text,
    };
  }
}

test("processes required manuscripts under 2, 4, and 8 concurrent API requests", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Concurrent API load runs once against the shared checker queue.");
  test.setTimeout(30 * 60_000);

  await signInForTests(page);
  const uploads = await readRequiredManuscripts();

  for (const scenario of concurrencyScenarios) {
    await test.step(scenario.label, async () => {
      for (const [batchIndex, manuscriptIndexes] of scenario.batches.entries()) {
        const batchUploads = manuscriptIndexes.map((index) => uploads[index]);
        const batchStartedAt = Date.now();

        const results = await Promise.all(batchUploads.map(async (upload, requestIndex) => {
          const response = await page.context().request.post("/api/check", {
            multipart: {
              file: upload,
            },
          });

          return {
            upload,
            requestIndex,
            response: await readResponse(response),
          };
        }));

        const elapsedMs = Date.now() - batchStartedAt;
        testInfo.annotations.push({
          type: "concurrency",
          description: `${scenario.label} batch ${batchIndex + 1} finished in ${elapsedMs}ms`,
        });

        for (const result of results) {
          const details = [
            scenario.label,
            `batch ${batchIndex + 1}`,
            `request ${result.requestIndex + 1}`,
            result.upload.name,
            `HTTP ${result.response.status}`,
            result.response.text.slice(0, 800),
          ].join(" | ");

          expect(result.response.status, details).toBe(200);
          expect(result.response.body, details).toEqual(expect.objectContaining({
            requestId: expect.any(String),
            filename: result.upload.name,
            status: expect.any(String),
            queuedMs: expect.any(Number),
            report: expect.stringContaining("# CEUR PDF Check Report"),
          }));
        }
      }
    });
  }
});

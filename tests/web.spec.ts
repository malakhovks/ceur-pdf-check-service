import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";

const samplePdfPath = path.resolve("Malakhov_et_al_UkrPROG_2026_id_22_revised.pdf");
const sampleDocxPath = path.resolve("Malakhov_et_al_UkrPROG_2026_id_22_revised.docx");
const sampleOdtPath = path.resolve("CEUR-Template-1col.odt");

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function pdfFixture(name: string) {
  return {
    name,
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n% test fixture\n"),
  };
}

function sampleReport(extraRaw = "WARNING: raw English output") {
  return [
    "# CEUR PDF Check Report",
    "",
    "| Field | Value |",
    "| --- | --- |",
    "| Status | fail |",
    "| Generated | 2026-06-05T00:00:00Z |",
    "| Input | /tmp/paper.pdf |",
    "| Manuscript count | 1 |",
    "| PDF count | 1 |",
    "| Tests | all |",
    "| Checker exit code | 1 |",
    "| Finding lines | 2 |",
    "",
    "## Input Manuscripts",
    "",
    "- paper.pdf",
    "",
    "## Checked PDFs",
    "",
    "- paper.pdf",
    "",
    "## Findings",
    "",
    "- WARNING: example finding",
    "",
    "## Raw CEUR Output",
    "",
    "```text",
    extraRaw,
    "Can't open index.html: No such file or directory.",
    "```",
  ].join("\n");
}

async function switchToEnglish(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "English" }).click();
}

async function expectNoDocumentScroll(page: import("@playwright/test").Page) {
  await expect.poll(async () => page.evaluate(() => {
    window.scrollTo(0, 1000);
    return {
      y: window.scrollY,
      htmlOverflow: getComputedStyle(document.documentElement).overflow,
      bodyOverflow: getComputedStyle(document.body).overflow,
    };
  })).toEqual({ y: 0, htmlOverflow: "hidden", bodyOverflow: "hidden" });
}

async function signInForTests(page: import("@playwright/test").Page) {
  await page.goto("/sign-in");
  await expect(page.getByTestId("sign-in-panel")).toBeVisible();
  await page.getByRole("button", { name: "Use test account" }).click();
  await expect(page.getByTestId("app-shell")).toBeVisible();
  await expect(page.getByTestId("signed-in-user")).toContainText("Test User");
}

const unauthenticatedTests = new Set([
  "requires Google Sign-In before showing the app",
  "rejects checker API requests without a session",
]);

test.beforeEach(async ({ page }, testInfo) => {
  if (unauthenticatedTests.has(testInfo.title)) {
    return;
  }

  await signInForTests(page);
});

test("requires Google Sign-In before showing the app", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/sign-in/);
  await expect(page.getByRole("heading", { name: "CEUR PDF Check" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in with Google" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Use test account" })).toBeVisible();
  await expect(page.getByTestId("app-shell")).not.toBeVisible();
});

test("rejects checker API requests without a session", async ({ request }) => {
  const response = await request.post("/api/check", {
    multipart: {
      file: pdfFixture("blocked.pdf"),
    },
  });

  expect(response.status()).toBe(401);
  await expect(response.json()).resolves.toEqual(expect.objectContaining({
    status: "error",
    error: "Authentication required.",
  }));
});

test("shows Ukrainian UI by default and switches to English", async ({ page }) => {
  await page.goto("/");

  const header = page.getByTestId("dashboard-header");
  const themeSwitcher = header.getByTestId("theme-switcher");
  const dashboardHeading = page.getByRole("heading", { name: "CEUR PDF Check" });
  await expect(dashboardHeading).toBeVisible();
  await expect.poll(async () => dashboardHeading.evaluate((element) => getComputedStyle(element).fontSize)).toBe("24px");
  await expect(page.getByText("Перевірка рукопису для CEUR-WS")).toBeVisible();
  await expect(page.getByText("Завантаження рукопису")).toBeVisible();
  await expect(page.getByText("Markdown-вивід перевірки")).toBeVisible();
  await expect(page.getByText("Файл не вибрано")).toBeVisible();
  await expect(page.getByRole("button", { name: "Запустити перевірку" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Завантажити report.md" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Перегляд" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Код" })).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("button", { name: "Інфо" })).toBeVisible();
  await expect(themeSwitcher).toHaveAttribute("role", "switch");
  await expect(themeSwitcher).toHaveAttribute("aria-checked", "false");
  await expect(header.getByRole("button", { name: "Українська" })).toHaveAttribute("aria-pressed", "true");
  await expect(header.getByRole("button", { name: "Українська" })).toHaveText("UA");
  await expect(header.getByRole("button", { name: "English" })).toHaveText("EN");
  await expect(header.getByText("Світла", { exact: true })).toHaveCount(0);
  await expect(header.getByText("Темна", { exact: true })).toHaveCount(0);
  await expect(header.getByText("Українська", { exact: true })).toHaveCount(0);
  await expect(header.getByText("English", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Check profile")).not.toBeVisible();
  await expectNoDocumentScroll(page);

  await switchToEnglish(page);
  await expect(page.getByText("Manuscript validation report generator")).toBeVisible();
  await expect(page.getByText("Upload manuscript")).toBeVisible();
  await expect(page.getByText("Markdown validation output")).toBeVisible();
  await expect(page.getByText("No file selected")).toBeVisible();
  await expect(page.getByRole("button", { name: "Run check" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Preview" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Source" })).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("button", { name: "Info" })).toBeVisible();
  await expect(themeSwitcher).toHaveAttribute("aria-checked", "false");
  await expect(header.getByRole("button", { name: "English" })).toHaveAttribute("aria-pressed", "true");
  await expect(header.getByRole("button", { name: "Українська" })).toHaveText("UA");
  await expect(header.getByRole("button", { name: "English" })).toHaveText("EN");
  await expect(header.getByText("Light", { exact: true })).toHaveCount(0);
  await expect(header.getByText("Dark", { exact: true })).toHaveCount(0);
  await expect(header.getByText("Українська", { exact: true })).toHaveCount(0);
  await expect(header.getByText("English", { exact: true })).toHaveCount(0);
  await expectNoDocumentScroll(page);
});

test("shows developer credit and fixed project links in the header", async ({ page }) => {
  await page.goto("/");

  const header = page.getByTestId("dashboard-header");
  await expect(header.getByRole("link", { name: "GitHub" })).toHaveAttribute("href", "https://github.com/malakhovks/ceur-pdf-check-service");

  const credit = header.getByTestId("developer-credit");
  await expect(credit).toHaveAttribute("href", "https://linktr.ee/malakhovks");
  await expect(credit).toContainText("Розробник");
  await expect(credit).not.toContainText("Developer");
  await expect(credit).toContainText("MalakhovKS");

  const expectedDate = await page.evaluate(() => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  });
  await expect(header.getByTestId("developer-credit-date")).toHaveText(expectedDate);

  await switchToEnglish(page);
  await expect(credit).toContainText("Developer");
  await expect(credit).toContainText("MalakhovKS");
  await expectNoDocumentScroll(page);
});

test("opens localized info modal and persists the dark theme", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Інфо" }).click();
  const ukDialog = page.getByRole("dialog", { name: "Можливості застосунку" });
  await expect(ukDialog).toBeVisible();
  await expect(ukDialog).toContainText("Завантажуйте PDF, DOCX, DOC або ODT рукописи.");
  await expect(ukDialog).toContainText("Читайте Markdown-звіт у режимі перегляду або сирого коду.");
  await page.keyboard.press("Escape");
  await expect(ukDialog).not.toBeVisible();

  await switchToEnglish(page);
  await page.getByRole("button", { name: "Info" }).click();
  const enDialog = page.getByRole("dialog", { name: "App features" });
  await expect(enDialog).toBeVisible();
  await expect(enDialog).toContainText("Upload PDF, DOCX, DOC, or ODT manuscripts.");
  await expect(enDialog).toContainText("Review the Markdown report as rendered preview or raw source.");
  await enDialog.getByRole("button", { name: "Close" }).last().click();
  await expect(enDialog).not.toBeVisible();

  const header = page.getByTestId("dashboard-header");
  const themeSwitcher = header.getByTestId("theme-switcher");
  await themeSwitcher.click();
  await expect(themeSwitcher).toHaveAttribute("aria-checked", "true");
  await expect.poll(async () => page.evaluate(() => document.documentElement.dataset.theme)).toBe("dark");
  await expect.poll(async () => page.evaluate(() => window.localStorage.getItem("ceur-pdf-check-theme"))).toBe("dark");

  const darkPalette = await page.evaluate(() => {
    const appShell = document.querySelector('[data-testid="app-shell"]')!;
    const dashboardPanel = document.querySelector('[data-testid="dashboard-panel"]')!;
    const styles = {
      body: getComputedStyle(document.body),
      appShell: getComputedStyle(appShell),
      dashboardPanel: getComputedStyle(dashboardPanel),
    };

    return {
      bodyBackground: styles.body.backgroundColor,
      shellBackgroundImage: styles.appShell.backgroundImage,
      panelBackgroundColor: styles.dashboardPanel.backgroundColor,
    };
  });

  expect(darkPalette.bodyBackground).toBe("rgb(17, 24, 39)");
  expect(darkPalette.shellBackgroundImage).toContain("rgb(17, 24, 39)");
  expect(darkPalette.shellBackgroundImage).toContain("rgb(15, 23, 42)");
  expect(darkPalette.panelBackgroundColor).toMatch(/rgba\(15, 23, 42, 0\.78\)|color\(srgb 0\.0588235 0\.0901961 0\.164706 \/ 0\.78\)|oklab\([^)]*\/ 0\.78\)/);
  await expectNoDocumentScroll(page);

  await page.reload();
  await expect.poll(async () => page.evaluate(() => document.documentElement.dataset.theme)).toBe("dark");
  await expect(page.getByTestId("theme-switcher")).toHaveAttribute("aria-checked", "true");
  await expectNoDocumentScroll(page);
});

test("uses reference dashboard colors and rounded forms", async ({ page }) => {
  await page.goto("/");

  const palette = await page.evaluate(() => {
    const appShell = document.querySelector('[data-testid="app-shell"]')!;
    const dashboardPanel = document.querySelector('[data-testid="dashboard-panel"]')!;
    const header = document.querySelector('[data-testid="dashboard-header"]')!;
    const dropzone = document.querySelector('[data-testid="upload-dropzone"]')!;
    const styles = {
      body: getComputedStyle(document.body),
      appShell: getComputedStyle(appShell),
      dashboardPanel: getComputedStyle(dashboardPanel),
      header: getComputedStyle(header),
      dropzone: getComputedStyle(dropzone),
    };

    return {
      bodyBackground: styles.body.backgroundColor,
      shellBackgroundImage: styles.appShell.backgroundImage,
      panelBackgroundColor: styles.dashboardPanel.backgroundColor,
      panelBorderColor: styles.dashboardPanel.borderColor,
      headerBackgroundColor: styles.header.backgroundColor,
      dropzoneBackgroundColor: styles.dropzone.backgroundColor,
      dropzoneBorderColor: styles.dropzone.borderColor,
      dropzoneBorderRadius: styles.dropzone.borderRadius,
    };
  });

  expect(palette.bodyBackground).toBe("rgb(231, 239, 231)");
  expect(palette.shellBackgroundImage).toContain("rgb(238, 244, 238)");
  expect(palette.shellBackgroundImage).toContain("rgb(221, 231, 223)");
  expect(palette.panelBackgroundColor).toMatch(/rgba\(255, 255, 255, 0\.72\)|color\(srgb 1 1 1 \/ 0\.72\)|oklab\([^)]*\/ 0\.72\)/);
  expect(palette.panelBorderColor).toMatch(/rgba\(255, 255, 255, 0\.7\)|color\(srgb 1 1 1 \/ 0\.7\)|oklab\([^)]*\/ 0\.7\)/);
  expect(palette.headerBackgroundColor).toBe("rgba(0, 0, 0, 0)");
  expect(palette.dropzoneBackgroundColor).toMatch(/rgba\(255, 255, 255, 0\.72\)|color\(srgb 1 1 1 \/ 0\.72\)|oklab\([^)]*\/ 0\.72\)/);
  expect(palette.dropzoneBorderColor).toMatch(/rgba\(255, 255, 255, 0\.7\)|color\(srgb 1 1 1 \/ 0\.7\)|oklab\([^)]*\/ 0\.7\)/);
  expect(parseFloat(palette.dropzoneBorderRadius)).toBeGreaterThanOrEqual(24);

  await page.locator('input[type="file"]').setInputFiles(pdfFixture("styled.pdf"));
  const runButton = page.getByRole("button", { name: "Запустити перевірку" });
  await expect(runButton).toBeEnabled();
  await expect(runButton).toHaveClass(/reference-dark/);
  await expect.poll(async () => runButton.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe("rgb(15, 23, 42)");
  const runButtonBorderRadius = await runButton.evaluate((element) => getComputedStyle(element).borderRadius);
  expect(parseFloat(runButtonBorderRadius)).toBeGreaterThanOrEqual(20);
  await expectNoDocumentScroll(page);
});

test("aligns the compact dashboard panel with the expanded report surface on desktop", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop column alignment is not used on mobile");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  const boxes = await page.evaluate(() => {
    const rectFor = (testId: string) => {
      const rect = document.querySelector(`[data-testid="${testId}"]`)!.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        width: rect.width,
        height: rect.height,
      };
    };

    return {
      dashboard: rectFor("dashboard-panel"),
      dropzone: rectFor("upload-dropzone"),
      stats: rectFor("stats-grid"),
      action: rectFor("action-panel"),
      report: rectFor("report-surface"),
      notesPresent: Boolean(document.querySelector('[data-testid="notes-surface"]')),
    };
  });

  expect(Math.abs(boxes.dropzone.height - boxes.stats.height)).toBeLessThanOrEqual(1);
  expect(Math.abs(boxes.action.height - boxes.stats.height)).toBeLessThanOrEqual(1);
  expect(boxes.notesPresent).toBe(false);
  expect(Math.abs(boxes.report.left - boxes.dashboard.left)).toBeLessThanOrEqual(1);
  expect(Math.abs(boxes.report.right - boxes.dashboard.right)).toBeLessThanOrEqual(1);
  expect(Math.abs(boxes.report.width - boxes.dashboard.width)).toBeLessThanOrEqual(1);
  expect(boxes.report.height).toBeGreaterThan(boxes.dashboard.height);

  const actionPanel = page.getByTestId("action-panel");
  await expect(actionPanel.getByText("усі тести")).toHaveCount(0);
  const actionControls = await page.evaluate(() => {
    const status = document.querySelector('[data-testid="action-status"]')!.getBoundingClientRect();
    const button = document.querySelector('[data-testid="action-panel"] button')!.getBoundingClientRect();

    return {
      status: { width: status.width, height: status.height },
      button: { width: button.width, height: button.height },
    };
  });
  expect(Math.abs(actionControls.status.width - actionControls.button.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(actionControls.status.height - actionControls.button.height)).toBeLessThanOrEqual(1);
  await expectNoDocumentScroll(page);
});

test("keeps dashboard controls reachable on short mobile viewports", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 560 });
  await page.goto("/");

  const dashboard = page.getByTestId("dashboard-panel");
  await expect.poll(async () => dashboard.evaluate((element) => element.scrollHeight > element.clientHeight)).toBeTruthy();

  await dashboard.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });

  await expect(page.getByRole("button", { name: "Запустити перевірку" })).toBeInViewport();
  await expectNoDocumentScroll(page);
});

test("rejects unsupported manuscript selections with localized errors", async ({ page }) => {
  await page.goto("/");

  await page.locator('input[type="file"]').setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not a pdf"),
  });

  await expect(page.getByRole("alert").filter({ hasText: "Можна перевіряти лише файли PDF, DOCX, DOC або ODT." })).toBeVisible();
  await switchToEnglish(page);
  await expect(page.getByRole("alert").filter({ hasText: "Only PDF, DOCX, DOC, or ODT files can be checked." })).toBeVisible();
  await expect(page.getByText("No file selected")).toBeVisible();
  await expect(page.getByRole("button", { name: "Run check" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Download report.md" })).toBeDisabled();
});

test("accepts DOCX and ODT manuscript selections", async ({ page }) => {
  await page.goto("/");

  await page.locator('input[type="file"]').setInputFiles(sampleDocxPath);
  await expect(page.getByText("Malakhov_et_al_UkrPROG_2026_id_22_revised.docx")).toBeVisible();
  await expect(page.getByRole("button", { name: "Запустити перевірку" })).toBeEnabled();

  await page.locator('input[type="file"]').setInputFiles(sampleOdtPath);
  await expect(page.getByText("CEUR-Template-1col.odt")).toBeVisible();
  await switchToEnglish(page);
  await expect(page.getByRole("button", { name: "Run check" })).toBeEnabled();
});

test("prevents duplicate submissions while a check is active", async ({ page }) => {
  let requestCount = 0;

  await page.route("/api/check", async (route) => {
    requestCount += 1;
    await delay(150);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        requestId: "request-1",
        filename: "active.pdf",
        status: "pass",
        findingCount: 0,
        exitCode: 0,
        queuedMs: 0,
        report: sampleReport("Active request complete"),
      }),
    });
  });

  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(pdfFixture("active.pdf"));

  await page.getByRole("button", { name: "Запустити перевірку" }).click();
  await expect(page.getByRole("button", { name: "Перевірка" })).toBeDisabled();
  await expect(page.getByText("Active request complete")).toBeVisible();
  expect(requestCount).toBe(1);
});

test("shows queue overload errors from the checker API in both languages", async ({ page }) => {
  await page.route("/api/check", async (route) => {
    await route.fulfill({
      status: 429,
      contentType: "application/json",
      body: JSON.stringify({
        requestId: "busy-request",
        status: "error",
        error: "The checker is busy. Try again shortly.",
        queue: { active: 2, pending: 8, maxConcurrent: 2, maxQueued: 8 },
      }),
    });
  });

  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(pdfFixture("busy.pdf"));
  await page.getByRole("button", { name: "Запустити перевірку" }).click();

  await expect(page.getByRole("alert").filter({ hasText: "Перевірник зайнятий. Спробуйте ще раз трохи пізніше." })).toBeVisible();
  await expect(page.getByText("Помилка").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Завантажити report.md" })).toBeDisabled();

  await switchToEnglish(page);
  await expect(page.getByRole("alert").filter({ hasText: "The checker is busy. Try again shortly." })).toBeVisible();
});

test("localizes server-side checker API errors", async ({ page }) => {
  let requestCount = 0;

  await page.route("/api/check", async (route) => {
    requestCount += 1;
    const isFirstRequest = requestCount === 1;

    await route.fulfill({
      status: isFirstRequest ? 400 : 504,
      contentType: "application/json",
      body: JSON.stringify({
        requestId: isFirstRequest ? "upload-parse-request" : "timeout-request",
        status: "error",
        error: isFirstRequest ? "The upload could not be parsed." : "The checker timed out after 110 seconds.",
      }),
    });
  });

  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(pdfFixture("parse-error.pdf"));
  await page.getByRole("button", { name: "Запустити перевірку" }).click();

  await expect(page.getByRole("alert").filter({ hasText: "Не вдалося прочитати завантаження." })).toBeVisible();

  await switchToEnglish(page);
  await expect(page.getByRole("alert").filter({ hasText: "The upload could not be parsed." })).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles(pdfFixture("timeout.pdf"));
  await page.getByRole("button", { name: "Run check" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "The checker exceeded the time limit." })).toBeVisible();
});

test("translates reports in Ukrainian while source and downloads stay raw", async ({ page }) => {
  await page.route("/api/check", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        requestId: "translated-request",
        filename: "paper.pdf",
        status: "fail",
        findingCount: 2,
        exitCode: 1,
        queuedMs: 0,
        report: sampleReport(),
      }),
    });
  });

  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(pdfFixture("paper.pdf"));
  await page.getByRole("button", { name: "Запустити перевірку" }).click();

  const report = page.getByLabel("Markdown-звіт перевірки");
  await expect(report.getByRole("heading", { name: "Звіт перевірки CEUR PDF", level: 1 })).toBeVisible();
  await expect(report.locator("table")).toBeVisible();
  await expect(report.locator("td").filter({ hasText: "Знахідки" })).toBeVisible();
  await expect(report.getByRole("heading", { name: "Сирий вивід CEUR (англійською)", level: 2 })).toBeVisible();
  await expect(report.getByText("| Статус | Знахідки |")).not.toBeVisible();
  await expect(page.getByText("WARNING: raw English output")).toBeVisible();

  await page.getByRole("button", { name: "Код" }).click();
  await expect(page.getByRole("button", { name: "Код" })).toHaveAttribute("aria-pressed", "true");
  await expect(report.locator("pre").filter({ hasText: "# CEUR PDF Check Report" })).toBeVisible();
  await expect(report.locator("pre").filter({ hasText: "| Status | fail |" })).toBeVisible();
  await expect(report.getByText("| Статус | Знахідки |")).not.toBeVisible();

  await page.getByRole("button", { name: "Перегляд" }).click();
  await expect(report.getByRole("heading", { name: "Звіт перевірки CEUR PDF", level: 1 })).toBeVisible();
  await expect(report.locator("table")).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Завантажити report.md" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("report_paper.md");
  const downloadPath = await download.path();
  expect(downloadPath).toBeTruthy();
  const content = await readFile(downloadPath!, "utf8");
  expect(content).toContain("# CEUR PDF Check Report");
  expect(content).toContain("## Raw CEUR Output");
  expect(content).toContain("WARNING: raw English output");
  expect(content).not.toContain("# Звіт перевірки CEUR PDF");
  expect(content).not.toContain("## Сирий вивід CEUR (англійською)");
});

test("uses internal report scrolling for long output", async ({ page }) => {
  const longRawOutput = Array.from({ length: 120 }, (_, index) => `WARNING: raw English output line ${index + 1}`).join("\n");

  await page.route("/api/check", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        requestId: "long-request",
        filename: "long.pdf",
        status: "fail",
        findingCount: 120,
        exitCode: 1,
        queuedMs: 0,
        report: sampleReport(longRawOutput),
      }),
    });
  });

  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(pdfFixture("long.pdf"));
  await page.getByRole("button", { name: "Запустити перевірку" }).click();
  await expect(page.getByText("WARNING: raw English output line 120")).toBeVisible();

  const report = page.getByLabel("Markdown-звіт перевірки");
  await expect.poll(async () => report.evaluate((element) => element.scrollHeight > element.clientHeight)).toBeTruthy();
  await expectNoDocumentScroll(page);
});

test("clears stale results when selecting another manuscript and surfaces API errors", async ({ page }) => {
  let requestCount = 0;

  await page.route("/api/check", async (route) => {
    requestCount += 1;

    if (requestCount === 1) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          requestId: "first-request",
          filename: "first.pdf",
          status: "pass",
          findingCount: 0,
          exitCode: 0,
          queuedMs: 0,
          report: sampleReport("First report"),
        }),
      });
      return;
    }

    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({
        requestId: "second-request",
        error: "The checker finished without producing a Markdown report.",
        filename: "second.pdf",
        status: "unknown",
        findingCount: null,
        exitCode: 2,
        queuedMs: 0,
        report: "# CEUR PDF Check Report\n\nFallback process output",
      }),
    });
  });

  await page.goto("/");

  await page.locator('input[type="file"]').setInputFiles(pdfFixture("first.pdf"));
  await page.getByRole("button", { name: "Запустити перевірку" }).click();
  await expect(page.getByText("First report")).toBeVisible();
  await expect(page.getByText("Пройдено").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Завантажити report.md" })).toBeEnabled();

  await page.locator('input[type="file"]').setInputFiles(pdfFixture("second.pdf"));
  await expect(page.getByText("First report")).not.toBeVisible();
  await expect(page.getByText("Очікування").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Завантажити report.md" })).toBeDisabled();

  await page.getByRole("button", { name: "Запустити перевірку" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Перевірник завершився без створення Markdown-звіту." })).toBeVisible();
  await expect(page.getByText("Fallback process output")).toBeVisible();
  await expect(page.getByText("Невідомо").first()).toBeVisible();
});

test("ignores stale check responses after selecting another manuscript", async ({ page }) => {
  let finishFirstRequest: (() => void) | undefined;

  await page.route("/api/check", async (route) => {
    const form = route.request().postData() || "";
    if (form.includes("slow.pdf")) {
      await new Promise<void>((resolve) => {
        finishFirstRequest = resolve;
      });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          requestId: "slow-request",
          filename: "slow.pdf",
          status: "pass",
          findingCount: 0,
          exitCode: 0,
          queuedMs: 0,
          report: sampleReport("Slow stale report"),
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        requestId: "new-request",
        filename: "new.pdf",
        status: "pass",
        findingCount: 0,
        exitCode: 0,
        queuedMs: 0,
        report: sampleReport("New report"),
      }),
    });
  });

  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(pdfFixture("slow.pdf"));
  await page.getByRole("button", { name: "Запустити перевірку" }).click();
  await expect(page.getByRole("button", { name: "Перевірка" })).toBeDisabled();

  await page.locator('input[type="file"]').setInputFiles(pdfFixture("new.pdf"));
  finishFirstRequest?.();
  await expect(page.getByText("Slow stale report")).not.toBeVisible();
  await expect(page.getByText("new.pdf")).toBeVisible();
});

test("checks a PDF and can switch the real report back to English", async ({ page }) => {
  await page.goto("/");

  await page.locator('input[type="file"]').setInputFiles(samplePdfPath);
  await expect(page.getByText("Malakhov_et_al_UkrPROG_2026_id_22_revised.pdf")).toBeVisible();

  await page.getByRole("button", { name: "Запустити перевірку" }).click();
  await expect(page.getByText("Звіт перевірки CEUR PDF")).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText("Сирий вивід CEUR (англійською)")).toBeVisible();
  await expect(page.getByText("Can't open index.html: No such file or directory.", { exact: true })).toBeVisible();

  await switchToEnglish(page);
  await expect(page.getByText("CEUR PDF Check Report")).toBeVisible();
  await expect(page.getByText("Finding lines")).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download report.md" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("report_Malakhov_et_al_UkrPROG_2026_id_22_revised.md");
});

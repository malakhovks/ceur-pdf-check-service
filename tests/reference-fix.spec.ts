import { expect, test } from "@playwright/test";
import { buildReferenceFix, type ReferenceCheckJson } from "../app/api/check/reference-fix";
import { createMemoryLogger, findLog, type CapturedLog } from "./logging-test-utils";

function referenceData(text: string): ReferenceCheckJson {
  return {
    version: 1,
    results: [{
      name: "paper.pdf",
      reference_count: 1,
      errors: ["[1] DOI values must be rendered with the CEURART prefix `doi:`."],
      reference_section: `[1] ${text}`,
      entries: [{
        label: 1,
        text,
        errors: ["[1] DOI values must be rendered with the CEURART prefix `doi:`."],
      }],
    }],
  };
}

test("generates high-confidence CEUR reference fixes from Crossref metadata", async () => {
  const logs: CapturedLog[] = [];
  const logger = createMemoryLogger(logs);
  const fetchImpl = (async () => new Response(JSON.stringify({
    message: {
      DOI: "10.1145/1188913.1188915",
      type: "journal-article",
      title: ["The patent holder's dilemma: Buy, sell, or troll?"],
      author: [
        { given: "Patricia S.", family: "Abril" },
        { given: "Robert", family: "Plant" },
      ],
      issued: { "date-parts": [[2007]] },
      "container-title": ["Communications of the ACM"],
      volume: "50",
      page: "36-44",
      URL: "https://doi.org/10.1145/1188913.1188915",
    },
  }), { status: 200, headers: { "content-type": "application/json" } })) as typeof fetch;

  const result = await buildReferenceFix(referenceData(
    "P. S. Abril, R. Plant, The patent holder's dilemma: Buy, sell, or troll?, Communications of the ACM 50 (2007) 36-44. https://doi.org/10.1145/1188913.1188915.",
  ), { filename: "paper.pdf", fetchImpl, logger, requestId: "reference-request" });

  expect(result.status).toBe("generated");
  expect(result.markdown).toContain("# CEUR Reference Fix");
  expect(result.markdown).toContain("| High confidence | 1 |");
  expect(result.markdown).toContain("doi:10.1145/1188913.1188915");
  expect(result.markdown).toContain("High-confidence metadata match");
  expect(result.markdown).toContain("## BibTeX Export");
  expect(result.markdown).toContain("## CSL-JSON Export");
  expect(findLog(logs, "reference_fix.started", { requestId: "reference-request", filename: "paper.pdf" })).toBeTruthy();
  expect(findLog(logs, "reference_fix.completed", { highConfidence: 1, fallbackCount: 0 })).toBeTruthy();
});

test("still generates low-confidence fixes with review notes when lookup fails", async () => {
  const logs: CapturedLog[] = [];
  const logger = createMemoryLogger(logs);
  const fetchImpl = (async () => new Response("{}", { status: 404 })) as typeof fetch;
  const result = await buildReferenceFix(referenceData(
    "Unknown Author, Incomplete but useful source title, 2024. http://example.com/source.",
  ), { filename: "paper.pdf", fetchImpl, logger, requestId: "fallback-request" });

  expect(result.status).toBe("generated");
  expect(result.markdown).toContain("| Low confidence | 1 |");
  expect(result.markdown).toContain("Review required before inserting into the manuscript.");
  expect(result.markdown).toContain("URL: http://example.com/source");
  expect(findLog(logs, "reference_fix.metadata_fallback", { requestId: "fallback-request", entryLabel: 1 })).toBeTruthy();
  expect(findLog(logs, "reference_fix.completed", { lowConfidence: 1, fallbackCount: 1 })).toBeTruthy();
});


test("passes an abort signal to metadata fetches and falls back when lookup fails", async () => {
  const logs: CapturedLog[] = [];
  const logger = createMemoryLogger(logs);
  let sawSignal = false;
  const fetchImpl = (async (_url: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    sawSignal = Boolean(init?.signal);
    throw new Error("metadata unavailable");
  }) as typeof fetch;

  const result = await buildReferenceFix(referenceData(
    "Unknown Author, Incomplete but useful source title, 2024. http://example.com/source.",
  ), { filename: "paper.pdf", fetchImpl, logger, requestId: "metadata-error-request" });

  expect(sawSignal).toBe(true);
  expect(result.status).toBe("generated");
  expect(result.markdown).toContain("| Low confidence | 1 |");
  expect(result.markdown).toContain("Review required before inserting into the manuscript.");
  expect(findLog(logs, "reference_fix.metadata_lookup_failed", { requestId: "metadata-error-request", source: "Crossref" })).toBeTruthy();
  expect(findLog(logs, "reference_fix.metadata_fallback", { requestId: "metadata-error-request", entryLabel: 1 })).toBeTruthy();
});


test("logs skipped and unavailable reference fix outcomes", async () => {
  const skippedLogs: CapturedLog[] = [];
  const skipped = await buildReferenceFix({
    results: [{
      name: "paper.pdf",
      reference_count: 0,
      errors: [],
      entries: [],
    }],
  }, { filename: "paper.pdf", logger: createMemoryLogger(skippedLogs), requestId: "skipped-request" });

  expect(skipped).toEqual({
    status: "skipped",
    warning: "No reference issues were detected.",
  });
  expect(findLog(skippedLogs, "reference_fix.skipped", {
    requestId: "skipped-request",
    reason: "no_reference_errors",
  })).toBeTruthy();

  const unavailableLogs: CapturedLog[] = [];
  const unavailable = await buildReferenceFix({
    results: [{
      name: "paper.pdf",
      reference_count: 0,
      errors: ["Reference section was not found."],
      entries: [],
    }],
  }, { filename: "paper.pdf", logger: createMemoryLogger(unavailableLogs), requestId: "unavailable-request" });

  expect(unavailable.status).toBe("unavailable");
  expect(unavailable.warning).toBe("No numbered reference entries were available for reconstruction.");
  expect(findLog(unavailableLogs, "reference_fix.unavailable", {
    requestId: "unavailable-request",
    reason: "no_numbered_entries",
  })).toBeTruthy();
});

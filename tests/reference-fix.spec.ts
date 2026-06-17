import { expect, test } from "@playwright/test";
import { buildReferenceFix, type ReferenceCheckJson } from "../app/api/check/reference-fix";

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
  ), { filename: "paper.pdf", fetchImpl });

  expect(result.status).toBe("generated");
  expect(result.markdown).toContain("# CEUR Reference Fix");
  expect(result.markdown).toContain("| High confidence | 1 |");
  expect(result.markdown).toContain("doi:10.1145/1188913.1188915");
  expect(result.markdown).toContain("High-confidence metadata match");
  expect(result.markdown).toContain("## BibTeX Export");
  expect(result.markdown).toContain("## CSL-JSON Export");
});

test("still generates low-confidence fixes with review notes when lookup fails", async () => {
  const fetchImpl = (async () => new Response("{}", { status: 404 })) as typeof fetch;
  const result = await buildReferenceFix(referenceData(
    "Unknown Author, Incomplete but useful source title, 2024. http://example.com/source.",
  ), { filename: "paper.pdf", fetchImpl });

  expect(result.status).toBe("generated");
  expect(result.markdown).toContain("| Low confidence | 1 |");
  expect(result.markdown).toContain("Review required before inserting into the manuscript.");
  expect(result.markdown).toContain("URL: http://example.com/source");
});


test("passes an abort signal to metadata fetches and falls back when lookup fails", async () => {
  let sawSignal = false;
  const fetchImpl = (async (_url: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    sawSignal = Boolean(init?.signal);
    throw new Error("metadata unavailable");
  }) as typeof fetch;

  const result = await buildReferenceFix(referenceData(
    "Unknown Author, Incomplete but useful source title, 2024. http://example.com/source.",
  ), { filename: "paper.pdf", fetchImpl });

  expect(sawSignal).toBe(true);
  expect(result.status).toBe("generated");
  expect(result.markdown).toContain("| Low confidence | 1 |");
  expect(result.markdown).toContain("Review required before inserting into the manuscript.");
});

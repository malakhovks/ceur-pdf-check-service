import { Cite } from "@citation-js/core";
import "@citation-js/plugin-bibtex";
import "@citation-js/plugin-csl";

export type ReferenceEntryData = {
  label: number;
  text: string;
  errors?: string[];
};

export type ReferenceCheckResultData = {
  name: string;
  reference_count: number;
  errors: string[];
  reference_section?: string | null;
  entries?: ReferenceEntryData[];
};

export type ReferenceCheckJson = {
  version?: number;
  results?: ReferenceCheckResultData[];
};

export type ReferenceFixResult = {
  status: "generated" | "skipped" | "unavailable";
  markdown?: string;
  warning?: string;
};

type FetchLike = typeof fetch;

type CslName = {
  given?: string;
  family?: string;
  literal?: string;
};

type CslItem = {
  id?: string;
  type?: string;
  title?: string;
  author?: CslName[];
  editor?: CslName[];
  issued?: { "date-parts"?: number[][] };
  "container-title"?: string;
  publisher?: string;
  volume?: string;
  issue?: string;
  page?: string;
  DOI?: string;
  URL?: string;
};

type Candidate = {
  item: CslItem;
  source: "Crossref" | "DataCite" | "Extracted text";
  sourceUrl?: string;
  confidence: number;
};

type Repair = {
  label: number;
  original: string;
  suggestion: string;
  confidence: number;
  confidenceLabel: "high" | "medium" | "low";
  provenance: string;
  sourceUrl?: string;
  reviewRequired: boolean;
  cslItem: CslItem;
};

const DOI_RE = /(?:https?:\/\/(?:dx\.)?doi\.org\/)?(10\.\d{4,9}\/[^\s<>"']+)/i;
const URL_RE = /https?:\/\/[^\s<>()\]]+/i;
const YEAR_RE = /\b(?:19|20)\d{2}[a-z]?\b/i;
const TRAILING_PUNCTUATION_RE = /[.,;:)\]}]+$/;
const METADATA_FETCH_TIMEOUT_MS = 8_000;

function normalizeSpaces(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function markdownEscape(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/`/g, "\\`");
}

function normalizeDoi(value: string | undefined | null) {
  if (!value) return "";
  const match = value.match(DOI_RE);
  return (match?.[1] || value)
    .replace(/^doi:\s*/i, "")
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
    .replace(TRAILING_PUNCTUATION_RE, "")
    .toLowerCase();
}

function extractDoi(text: string) {
  return normalizeDoi(text.match(DOI_RE)?.[0]);
}

function extractUrl(text: string) {
  return text.match(URL_RE)?.[0]?.replace(TRAILING_PUNCTUATION_RE, "") || "";
}

function extractYear(text: string) {
  const match = text.match(YEAR_RE)?.[0];
  return match ? Number(match.slice(0, 4)) : undefined;
}

function words(value: string) {
  return normalizeSpaces(value)
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/10\.\d{4,9}\/\S+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((word) => word.length > 2);
}

function tokenOverlap(left: string, right: string) {
  const leftWords = new Set(words(left));
  const rightWords = new Set(words(right));
  if (!leftWords.size || !rightWords.size) {
    return 0;
  }

  let shared = 0;
  for (const word of leftWords) {
    if (rightWords.has(word)) {
      shared += 1;
    }
  }

  return shared / Math.max(leftWords.size, rightWords.size);
}

function firstString(value: unknown) {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : "";
  }

  return typeof value === "string" ? value : "";
}

function crossrefItemFromMessage(message: Record<string, unknown>): CslItem {
  return {
    id: normalizeDoi(String(message.DOI || "")) || undefined,
    type: String(message.type || "article-journal"),
    title: firstString(message.title),
    author: Array.isArray(message.author) ? message.author as CslName[] : undefined,
    editor: Array.isArray(message.editor) ? message.editor as CslName[] : undefined,
    issued: message.issued as CslItem["issued"],
    "container-title": firstString(message["container-title"]),
    publisher: typeof message.publisher === "string" ? message.publisher : undefined,
    volume: typeof message.volume === "string" ? message.volume : undefined,
    issue: typeof message.issue === "string" ? message.issue : undefined,
    page: typeof message.page === "string" ? message.page : undefined,
    DOI: normalizeDoi(String(message.DOI || "")) || undefined,
    URL: typeof message.URL === "string" ? message.URL : undefined,
  };
}

function dataciteNames(creators: unknown): CslName[] | undefined {
  if (!Array.isArray(creators)) {
    return undefined;
  }

  return creators.map((creator) => {
    if (!creator || typeof creator !== "object") {
      return {};
    }
    const value = creator as { givenName?: unknown; familyName?: unknown; name?: unknown };
    return {
      given: typeof value.givenName === "string" ? value.givenName : undefined,
      family: typeof value.familyName === "string" ? value.familyName : undefined,
      literal: !value.familyName && typeof value.name === "string" ? value.name : undefined,
    };
  });
}

function dataciteItemFromAttributes(attributes: Record<string, unknown>, doi: string): CslItem {
  const titles = Array.isArray(attributes.titles) ? attributes.titles as Array<Record<string, unknown>> : [];
  const title = titles.find((candidate) => typeof candidate.title === "string")?.title as string | undefined;
  const container = typeof attributes.container === "string" ? attributes.container : undefined;
  const publisher = typeof attributes.publisher === "string" ? attributes.publisher : undefined;
  const year = Number(attributes.publicationYear);

  return {
    id: doi || undefined,
    type: "article-journal",
    title,
    author: dataciteNames(attributes.creators),
    issued: Number.isFinite(year) ? { "date-parts": [[year]] } : undefined,
    "container-title": container,
    publisher,
    DOI: doi || undefined,
    URL: typeof attributes.url === "string" ? attributes.url : undefined,
  };
}

async function fetchJson(fetchImpl: FetchLike, url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), METADATA_FETCH_TIMEOUT_MS);

  try {
    const response = await fetchImpl(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "ceur-pdf-check-service/0.1 (mailto:no-reply@example.com)",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    return response.json().catch(() => null) as Promise<unknown | null>;
  } finally {
    clearTimeout(timeout);
  }
}

function scoreCandidate(entryText: string, candidate: CslItem, entryDoi: string, source: Candidate["source"]) {
  const candidateDoi = normalizeDoi(candidate.DOI);
  if (entryDoi && candidateDoi && entryDoi === candidateDoi) {
    return source === "Extracted text" ? 0.65 : 0.98;
  }

  const titleScore = candidate.title ? tokenOverlap(entryText, candidate.title) : 0;
  const containerScore = candidate["container-title"] ? tokenOverlap(entryText, candidate["container-title"]) : 0;
  const entryYear = extractYear(entryText);
  const candidateYear = candidate.issued?.["date-parts"]?.[0]?.[0];
  const yearScore = entryYear && candidateYear && entryYear === candidateYear ? 0.16 : 0;
  const sourceBoost = source === "Extracted text" ? 0 : 0.14;
  return Math.min(0.9, titleScore * 0.58 + containerScore * 0.12 + yearScore + sourceBoost);
}

async function crossrefCandidates(fetchImpl: FetchLike, entry: ReferenceEntryData, doi: string): Promise<Candidate[]> {
  const candidates: Candidate[] = [];

  if (doi) {
    const exact = await fetchJson(fetchImpl, `https://api.crossref.org/works/${encodeURIComponent(doi)}`);
    const message = exact && typeof exact === "object" && "message" in exact ? (exact as { message?: unknown }).message : null;
    if (message && typeof message === "object") {
      const item = crossrefItemFromMessage(message as Record<string, unknown>);
      candidates.push({
        item,
        source: "Crossref",
        sourceUrl: `https://doi.org/${doi}`,
        confidence: scoreCandidate(entry.text, item, doi, "Crossref"),
      });
    }
  }

  if (!candidates.length) {
    const query = encodeURIComponent(entry.text.slice(0, 450));
    const search = await fetchJson(fetchImpl, `https://api.crossref.org/works?query.bibliographic=${query}&rows=3`);
    const message = search && typeof search === "object" && "message" in search ? (search as { message?: unknown }).message : null;
    const items = message && typeof message === "object" && Array.isArray((message as { items?: unknown }).items)
      ? (message as { items: Array<Record<string, unknown>> }).items
      : [];

    for (const rawItem of items) {
      const item = crossrefItemFromMessage(rawItem);
      candidates.push({
        item,
        source: "Crossref",
        sourceUrl: item.DOI ? `https://doi.org/${item.DOI}` : item.URL,
        confidence: scoreCandidate(entry.text, item, doi, "Crossref"),
      });
    }
  }

  return candidates;
}

async function dataciteCandidates(fetchImpl: FetchLike, entry: ReferenceEntryData, doi: string): Promise<Candidate[]> {
  if (!doi) {
    return [];
  }

  const result = await fetchJson(fetchImpl, `https://api.datacite.org/dois/${encodeURIComponent(doi)}`);
  const data = result && typeof result === "object" && "data" in result ? (result as { data?: unknown }).data : null;
  const attributes = data && typeof data === "object" && "attributes" in data ? (data as { attributes?: unknown }).attributes : null;

  if (!attributes || typeof attributes !== "object") {
    return [];
  }

  const item = dataciteItemFromAttributes(attributes as Record<string, unknown>, doi);
  return [{
    item,
    source: "DataCite",
    sourceUrl: `https://doi.org/${doi}`,
    confidence: scoreCandidate(entry.text, item, doi, "DataCite"),
  }];
}

function guessedTitle(text: string) {
  const withoutLabel = text.replace(/^\s*\[\d+\]\s*/, "");
  const pieces = withoutLabel.split(",");
  if (pieces.length >= 2) {
    return normalizeSpaces(pieces[1]);
  }

  return normalizeSpaces(withoutLabel).slice(0, 180);
}

function heuristicItem(entry: ReferenceEntryData): CslItem {
  const doi = extractDoi(entry.text);
  const url = extractUrl(entry.text);
  const year = extractYear(entry.text);
  return {
    id: `ref-${entry.label}`,
    type: "article-journal",
    title: guessedTitle(entry.text),
    issued: year ? { "date-parts": [[year]] } : undefined,
    DOI: doi || undefined,
    URL: url || undefined,
  };
}

async function candidateForEntry(fetchImpl: FetchLike, entry: ReferenceEntryData): Promise<Candidate> {
  const doi = extractDoi(entry.text);
  const candidates = [
    ...(await crossrefCandidates(fetchImpl, entry, doi).catch(() => [])),
    ...(await dataciteCandidates(fetchImpl, entry, doi).catch(() => [])),
  ].sort((left, right) => right.confidence - left.confidence);

  if (candidates[0]) {
    return candidates[0];
  }

  const item = heuristicItem(entry);
  return {
    item,
    source: "Extracted text",
    confidence: item.DOI || item.URL || item.title ? 0.34 : 0.18,
  };
}

function initials(given: string) {
  return given
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase()}.`)
    .join(" ");
}

function formatNames(names: CslName[] | undefined) {
  if (!names?.length) {
    return "";
  }

  return names
    .map((name) => {
      if (name.literal) return name.literal;
      const family = name.family || "";
      const given = name.given ? initials(name.given) : "";
      return normalizeSpaces([given, family].filter(Boolean).join(" "));
    })
    .filter(Boolean)
    .join(", ");
}

function itemYear(item: CslItem) {
  return item.issued?.["date-parts"]?.[0]?.[0];
}

function formatCeurReference(item: CslItem, fallbackText: string) {
  const author = formatNames(item.author) || formatNames(item.editor);
  const title = normalizeSpaces(item.title || guessedTitle(fallbackText));
  const container = normalizeSpaces(item["container-title"] || item.publisher || "");
  const year = itemYear(item) || extractYear(fallbackText);
  const volume = item.volume ? ` ${item.volume}` : "";
  const issue = item.issue ? `(${item.issue})` : "";
  const pages = item.page ? ` ${item.page.replace(/\s*-\s*/g, "-")}` : "";
  const doi = normalizeDoi(item.DOI) || extractDoi(fallbackText);
  const url = (item.URL || extractUrl(fallbackText)).replace(TRAILING_PUNCTUATION_RE, "");

  const segments: string[] = [];
  if (author) {
    segments.push(author);
  }
  if (title) {
    segments.push(title);
  }

  const publication = normalizeSpaces(`${container}${volume}${issue}${year ? ` (${year})` : ""}${pages}`);
  if (publication) {
    segments.push(publication);
  } else if (year) {
    segments.push(String(year));
  }

  let rendered = segments.join(", ").replace(/\s+\./g, ".").replace(/\.+$/, "");
  if (!rendered) {
    rendered = normalizeSpaces(fallbackText).replace(/^\[\d+\]\s*/, "").replace(/\.+$/, "");
  }

  if (doi) {
    rendered += `. doi:${doi}`;
  } else if (url) {
    rendered += `. URL: ${url}`;
  }

  return `${rendered}.`;
}

function confidenceLabel(confidence: number): Repair["confidenceLabel"] {
  if (confidence >= 0.86) return "high";
  if (confidence >= 0.58) return "medium";
  return "low";
}

function buildCslExport(items: CslItem[]) {
  return JSON.stringify(items, null, 2);
}

function buildBibtexExport(items: CslItem[]) {
  try {
    return new Cite(items).format("bibtex").trim();
  } catch {
    return "";
  }
}

function repairSummary(repairs: Repair[]) {
  return {
    high: repairs.filter((repair) => repair.confidenceLabel === "high").length,
    medium: repairs.filter((repair) => repair.confidenceLabel === "medium").length,
    low: repairs.filter((repair) => repair.confidenceLabel === "low").length,
  };
}

function renderMarkdown(filename: string, repairs: Repair[], warnings: string[]) {
  const counts = repairSummary(repairs);
  const cslItems = repairs.map((repair) => repair.cslItem);
  const bibtex = buildBibtexExport(cslItems);
  const cslJson = buildCslExport(cslItems);
  const now = new Date().toISOString();

  const lines = [
    "# CEUR Reference Fix",
    "",
    "| Field | Value |",
    "| --- | --- |",
    `| Manuscript | ${markdownEscape(filename || "manuscript")} |`,
    `| References detected | ${repairs.length} |`,
    `| Repaired suggestions | ${repairs.length} |`,
    `| High confidence | ${counts.high} |`,
    `| Medium confidence | ${counts.medium} |`,
    `| Low confidence | ${counts.low} |`,
    `| Generated | ${now} |`,
    "",
    "## Replacement References Section",
    "",
    "```text",
    "References",
    ...repairs.map((repair) => `[${repair.label}] ${repair.suggestion}`),
    "```",
    "",
    "## Per-reference Repairs",
    "",
  ];

  for (const repair of repairs) {
    lines.push(
      `### [${repair.label}]`,
      "",
      `- Confidence: ${repair.confidenceLabel} (${Math.round(repair.confidence * 100)}%)`,
      `- Provenance: ${repair.provenance}${repair.sourceUrl ? ` (${repair.sourceUrl})` : ""}`,
      `- Review note: ${repair.reviewRequired ? "Review required before inserting into the manuscript." : "High-confidence metadata match; still verify before submission."}`,
      "",
      "**Original**",
      "",
      "```text",
      repair.original,
      "```",
      "",
      "**Suggested CEUR reference**",
      "",
      "```text",
      `[${repair.label}] ${repair.suggestion}`,
      "```",
      "",
    );
  }

  lines.push(
    "## BibTeX Export",
    "",
    "```bibtex",
    bibtex || "% BibTeX export unavailable for the reconstructed references.",
    "```",
    "",
    "## CSL-JSON Export",
    "",
    "```json",
    cslJson,
    "```",
    "",
    "## Notes",
    "",
    "- This bundle is for manual insertion; the uploaded manuscript was not rewritten.",
    "- Medium- and low-confidence suggestions must be reviewed against official source metadata.",
    "- CEUR papers should cite the stable CEUR paper URL when no DOI exists for the individual paper.",
  );

  for (const warning of warnings) {
    lines.push(`- ${warning}`);
  }

  return lines.join("\n");
}

export async function buildReferenceFix(
  referenceData: ReferenceCheckJson,
  options: { filename: string; fetchImpl?: FetchLike },
): Promise<ReferenceFixResult> {
  const failedResults = (referenceData.results || []).filter((result) => result.errors?.length);
  const entries = failedResults.flatMap((result) => result.entries || []);

  if (!failedResults.length) {
    return { status: "skipped", warning: "No reference issues were detected." };
  }

  if (!entries.length) {
    return {
      status: "unavailable",
      markdown: [
        "# CEUR Reference Fix",
        "",
        "The reference checker found reference issues, but no numbered reference entries were extracted.",
        "",
        "## Notes",
        "",
        "- Add a `References` section with bracketed numeric labels such as `[1]`, `[2]`, `[3]`.",
        "- Run the check again with Automatic reference fix enabled after references are present.",
      ].join("\n"),
      warning: "No numbered reference entries were available for reconstruction.",
    };
  }

  const fetchImpl = options.fetchImpl || fetch;
  const repairs: Repair[] = [];
  const warnings: string[] = [];

  for (const entry of entries) {
    const candidate = await candidateForEntry(fetchImpl, entry);
    const confidence = Number(candidate.confidence.toFixed(2));
    const label = confidenceLabel(confidence);
    const suggestion = formatCeurReference(candidate.item, entry.text);
    const cslItem = {
      ...candidate.item,
      id: candidate.item.id || `ref-${entry.label}`,
    };

    repairs.push({
      label: entry.label,
      original: entry.text,
      suggestion,
      confidence,
      confidenceLabel: label,
      provenance: candidate.source,
      sourceUrl: candidate.sourceUrl,
      reviewRequired: label !== "high",
      cslItem,
    });
  }

  if (repairs.some((repair) => repair.provenance === "Extracted text")) {
    warnings.push("Some suggestions were reconstructed from extracted text because external metadata lookup did not return a reliable match.");
  }

  return {
    status: "generated",
    markdown: renderMarkdown(options.filename, repairs, warnings),
  };
}

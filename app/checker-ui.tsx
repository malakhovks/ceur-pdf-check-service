"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  AlertTriangle,
  CheckCircle2,
  Code2,
  Download,
  Eye,
  ExternalLink,
  FileText,
  GitBranch,
  LoaderCircle,
  LogOut,
  Moon,
  Settings,
  ShieldCheck,
  Sun,
  UploadCloud,
  X,
  XCircle,
} from "lucide-react";

type Language = "uk" | "en";
type ReportView = "preview" | "source";
type ReportTab = "check-report" | "references-fix";
type HelpTab = "features" | "settings";
type Theme = "light" | "dark";

type ReferenceFixResponse = {
  status: "generated" | "skipped" | "unavailable";
  markdown?: string;
  warning?: string;
};

export type SignedInUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

type CheckResponse = {
  requestId?: string;
  filename?: string;
  status?: string;
  referenceStatus?: string;
  findingCount?: number | null;
  exitCode?: number | null;
  report?: string;
  referenceFix?: ReferenceFixResponse;
  error?: string;
  queuedMs?: number;
};

type StoredSettings = {
  automaticReferenceFix: boolean;
};

type StoredAnalysis = {
  filename: string;
  status: string | null;
  referenceStatus: string | null;
  findingCount: number | null;
  exitCode: number | null;
  report: string;
  referenceFixMarkdown: string;
  referenceFixStatus: ReferenceFixResponse["status"] | "";
  referenceFixWarning: string;
  reportTab: ReportTab;
  reportView: ReportView;
  updatedAt: string;
};

type Translation = {
  locale: string;
  meta: {
    title: string;
    subtitle: string;
    github: string;
    developer: string;
    info: string;
    language: string;
    theme: string;
    lightTheme: string;
    darkTheme: string;
    signOut: string;
  };
  upload: {
    eyebrow: string;
    title: string;
    support: string;
    noFileSelected: string;
  };
  stats: {
    file: string;
    ready: string;
    empty: string;
    noFile: string;
    status: string;
    findings: string;
    exitCode: string;
    notAvailable: string;
    allTests: string;
    activeTests: string;
  };
  actions: {
    run: string;
    checking: string;
    download: string;
    downloadReferenceFix: string;
  };
  report: {
    eyebrow: string;
    title: string;
    empty: string;
    fixEmpty: string;
    fixDisabled: string;
    ariaLabel: string;
    fixAriaLabel: string;
    checkReport: string;
    referencesFix: string;
    viewMode: string;
    preview: string;
    source: string;
  };
  help: {
    modalTitle: string;
    featuresTab: string;
    settingsTab: string;
    title: string;
    intro: string;
    features: string[];
    settingsTitle: string;
    automaticReferenceFix: string;
    automaticReferenceFixDescription: string;
    referenceTitle: string;
    referenceIntro: string;
    referenceFixes: string[];
    promptTitle: string;
    promptSteps: string[];
    promptDownload: string;
    promptDownloadAria: string;
    close: string;
  };
  status: Record<string, string>;
  errors: Record<string, string>;
};

const translations: Record<Language, Translation> = {
  uk: {
    locale: "uk",
    meta: {
      title: "CEUR PDF Check",
      subtitle: "Перевірка рукопису для CEUR-WS",
      github: "GitHub",
      developer: "Розробник",
      info: "Налаштування",
      language: "Мова інтерфейсу",
      theme: "Тема інтерфейсу",
      lightTheme: "Світла",
      darkTheme: "Темна",
      signOut: "Вийти",
    },
    upload: {
      eyebrow: "Завантаження рукопису",
      title: "Виберіть або перетягніть рукопис",
      support: "PDF, DOCX, DOC, ODT",
      noFileSelected: "Файл не вибрано",
    },
    stats: {
      file: "Файл",
      ready: "Готово",
      empty: "Порожньо",
      noFile: "Файл відсутній",
      status: "Статус",
      findings: "Знахідки",
      exitCode: "Код виходу",
      notAvailable: "Н/Д",
      allTests: "усі тести",
      activeTests: "тести CEUR виконуються",
    },
    actions: {
      run: "Запустити перевірку",
      checking: "Перевірка",
      download: "Завантажити report.md",
      downloadReferenceFix: "Завантажити references_fix.md",
    },
    report: {
      eyebrow: "Звіт",
      title: "Markdown-вивід перевірки",
      empty: "Завантажте рукопис і запустіть перевірку CEUR, щоб прочитати Markdown-звіт тут.",
      fixEmpty: "Виправлення літератури зʼявиться тут після перевірки рукопису з помилками у списку посилань.",
      fixDisabled: "Автоматичне виправлення літератури вимкнено. Увімкніть його в Налаштуваннях і запустіть перевірку ще раз, щоб отримати Markdown-пакет виправлень.",
      ariaLabel: "Markdown-звіт перевірки",
      fixAriaLabel: "Markdown-виправлення літератури",
      checkReport: "Звіт перевірки",
      referencesFix: "Література",
      viewMode: "Вигляд звіту",
      preview: "Перегляд",
      source: "Код",
    },
    help: {
      modalTitle: "Налаштування",
      featuresTab: "Можливості",
      settingsTab: "Налаштування",
      title: "Можливості застосунку",
      intro: "CEUR PDF Check допомагає швидко перевірити рукопис перед поданням до CEUR-WS.",
      features: [
        "Завантажуйте PDF, DOCX, DOC або ODT рукописи.",
        "Запускайте офіційну перевірку CEUR і перевірку списку посилань.",
        "Читайте Markdown-звіт у режимі перегляду або сирого коду.",
        "Завантажуйте оригінальний Markdown-звіт з назвою за рукописом.",
      ],
      settingsTitle: "Параметри перевірки",
      automaticReferenceFix: "Автоматичне виправлення літератури",
      automaticReferenceFixDescription: "Коли перевірка знаходить помилки у списку літератури, створювати Markdown-пакет із CEUR-форматованими замінами, оцінками впевненості, джерелами та експортом BibTeX/CSL-JSON.",
      referenceTitle: "Як виправити помилки в Reference",
      referenceIntro: "Якщо звіт показує помилки Reference, виправте список посилань у рукописі та запустіть перевірку ще раз.",
      referenceFixes: [
        "Додайте розділ References і використовуйте послідовну нумерацію [1], [2], [3].",
        "Приберіть сирий BibTeX або LaTeX-код зі списку посилань.",
        "Перевірте авторів, назви, рік, видання та сторінки за офіційними джерелами.",
        "Для наукових джерел додавайте doi:10...; для вебресурсів додавайте URL: і дату доступу.",
      ],
      promptTitle: "Промпт для ChatGPT",
      promptSteps: [
        "Завантажте файл ceur_ws_reference_prompt.md за посиланням нижче.",
        "Завантажте цей Markdown-файл у діалог ChatGPT.",
        "У текстовому полі ChatGPT вставте список URL або DOI та надішліть запит.",
        "Перевірте результат і вставте готові CEUR-WS посилання у рукопис.",
      ],
      promptDownload: "Завантажити ceur_ws_reference_prompt.md",
      promptDownloadAria: "Завантажити промпт ceur_ws_reference_prompt.md для ChatGPT",
      close: "Закрити",
    },
    status: {
      waiting: "Очікування",
      pass: "Пройдено",
      fail: "Знахідки",
      error: "Помилка",
      unknown: "Невідомо",
      running: "Виконується",
      checking: "Перевірка",
    },
    errors: {
      unsupportedFormat: "Можна перевіряти лише файли PDF, DOCX, DOC або ODT.",
      unreadable: "API перевірки повернув нечитабельну відповідь.",
      apiFailed: "API перевірки не спрацював.",
      checkerFailed: "Перевірка не спрацювала.",
      busy: "Перевірник зайнятий. Спробуйте ще раз трохи пізніше.",
      queuedTooLong: "Перевірник зайнятий, і запит очікував слот занадто довго.",
      noReport: "Перевірник завершився без створення Markdown-звіту.",
      authRequired: "Потрібна автентифікація.",
      uploadParse: "Не вдалося прочитати завантаження.",
      missingUpload: "Завантажте файл PDF, DOCX, DOC або ODT, щоб запустити перевірку.",
      executableMissing: "Виконуваний файл ceur-pdf-check недоступний у PATH.",
      timeout: "Перевірник перевищив ліміт часу.",
      unexpected: "Сталася неочікувана помилка перевірника.",
      uploadLimit: "Завантаження рукопису обмежене 30 МБ.",
      emptyUpload: "Завантажений рукопис порожній.",
      fakePdf: "Завантажений файл не схожий на підтримуваний рукопис.",
    },
  },
  en: {
    locale: "en",
    meta: {
      title: "CEUR PDF Check",
      subtitle: "Manuscript validation report generator",
      github: "GitHub",
      developer: "Developer",
      info: "Settings",
      language: "Interface language",
      theme: "Interface theme",
      lightTheme: "Light",
      darkTheme: "Dark",
      signOut: "Sign out",
    },
    upload: {
      eyebrow: "Upload manuscript",
      title: "Choose or drop a manuscript",
      support: "PDF, DOCX, DOC, ODT",
      noFileSelected: "No file selected",
    },
    stats: {
      file: "File",
      ready: "Ready",
      empty: "Empty",
      noFile: "No file",
      status: "Status",
      findings: "Findings",
      exitCode: "Exit code",
      notAvailable: "N/A",
      allTests: "all tests",
      activeTests: "CEUR tests active",
    },
    actions: {
      run: "Run check",
      checking: "Checking",
      download: "Download report.md",
      downloadReferenceFix: "Download references_fix.md",
    },
    report: {
      eyebrow: "Report",
      title: "Markdown validation output",
      empty: "Upload a manuscript and run the CEUR check to read the generated Markdown report here.",
      fixEmpty: "The References fix will appear here after a check finds reference-list issues.",
      fixDisabled: "Automatic reference fix is off. Enable it in Settings and run the check again to generate a Markdown repair bundle.",
      ariaLabel: "Markdown validation report",
      fixAriaLabel: "Markdown References fix",
      checkReport: "Check report",
      referencesFix: "References fix",
      viewMode: "Report view",
      preview: "Preview",
      source: "Source",
    },
    help: {
      modalTitle: "Settings",
      featuresTab: "App features",
      settingsTab: "Settings",
      title: "App features",
      intro: "CEUR PDF Check helps validate a manuscript before CEUR-WS submission.",
      features: [
        "Upload PDF, DOCX, DOC, or ODT manuscripts.",
        "Run the official CEUR checker and the rendered reference check.",
        "Review the Markdown report as rendered preview or raw source.",
        "Download the original Markdown report with a manuscript-based filename.",
      ],
      settingsTitle: "Check settings",
      automaticReferenceFix: "Automatic reference fix",
      automaticReferenceFixDescription: "When reference errors are found, generate a Markdown repair bundle with CEUR-formatted replacements, confidence scores, provenance, and BibTeX/CSL-JSON export.",
      referenceTitle: "How to fix Reference mistakes",
      referenceIntro: "If the report shows Reference errors, fix the reference list in the manuscript and run the check again.",
      referenceFixes: [
        "Add a References section and use sequential bracketed labels: [1], [2], [3].",
        "Remove raw BibTeX or LaTeX code from the rendered reference list.",
        "Verify authors, titles, year, venue, and pages against official sources.",
        "Use doi:10... for scholarly sources; use URL: and an access date for web resources.",
      ],
      promptTitle: "ChatGPT prompt",
      promptSteps: [
        "Download ceur_ws_reference_prompt.md from the link below.",
        "Upload this Markdown file to a ChatGPT dialog.",
        "Paste the list of URLs or DOIs into the ChatGPT text field and send it.",
        "Review the result and copy the generated CEUR-WS references into the manuscript.",
      ],
      promptDownload: "Download ceur_ws_reference_prompt.md",
      promptDownloadAria: "Download the ceur_ws_reference_prompt.md prompt for ChatGPT",
      close: "Close",
    },
    status: {
      waiting: "Waiting",
      pass: "Passed",
      fail: "Findings",
      error: "Error",
      unknown: "Unknown",
      running: "Running",
      checking: "Checking",
    },
    errors: {
      unsupportedFormat: "Only PDF, DOCX, DOC, or ODT files can be checked.",
      unreadable: "The checker API returned an unreadable response.",
      apiFailed: "The checker API failed.",
      checkerFailed: "The checker failed.",
      busy: "The checker is busy. Try again shortly.",
      queuedTooLong: "The checker is busy and this request waited too long for a slot.",
      noReport: "The checker finished without producing a Markdown report.",
      authRequired: "Authentication required.",
      uploadParse: "The upload could not be parsed.",
      missingUpload: "Upload a PDF, DOCX, DOC, or ODT file to run the check.",
      executableMissing: "The ceur-pdf-check executable is not available on PATH.",
      timeout: "The checker exceeded the time limit.",
      unexpected: "Unexpected checker failure.",
      uploadLimit: "Manuscript uploads are limited to 30 MB.",
      emptyUpload: "The uploaded manuscript is empty.",
      fakePdf: "The uploaded file does not look like a supported manuscript.",
    },
  },
};

const errorTranslations: Record<string, keyof Translation["errors"]> = {
  "Only PDF, DOCX, DOC, or ODT files can be checked.": "unsupportedFormat",
  "The checker API returned an unreadable response.": "unreadable",
  "The checker API failed.": "apiFailed",
  "The checker failed.": "checkerFailed",
  "The checker is busy. Try again shortly.": "busy",
  "The checker is busy and this request waited too long for a slot.": "queuedTooLong",
  "The checker finished without producing a Markdown report.": "noReport",
  "Authentication required.": "authRequired",
  "The upload could not be parsed.": "uploadParse",
  "Upload a PDF, DOCX, DOC, or ODT file to run the check.": "missingUpload",
  "The ceur-pdf-check executable is not available on PATH.": "executableMissing",
  "The checker timed out after 110 seconds.": "timeout",
  "Unexpected checker failure.": "unexpected",
  "Manuscript uploads are limited to 30 MB.": "uploadLimit",
  "The uploaded manuscript is empty.": "emptyUpload",
  "The uploaded file does not look like a supported manuscript.": "fakePdf",
};

const githubRepoUrl = "https://github.com/malakhovks/ceur-pdf-check-service";
const developerCreditUrl = "https://linktr.ee/malakhovks";
const themeStorageKey = "ceur-pdf-check-theme";
const settingsStorageKey = "ceur-pdf-check-settings";
const latestAnalysisStorageKey = "ceur-pdf-check-latest-analysis";
const supportedManuscriptExtensions = [".pdf", ".docx", ".doc", ".odt"];
const supportedManuscriptMimeTypes = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.oasis.opendocument.text",
]);

function isSupportedManuscript(file: File) {
  const lowerName = file.name.toLowerCase();
  return supportedManuscriptExtensions.some((extension) => lowerName.endsWith(extension)) || supportedManuscriptMimeTypes.has(file.type.toLowerCase());
}

function reportDownloadFilename(filename: string | null | undefined) {
  if (!filename) {
    return "report.md";
  }

  const basename = filename.split(/[/\\]/).pop() || "";
  const lowerName = basename.toLowerCase();
  const extension = supportedManuscriptExtensions.find((candidate) => lowerName.endsWith(candidate));
  const stem = extension ? basename.slice(0, -extension.length) : basename;
  const normalized = stem.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^\.+$/, "").slice(0, 120);

  return normalized ? `report_${normalized}.md` : "report.md";
}

function referenceFixDownloadFilename(filename: string | null | undefined) {
  const reportFilename = reportDownloadFilename(filename);
  return reportFilename === "report.md"
    ? "references_fix.md"
    : reportFilename.replace(/^report_/, "references_fix_");
}

function readReferenceStatusFromReport(report: string) {
  const match = report.match(/\| Reference status \| ([^|]+) \|/);
  return match ? match[1].trim() : null;
}

function hasReferenceIssues(report: string, referenceStatus: string | null) {
  return referenceStatus === "fail" || readReferenceStatusFromReport(report) === "fail";
}

function parseStoredSettings(value: string | null): StoredSettings {
  if (!value) {
    return { automaticReferenceFix: false };
  }

  try {
    const parsed = JSON.parse(value) as Partial<StoredSettings>;
    return { automaticReferenceFix: parsed.automaticReferenceFix === true };
  } catch {
    return { automaticReferenceFix: false };
  }
}

function parseStoredAnalysis(value: string | null): StoredAnalysis | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<StoredAnalysis>;
    if (typeof parsed.report !== "string") {
      return null;
    }

    return {
      filename: typeof parsed.filename === "string" ? parsed.filename : "",
      status: typeof parsed.status === "string" ? parsed.status : null,
      referenceStatus: typeof parsed.referenceStatus === "string" ? parsed.referenceStatus : null,
      findingCount: typeof parsed.findingCount === "number" ? parsed.findingCount : null,
      exitCode: typeof parsed.exitCode === "number" ? parsed.exitCode : null,
      report: parsed.report,
      referenceFixMarkdown: typeof parsed.referenceFixMarkdown === "string" ? parsed.referenceFixMarkdown : "",
      referenceFixStatus: parsed.referenceFixStatus === "generated" || parsed.referenceFixStatus === "skipped" || parsed.referenceFixStatus === "unavailable" ? parsed.referenceFixStatus : "",
      referenceFixWarning: typeof parsed.referenceFixWarning === "string" ? parsed.referenceFixWarning : "",
      reportTab: parsed.reportTab === "references-fix" ? "references-fix" : "check-report",
      reportView: parsed.reportView === "source" ? "source" : "preview",
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : "",
    };
  } catch {
    return null;
  }
}


function classNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const markdownComponents: Components = {
  h1({ node, className, ...props }) {
    return <h1 className={classNames("mb-3 text-xl font-semibold leading-tight text-heading", className)} {...props} />;
  },
  h2({ node, className, ...props }) {
    return <h2 className={classNames("mb-2 mt-5 text-lg font-semibold leading-tight text-heading", className)} {...props} />;
  },
  h3({ node, className, ...props }) {
    return <h3 className={classNames("mb-2 mt-4 text-base font-semibold leading-tight text-heading", className)} {...props} />;
  },
  p({ node, className, ...props }) {
    return <p className={classNames("mb-3", className)} {...props} />;
  },
  ul({ node, className, ...props }) {
    return <ul className={classNames("mb-4 list-disc space-y-1 pl-5", className)} {...props} />;
  },
  li({ node, className, ...props }) {
    return <li className={classNames("pl-1", className)} {...props} />;
  },
  table({ node, className, ...props }) {
    return (
      <div className="table-frame mb-4 overflow-x-auto rounded-[18px]">
        <table className={classNames("w-full min-w-[34rem] border-collapse text-left text-sm", className)} {...props} />
      </div>
    );
  },
  thead({ node, className, ...props }) {
    return <thead className={classNames("table-head text-xs uppercase", className)} {...props} />;
  },
  th({ node, className, ...props }) {
    return <th className={classNames("table-cell-border px-3 py-2 font-semibold", className)} {...props} />;
  },
  td({ node, className, ...props }) {
    return <td className={classNames("table-cell-border px-3 py-2 align-top", className)} {...props} />;
  },
  pre({ node, className, ...props }) {
    return <pre className={classNames("mb-4 overflow-x-auto rounded-[18px] bg-slate-950 p-3 text-xs leading-5 text-slate-100", className)} {...props} />;
  },
  code({ node, className, ...props }) {
    return <code className={classNames("code-inline rounded px-1 py-0.5 font-mono text-[0.85em]", className)} {...props} />;
  },
};

function statusLabel(status: string | null, t: Translation) {
  if (!status) return t.status.waiting;
  return t.status[status] || status;
}

function formatFileSize(file: File | null, t: Translation) {
  if (!file) return t.stats.noFile;
  if (file.size < 1024 * 1024) return `${Math.max(1, Math.round(file.size / 1024))} KB`;
  return `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
}

function translateError(message: string, t: Translation) {
  if (message.startsWith("The checker timed out after ")) {
    return t.errors.timeout;
  }

  const key = errorTranslations[message];
  return key ? t.errors[key] : message;
}

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function translateReportMetadata(section: string) {
  return section
    .replace(/^# CEUR PDF Check Report$/m, "# Звіт перевірки CEUR PDF")
    .replace(/^\| Field \| Value \|$/m, "| Поле | Значення |")
    .replace(/^\| Status \| pass \|$/m, "| Статус | Пройдено |")
    .replace(/^\| Status \| fail \|$/m, "| Статус | Знахідки |")
    .replace(/^\| Status \| unknown \|$/m, "| Статус | Невідомо |")
    .replace(/^\| Status \| error \|$/m, "| Статус | Помилка |")
    .replace(/^\| Generated \|/gm, "| Створено |")
    .replace(/^\| Input \|/gm, "| Вхід |")
    .replace(/^\| Manuscript count \|/gm, "| Кількість рукописів |")
    .replace(/^\| PDF count \|/gm, "| Кількість PDF |")
    .replace(/^\| Tests \|/gm, "| Тести |")
    .replace(/^\| Checker exit code \|/gm, "| Код виходу перевірника |")
    .replace(/^\| Finding lines \|/gm, "| Рядки знахідок |")
    .replace(/^\| Reference status \| pass \|$/m, "| Статус посилань | Пройдено |")
    .replace(/^\| Reference status \| fail \|$/m, "| Статус посилань | Знахідки |")
    .replace(/^\| Reference errors \|/gm, "| Помилки посилань |")
    .replace(/^## Input Manuscripts$/m, "## Вхідні рукописи")
    .replace(/^## Checked PDFs$/m, "## Перевірені PDF")
    .replace(/^## Reference Check$/m, "## Перевірка посилань")
    .replace(/^## Findings$/m, "## Знахідки")
    .replace(/^## Process Output$/m, "## Вивід процесу (англійською)")
    .replace(/No likely findings were detected in the CEUR checker output\./g, "У виводі перевірника CEUR не виявлено ймовірних знахідок.")
    .replace(/No reference errors were detected\./g, "Помилок у посиланнях не виявлено.")
    .replace(/No CEURART-style reference errors detected\./g, "Помилок формату CEURART у посиланнях не виявлено.")
    .replace(/The checker did not produce a Markdown report\./g, "Перевірник не створив Markdown-звіт.");
}

function translateReport(report: string, language: Language) {
  if (!report || language === "en") {
    return report;
  }

  const rawHeading = "## Raw CEUR Output";
  const rawIndex = report.indexOf(rawHeading);
  if (rawIndex === -1) {
    return translateReportMetadata(report);
  }

  const translatedReport = translateReportMetadata(report.slice(0, rawIndex).trimEnd());
  const rawOutput = report.slice(rawIndex + rawHeading.length).trimStart();
  return `${translatedReport}\n\n## Сирий вивід CEUR (англійською)\n${rawOutput}`;
}

function translateReferenceFixMarkdown(markdown: string, language: Language) {
  if (!markdown || language === "en") {
    return markdown;
  }

  return markdown
    .replace(/^# CEUR Reference Fix$/m, "# Виправлення літератури CEUR")
    .replace(/^\| Field \| Value \|$/m, "| Поле | Значення |")
    .replace(/^\| Manuscript \|/gm, "| Рукопис |")
    .replace(/^\| References detected \|/gm, "| Знайдено джерел |")
    .replace(/^\| Repaired suggestions \|/gm, "| Запропоновано виправлень |")
    .replace(/^\| High confidence \|/gm, "| Висока впевненість |")
    .replace(/^\| Medium confidence \|/gm, "| Середня впевненість |")
    .replace(/^\| Low confidence \|/gm, "| Низька впевненість |")
    .replace(/^\| Generated \|/gm, "| Створено |")
    .replace(/^## Replacement References Section$/m, "## Розділ літератури для заміни")
    .replace(/^## Per-reference Repairs$/m, "## Виправлення за джерелами")
    .replace(/^- Confidence: high \((\d+)%\)$/gm, "- Впевненість: висока ($1%)")
    .replace(/^- Confidence: medium \((\d+)%\)$/gm, "- Впевненість: середня ($1%)")
    .replace(/^- Confidence: low \((\d+)%\)$/gm, "- Впевненість: низька ($1%)")
    .replace(/^- Provenance: Extracted text/gm, "- Джерело: витягнутий текст")
    .replace(/^- Provenance:/gm, "- Джерело:")
    .replace(/^- Review note: Review required before inserting into the manuscript\.$/gm, "- Примітка до перевірки: потрібна ручна перевірка перед вставленням у рукопис.")
    .replace(/^- Review note: High-confidence metadata match; still verify before submission\.$/gm, "- Примітка до перевірки: метадані знайдено з високою впевненістю; все одно перевірте перед поданням.")
    .replace(/^\*\*Original\*\*$/gm, "**Оригінал**")
    .replace(/^\*\*Suggested CEUR reference\*\*$/gm, "**Запропоноване посилання CEUR**")
    .replace(/^## BibTeX Export$/m, "## Експорт BibTeX")
    .replace(/^## CSL-JSON Export$/m, "## Експорт CSL-JSON")
    .replace(/^## Notes$/m, "## Примітки")
    .replace(/^The reference checker found reference issues, but no numbered reference entries were extracted\.$/gm, "Перевірка літератури знайшла помилки, але не змогла витягнути нумеровані записи.")
    .replace(/^- Add a `References` section with bracketed numeric labels such as `\[1\]`, `\[2\]`, `\[3\]`\.$/gm, "- Додайте розділ `References` із числовими мітками у квадратних дужках, наприклад `[1]`, `[2]`, `[3]`.")
    .replace(/^- Run the check again with Automatic reference fix enabled after references are present\.$/gm, "- Запустіть перевірку ще раз після додавання джерел і ввімкнення автоматичного виправлення літератури.")
    .replace(/^- This bundle is for manual insertion; the uploaded manuscript was not rewritten\.$/gm, "- Цей пакет призначений для ручного вставлення; завантажений рукопис не змінювався.")
    .replace(/^- Medium- and low-confidence suggestions must be reviewed against official source metadata\.$/gm, "- Пропозиції із середньою та низькою впевненістю потрібно звірити з офіційними метаданими джерел.")
    .replace(/^- CEUR papers should cite the stable CEUR paper URL when no DOI exists for the individual paper\.$/gm, "- Для статей CEUR потрібно цитувати стабільну URL-адресу статті CEUR, якщо окрема стаття не має DOI.")
    .replace(/^- Some suggestions were reconstructed from extracted text because external metadata lookup did not return a reliable match\.$/gm, "- Частину пропозицій реконструйовано з витягнутого тексту, бо зовнішній пошук метаданих не повернув надійного збігу.")
    .replace(/^% BibTeX export unavailable for the reconstructed references\.$/gm, "% Експорт BibTeX недоступний для реконструйованих джерел.");
}

export default function CheckerUi({ user }: { user: SignedInUser }) {
  const [language, setLanguage] = useState<Language>("uk");
  const [theme, setTheme] = useState<Theme>("light");
  const [isThemeReady, setIsThemeReady] = useState(false);
  const [isStorageReady, setIsStorageReady] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [helpTab, setHelpTab] = useState<HelpTab>("features");
  const [automaticReferenceFix, setAutomaticReferenceFix] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState("");
  const [reportFilename, setReportFilename] = useState("");
  const [referenceStatus, setReferenceStatus] = useState<string | null>(null);
  const [referenceFixMarkdown, setReferenceFixMarkdown] = useState("");
  const [referenceFixStatus, setReferenceFixStatus] = useState<ReferenceFixResponse["status"] | "">("");
  const [referenceFixWarning, setReferenceFixWarning] = useState("");
  const [reportTab, setReportTab] = useState<ReportTab>("check-report");
  const [reportView, setReportView] = useState<ReportView>("preview");
  const [status, setStatus] = useState<string | null>(null);
  const [findingCount, setFindingCount] = useState<number | null>(null);
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [todayLabel, setTodayLabel] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const helpCloseRef = useRef<HTMLButtonElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const dragDepthRef = useRef(0);
  const requestSequenceRef = useRef(0);

  const t = translations[language];
  const selectedName = file ? file.name : t.upload.noFileSelected;
  const previewReport = useMemo(() => translateReport(report, language), [report, language]);
  const referenceIssuesDetected = hasReferenceIssues(report, referenceStatus);
  const referenceFixFallback = referenceIssuesDetected
    ? referenceFixWarning
      ? `# CEUR Reference Fix\n\n${referenceFixWarning}`
      : t.report.fixDisabled
    : t.report.fixEmpty;
  const activeMarkdown = reportTab === "references-fix"
    ? referenceFixMarkdown || referenceFixFallback
    : report;
  const previewReferenceFix = useMemo(() => translateReferenceFixMarkdown(activeMarkdown, language), [activeMarkdown, language]);
  const previewMarkdown = reportTab === "references-fix" ? previewReferenceFix : previewReport;
  const activeAriaLabel = reportTab === "references-fix" ? t.report.fixAriaLabel : t.report.ariaLabel;
  const canDownloadActiveMarkdown = reportTab === "references-fix" ? Boolean(referenceFixMarkdown) : Boolean(report);
  const signedInLabel = user.name || user.email || "Google user";
  const signedInDetail = user.email && user.email !== signedInLabel ? user.email : "Google";

  useEffect(() => {
    document.documentElement.lang = t.locale;
  }, [t.locale]);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(themeStorageKey);
    if (storedTheme === "light" || storedTheme === "dark") {
      setTheme(storedTheme);
    }
    setIsThemeReady(true);
  }, []);

  useEffect(() => {
    const storedSettings = parseStoredSettings(window.localStorage.getItem(settingsStorageKey));
    setAutomaticReferenceFix(storedSettings.automaticReferenceFix);

    const storedAnalysis = parseStoredAnalysis(window.localStorage.getItem(latestAnalysisStorageKey));
    if (storedAnalysis) {
      setReport(storedAnalysis.report);
      setReportFilename(storedAnalysis.filename);
      setStatus(storedAnalysis.status);
      setReferenceStatus(storedAnalysis.referenceStatus);
      setFindingCount(storedAnalysis.findingCount);
      setExitCode(storedAnalysis.exitCode);
      setReferenceFixMarkdown(storedAnalysis.referenceFixMarkdown);
      setReferenceFixStatus(storedAnalysis.referenceFixStatus);
      setReferenceFixWarning(storedAnalysis.referenceFixWarning);
      setReportTab(storedAnalysis.reportTab);
      setReportView(storedAnalysis.reportView);
    }

    setIsStorageReady(true);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;

    if (isThemeReady) {
      window.localStorage.setItem(themeStorageKey, theme);
    }
  }, [theme, isThemeReady]);

  useEffect(() => {
    if (!isStorageReady) {
      return;
    }

    window.localStorage.setItem(settingsStorageKey, JSON.stringify({ automaticReferenceFix }));
  }, [automaticReferenceFix, isStorageReady]);

  useEffect(() => {
    if (!isStorageReady) {
      return;
    }

    if (!report && !referenceFixMarkdown && !status) {
      window.localStorage.removeItem(latestAnalysisStorageKey);
      return;
    }

    const storedAnalysis: StoredAnalysis = {
      filename: reportFilename,
      status,
      referenceStatus,
      findingCount,
      exitCode,
      report,
      referenceFixMarkdown,
      referenceFixStatus,
      referenceFixWarning,
      reportTab,
      reportView,
      updatedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(latestAnalysisStorageKey, JSON.stringify(storedAnalysis));
  }, [
    exitCode,
    findingCount,
    isStorageReady,
    referenceFixMarkdown,
    referenceFixStatus,
    referenceFixWarning,
    referenceStatus,
    report,
    reportFilename,
    reportTab,
    reportView,
    status,
  ]);

  useEffect(() => {
    if (reportTab === "references-fix" && !referenceIssuesDetected) {
      setReportTab("check-report");
    }
  }, [referenceIssuesDetected, reportTab]);

  useEffect(() => {
    if (!isHelpOpen) {
      return;
    }

    helpCloseRef.current?.focus();

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsHelpOpen(false);
      }
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isHelpOpen]);

  useEffect(() => {
    const updateDate = () => setTodayLabel(formatLocalDate(new Date()));

    updateDate();
    const timer = window.setInterval(updateDate, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const resetResult = () => {
    setReport("");
    setReportFilename("");
    setReferenceStatus(null);
    setReferenceFixMarkdown("");
    setReferenceFixStatus("");
    setReferenceFixWarning("");
    setReportTab("check-report");
    setStatus(null);
    setFindingCount(null);
    setExitCode(null);
  };

  const cancelActiveRequest = () => {
    requestSequenceRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setIsChecking(false);
  };

  const selectFile = (candidate: File | undefined) => {
    cancelActiveRequest();
    setError("");
    resetResult();
    dragDepthRef.current = 0;
    setIsDragging(false);

    if (!candidate) {
      return;
    }

    if (!isSupportedManuscript(candidate)) {
      setFile(null);
      setError("Only PDF, DOCX, DOC, or ODT files can be checked.");
      return;
    }

    setFile(candidate);
  };

  const downloadActiveMarkdown = () => {
    const content = reportTab === "references-fix" ? referenceFixMarkdown : report;
    if (!content) return;
    const url = URL.createObjectURL(new Blob([content], { type: "text/markdown;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = reportTab === "references-fix" ? referenceFixDownloadFilename(reportFilename) : reportDownloadFilename(reportFilename);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const runCheck = async () => {
    if (!file || isChecking) return;

    const requestToken = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestToken;
    const controller = new AbortController();
    abortRef.current = controller;

    const isCurrentRequest = () => requestSequenceRef.current === requestToken && abortRef.current === controller;

    setIsChecking(true);
    setError("");
    resetResult();

    const form = new FormData();
    form.append("file", file);
    form.append("referenceFix", automaticReferenceFix ? "1" : "0");

    let handledApiError = false;

    try {
      const response = await fetch("/api/check", {
        method: "POST",
        body: form,
        signal: controller.signal,
      });
      const payload = (await response.json().catch(() => ({
        error: "The checker API returned an unreadable response.",
      }))) as CheckResponse;

      if (!isCurrentRequest()) {
        return;
      }

      if (!response.ok) {
        handledApiError = true;
        setReport(payload.report || "");
        setReportFilename(payload.filename || "");
        setStatus(payload.status || "error");
        setReferenceStatus(payload.referenceStatus || readReferenceStatusFromReport(payload.report || ""));
        setReferenceFixMarkdown(payload.referenceFix?.markdown || "");
        setReferenceFixStatus(payload.referenceFix?.status || "");
        setReferenceFixWarning(payload.referenceFix?.warning || "");
        setFindingCount(payload.findingCount ?? null);
        setExitCode(payload.exitCode ?? null);
        throw new Error(payload.error || "The checker API failed.");
      }

      setReport(payload.report || "");
      setReportFilename(payload.filename || "");
      setStatus(payload.status || "unknown");
      setReferenceStatus(payload.referenceStatus || readReferenceStatusFromReport(payload.report || ""));
      setReferenceFixMarkdown(payload.referenceFix?.markdown || "");
      setReferenceFixStatus(payload.referenceFix?.status || "");
      setReferenceFixWarning(payload.referenceFix?.warning || "");
      setFindingCount(payload.findingCount ?? null);
      setExitCode(payload.exitCode ?? null);
    } catch (checkError) {
      if (!isCurrentRequest() || controller.signal.aborted) {
        return;
      }

      if (!handledApiError) {
        setStatus("error");
        setReferenceStatus(null);
        setReferenceFixMarkdown("");
        setReferenceFixStatus("");
        setReferenceFixWarning("");
        setReportTab("check-report");
        setFindingCount(null);
        setExitCode(null);
        setReport("");
        setReportFilename("");
      }
      const message = checkError instanceof Error ? checkError.message : "The checker failed.";
      setError(message);
    } finally {
      if (isCurrentRequest()) {
        setIsChecking(false);
        abortRef.current = null;
      }
    }
  };

  const statusTone = status === "pass"
    ? "status-pill-pass"
    : status === "fail"
      ? "status-pill-fail"
      : status === "error"
        ? "status-pill-error"
        : "status-pill-neutral";
  const StatusIcon = status === "pass" ? CheckCircle2 : status === "fail" ? AlertTriangle : status === "error" ? XCircle : ShieldCheck;

  return (
    <main
      className="app-shell h-[100dvh] overflow-hidden"
      data-testid="app-shell"
    >
      <div className="mx-auto flex h-full max-h-[100dvh] max-w-[1840px] min-w-0 flex-col overflow-hidden px-3 py-3 sm:px-5 lg:px-6">
        <header
          data-testid="dashboard-header"
          className="mb-3 flex shrink-0 flex-col gap-3 px-1 pt-1 lg:flex-row lg:items-start lg:justify-between"
        >
          <div className="min-w-0">
            <h1 className="font-display text-[1.5rem] leading-tight text-heading">{t.meta.title}</h1>
            <p className="mt-1 text-sm text-muted sm:text-base">{t.meta.subtitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={githubRepoUrl}
              target="_blank"
              rel="noreferrer"
              className="control-surface inline-flex h-9 items-center gap-2 rounded-full px-3 text-sm font-semibold transition focus-ring"
            >
              <GitBranch className="h-4 w-4" />
              {t.meta.github}
            </a>
            <a
              data-testid="developer-credit"
              href={developerCreditUrl}
              target="_blank"
              rel="noreferrer"
              className="control-surface inline-flex h-9 max-w-full items-center gap-2 rounded-full px-3 text-sm font-semibold transition focus-ring"
            >
              <span>{t.meta.developer}</span>
              <span className="hidden sm:inline">MalakhovKS</span>
              <span data-testid="developer-credit-date" className="date-pill rounded-full px-2 py-0.5 text-xs">
                {todayLabel || "0000-00-00"}
              </span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            </a>
            <button
              type="button"
              data-testid="info-button"
              onClick={() => {
                setHelpTab("features");
                setIsHelpOpen(true);
              }}
              className="control-surface inline-flex h-9 items-center gap-2 rounded-full px-3 text-sm font-semibold transition focus-ring"
            >
              <Settings className="h-4 w-4" aria-hidden="true" />
              {t.meta.info}
            </button>
            <button
              type="button"
              data-testid="theme-switcher"
              role="switch"
              aria-checked={theme === "dark"}
              aria-label={theme === "dark" ? t.meta.lightTheme : t.meta.darkTheme}
              title={theme === "dark" ? t.meta.lightTheme : t.meta.darkTheme}
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className={classNames("theme-toggle focus-ring", theme === "dark" && "theme-toggle-dark")}
            >
              <span className="theme-toggle-icon theme-toggle-sun" aria-hidden="true">
                <Sun className="h-4 w-4" />
              </span>
              <span className="theme-toggle-icon theme-toggle-moon" aria-hidden="true">
                <Moon className="h-4 w-4" />
              </span>
              <span className="theme-toggle-thumb" aria-hidden="true" />
            </button>
            <button
              type="button"
              data-testid="language-switcher"
              role="switch"
              aria-checked={language === "en"}
              aria-label={language === "uk" ? "English" : "Українська"}
              title={language === "uk" ? "English" : "Українська"}
              onClick={() => setLanguage(language === "uk" ? "en" : "uk")}
              className={classNames("language-switcher focus-ring", language === "en" && "language-switcher-en")}
            >
              <span className="language-switcher-option" aria-hidden="true">UA</span>
              <span className="language-switcher-option" aria-hidden="true">EN</span>
              <span className="language-switcher-thumb" aria-hidden="true" />
            </button>
            <div data-testid="signed-in-user" className="control-surface inline-flex h-9 max-w-full items-center gap-2 rounded-full py-1 pl-3 pr-1 text-sm">
              <span className="min-w-0 truncate font-semibold" title={signedInLabel}>{signedInLabel}</span>
              <span className="hidden text-xs text-muted md:inline" title={signedInDetail}>{signedInDetail}</span>
              <button
                type="button"
                onClick={() => void signOut({ callbackUrl: "/sign-in" })}
                className="icon-button inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition focus-ring"
                aria-label={t.meta.signOut}
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>

        {isHelpOpen ? (
          <div
            data-testid="info-modal"
            className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center px-4 py-6"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setIsHelpOpen(false);
              }
            }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="info-modal-title"
              className="modal-panel flex h-[min(44rem,calc(100dvh-3rem))] w-full max-w-3xl flex-col overflow-hidden rounded-[28px] p-5 shadow-[0_24px_70px_rgba(15,23,42,0.24)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase text-muted">{t.meta.title}</p>
                  <h2 id="info-modal-title" className="mt-1 text-xl font-semibold leading-tight text-heading">{t.help.modalTitle}</h2>
                </div>
                <button
                  ref={helpCloseRef}
                  type="button"
                  onClick={() => setIsHelpOpen(false)}
                  className="icon-button inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition focus-ring"
                  aria-label={t.help.close}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <div className="segmented-control mt-4 inline-flex min-h-9 items-center gap-1 rounded-full p-1" role="tablist" aria-label={t.help.modalTitle}>
                {([
                  ["features", t.help.featuresTab],
                  ["settings", t.help.settingsTab],
                ] as const).map(([tab, label]) => (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    aria-selected={helpTab === tab}
                    aria-controls={`info-modal-${tab}`}
                    id={`info-modal-${tab}-tab`}
                    onClick={() => setHelpTab(tab)}
                    className={classNames(
                      "inline-flex h-7 items-center rounded-full px-3 text-xs font-semibold leading-none transition focus-ring",
                      helpTab === tab ? "reference-dark" : "segmented-option",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="mt-4 min-h-0 flex-1 overflow-auto pr-1">
                {helpTab === "features" ? (
                  <div
                    id="info-modal-features"
                    role="tabpanel"
                    aria-labelledby="info-modal-features-tab"
                  >
                    <p className="text-sm leading-6 text-body">{t.help.intro}</p>
                  <ul className="mt-4 space-y-3 text-sm leading-6 text-body">
                    {t.help.features.map((feature) => (
                      <li key={feature} className="flex gap-3">
                        <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-6 grid gap-6 border-t border-[color:var(--app-border)] pt-5 md:grid-cols-2">
                    <section className="min-w-0">
                      <h3 className="text-base font-semibold leading-tight text-heading">{t.help.referenceTitle}</h3>
                      <p className="mt-2 text-sm leading-6 text-body">{t.help.referenceIntro}</p>
                      <ul className="mt-3 space-y-2 text-sm leading-6 text-body">
                        {t.help.referenceFixes.map((fix) => (
                          <li key={fix} className="flex gap-3">
                            <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                            <span>{fix}</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                    <section className="min-w-0">
                      <h3 className="text-base font-semibold leading-tight text-heading">{t.help.promptTitle}</h3>
                      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-body">
                        {t.help.promptSteps.map((step) => (
                          <li key={step} className="pl-1">{step}</li>
                        ))}
                      </ol>
                      <a
                        href="/ceur_ws_reference_prompt.md"
                        download="ceur_ws_reference_prompt.md"
                        className="reference-dark mt-4 inline-flex min-h-9 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition focus-ring"
                        aria-label={t.help.promptDownloadAria}
                      >
                        <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span className="min-w-0 break-words text-left">{t.help.promptDownload}</span>
                      </a>
                    </section>
                  </div>
                </div>
                ) : (
                  <div
                    id="info-modal-settings"
                    role="tabpanel"
                    aria-labelledby="info-modal-settings-tab"
                  >
                    <h3 className="text-base font-semibold leading-tight text-heading">{t.help.settingsTitle}</h3>
                    <label className="soft-panel mt-4 flex cursor-pointer items-start gap-3 rounded-[22px] p-4 text-body">
                    <input
                      type="checkbox"
                      checked={automaticReferenceFix}
                      onChange={(event) => setAutomaticReferenceFix(event.target.checked)}
                      className="mt-1 h-4 w-4 shrink-0 accent-emerald-700"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-heading">{t.help.automaticReferenceFix}</span>
                      <span className="mt-1 block text-sm leading-6 text-body">{t.help.automaticReferenceFixDescription}</span>
                    </span>
                    </label>
                  </div>
                )}
              </div>
              <div className="mt-5 flex shrink-0 justify-end">
                <button
                  type="button"
                  onClick={() => setIsHelpOpen(false)}
                  className="reference-dark inline-flex h-9 items-center justify-center rounded-full px-4 text-sm font-semibold transition focus-ring"
                >
                  {t.help.close}
                </button>
              </div>
            </section>
          </div>
        ) : null}

        <section data-testid="dashboard-panel" className="surface mb-2 max-h-[34dvh] shrink-0 overflow-auto rounded-[30px] px-3 py-2 sm:px-4">
          <div className="grid items-stretch gap-2 xl:grid-cols-[minmax(0,1fr)_minmax(16rem,0.78fr)_minmax(15rem,0.58fr)]">
            <div className="flex min-h-0">
              <input
                id="manuscript-upload"
                ref={inputRef}
                type="file"
                accept="application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx,application/msword,.doc,application/vnd.oasis.opendocument.text,.odt"
                className="sr-only"
                onClick={(event) => {
                  event.currentTarget.value = "";
                }}
                onChange={(event) => selectFile(event.target.files?.[0])}
              />
              <button
                type="button"
                data-testid="upload-dropzone"
                aria-describedby="upload-support selected-file"
                className={classNames(
                  "flex h-full min-h-24 w-full flex-col justify-between rounded-[24px] border border-dashed px-3 py-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500",
                  isDragging ? "dropzone-active" : "dropzone-surface",
                )}
                onClick={() => inputRef.current?.click()}
                onDragEnter={(event) => {
                  event.preventDefault();
                  dragDepthRef.current += 1;
                  setIsDragging(true);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
                  if (dragDepthRef.current === 0) {
                    setIsDragging(false);
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  dragDepthRef.current = 0;
                  setIsDragging(false);
                  selectFile(event.dataTransfer.files[0]);
                }}
              >
                <span className="flex items-start justify-between gap-4">
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold uppercase text-muted">{t.upload.eyebrow}</span>
                    <span className="mt-1 block text-base font-semibold text-heading">{t.upload.title}</span>
                  </span>
                  <span className="dropzone-icon inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[18px]">
                    <UploadCloud className="h-5 w-5" />
                  </span>
                </span>
                <span className="mt-2 flex min-w-0 flex-wrap items-center gap-2 text-sm text-muted">
                  <span id="upload-support" className="support-badge inline-flex rounded-full px-2 py-1 text-xs font-semibold uppercase">
                    {t.upload.support}
                  </span>
                  <span id="selected-file" className="min-w-0 break-all" title={selectedName}>{selectedName}</span>
                </span>
              </button>
            </div>

            <div data-testid="stats-grid" className="soft-panel grid grid-cols-2 gap-2 rounded-[24px] p-2 sm:grid-cols-4 xl:self-stretch">
              <div className="info-card rounded-[22px] px-2.5 py-2">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted"><FileText className="h-4 w-4" />{t.stats.file}</div>
                <div className="mt-1 break-words text-sm font-semibold text-heading">{file ? t.stats.ready : t.stats.empty}</div>
                <div className="mt-1 text-xs text-muted">{formatFileSize(file, t)}</div>
              </div>
              <div className="info-card rounded-[22px] px-2.5 py-2" aria-live="polite">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted"><StatusIcon className="h-4 w-4" />{t.stats.status}</div>
                <div className="mt-1 break-words text-sm font-semibold text-heading">{isChecking ? t.status.running : statusLabel(status, t)}</div>
                <div className="mt-1 text-xs text-muted">{isChecking ? t.stats.activeTests : t.stats.allTests}</div>
              </div>
              <div className="info-card rounded-[22px] px-2.5 py-2">
                <div className="text-xs font-semibold uppercase text-muted">{t.stats.findings}</div>
                <div className="mt-1 text-sm font-semibold text-heading">{findingCount ?? t.stats.notAvailable}</div>
              </div>
              <div className="info-card rounded-[22px] px-2.5 py-2">
                <div className="text-xs font-semibold uppercase text-muted">{t.stats.exitCode}</div>
                <div className="mt-1 text-sm font-semibold text-heading">{exitCode ?? t.stats.notAvailable}</div>
              </div>
            </div>

            <div data-testid="action-panel" className="soft-panel flex flex-col justify-between rounded-[24px] px-3 py-2 text-body">
              <div className="grid gap-2">
                <span data-testid="action-status" className={classNames("inline-flex h-9 w-full items-center justify-center gap-2 rounded-full border px-4 text-center text-xs font-semibold", statusTone)} aria-live="polite">
                  <StatusIcon className="h-3.5 w-3.5" />
                  {isChecking ? t.status.checking : statusLabel(status, t)}
                </span>
                <button
                  type="button"
                  onClick={runCheck}
                  disabled={!file || isChecking}
                  className={classNames(
                    "inline-flex h-9 w-full items-center justify-center gap-2 rounded-full px-4 text-center text-sm font-semibold leading-tight transition focus-ring",
                    !file || isChecking ? "reference-disabled" : "reference-dark",
                  )}
                >
                  {isChecking ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  {isChecking ? t.actions.checking : t.actions.run}
                </button>
              </div>
              {error ? (
                <div role="alert" className="error-alert mt-2 flex items-start gap-2 rounded-[18px] px-3 py-2 text-sm">
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span className="min-w-0 break-words">{translateError(error, t)}</span>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section data-testid="content-grid" className="grid min-h-0 flex-1 items-stretch overflow-hidden">
          <div data-testid="report-surface" className="surface flex min-h-0 min-w-0 flex-col rounded-[30px] p-3 sm:p-4">
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase text-muted">{t.report.eyebrow}</p>
                <h2 className="mt-1 text-base font-semibold text-heading sm:text-lg">{t.report.title}</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="segmented-control inline-flex min-h-9 items-center gap-1 rounded-full p-1" role="tablist" aria-label={t.report.eyebrow}>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={reportTab === "check-report"}
                    onClick={() => setReportTab("check-report")}
                    className={classNames(
                      "inline-flex h-7 items-center rounded-full px-2 text-xs font-semibold leading-none transition focus-ring",
                      reportTab === "check-report" ? "reference-dark" : "segmented-option",
                    )}
                  >
                    {t.report.checkReport}
                  </button>
                  {referenceIssuesDetected ? (
                    <button
                      type="button"
                      role="tab"
                      aria-selected={reportTab === "references-fix"}
                      onClick={() => setReportTab("references-fix")}
                      className={classNames(
                        "inline-flex h-7 items-center rounded-full px-2 text-xs font-semibold leading-none transition focus-ring",
                        reportTab === "references-fix" ? "reference-dark" : "segmented-option",
                      )}
                    >
                      {t.report.referencesFix}
                    </button>
                  ) : null}
                </div>
                <div className="segmented-control inline-flex min-h-9 items-center gap-1 rounded-full p-1" role="group" aria-label={t.report.viewMode}>
                  {([
                    ["preview", t.report.preview, Eye],
                    ["source", t.report.source, Code2],
                  ] as const).map(([view, label, Icon]) => (
                    <button
                      key={view}
                      type="button"
                      aria-pressed={reportView === view}
                      onClick={() => setReportView(view)}
                      className={classNames(
                        "inline-flex h-7 items-center gap-1.5 rounded-full px-2 text-xs font-semibold leading-none transition focus-ring",
                        reportView === view ? "reference-dark" : "segmented-option",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                      {label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={downloadActiveMarkdown}
                  disabled={!canDownloadActiveMarkdown}
                  className={classNames(
                    "inline-flex min-h-9 items-center justify-center gap-2 rounded-full px-3 py-1.5 text-center text-sm font-semibold leading-tight transition focus-ring",
                    canDownloadActiveMarkdown ? "reference-dark" : "reference-disabled",
                  )}
                >
                  <Download className="h-4 w-4" />
                  {reportTab === "references-fix" ? t.actions.downloadReferenceFix : t.actions.download}
                </button>
              </div>
            </div>
            <div className="report-frame mt-3 min-h-0 flex-1 overflow-hidden rounded-[24px]">
              <div className="report-markdown h-full overflow-auto p-4 text-sm leading-6 text-report" aria-label={activeAriaLabel}>
                {activeMarkdown ? (
                  reportView === "preview" ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                      {previewMarkdown}
                    </ReactMarkdown>
                  ) : (
                    <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-5 text-report">{activeMarkdown}</pre>
                  )
                ) : (
                  <p className="m-0 text-muted">{t.report.empty}</p>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

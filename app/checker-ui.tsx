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
  Languages,
  LoaderCircle,
  LogOut,
  ShieldCheck,
  UploadCloud,
  XCircle,
} from "lucide-react";

type Language = "uk" | "en";
type ReportView = "preview" | "source";

export type SignedInUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

type CheckResponse = {
  requestId?: string;
  filename?: string;
  status?: string;
  findingCount?: number | null;
  exitCode?: number | null;
  report?: string;
  error?: string;
  queuedMs?: number;
};

type Translation = {
  locale: string;
  meta: {
    title: string;
    subtitle: string;
    github: string;
    language: string;
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
  };
  report: {
    eyebrow: string;
    title: string;
    empty: string;
    ariaLabel: string;
    viewMode: string;
    preview: string;
    source: string;
  };
  notes: {
    title: string;
    badge: string;
    findings: string;
    singleManuscript: string;
    rawOutput: string;
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
      language: "Мова інтерфейсу",
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
    },
    report: {
      eyebrow: "Звіт",
      title: "Markdown-вивід перевірки",
      empty: "Завантажте рукопис і запустіть перевірку CEUR, щоб прочитати Markdown-звіт тут.",
      ariaLabel: "Markdown-звіт перевірки",
      viewMode: "Вигляд звіту",
      preview: "Перегляд",
      source: "Код",
    },
    notes: {
      title: "Примітки до виводу",
      badge: "Markdown",
      findings: "Знахідки CEUR можуть встановити статус помилки навіть тоді, коли процес перевірки завершується штатно.",
      singleManuscript: "Перевірка одного рукопису не містить index.html, тому перевірки назви можуть повідомити про відсутній супровідний файл.",
      rawOutput: "Сирий вивід CEUR зберігається англійською мовою для аудиту.",
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
      language: "Interface language",
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
    },
    report: {
      eyebrow: "Report",
      title: "Markdown validation output",
      empty: "Upload a manuscript and run the CEUR check to read the generated Markdown report here.",
      ariaLabel: "Markdown validation report",
      viewMode: "Report view",
      preview: "Preview",
      source: "Source",
    },
    notes: {
      title: "Output notes",
      badge: "Markdown",
      findings: "CEUR findings can fail the status even when the checker process exits normally.",
      singleManuscript: "Single-manuscript checks do not include index.html, so title checks may report that companion file as missing.",
      rawOutput: "Raw CEUR output is preserved in English for auditability.",
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


function classNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const markdownComponents: Components = {
  h1({ node, className, ...props }) {
    return <h1 className={classNames("mb-3 text-xl font-semibold leading-tight text-slate-950", className)} {...props} />;
  },
  h2({ node, className, ...props }) {
    return <h2 className={classNames("mb-2 mt-5 text-lg font-semibold leading-tight text-slate-900", className)} {...props} />;
  },
  h3({ node, className, ...props }) {
    return <h3 className={classNames("mb-2 mt-4 text-base font-semibold leading-tight text-slate-900", className)} {...props} />;
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
      <div className="mb-4 overflow-x-auto rounded-[18px] border border-slate-200 bg-white/72">
        <table className={classNames("w-full min-w-[34rem] border-collapse text-left text-sm", className)} {...props} />
      </div>
    );
  },
  thead({ node, className, ...props }) {
    return <thead className={classNames("bg-white/80 text-xs uppercase text-slate-500", className)} {...props} />;
  },
  th({ node, className, ...props }) {
    return <th className={classNames("border-b border-slate-200 px-3 py-2 font-semibold", className)} {...props} />;
  },
  td({ node, className, ...props }) {
    return <td className={classNames("border-b border-slate-100 px-3 py-2 align-top", className)} {...props} />;
  },
  pre({ node, className, ...props }) {
    return <pre className={classNames("mb-4 overflow-x-auto rounded-[18px] bg-slate-950 p-3 text-xs leading-5 text-slate-100", className)} {...props} />;
  },
  code({ node, className, ...props }) {
    return <code className={classNames("rounded bg-white/80 px-1 py-0.5 font-mono text-[0.85em] text-slate-900", className)} {...props} />;
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

export default function CheckerUi({ user }: { user: SignedInUser }) {
  const [language, setLanguage] = useState<Language>("uk");
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState("");
  const [reportView, setReportView] = useState<ReportView>("preview");
  const [status, setStatus] = useState<string | null>(null);
  const [findingCount, setFindingCount] = useState<number | null>(null);
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [todayLabel, setTodayLabel] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestSequenceRef = useRef(0);

  const t = translations[language];
  const selectedName = file ? file.name : t.upload.noFileSelected;
  const displayReport = useMemo(() => translateReport(report, language), [report, language]);
  const signedInLabel = user.name || user.email || "Google user";
  const signedInDetail = user.email && user.email !== signedInLabel ? user.email : "Google";

  useEffect(() => {
    document.documentElement.lang = t.locale;
  }, [t.locale]);

  useEffect(() => {
    const updateDate = () => setTodayLabel(formatLocalDate(new Date()));

    updateDate();
    const timer = window.setInterval(updateDate, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const resetResult = () => {
    setReport("");
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

  const downloadReport = () => {
    if (!displayReport) return;
    const url = URL.createObjectURL(new Blob([displayReport], { type: "text/markdown;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "report.md";
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
        setStatus(payload.status || "error");
        setFindingCount(payload.findingCount ?? null);
        setExitCode(payload.exitCode ?? null);
        throw new Error(payload.error || "The checker API failed.");
      }

      setReport(payload.report || "");
      setStatus(payload.status || "unknown");
      setFindingCount(payload.findingCount ?? null);
      setExitCode(payload.exitCode ?? null);
    } catch (checkError) {
      if (!isCurrentRequest() || controller.signal.aborted) {
        return;
      }

      if (!handledApiError) {
        setStatus("error");
        setFindingCount(null);
        setExitCode(null);
        setReport("");
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
    ? "border-emerald-200 bg-emerald-50 text-emerald-950"
    : status === "fail"
      ? "border-amber-500 bg-amber-100 text-amber-950"
      : status === "error"
        ? "border-rose-200 bg-rose-50 text-rose-950"
        : "border-slate-200 bg-white text-slate-700";
  const StatusIcon = status === "pass" ? CheckCircle2 : status === "fail" ? AlertTriangle : status === "error" ? XCircle : ShieldCheck;

  return (
    <main
      className="h-[100dvh] overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(184,227,214,0.65),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(255,224,204,0.4),_transparent_24%),linear-gradient(180deg,_#eef4ee_0%,_#e7efe7_52%,_#dde7df_100%)] text-slate-900"
      data-testid="app-shell"
    >
      <div className="mx-auto flex h-full max-h-[100dvh] max-w-[1840px] min-w-0 flex-col overflow-hidden px-3 py-3 sm:px-5 lg:px-6">
        <header
          data-testid="dashboard-header"
          className="mb-3 flex shrink-0 flex-col gap-3 px-1 pt-1 lg:flex-row lg:items-start lg:justify-between"
        >
          <div className="min-w-0">
            <h1 className="font-display text-[2.4rem] leading-none text-slate-950 sm:text-[3.4rem]">{t.meta.title}</h1>
            <p className="mt-1 text-sm text-slate-600 sm:text-base">{t.meta.subtitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={githubRepoUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center gap-2 rounded-full border border-white/70 bg-white/70 px-3 text-sm font-semibold text-slate-700 shadow-[0_12px_28px_rgba(30,28,24,0.08)] transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
            >
              <GitBranch className="h-4 w-4" />
              {t.meta.github}
            </a>
            <a
              data-testid="developer-credit"
              href={developerCreditUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 max-w-full items-center gap-2 rounded-full border border-white/70 bg-white/70 px-3 text-sm font-semibold text-slate-700 shadow-[0_12px_28px_rgba(30,28,24,0.08)] transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
            >
              <span>Developer</span>
              <span className="hidden sm:inline">MalakhovKS</span>
              <span data-testid="developer-credit-date" className="rounded-full bg-white/70 px-2 py-0.5 text-xs text-slate-500">
                {todayLabel || "0000-00-00"}
              </span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            </a>
            <div className="inline-flex h-9 items-center gap-1 rounded-full border border-white/70 bg-white/70 p-1 shadow-[0_12px_28px_rgba(30,28,24,0.08)]" role="group" aria-label={t.meta.language}>
              <Languages className="ml-1 h-4 w-4 text-slate-500" aria-hidden="true" />
              {(["uk", "en"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={language === option}
                  onClick={() => setLanguage(option)}
                  className={classNames(
                    "h-7 rounded-full px-2 text-xs font-semibold leading-none transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300",
                    language === option ? "reference-dark" : "text-slate-700 hover:bg-white/80",
                  )}
                >
                  {option === "uk" ? "Українська" : "English"}
                </button>
              ))}
            </div>
            <div data-testid="signed-in-user" className="inline-flex h-9 max-w-full items-center gap-2 rounded-full border border-white/70 bg-white/70 py-1 pl-3 pr-1 text-sm text-slate-700 shadow-[0_12px_28px_rgba(30,28,24,0.08)]">
              <span className="min-w-0 truncate font-semibold" title={signedInLabel}>{signedInLabel}</span>
              <span className="hidden text-xs text-slate-500 md:inline" title={signedInDetail}>{signedInDetail}</span>
              <button
                type="button"
                onClick={() => void signOut({ callbackUrl: "/sign-in" })}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-white hover:text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>

        <section data-testid="dashboard-panel" className="surface mb-3 max-h-[42dvh] shrink-0 overflow-auto rounded-[30px] px-4 py-3 sm:px-5 xl:max-h-none xl:overflow-visible">
          <div className="grid items-stretch gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(19rem,0.42fr)_minmax(18rem,0.34fr)]">
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
                  "flex h-full min-h-36 w-full flex-col justify-between rounded-[24px] border border-dashed px-4 py-4 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500",
                  isDragging ? "border-emerald-400 bg-emerald-50" : "border-white/70 bg-white/72 hover:border-emerald-300 hover:bg-white",
                )}
                onClick={() => inputRef.current?.click()}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setIsDragging(false);
                  selectFile(event.dataTransfer.files[0]);
                }}
              >
                <span className="flex items-start justify-between gap-4">
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold uppercase text-slate-500">{t.upload.eyebrow}</span>
                    <span className="mt-1 block text-lg font-semibold text-slate-900">{t.upload.title}</span>
                  </span>
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[18px] bg-emerald-50 text-emerald-800">
                    <UploadCloud className="h-5 w-5" />
                  </span>
                </span>
                <span className="mt-4 flex min-w-0 flex-wrap items-center gap-2 text-sm text-slate-500">
                  <span id="upload-support" className="inline-flex rounded-full border border-white/70 bg-white/78 px-2 py-1 text-xs font-semibold uppercase text-slate-500">
                    {t.upload.support}
                  </span>
                  <span id="selected-file" className="min-w-0 break-all" title={selectedName}>{selectedName}</span>
                </span>
              </button>
            </div>

            <div data-testid="stats-grid" className="grid grid-cols-2 gap-2 rounded-[24px] border border-white/70 bg-white/55 p-2 sm:p-3 xl:self-stretch">
              <div className="rounded-[22px] border border-white/70 bg-white/78 px-3 py-3">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-500"><FileText className="h-4 w-4" />{t.stats.file}</div>
                <div className="mt-2 break-words text-base font-semibold text-slate-900">{file ? t.stats.ready : t.stats.empty}</div>
                <div className="mt-1 text-xs text-slate-500">{formatFileSize(file, t)}</div>
              </div>
              <div className="rounded-[22px] border border-white/70 bg-white/78 px-3 py-3" aria-live="polite">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-500"><StatusIcon className="h-4 w-4" />{t.stats.status}</div>
                <div className="mt-2 break-words text-base font-semibold text-slate-900">{isChecking ? t.status.running : statusLabel(status, t)}</div>
                <div className="mt-1 text-xs text-slate-500">{isChecking ? t.stats.activeTests : t.stats.allTests}</div>
              </div>
              <div className="rounded-[22px] border border-white/70 bg-white/78 px-3 py-3">
                <div className="text-xs font-semibold uppercase text-slate-500">{t.stats.findings}</div>
                <div className="mt-2 text-base font-semibold text-slate-900">{findingCount ?? t.stats.notAvailable}</div>
              </div>
              <div className="rounded-[22px] border border-white/70 bg-white/78 px-3 py-3">
                <div className="text-xs font-semibold uppercase text-slate-500">{t.stats.exitCode}</div>
                <div className="mt-2 text-base font-semibold text-slate-900">{exitCode ?? t.stats.notAvailable}</div>
              </div>
            </div>

            <div data-testid="action-panel" className="flex flex-col justify-between rounded-[24px] border border-white/70 bg-white/55 px-4 py-3 text-slate-900">
              <div className="flex flex-wrap items-center gap-2">
                <span className={classNames("inline-flex min-h-8 items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold", statusTone)} aria-live="polite">
                  <StatusIcon className="h-3.5 w-3.5" />
                  {isChecking ? t.status.checking : statusLabel(status, t)}
                </span>
                <span className="inline-flex min-h-8 items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700">{t.stats.allTests}</span>
              </div>
              <button
                type="button"
                onClick={runCheck}
                disabled={!file || isChecking}
                className={classNames(
                  "mt-3 inline-flex min-h-10 items-center justify-center gap-2 rounded-full px-4 py-2 text-center text-sm font-semibold leading-tight transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300",
                  !file || isChecking ? "reference-disabled" : "reference-dark",
                )}
              >
                {isChecking ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                {isChecking ? t.actions.checking : t.actions.run}
              </button>
              {error ? (
                <div role="alert" className="mt-2 flex items-start gap-2 rounded-[18px] border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-950">
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span className="min-w-0 break-words">{translateError(error, t)}</span>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section data-testid="content-grid" className="grid min-h-0 flex-1 items-stretch gap-3 overflow-hidden px-[17px] sm:px-[21px] xl:grid-cols-[minmax(0,1.1fr)_minmax(19rem,0.42fr)_minmax(18rem,0.34fr)]">
          <div data-testid="report-surface" className="surface flex min-h-0 min-w-0 flex-col rounded-[30px] p-3 sm:p-4 xl:col-span-2">
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase text-slate-500">{t.report.eyebrow}</p>
                <h2 className="mt-1 text-base font-semibold text-slate-900 sm:text-lg">{t.report.title}</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex min-h-9 items-center gap-1 rounded-full border border-white/70 bg-white/70 p-1" role="group" aria-label={t.report.viewMode}>
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
                        "inline-flex h-7 items-center gap-1.5 rounded-full px-2 text-xs font-semibold leading-none transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500",
                        reportView === view ? "reference-dark" : "text-slate-700 hover:bg-white/80",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                      {label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={downloadReport}
                  disabled={!displayReport}
                  className={classNames(
                    "inline-flex min-h-9 items-center justify-center gap-2 rounded-full px-3 py-1.5 text-center text-sm font-semibold leading-tight transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500",
                    displayReport ? "reference-dark" : "reference-disabled",
                  )}
                >
                  <Download className="h-4 w-4" />
                  {t.actions.download}
                </button>
              </div>
            </div>
            <div className="mt-3 min-h-0 flex-1 overflow-hidden rounded-[24px] border border-white/70 bg-[#faf6f0]">
              <div className="report-markdown h-full overflow-auto p-4 text-sm leading-6 text-slate-700" aria-label={t.report.ariaLabel}>
                {displayReport ? (
                  reportView === "preview" ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                      {displayReport}
                    </ReactMarkdown>
                  ) : (
                    <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-5 text-slate-700">{displayReport}</pre>
                  )
                ) : (
                  <p className="m-0 text-slate-500">{t.report.empty}</p>
                )}
              </div>
            </div>
          </div>

          <aside className="hidden min-h-0 xl:block">
            <section data-testid="notes-surface" className="surface flex h-full min-h-0 flex-col rounded-[30px] p-4">
              <div className="flex shrink-0 items-center justify-between gap-3">
                <div className="text-sm font-semibold text-slate-900">{t.notes.title}</div>
                <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800">{t.notes.badge}</span>
              </div>
              <div className="mt-3 min-h-0 space-y-3 overflow-auto text-sm text-slate-500">
                <div className="rounded-[22px] border border-white/70 bg-white/78 px-3 py-2">{t.notes.findings}</div>
                <div className="rounded-[22px] border border-white/70 bg-white/78 px-3 py-2">{t.notes.singleManuscript}</div>
                <div className="rounded-[22px] border border-white/70 bg-white/78 px-3 py-2">{t.notes.rawOutput}</div>
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
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
  };
  notes: {
    title: string;
    badge: string;
    findings: string;
    singlePdf: string;
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
      subtitle: "Генератор звіту перевірки рукопису",
      github: "GitHub",
      language: "Мова інтерфейсу",
    },
    upload: {
      eyebrow: "Завантаження рукопису",
      title: "Виберіть або перетягніть PDF",
      support: "Лише PDF",
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
    },
    notes: {
      title: "Примітки до виводу",
      badge: "Markdown",
      findings: "Знахідки CEUR можуть встановити статус помилки навіть тоді, коли процес перевірки завершується штатно.",
      singlePdf: "Перевірка одного PDF не містить index.html, тому перевірки назви можуть повідомити про відсутній супровідний файл.",
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
      onlyPdf: "Можна перевіряти лише PDF-файли.",
      unreadable: "API перевірки повернув нечитабельну відповідь.",
      apiFailed: "API перевірки не спрацював.",
      checkerFailed: "Перевірка не спрацювала.",
      busy: "Перевірник зайнятий. Спробуйте ще раз трохи пізніше.",
      noReport: "Перевірник завершився без створення Markdown-звіту.",
      uploadLimit: "Завантаження PDF обмежене 30 МБ.",
      emptyUpload: "Завантажений PDF порожній.",
      fakePdf: "Завантажений файл не схожий на PDF.",
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
      title: "Choose or drop a PDF",
      support: "PDF only",
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
    },
    notes: {
      title: "Output notes",
      badge: "Markdown",
      findings: "CEUR findings can fail the status even when the checker process exits normally.",
      singlePdf: "Single-PDF checks do not include index.html, so title checks may report that companion file as missing.",
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
      onlyPdf: "Only PDF files can be checked.",
      unreadable: "The checker API returned an unreadable response.",
      apiFailed: "The checker API failed.",
      checkerFailed: "The checker failed.",
      busy: "The checker is busy. Try again shortly.",
      noReport: "The checker finished without producing a Markdown report.",
      uploadLimit: "PDF uploads are limited to 30 MB.",
      emptyUpload: "The uploaded PDF is empty.",
      fakePdf: "The uploaded file does not look like a PDF.",
    },
  },
};

const errorTranslations: Record<string, keyof Translation["errors"]> = {
  "Only PDF files can be checked.": "onlyPdf",
  "The checker API returned an unreadable response.": "unreadable",
  "The checker API failed.": "apiFailed",
  "The checker failed.": "checkerFailed",
  "The checker is busy. Try again shortly.": "busy",
  "The checker finished without producing a Markdown report.": "noReport",
  "PDF uploads are limited to 30 MB.": "uploadLimit",
  "The uploaded PDF is empty.": "emptyUpload",
  "The uploaded file does not look like a PDF.": "fakePdf",
};

const githubRepoUrl = "https://github.com/malakhovks/ceur-pdf-check-service";
const developerCreditUrl = "https://linktr.ee/malakhovks";

function classNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

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
    .replace(/^\| PDF count \|/gm, "| Кількість PDF |")
    .replace(/^\| Tests \|/gm, "| Тести |")
    .replace(/^\| Checker exit code \|/gm, "| Код виходу перевірника |")
    .replace(/^\| Finding lines \|/gm, "| Рядки знахідок |")
    .replace(/^## Checked PDFs$/m, "## Перевірені PDF")
    .replace(/^## Findings$/m, "## Знахідки")
    .replace(/^## Process Output$/m, "## Вивід процесу (англійською)")
    .replace(/No likely findings were detected in the CEUR checker output\./g, "У виводі перевірника CEUR не виявлено ймовірних знахідок.")
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

    if (!candidate.name.toLowerCase().endsWith(".pdf") && candidate.type !== "application/pdf") {
      setFile(null);
      setError("Only PDF files can be checked.");
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
      className="h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(184,227,214,0.65),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(255,224,204,0.4),_transparent_24%),linear-gradient(180deg,_#eef4ee_0%,_#e7efe7_52%,_#dde7df_100%)] text-slate-900"
      data-testid="app-shell"
    >
      <div className="mx-auto flex h-screen max-w-[1840px] min-w-0 flex-col overflow-hidden px-3 py-3 sm:px-5 lg:px-6">
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
                    "h-7 rounded-full px-2 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300",
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

        <section data-testid="dashboard-panel" className="surface mb-3 max-h-[38vh] shrink-0 overflow-auto rounded-[30px] px-4 py-3 sm:px-5 xl:max-h-none xl:overflow-visible">
          <div className="grid items-stretch gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(19rem,0.42fr)_minmax(18rem,0.34fr)]">
            <div className="flex min-h-0">
              <input
                id="pdf-upload"
                ref={inputRef}
                type="file"
                accept="application/pdf,.pdf"
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
                <span className="mt-4 block min-w-0 text-sm text-slate-500">
                  <span id="upload-support" className="mr-2 inline-flex rounded-full border border-white/70 bg-white/78 px-2 py-1 text-xs font-semibold uppercase text-slate-500">
                    {t.upload.support}
                  </span>
                  <span id="selected-file" className="break-all" title={selectedName}>{selectedName}</span>
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
                  "mt-3 inline-flex h-10 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300",
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
              <button
                type="button"
                onClick={downloadReport}
                disabled={!displayReport}
                className={classNames(
                  "inline-flex h-9 items-center gap-2 rounded-full px-3 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500",
                  displayReport ? "reference-dark" : "reference-disabled",
                )}
              >
                <Download className="h-4 w-4" />
                {t.actions.download}
              </button>
            </div>
            <div className="mt-3 min-h-0 flex-1 overflow-hidden rounded-[24px] border border-white/70 bg-[#faf6f0]">
              <pre className="report-markdown h-full overflow-auto p-4 text-sm leading-6 text-slate-700" aria-label={t.report.ariaLabel}>{displayReport || t.report.empty}</pre>
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
                <div className="rounded-[22px] border border-white/70 bg-white/78 px-3 py-2">{t.notes.singlePdf}</div>
                <div className="rounded-[22px] border border-white/70 bg-white/78 px-3 py-2">{t.notes.rawOutput}</div>
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}

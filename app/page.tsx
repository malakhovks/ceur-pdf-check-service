"use client";

import { useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  GitBranch,
  LoaderCircle,
  ShieldCheck,
  UploadCloud,
  XCircle,
} from "lucide-react";

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

const repoUrl = process.env.NEXT_PUBLIC_GITHUB_REPO_URL || "https://github.com/your-org/ceur-pdf-check";

function classNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function statusLabel(status: string | null) {
  if (!status) return "Waiting";
  if (status === "pass") return "Passed";
  if (status === "fail") return "Findings";
  if (status === "error") return "Error";
  if (status === "unknown") return "Unknown";
  return status;
}

function formatFileSize(file: File | null) {
  if (!file) return "No file";
  if (file.size < 1024 * 1024) return `${Math.max(1, Math.round(file.size / 1024))} KB`;
  return `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [findingCount, setFindingCount] = useState<number | null>(null);
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestSequenceRef = useRef(0);

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
    if (!report) return;
    const url = URL.createObjectURL(new Blob([report], { type: "text/markdown;charset=utf-8" }));
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
      setError(checkError instanceof Error ? checkError.message : "The checker failed.");
    } finally {
      if (isCurrentRequest()) {
        setIsChecking(false);
        abortRef.current = null;
      }
    }
  };

  const statusTone = status === "pass"
    ? "border-emerald-300 bg-emerald-50 text-emerald-900"
    : status === "fail"
      ? "border-amber-300 bg-amber-50 text-amber-950"
      : status === "error"
        ? "border-red-300 bg-red-50 text-red-900"
        : "border-slate-200 bg-white text-slate-700";
  const StatusIcon = status === "pass" ? CheckCircle2 : status === "fail" ? AlertTriangle : status === "error" ? XCircle : ShieldCheck;
  const selectedName = file ? file.name : "No file selected";

  return (
    <main className="min-h-screen overflow-x-hidden text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[1500px] min-w-0 flex-col px-4 py-4 sm:px-6 lg:px-8">
        <header className="mb-5 flex flex-col gap-4 border-b border-slate-200 pb-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h1 className="font-display text-4xl leading-tight text-slate-950 sm:text-5xl">CEUR PDF Check</h1>
            <p className="mt-1 text-sm text-slate-600 sm:text-base">Manuscript validation report generator</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={repoUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            >
              <GitBranch className="h-4 w-4" />
              GitHub Repo
            </a>
            <span className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm">
              <ShieldCheck className="h-4 w-4 text-emerald-700" />
              Official CEUR checker
            </span>
          </div>
        </header>

        <section className="surface mb-5 rounded-lg p-4 sm:p-5">
          <div className="grid items-stretch gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(19rem,0.55fr)_minmax(18rem,0.45fr)]">
            <div>
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
                aria-describedby="upload-support selected-file"
                className={classNames(
                  "flex min-h-48 w-full flex-col justify-between rounded-lg border border-dashed px-5 py-5 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900",
                  isDragging ? "border-emerald-500 bg-emerald-50" : "border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-white",
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
                    <span className="block text-xs font-semibold uppercase text-slate-500">Upload manuscript</span>
                    <span className="mt-2 block text-xl font-semibold text-slate-950">Choose or drop a PDF</span>
                  </span>
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
                    <UploadCloud className="h-5 w-5" />
                  </span>
                </span>
                <span className="mt-6 block min-w-0 text-sm text-slate-600">
                  <span id="upload-support" className="mr-2 inline-flex rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold uppercase text-slate-600">
                    PDF only
                  </span>
                  <span id="selected-file" className="break-all" title={selectedName}>{selectedName}</span>
                </span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-white p-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-500"><FileText className="h-4 w-4" />File</div>
                <div className="mt-3 break-words text-lg font-semibold text-slate-950">{file ? "Ready" : "Empty"}</div>
                <div className="mt-1 text-xs text-slate-500">{formatFileSize(file)}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-4" aria-live="polite">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-500"><StatusIcon className="h-4 w-4" />Status</div>
                <div className="mt-3 break-words text-lg font-semibold text-slate-950">{isChecking ? "Running" : statusLabel(status)}</div>
                <div className="mt-1 text-xs text-slate-500">{isChecking ? "CEUR tests active" : "all tests"}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="text-xs font-semibold uppercase text-slate-500">Findings</div>
                <div className="mt-3 text-lg font-semibold text-slate-950">{findingCount ?? "N/A"}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="text-xs font-semibold uppercase text-slate-500">Exit code</div>
                <div className="mt-3 text-lg font-semibold text-slate-950">{exitCode ?? "N/A"}</div>
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white px-4 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={classNames("inline-flex min-h-8 items-center gap-2 rounded-md border px-3 py-1 text-xs font-semibold", statusTone)} aria-live="polite">
                  <StatusIcon className="h-3.5 w-3.5" />
                  {isChecking ? "Checking" : statusLabel(status)}
                </span>
                <span className="inline-flex min-h-8 items-center rounded-md border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">all CEUR tests</span>
              </div>
              <button
                type="button"
                onClick={runCheck}
                disabled={!file || isChecking}
                className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {isChecking ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                {isChecking ? "Checking" : "Run check"}
              </button>
              {error ? (
                <div role="alert" className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span className="min-w-0 break-words">{error}</span>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section className="grid min-w-0 flex-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="surface min-w-0 rounded-lg p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase text-slate-500">Report</p>
                <h2 className="mt-1 text-lg font-semibold text-slate-900">Markdown validation output</h2>
              </div>
              <button
                type="button"
                onClick={downloadReport}
                disabled={!report}
                className={classNames(
                  "inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900",
                  report ? "bg-slate-950 text-white hover:bg-slate-800" : "cursor-not-allowed bg-slate-300 text-slate-600",
                )}
              >
                <Download className="h-4 w-4" />
                Download report.md
              </button>
            </div>
            <div className="mt-4 min-h-[520px] overflow-hidden rounded-lg border border-slate-200 bg-white">
              <pre className="report-markdown h-full min-h-[520px] overflow-auto p-4 text-sm leading-6 text-slate-800" aria-label="Markdown validation report">{report || "Upload a manuscript and run the CEUR check to read the generated Markdown report here."}</pre>
            </div>
          </div>

          <aside className="space-y-4">
            <section className="surface rounded-lg p-5">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
                <ShieldCheck className="h-4 w-4 text-emerald-700" />
                Check profile
              </div>
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-950 px-4 py-4 text-sm leading-7 text-slate-100">
                The web UI runs the official CEUR checker through the same container CLI used by command-line workflows.
              </div>
            </section>
            <section className="surface rounded-lg p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-slate-900">Output notes</div>
                <span className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-500">Markdown</span>
              </div>
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">CEUR findings can fail the status even when the checker process exits normally.</div>
                <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">Single-PDF checks do not include index.html, so title checks may report that companion file as missing.</div>
              </div>
            </section>
          </aside>
        </section>

        <footer className="mt-8 border-t border-slate-200 px-2 pb-8 pt-5 text-center text-xs leading-6 text-slate-500">
          CEUR tool output is preserved verbatim in the report for auditability.
        </footer>
      </div>
    </main>
  );
}

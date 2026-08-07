"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { AlertCircle, Copy, Dna, ExternalLink, Loader2, RefreshCw, Zap } from "lucide-react";
import { BlastHit, SequenceAnalysis } from "@/lib/api";
import { Translate } from "@/lib/i18n";
import { useBlastSearch } from "@/hooks/useBlastSearch";
import { useSequenceAnalysis } from "@/hooks/useSequenceAnalysis";

type CountMap = Record<string, number>;

function copyText(value: string) {
  if (typeof navigator === "undefined") return;
  navigator.clipboard?.writeText(value).catch(() => undefined);
}

function countWidth(counts: CountMap | undefined, base: string) {
  const total = Object.values(counts || {}).reduce((sum, value) => sum + Number(value || 0), 0);
  if (!total) return 0;
  return Math.max(3, (Number(counts?.[base] || 0) / total) * 100);
}

const BASE_COLORS: Record<string, string> = {
  A: "linear-gradient(90deg, #60a5fa, #2563eb)",
  T: "linear-gradient(90deg, #4ade80, #16a34a)",
  G: "linear-gradient(90deg, #fbbf24, #d97706)",
  C: "linear-gradient(90deg, #f87171, #dc2626)",
};

export function SequenceAnalysisPanel({ t }: { t: Translate }) {
  const [seqSubTab, setSeqSubTab] = useState<"analyze" | "blast">("analyze");
  const analysis = useSequenceAnalysis(t);
  const blast = useBlastSearch();

  const sequenceCounts: CountMap = analysis.result?.base_counts || {};

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Sub-tab navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          onClick={() => setSeqSubTab("analyze")}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition ${
            seqSubTab === "analyze"
              ? "bg-slate-900 dark:bg-cyan-500 text-white dark:text-slate-950"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          {t("blast.subtabAnalyze")}
        </button>
        <button
          onClick={() => setSeqSubTab("blast")}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition ${
            seqSubTab === "blast"
              ? "bg-slate-900 dark:bg-cyan-500 text-white dark:text-slate-950"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          {t("blast.subtabBlast")}
        </button>
      </div>

      {seqSubTab === "analyze" ? (
        <section className="grid gap-6 lg:grid-cols-12">
          <form
            onSubmit={analysis.runAnalysis}
            className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-6 shadow-sm lg:col-span-5"
          >
            <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-cyan-600 dark:text-cyan-400">
              {t("sequence.badge")}
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">
              {t("sequence.title")}
            </h2>
            <p className="mt-1.5 text-sm leading-6 text-slate-500 dark:text-slate-400">
              {t("sequence.desc")}
            </p>
            <textarea
              value={analysis.sequence}
              onChange={(e) => analysis.setSequence(e.target.value)}
              className="mt-4 min-h-64 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-4 font-mono text-xs leading-6 text-slate-900 dark:text-slate-100 outline-none focus:border-slate-400 dark:focus:border-slate-500 focus:bg-white dark:focus:bg-slate-800 transition custom-scrollbar"
              spellCheck={false}
            />
            {analysis.error && (
              <p className="mt-3 rounded-lg bg-red-50 dark:bg-red-950/40 p-3 text-xs text-red-600 dark:text-red-300">
                {analysis.error}
              </p>
            )}
            <button
              disabled={analysis.loading}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 dark:bg-cyan-500 px-4 py-2.5 text-xs font-medium text-white dark:text-slate-950 hover:bg-slate-700 dark:hover:bg-cyan-400 disabled:opacity-50 transition"
            >
              {analysis.loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Zap className="h-3.5 w-3.5" />
              )}
              {t("sequence.button")}
            </button>
          </form>

          <div className="space-y-5 lg:col-span-7">
            <MetricsPanel result={analysis.result} counts={sequenceCounts} t={t} />
            {analysis.result ? (
              <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-6 shadow-sm">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-xs font-medium uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
                    {t("sequence.outputs")}
                  </h3>
                  <button
                    onClick={() => copyText(analysis.result?.reverse_complement || "")}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    {t("sequence.copyReverse")}
                  </button>
                </div>
                <Output label={t("sequence.reverse")} value={analysis.result.reverse_complement} />
                <Output label={t("sequence.rna")} value={analysis.result.rna_sequence} />
              </div>
            ) : (
              <EmptyState title={t("sequence.emptyTitle")} message={t("sequence.emptyMessage")} />
            )}
          </div>
        </section>
      ) : (
        /* BLAST similarity search tab with full Loading, Empty, and Error UI states */
        <section className="space-y-6">
          <form
            onSubmit={blast.submitJob}
            className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-6 shadow-sm"
          >
            <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-cyan-600 dark:text-cyan-400">
              {t("blast.badge")}
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">
              {t("blast.title")}
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {t("blast.desc")}
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <label className="space-y-1">
                <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {t("blast.seqType")}
                </span>
                <select
                  value={blast.seqType}
                  onChange={(e) => blast.setSeqType(e.target.value as any)}
                  className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none"
                >
                  <option value="auto">{t("blast.seqTypeAuto")}</option>
                  <option value="dna">{t("blast.seqTypeDna")}</option>
                  <option value="protein">{t("blast.seqTypeProtein")}</option>
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {t("blast.provider")}
                </span>
                <select
                  value={blast.provider}
                  onChange={(e) => blast.setProvider(e.target.value as any)}
                  className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none"
                >
                  <option value="auto">{t("blast.providerAuto")}</option>
                  <option value="ebi">{t("blast.providerEbi")}</option>
                  <option value="uniprot">{t("blast.providerUniprot")}</option>
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {t("blast.databaseFilter")}
                </span>
                <input
                  value={blast.database}
                  onChange={(e) => blast.setDatabase(e.target.value)}
                  placeholder={t("blast.databasePlaceholder")}
                  className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
              </label>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={blast.loadSampleDna}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                >
                  {t("blast.sampleDna")}
                </button>
                <button
                  type="button"
                  onClick={blast.loadSampleProtein}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                >
                  {t("blast.sampleProtein")}
                </button>
              </div>
            </div>

            <textarea
              value={blast.seq}
              onChange={(e) => blast.setSeq(e.target.value)}
              placeholder={t("blast.placeholder")}
              className="mt-3 min-h-36 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-4 font-mono text-xs leading-6 text-slate-900 dark:text-slate-100 outline-none focus:border-slate-400 dark:focus:border-slate-500 transition custom-scrollbar"
              spellCheck={false}
            />

            <div className="mt-4 flex items-center justify-between">
              <button
                disabled={blast.loading || !blast.seq.trim()}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 dark:bg-cyan-500 px-5 py-2.5 text-xs font-semibold text-white dark:text-slate-950 hover:bg-slate-700 dark:hover:bg-cyan-400 disabled:opacity-50 transition"
              >
                {blast.loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                {blast.loading ? t("blast.submitting") : t("blast.submit")}
              </button>
              {blast.status !== "idle" && (
                <button
                  type="button"
                  onClick={blast.reset}
                  className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 transition"
                >
                  {t("blast.reset")}
                </button>
              )}
            </div>
          </form>

          {/* 1. BLAST LOADING STATE */}
          {blast.loading && (
            <div className="rounded-xl border border-cyan-200 dark:border-cyan-900/50 bg-cyan-50/40 dark:bg-cyan-950/20 p-6 shadow-sm animate-pulse">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-cyan-500 text-slate-950">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {t("blast.inProgress")} ({blast.elapsedSeconds}s)
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {t("blast.jobId")}: <span className="font-mono">{blast.jobId || "Initialising"}</span> | {t("blast.status")}:{" "}
                      <span className="font-semibold text-cyan-600 dark:text-cyan-400">{blast.status}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
                  </span>
                  <span className="text-xs font-mono text-slate-400 dark:text-slate-500">
                    {t("blast.polling")} ({blast.elapsedSeconds}s)
                  </span>
                </div>
              </div>
              {/* Progress bar animation */}
              <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-cyan-100 dark:bg-cyan-950">
                <div className="h-full bg-cyan-500 rounded-full animate-pulse w-3/4" />
              </div>
            </div>
          )}

          {/* 2. BLAST ERROR STATE */}
          {blast.error && !blast.loading && (
            <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 p-6 shadow-sm">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-red-900 dark:text-red-300">{t("blast.failed")}</h4>
                  <p className="mt-1 text-xs leading-5 text-red-700 dark:text-red-400">{blast.error}</p>
                  <button
                    onClick={blast.submitJob}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-red-700 transition"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> {t("blast.retry")}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 3. BLAST EMPTY STATE (Finished but 0 hits) */}
          {!blast.loading && !blast.error && blast.status === "FINISHED" && blast.hits.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-slate-100 dark:bg-slate-800">
                <Dna className="h-6 w-6 text-slate-400 dark:text-slate-500" />
              </div>
              <h3 className="mt-4 text-sm font-bold text-slate-800 dark:text-slate-200">
                {t("blast.emptyTitle")}
              </h3>
              <p className="mx-auto mt-1.5 max-w-sm text-xs leading-5 text-slate-500 dark:text-slate-400">
                {t("blast.emptyDesc")}
              </p>
            </div>
          )}

          {/* 4. BLAST RESULTS LIST */}
          {!blast.loading && blast.hits.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {t("blast.alignmentsFound")} ({blast.hits.length})
              </h3>
              <div className="space-y-3">
                {blast.hits.map((hit, idx) => (
                  <div
                    key={`${hit.accession}-${idx}`}
                    className="group rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-cyan-500/40 dark:hover:border-cyan-500/40"
                  >
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-cyan-600 dark:text-cyan-400">
                            {hit.accession}
                          </span>
                          <span className="rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:text-slate-400 uppercase">
                            {hit.source}
                          </span>
                        </div>
                        <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
                          {hit.description}
                        </p>
                      </div>
                      <div className="flex items-center gap-4 text-right text-xs shrink-0">
                        <div>
                          <span className="block text-[10px] uppercase text-slate-400">{t("blast.identity")}</span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            {hit.identity_percent}%
                          </span>
                        </div>
                        <div>
                          <span className="block text-[10px] uppercase text-slate-400">{t("blast.eValue")}</span>
                          <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                            {hit.e_value}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[10px] uppercase text-slate-400">{t("blast.coverage")}</span>
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {hit.query_coverage_percent}%
                          </span>
                        </div>
                        <Link
                          href={`/genes/${encodeURIComponent(hit.accession)}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-cyan-500 hover:text-slate-950 dark:hover:bg-cyan-400 dark:hover:text-slate-950 transition"
                        >
                          {t("blast.details")} <ExternalLink className="h-3 w-3" />
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function Output({ label, value }: { label: string; value?: string }) {
  return (
    <div className="mt-3">
      <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500">
        {label}
      </span>
      <div className="mt-1 overflow-x-auto rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-3 font-mono text-xs text-slate-800 dark:text-slate-200 custom-scrollbar">
        {value || "None"}
      </div>
    </div>
  );
}

function MetricsPanel({
  result,
  counts,
  t,
}: {
  result: SequenceAnalysis | null;
  counts: CountMap;
  t: Translate;
}) {
  const gc = result?.gc_content_percent ?? 0;
  const circumference = 351.85;
  const offset = circumference - (Number(gc || 0) / 100) * circumference;

  return (
    <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-6 shadow-sm">
      <h3 className="text-xs font-medium uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
        {t("sequence.metrics")}
      </h3>
      <div className="mt-5 grid gap-6 md:grid-cols-3">
        <div className="flex flex-col items-center justify-center rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-4">
          <div className="relative flex h-32 w-32 items-center justify-center">
            <svg className="h-full w-full -rotate-90">
              <circle
                cx="64"
                cy="64"
                r="56"
                fill="transparent"
                stroke="currentColor"
                strokeWidth="8"
                className="text-slate-200 dark:text-slate-700"
              />
              <circle
                cx="64"
                cy="64"
                r="56"
                fill="transparent"
                stroke="url(#gcGradient)"
                strokeWidth="8"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                className="gc-donut-circle"
              />
              <defs>
                <linearGradient id="gcGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#22d3ee" />
                  <stop offset="100%" stopColor="#0891b2" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute text-center">
              <span className="block text-2xl font-bold text-slate-950 dark:text-slate-100">
                {Number(gc).toFixed(1)}%
              </span>
              <span className="text-[9px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
                GC
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-3 md:col-span-2">
          {(["A", "T", "G", "C"] as const).map((base) => {
            const w = countWidth(counts, base);
            const total = Object.values(counts).reduce((s, v) => s + Number(v || 0), 0);
            const pct = total > 0 ? ((Number(counts[base] || 0) / total) * 100).toFixed(1) : "0.0";
            return (
              <div key={base} className="bar-row">
                <div className="mb-1.5 flex justify-between font-mono text-xs text-slate-600 dark:text-slate-300">
                  <span className="font-semibold">{base}</span>
                  <span className="tabular-nums text-slate-500 dark:text-slate-400">
                    {counts[base] || 0}{" "}
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">({pct}%)</span>
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${w}%`,
                      background: BASE_COLORS[base],
                      animation: "fillBar 600ms cubic-bezier(0.16,1,0.3,1) both",
                      ["--bar-width" as any]: `${w}%`,
                    }}
                  />
                </div>
              </div>
            );
          })}
          <div className="grid gap-3 sm:grid-cols-2 pt-1">
            <MiniStat
              label={t("sequence.length")}
              value={result ? result.sequence_length.toLocaleString() : "0"}
            />
            <MiniStat
              label={t("sequence.validBases")}
              value={Object.values(counts)
                .reduce((s, v) => s + Number(v || 0), 0)
                .toLocaleString()}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-3 ring-1 ring-slate-100 dark:ring-slate-800">
      <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">{value}</p>
    </div>
  );
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 p-10 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
        <Dna className="h-5 w-5 text-slate-400 dark:text-slate-500" />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-slate-700 dark:text-slate-300">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-sm text-xs leading-5 text-slate-400 dark:text-slate-500">
        {message}
      </p>
    </div>
  );
}

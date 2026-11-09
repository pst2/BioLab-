"use client";

import { useState } from "react";
import { Terminal } from "lucide-react";
import { api, PubMedResult } from "@/lib/api";
import { Translate } from "@/lib/i18n";

export function ApiExplorerPanel({ t }: { t: Translate }) {
  const [pubmedQuery, setPubmedQuery] = useState("BRCA1 cancer");
  const [articles, setArticles] = useState<PubMedResult[]>([]);
  const [apiResponse, setApiResponse] = useState("");
  const [apiLoading, setApiLoading] = useState(false);

  async function runApiPlayground(kind: "health" | "status" | "pubmed") {
    setApiLoading(true);
    setApiResponse("");
    try {
      const response =
        kind === "health"
          ? await api.health()
          : kind === "status"
          ? await api.systemStatus()
          : await api.searchPubmed(pubmedQuery);
      if (kind === "pubmed") setArticles((response.data || []) as PubMedResult[]);
      setApiResponse(JSON.stringify(response, null, 2));
    } catch (error) {
      setApiResponse(
        JSON.stringify(
          { error: error instanceof Error ? error.message : t("api.requestFailed") },
          null,
          2
        )
      );
    } finally {
      setApiLoading(false);
    }
  }

  return (
    <section className="space-y-6 animate-fadeIn">
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-6 shadow-sm">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-400 via-sky-500 to-indigo-500" />
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/15 to-indigo-500/15 text-cyan-600 dark:text-cyan-400 ring-1 ring-cyan-500/20">
            <Terminal className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-950 dark:text-slate-100">
              {t("api.title")}
            </h2>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{t("api.desc")}</p>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={() => runApiPlayground("health")}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-cyan-500/20 hover:shadow-lg hover:shadow-cyan-500/30 hover:brightness-110 transition-all"
          >
            <span className="rounded bg-white/20 px-1.5 py-0.5 font-mono text-[10px]">GET</span>
            /health
          </button>
          <button
            onClick={() => runApiPlayground("status")}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:border-cyan-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-all shadow-2xs"
          >
            <span className="rounded bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 px-1.5 py-0.5 font-mono text-[10px]">GET</span>
            /system/status
          </button>
          <div className="flex rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 overflow-hidden focus-within:border-cyan-400 focus-within:ring-2 focus-within:ring-cyan-500/15 transition">
            <input
              value={pubmedQuery}
              onChange={(e) => setPubmedQuery(e.target.value)}
              className="bg-transparent px-3.5 py-2 text-xs font-medium text-slate-900 dark:text-slate-100 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
              placeholder={t("api.pubmedPlaceholder")}
            />
            <button
              onClick={() => runApiPlayground("pubmed")}
              className="border-l border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-700 px-4 text-xs font-bold text-cyan-600 dark:text-cyan-300 hover:bg-cyan-50 dark:hover:bg-slate-600 transition"
            >
              {t("api.pubmed")}
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-lg">
        <div className="flex items-center justify-between border-b border-slate-800/80 bg-slate-900/90 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
            <h3 className="ml-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {t("api.responseJson")}
            </h3>
          </div>
          <span className="font-mono text-[10px] text-cyan-400/80">JSON • UTF-8</span>
        </div>
        <pre className="min-h-56 overflow-x-auto p-5 font-mono text-xs leading-6 text-cyan-100 custom-scrollbar">
          {apiLoading ? t("api.loading") : apiResponse || t("api.empty")}
        </pre>
      </div>

      {!!articles.length && (
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-5 shadow-sm space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {t("pubmed.resultsTitle")} ({articles.length})
          </p>
          <div className="space-y-2">
            {articles.slice(0, 5).map((a) => (
              <div
                key={a.pmid}
                className="flex items-start gap-3 py-2.5 border-b border-slate-100 dark:border-slate-800/60 last:border-0"
              >
                <span className="mt-0.5 shrink-0 rounded-lg bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                  PMID: {a.pmid}
                </span>
                <div className="min-w-0 flex-1">
                  <a
                    href={`https://pubmed.ncbi.nlm.nih.gov/${a.pmid}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-bold text-slate-900 dark:text-slate-100 hover:text-cyan-600 dark:hover:text-cyan-400 line-clamp-1 transition-colors"
                  >
                    {a.title}
                  </a>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {a.source || t("pubmed.unknownJournal")} · {a.pubdate || t("pubmed.unknownDate")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

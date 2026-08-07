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
          { error: error instanceof Error ? error.message : "Request failed" },
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
      <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-950 dark:text-slate-100">
          <Terminal className="h-5 w-5 text-slate-400 dark:text-slate-500" /> {t("api.title")}
        </h2>
        <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{t("api.desc")}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            onClick={() => runApiPlayground("health")}
            className="rounded-lg bg-slate-900 dark:bg-cyan-500 px-4 py-2 text-xs font-medium text-white dark:text-slate-950 hover:bg-slate-700 dark:hover:bg-cyan-400 transition"
          >
            GET /health
          </button>
          <button
            onClick={() => runApiPlayground("status")}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
          >
            GET /system/status
          </button>
          <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 overflow-hidden">
            <input
              value={pubmedQuery}
              onChange={(e) => setPubmedQuery(e.target.value)}
              className="bg-transparent px-3 py-2 text-xs text-slate-900 dark:text-slate-100 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
              placeholder="PubMed query…"
            />
            <button
              onClick={() => runApiPlayground("pubmed")}
              className="border-l border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-700 px-3 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 transition"
            >
              PubMed
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-6 shadow-sm">
        <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Response JSON
        </h3>
        <pre className="mt-3 min-h-48 overflow-x-auto rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-4 font-mono text-xs leading-5 text-slate-800 dark:text-slate-200 custom-scrollbar">
          {apiLoading ? t("api.loading") : apiResponse || t("api.empty")}
        </pre>
      </div>
    </section>
  );
}

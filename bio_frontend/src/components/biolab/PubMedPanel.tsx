"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  BarChart3,
  BookOpen,
  Calendar,
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Search,
  Sparkles,
} from "lucide-react";
import { api, ApiResponse, PubMedResult } from "@/lib/api";
import { Translate } from "@/lib/i18n";

const SAMPLE_QUERIES = ["BRCA1", "cancer", "CRISPR Cas9", "TP53", "covid"];

function extractYear(pubdate: string): string {
  const match = pubdate?.match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : "Unknown";
}

function countTop(items: string[], limit = 8): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = item?.trim() || "Unknown";
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function buildBibtexUrl(article: PubMedResult): string {
  const params = new URLSearchParams({
    pmid: article.pmid,
    title: article.title || "",
    authors: (article.authors || []).join(", "),
    journal: article.source || "",
    year: article.pubdate || "",
    doi: article.doi || "",
  });
  return `/api/backend/api/v1/export/citation/bibtex?${params.toString()}`;
}

function buildRisUrl(article: PubMedResult): string {
  const params = new URLSearchParams({
    pmid: article.pmid,
    title: article.title || "",
    authors: (article.authors || []).join(", "),
    journal: article.source || "",
    year: article.pubdate || "",
    doi: article.doi || "",
    abstract: article.abstract || "",
  });
  return `/api/backend/api/v1/export/citation/ris?${params.toString()}`;
}

export function PubMedPanel({ t }: { t: Translate }) {
  const [query, setQuery] = useState("BRCA1 cancer");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResponse<PubMedResult[]> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedAbstracts, setExpandedAbstracts] = useState<Set<string>>(new Set());

  const articles = Array.isArray(result?.data) ? result.data : [];
  const years = useMemo(() => countTop(articles.map((a) => extractYear(a.pubdate)), 8), [articles]);
  const journals = useMemo(() => countTop(articles.map((a) => a.source), 6), [articles]);
  const withAbstracts = useMemo(() => articles.filter((a) => Boolean(a.abstract)).length, [articles]);
  const withDoi = useMemo(() => articles.filter((a) => Boolean(a.doi)).length, [articles]);

  function toggleAbstract(pmid: string) {
    setExpandedAbstracts((prev) => {
      const next = new Set(prev);
      if (next.has(pmid)) next.delete(pmid);
      else next.add(pmid);
      return next;
    });
  }

  async function handleSearch(term?: string) {
    const q = (term ?? query).trim();
    if (q.length < 2) return;
    if (term) setQuery(term);
    setLoading(true);
    setError(null);
    setResult(null);
    setExpandedAbstracts(new Set());

    try {
      const response = await api.searchPubmed(q);
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("search.failed"));
    } finally {
      setLoading(false);
    }
  }

  const maxYearCount = Math.max(...years.map((y) => y.count), 1);
  const maxJournalCount = Math.max(...journals.map((j) => j.count), 1);

  return (
    <section className="space-y-6 animate-fadeIn">
      {/* Hero Header */}
      <div
        className="relative overflow-hidden rounded-2xl p-6 md:p-8 text-white shadow-xl"
        style={{ background: "linear-gradient(135deg, #020617 0%, #082f49 60%, #0c4a6e 100%)" }}
      >
        <div className="relative z-10 max-w-3xl">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/30 bg-cyan-950/60 px-3 py-1 text-xs font-semibold text-cyan-300 backdrop-blur-md">
            <BookOpen className="h-3.5 w-3.5" />
            {t("pubmed.badge")}
          </span>
          <h2 className="mt-4 text-2xl md:text-3xl font-bold tracking-tight text-white">
            {t("pubmed.title")}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            {t("pubmed.desc")}
          </p>

          {/* Search Box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch();
            }}
            className="mt-6 flex flex-col gap-3 sm:flex-row"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("pubmed.placeholder")}
                className="w-full rounded-xl border border-slate-700 bg-slate-900/90 py-3 pl-10 pr-4 text-sm text-white placeholder-slate-400 backdrop-blur-sm transition focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/20"
              />
            </div>
            <button
              type="submit"
              disabled={loading || query.trim().length < 2}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-6 py-3 text-sm font-semibold text-slate-950 shadow-md transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("pubmed.searching")}
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  {t("pubmed.searchButton")}
                </>
              )}
            </button>
          </form>

          {/* Quick Query Pills */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-400">{t("pubmed.quickExamples")}:</span>
            {SAMPLE_QUERIES.map((sample) => (
              <button
                key={sample}
                type="button"
                onClick={() => handleSearch(sample)}
                className="rounded-lg border border-slate-700/80 bg-slate-800/60 px-2.5 py-1 text-xs font-medium text-slate-300 transition hover:border-cyan-400/50 hover:bg-slate-700/80 hover:text-white"
              >
                {sample}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-4 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Results View */}
      {result && !loading && (
        <div className="space-y-6">
          {/* Summary Stat Cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatBox label={t("pubmed.statArticles")} value={articles.length} icon={FileText} />
            <StatBox label={t("pubmed.statWithAbstract")} value={withAbstracts} icon={BookOpen} />
            <StatBox label={t("pubmed.statJournals")} value={journals.length} icon={BarChart3} />
            <StatBox label={t("pubmed.statWithDoi")} value={withDoi} icon={Sparkles} />
          </div>

          {/* Charts: Timeline & Top Journals */}
          {articles.length > 0 && (years.length > 1 || journals.length > 1) && (
            <div className="grid gap-6 md:grid-cols-2">
              {/* Publication Timeline */}
              <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="h-4 w-4 text-cyan-500" />
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {t("pubmed.timeline")}
                  </h3>
                </div>
                <div className="space-y-2.5">
                  {years.map((y) => (
                    <div key={y.label} className="flex items-center gap-3 text-xs">
                      <span className="w-12 font-mono text-slate-500 dark:text-slate-400">{y.label}</span>
                      <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500"
                          style={{ width: `${(y.count / maxYearCount) * 100}%` }}
                        />
                      </div>
                      <span className="w-8 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                        {y.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Journals */}
              <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="h-4 w-4 text-cyan-500" />
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {t("pubmed.topJournals")}
                  </h3>
                </div>
                <div className="space-y-2.5">
                  {journals.map((j) => (
                    <div key={j.label} className="flex items-center gap-3 text-xs">
                      <span className="w-36 truncate text-slate-600 dark:text-slate-300" title={j.label}>
                        {j.label}
                      </span>
                      <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500"
                          style={{ width: `${(j.count / maxJournalCount) * 100}%` }}
                        />
                      </div>
                      <span className="w-8 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                        {j.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Articles list */}
          {articles.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center">
              <BookOpen className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" />
              <h3 className="mt-3 text-base font-semibold text-slate-800 dark:text-slate-200">
                {t("pubmed.noResultsTitle")}
              </h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {t("pubmed.noResultsDesc").replace("{query}", query)}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {t("pubmed.resultsTitle")} ({articles.length})
                </h3>
              </div>

              {articles.map((article, index) => {
                const isExpanded = expandedAbstracts.has(article.pmid);
                return (
                  <article
                    key={article.pmid || index}
                    className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-5 shadow-sm transition hover:border-cyan-300 dark:hover:border-cyan-700/60"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        {/* Title */}
                        <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                          {article.title}
                        </h4>

                        {/* Metadata badges */}
                        <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-mono rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                            PMID: {article.pmid}
                          </span>
                          <span className="rounded bg-cyan-50 dark:bg-cyan-950/40 px-2 py-0.5 text-[11px] font-medium text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-900/60">
                            {article.source || t("pubmed.unknownJournal")}
                          </span>
                          <span className="rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] text-slate-600 dark:text-slate-400">
                            {article.pubdate || t("pubmed.unknownDate")}
                          </span>
                        </div>

                        {/* Authors */}
                        {article.authors?.length > 0 && (
                          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                            {article.authors.slice(0, 5).join(", ")}
                            {article.authors.length > 5 && (
                              <span className="text-slate-400 dark:text-slate-500 italic ml-1">
                                {t("pubmed.authorsMore").replace("{count}", String(article.authors.length - 5))}
                              </span>
                            )}
                          </p>
                        )}

                        {/* Collapsible Abstract */}
                        {article.abstract && (
                          <div className="mt-3">
                            <button
                              type="button"
                              onClick={() => toggleAbstract(article.pmid)}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:underline"
                            >
                              {isExpanded ? (
                                <>
                                  <ChevronUp className="h-3.5 w-3.5" />
                                  {t("pubmed.hideAbstract")}
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="h-3.5 w-3.5" />
                                  {t("pubmed.showAbstract")}
                                </>
                              )}
                            </button>
                            {isExpanded && (
                              <div className="mt-2.5 rounded-lg border-l-2 border-cyan-400 bg-slate-50 dark:bg-slate-800/50 p-3.5 text-xs leading-relaxed text-slate-700 dark:text-slate-300 animate-fadeIn">
                                {article.abstract}
                              </div>
                            )}
                          </div>
                        )}

                        {/* MeSH Terms */}
                        {article.mesh_terms && article.mesh_terms.length > 0 && (
                          <div className="mt-3 flex flex-wrap items-center gap-1.5">
                            {article.mesh_terms.slice(0, 6).map((term) => (
                              <span
                                key={term}
                                className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-[10px] font-medium text-slate-600 dark:text-slate-400"
                              >
                                {term}
                              </span>
                            ))}
                            {article.mesh_terms.length > 6 && (
                              <span className="text-[10px] text-slate-400">
                                {t("pubmed.meshMore").replace("{count}", String(article.mesh_terms.length - 6))}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Citation Export Buttons + DOI */}
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          {article.doi && (
                            <a
                              href={`https://doi.org/${article.doi}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-slate-400 hover:text-cyan-500 transition mr-2"
                            >
                              DOI: {article.doi}
                            </a>
                          )}
                          <a
                            href={buildBibtexUrl(article)}
                            download
                            className="inline-flex items-center gap-1 rounded-md border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-1 text-xs font-medium text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition"
                          >
                            <Download className="h-3 w-3" />
                            {t("pubmed.exportBibtex")}
                          </a>
                          <a
                            href={buildRisUrl(article)}
                            download
                            className="inline-flex items-center gap-1 rounded-md border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition"
                          >
                            <Download className="h-3 w-3" />
                            {t("pubmed.exportRis")}
                          </a>
                        </div>
                      </div>

                      {/* View on PubMed link */}
                      <a
                        href={`https://pubmed.ncbi.nlm.nih.gov/${article.pmid}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                      >
                        {t("pubmed.viewOnPubmed")}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Initial Empty State */}
      {!result && !loading && (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 p-12 text-center">
          <BookOpen className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-700" />
          <h3 className="mt-4 text-base font-semibold text-slate-800 dark:text-slate-200">
            {t("pubmed.emptyTitle")}
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            {t("pubmed.emptyDesc")}
          </p>
        </div>
      )}
    </section>
  );
}

function StatBox({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
        <Icon className="h-4 w-4 text-cyan-500" />
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
        {value.toLocaleString()}
      </p>
    </div>
  );
}

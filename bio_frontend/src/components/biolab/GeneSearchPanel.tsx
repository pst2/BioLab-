"use client";

import Link from "next/link";
import { FormEvent } from "react";
import { ArrowRight, AlertCircle, ChevronDown, Dna, Loader2, Search, SlidersHorizontal } from "lucide-react";
import { GeneDataType, GeneProvider, GeneResult, GeneSearchBy } from "@/lib/api";
import { Translate } from "@/lib/i18n";
import { SearchMode } from "@/hooks/useGeneSearch";

function asGeneId(gene: GeneResult) {
  return String(gene.gene_id ?? gene.external_id ?? gene.id ?? gene.symbol ?? "");
}

function safe(value: unknown, fallback = "Unknown") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function dataTypeTagClass(dataType: string): string {
  const dt = String(dataType || "").toLowerCase();
  if (dt.includes("protein")) return "tag-protein";
  if (dt.includes("nucleotide") || dt.includes("dna") || dt.includes("rna")) return "tag-nucleotide";
  return "tag-gene";
}

function sourceTagClass(source: string): string {
  const s = String(source || "").toLowerCase();
  if (s.includes("uniprot")) return "tag-uniprot";
  if (s.includes("ncbi")) return "tag-ncbi";
  if (s.includes("ensembl")) return "tag-ensembl";
  return "tag-verified";
}

export function GeneSearchPanel(props: {
  query: string;
  setQuery: (v: string) => void;
  dataType: GeneDataType;
  setDataType: (v: GeneDataType) => void;
  searchBy: GeneSearchBy;
  setSearchBy: (v: GeneSearchBy) => void;
  organism: string;
  setOrganism: (v: string) => void;
  mode: SearchMode;
  setMode: (v: SearchMode) => void;
  provider: GeneProvider;
  setProvider: (v: GeneProvider) => void;
  fallbackEnabled: boolean;
  setFallbackEnabled: (v: boolean) => void;
  showFilters: boolean;
  setShowFilters: (v: boolean) => void;
  onSubmit: (event?: FormEvent) => void;
  loading: boolean;
  error: string;
  message: string;
  genes: GeneResult[];
  t: Translate;
}) {
  const {
    query,
    setQuery,
    dataType,
    setDataType,
    searchBy,
    setSearchBy,
    organism,
    setOrganism,
    mode,
    setMode,
    provider,
    setProvider,
    fallbackEnabled,
    setFallbackEnabled,
    showFilters,
    setShowFilters,
    onSubmit,
    loading,
    error,
    message,
    genes,
    t,
  } = props;

  return (
    <section className="space-y-5 animate-fadeIn">
      {/* Search bar */}
      <div className="overflow-hidden rounded-xl border border-slate-200/70 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-sm">
        <div className="px-6 pt-6 pb-5">
          <h2 className="text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">
            {t("search.title")}
          </h2>

          <form onSubmit={onSubmit} className="mt-4">
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-1 transition focus-within:border-slate-300 dark:focus-within:border-slate-600 focus-within:bg-white dark:focus-within:bg-slate-800 focus-within:shadow-sm">
              <Search className="ml-3 h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-900 dark:text-slate-100"
                placeholder={t("search.placeholder")}
              />
              <button
                type="button"
                onClick={() => setShowFilters(!showFilters)}
                className={`hidden items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition sm:inline-flex ${
                  showFilters
                    ? "bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200"
                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200"
                }`}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" /> {t("search.filters")}
                <ChevronDown className={`h-3 w-3 transition-transform ${showFilters ? "rotate-180" : ""}`} />
              </button>
              <button
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 dark:bg-cyan-500 px-4 py-2 text-xs font-medium text-white dark:text-slate-950 hover:bg-slate-700 dark:hover:bg-cyan-400 disabled:opacity-50 transition"
              >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t("search.button")}
              </button>
            </div>
          </form>
        </div>

        {/* Filters panel */}
        {showFilters && (
          <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 px-6 py-5 animate-fadeIn">
            <div className="grid gap-4 md:grid-cols-3">
              <FilterSelect
                label={t("search.dataType")}
                value={dataType}
                onChange={(v) => setDataType(v as GeneDataType)}
                options={[
                  ["gene", t("select.gene")],
                  ["nucleotide", t("select.nucleotide")],
                  ["protein", t("select.protein")],
                ]}
              />
              <FilterSelect
                label={t("search.searchBy")}
                value={searchBy}
                onChange={(v) => setSearchBy(v as GeneSearchBy)}
                options={[
                  ["name", t("select.name")],
                  ["accession", t("select.accession")],
                  ["id", t("select.id")],
                ]}
              />
              <FilterSelect
                label={t("search.mode")}
                value={mode}
                onChange={(v) => setMode(v as SearchMode)}
                options={[
                  ["local_first", t("select.localFirst")],
                  ["local_only", t("select.localOnly")],
                  ["external_refresh", t("select.externalRefresh")],
                ]}
              />
              <FilterSelect
                label={t("search.provider")}
                value={provider}
                onChange={(v) => setProvider(v as GeneProvider)}
                options={[
                  ["auto", t("select.autoFallback")],
                  ["ncbi", "NCBI"],
                  ["ensembl", "Ensembl"],
                  ["uniprot", "UniProt"],
                  ["bvbrc", "BV-BRC"],
                  ["phytozome", "Phytozome"],
                ]}
              />
              <label className="space-y-1.5 md:col-span-2">
                <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500">
                  {t("search.organism")}
                </span>
                <input
                  value={organism}
                  onChange={(e) => setOrganism(e.target.value)}
                  className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-slate-400 dark:focus:border-slate-500 transition placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  placeholder={t("search.organismPlaceholder")}
                />
              </label>
            </div>
            <label className="mt-4 flex cursor-pointer items-center gap-2.5">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={fallbackEnabled}
                  onChange={(e) => setFallbackEnabled(e.target.checked)}
                  className="sr-only"
                />
                <div
                  className={`h-4 w-7 rounded-full transition-colors ${
                    fallbackEnabled ? "bg-cyan-500" : "bg-slate-300 dark:bg-slate-700"
                  }`}
                />
                <div
                  className={`absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform ${
                    fallbackEnabled ? "translate-x-3" : "translate-x-0"
                  }`}
                />
              </div>
              <span className="text-xs text-slate-600 dark:text-slate-400">
                {t("search.fallbackFlow")}
              </span>
            </label>
          </div>
        )}
      </div>

      {error && <Notice tone="red" title={t("search.failed")} message={error} />}
      {message && !error && <Notice tone="cyan" title={t("search.backendResponse")} message={message} />}

      {/* Results */}
      <div className="space-y-3 stagger-children">
        {loading && Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
        {!loading && genes.length === 0 && !error && (
          <EmptyState title={t("search.emptyTitle")} message={t("search.emptyMessage")} />
        )}
        {!loading && genes.map((gene) => <GeneCard key={`${asGeneId(gene)}-${gene.symbol}`} gene={gene} t={t} />)}
      </div>
    </section>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <label className="space-y-1.5">
      <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-slate-400 dark:focus:border-slate-500 transition"
      >
        {options.map(([val, name]) => (
          <option key={val} value={val}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}

function GeneCard({ gene, t }: { gene: GeneResult; t: Translate }) {
  const id = asGeneId(gene);
  const dtClass = dataTypeTagClass(safe(gene.data_type, "gene"));
  const srcClass = sourceTagClass(safe(gene.source || gene.database, ""));

  return (
    <article className="group relative overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-sm transition-all duration-200 hover:-translate-y-px hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md animate-slideInUp">
      <div className="absolute left-0 top-0 h-full w-[2px] bg-cyan-400 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
      <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`tag-base ${dtClass}`}>{safe(gene.data_type, "gene")}</span>
            {gene.database && <span className={`tag-base ${srcClass}`}>{safe(gene.database, "")}</span>}
            {gene.source && gene.source !== gene.database && (
              <span className="tag-base tag-verified">{gene.source}</span>
            )}
          </div>
          <h3 className="mt-2.5 text-lg font-semibold leading-snug tracking-tight text-slate-950 dark:text-slate-100">
            {safe(gene.symbol || gene.name, `Gene ${id}`)}
          </h3>
          {gene.organism && (
            <p className="mt-0.5 text-xs italic text-slate-400 dark:text-slate-500">{gene.organism}</p>
          )}
          <p className="mt-2 line-clamp-2 max-w-3xl text-sm leading-5 text-slate-500 dark:text-slate-400">
            {safe(gene.description || gene.name, t("geneCard.noDescription"))}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1">
            <span className="flex items-baseline gap-1.5">
              <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500">
                {t("geneCard.accession")}
              </span>
              <span className="font-mono text-xs text-slate-600 dark:text-slate-300">{id}</span>
            </span>
            <span className="flex items-baseline gap-1.5">
              <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500">
                {t("geneCard.organism")}
              </span>
              <span className="text-xs italic text-slate-600 dark:text-slate-300">{safe(gene.organism)}</span>
            </span>
            <span className="flex items-baseline gap-1.5">
              <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500">
                {t("geneCard.external")}
              </span>
              <span className="font-mono text-xs text-slate-600 dark:text-slate-300">
                {safe(gene.external_id ?? gene.gene_id ?? gene.id)}
              </span>
            </span>
          </div>
        </div>

        <Link
          href={`/genes/${encodeURIComponent(id)}`}
          className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 transition hover:border-slate-300 dark:hover:border-slate-600 hover:bg-white dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100"
        >
          {t("geneCard.viewDetail")} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </article>
  );
}

function Notice({ tone, title, message }: { tone: "red" | "cyan"; title: string; message: string }) {
  const red = tone === "red";
  return (
    <div
      className={`flex items-start gap-3 rounded-lg border p-4 text-sm ${
        red
          ? "border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300"
          : "border-cyan-200/60 dark:border-cyan-900/50 bg-cyan-50/60 dark:bg-cyan-950/40 text-cyan-900 dark:text-cyan-300"
      }`}
    >
      <AlertCircle className={`mt-0.5 h-4 w-4 shrink-0 ${red ? "text-red-500" : "text-cyan-500"}`} />
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-1 text-xs leading-5 text-inherit/80">{message}</p>
      </div>
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
      <p className="mx-auto mt-1.5 max-w-sm text-xs leading-5 text-slate-400 dark:text-slate-500">{message}</p>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 overflow-hidden">
      <div className="flex gap-2 mb-4">
        <div className="h-4 w-14 rounded skeleton-shimmer" />
        <div className="h-4 w-18 rounded skeleton-shimmer" />
      </div>
      <div className="h-5 w-40 rounded skeleton-shimmer" />
      <div className="mt-2 h-3 w-20 rounded skeleton-shimmer" />
      <div className="mt-3 h-3.5 w-full rounded skeleton-shimmer" />
      <div className="mt-2 h-3.5 w-3/4 rounded skeleton-shimmer" />
      <div className="mt-4 flex justify-end">
        <div className="h-8 w-24 rounded-lg skeleton-shimmer" />
      </div>
    </div>
  );
}

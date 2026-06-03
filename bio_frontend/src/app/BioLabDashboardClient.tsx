"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Cloud,
  Copy,
  Database,
  Dna,
  FlaskConical,
  LayoutDashboard,
  Loader2,
  Menu,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Terminal,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { api, GeneDataType, GeneProvider, GeneResult, GeneSearchBy, HealthData, PubMedResult, SequenceAnalysis, SystemStatus } from "@/lib/api";
import { LanguageToggle, Translate, useLanguage } from "@/lib/i18n";

type ActiveTab = "dashboard" | "search" | "sequence" | "api" | "settings";
type SearchMode = "local_first" | "local_only" | "external_refresh";
type StatusState = "idle" | "checking" | "online" | "offline";
type CountMap = Record<string, number>;

const sampleGenes = ["BRCA1", "TP53", "EGFR", "NM_007294"];

function asGeneId(gene: GeneResult) {
  return String(gene.gene_id ?? gene.external_id ?? gene.id ?? gene.symbol ?? "");
}

function safe(value: unknown, fallback = "Unknown") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function countWidth(counts: CountMap | undefined, base: string) {
  const total = Object.values(counts || {}).reduce((sum, value) => sum + Number(value || 0), 0);
  if (!total) return 0;
  return Math.max(3, (Number(counts?.[base] || 0) / total) * 100);
}

function copyText(value: string) {
  if (typeof navigator === "undefined") return;
  navigator.clipboard?.writeText(value).catch(() => undefined);
}

function statusTone(status: StatusState) {
  if (status === "online") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (status === "offline") return "bg-red-50 text-red-700 ring-red-200";
  if (status === "checking") return "bg-cyan-50 text-cyan-700 ring-cyan-200";
  return "bg-slate-100 text-slate-600 ring-slate-200";
}

export default function BioLabDashboard() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [query, setQuery] = useState("BRCA1");
  const [dataType, setDataType] = useState<GeneDataType>("gene");
  const [searchBy, setSearchBy] = useState<GeneSearchBy>("name");
  const [organism, setOrganism] = useState("");
  const [mode, setMode] = useState<SearchMode>("local_first");
  const [provider, setProvider] = useState<GeneProvider>("auto");
  const [fallbackEnabled, setFallbackEnabled] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [genes, setGenes] = useState<GeneResult[]>([]);
  const [geneLoading, setGeneLoading] = useState(false);
  const [geneError, setGeneError] = useState("");
  const [geneMessage, setGeneMessage] = useState("");

  const [sequence, setSequence] = useState("ATGCGTACGTAGCTAGCTAGCGCGCGTTAA");
  const [sequenceLoading, setSequenceLoading] = useState(false);
  const [sequenceError, setSequenceError] = useState("");
  const [sequenceResult, setSequenceResult] = useState<SequenceAnalysis | null>(null);

  const [pubmedQuery, setPubmedQuery] = useState("BRCA1 cancer");
  const [articles, setArticles] = useState<PubMedResult[]>([]);
  const [apiResponse, setApiResponse] = useState("");
  const [apiLoading, setApiLoading] = useState(false);

  const [status, setStatus] = useState<StatusState>("idle");
  const [health, setHealth] = useState<HealthData | SystemStatus | null>(null);
  const { t } = useLanguage();

  const sequenceCounts = useMemo<CountMap>(() => {
    if (!sequenceResult?.base_counts) return {};
    return sequenceResult.base_counts;
  }, [sequenceResult]);

  async function runGeneSearch(event?: FormEvent, override?: Partial<{ q: string; mode: SearchMode; tab: ActiveTab }>) {
    event?.preventDefault();
    const q = (override?.q ?? query).trim();
    if (!q) return;
    setQuery(q);
    setGeneLoading(true);
    setGeneError("");
    setGeneMessage("");
    setActiveTab(override?.tab ?? "search");

    try {
      const response = await api.searchGenes({
        q,
        dataType,
        searchBy,
        organism: organism.trim() || undefined,
        mode: override?.mode ?? mode,
        provider,
        fallback: fallbackEnabled,
      });
      setGenes(response.data || []);
      setGeneMessage(response.message || `Found ${(response.data || []).length} matching records.`);
    } catch (error) {
      setGenes([]);
      setGeneError(error instanceof Error ? error.message : "Unable to search genes.");
    } finally {
      setGeneLoading(false);
    }
  }

  async function runSequenceAnalysis(event?: FormEvent) {
    event?.preventDefault();
    const raw = sequence.replace(/\s+/g, "").toUpperCase();
    if (!raw) return;
    setSequenceLoading(true);
    setSequenceError("");
    setActiveTab("sequence");

    try {
      const response = await api.analyzeSequence(raw);
      setSequenceResult(response.data);
    } catch (error) {
      setSequenceResult(null);
      setSequenceError(error instanceof Error ? error.message : "Unable to analyze sequence.");
    } finally {
      setSequenceLoading(false);
    }
  }

  async function runApiPlayground(kind: "health" | "status" | "pubmed") {
    setApiLoading(true);
    setApiResponse("");
    try {
      const response = kind === "health"
        ? await api.health()
        : kind === "status"
        ? await api.systemStatus()
        : await api.searchPubmed(pubmedQuery);
      if (kind === "pubmed") setArticles((response.data || []) as PubMedResult[]);
      setApiResponse(JSON.stringify(response, null, 2));
    } catch (error) {
      setApiResponse(JSON.stringify({ error: error instanceof Error ? error.message : "Request failed" }, null, 2));
    } finally {
      setApiLoading(false);
    }
  }

  async function checkStatus() {
    setStatus("checking");
    try {
      const response = await api.health();
      setHealth(response.data);
      setStatus("online");
    } catch {
      setHealth(null);
      setStatus("offline");
    }
  }

  const statusLabel = status === "online" ? t("status.online") : status === "offline" ? t("status.offline") : status === "checking" ? t("status.checking") : t("status.idle");

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-950 antialiased">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={(tab) => { setActiveTab(tab); setMobileOpen(false); }}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        status={status}
        statusLabel={statusLabel}
        t={t}
      />

      <div className={`min-h-screen transition-[padding] duration-300 ease-out ${sidebarCollapsed ? "lg:pl-20" : "lg:pl-72"}`}>
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur-md md:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button onClick={() => setMobileOpen(true)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden" aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <p className="hidden text-[10px] font-black uppercase tracking-[0.24em] text-slate-400 sm:block">{t("workspace")}</p>
              <h1 className="text-sm font-black uppercase tracking-widest text-slate-900">{t(`tab.${activeTab}`)}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageToggle compact />
            <button onClick={checkStatus} className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-black ring-1 ${statusTone(status)}`}>
            {status === "checking" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cloud className="h-4 w-4" />}
              {statusLabel}
            </button>
          </div>
        </header>

        <main className="min-h-[calc(100vh-4rem)] p-4 md:p-8 dna-pattern">
          <div className="mx-auto max-w-7xl">
            {activeTab === "dashboard" && (
              <Dashboard
                onSearch={(value) => runGeneSearch(undefined, { q: value })}
                onOpenSearch={() => setActiveTab("search")}
                onOpenSequence={() => setActiveTab("sequence")}
                t={t}
              />
            )}

            {activeTab === "search" && (
              <SearchWorkspace
                query={query}
                setQuery={setQuery}
                dataType={dataType}
                setDataType={setDataType}
                searchBy={searchBy}
                setSearchBy={setSearchBy}
                organism={organism}
                setOrganism={setOrganism}
                mode={mode}
                setMode={setMode}
                provider={provider}
                setProvider={setProvider}
                fallbackEnabled={fallbackEnabled}
                setFallbackEnabled={setFallbackEnabled}
                showFilters={showFilters}
                setShowFilters={setShowFilters}
                onSubmit={runGeneSearch}
                loading={geneLoading}
                error={geneError}
                message={geneMessage}
                genes={genes}
                t={t}
              />
            )}

            {activeTab === "sequence" && (
              <SequenceWorkspace
                sequence={sequence}
                setSequence={setSequence}
                loading={sequenceLoading}
                error={sequenceError}
                result={sequenceResult}
                counts={sequenceCounts}
                onSubmit={runSequenceAnalysis}
                t={t}
              />
            )}

            {activeTab === "api" && (
              <ApiWorkspace
                pubmedQuery={pubmedQuery}
                setPubmedQuery={setPubmedQuery}
                runApiPlayground={runApiPlayground}
                loading={apiLoading}
                response={apiResponse}
                articles={articles}
                t={t}
              />
            )}

            {activeTab === "settings" && <SettingsWorkspace health={health} t={t} />}
          </div>
        </main>
      </div>
    </div>
  );
}

function Sidebar({
  activeTab,
  setActiveTab,
  mobileOpen,
  setMobileOpen,
  collapsed,
  setCollapsed,
  status,
  statusLabel,
  t,
}: {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  collapsed: boolean;
  setCollapsed: (value: boolean) => void;
  status: StatusState;
  statusLabel: string;
  t: Translate;
}) {
  const items = [
    { id: "dashboard" as const, label: t("tab.dashboard"), icon: LayoutDashboard },
    { id: "search" as const, label: t("tab.search"), icon: Search },
    { id: "sequence" as const, label: t("tab.sequence"), icon: Dna },
    { id: "api" as const, label: t("tab.api"), icon: Terminal },
    { id: "settings" as const, label: t("tab.settings"), icon: Settings },
  ];

  const providerFlow = "NCBI → Ensembl → UniProt → BV-BRC → Phytozome → Local";
  const statusDot = status === "online" ? "bg-emerald-400" : status === "offline" ? "bg-red-400" : status === "checking" ? "bg-cyan-400 animate-pulse" : "bg-slate-500";

  function sidebarContent(isCollapsed: boolean, isMobile = false) {
    return (
      <aside className={`flex h-full flex-col border-r border-white/10 bg-slate-950 text-white shadow-2xl shadow-slate-950/20 transition-[width] duration-300 ease-out ${isMobile ? "w-72" : isCollapsed ? "w-20" : "w-72"}`}>
        <div className={`flex h-16 items-center border-b border-white/10 ${isCollapsed && !isMobile ? "justify-center px-3" : "justify-between px-4"}`}>
          <div className={`flex min-w-0 items-center gap-3 ${isCollapsed && !isMobile ? "justify-center" : ""}`}>
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-cyan-300/30 bg-cyan-300/10 text-cyan-300 shadow-sm shadow-cyan-500/10">
              <Dna className="h-5 w-5" />
            </div>
            {(!isCollapsed || isMobile) && (
              <div className="min-w-0">
                <h1 className="truncate text-sm font-black tracking-wide">BIOLAB <span className="text-cyan-300">AI</span></h1>
                <p className="truncate text-[9px] font-bold uppercase tracking-[0.24em] text-cyan-500">{t("sidebar.subtitle")}</p>
              </div>
            )}
          </div>

          {!isMobile && (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="hidden rounded-xl border border-white/10 bg-white/5 p-2 text-slate-400 transition hover:bg-white/10 hover:text-cyan-300 lg:inline-flex"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          )}
        </div>

        <nav className="flex-1 space-y-2 p-3 pt-5">
          {items.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                title={isCollapsed && !isMobile ? item.label : undefined}
                className={`group relative flex w-full items-center rounded-2xl text-left text-xs font-black uppercase tracking-wider transition ${isCollapsed && !isMobile ? "justify-center px-0 py-3.5" : "gap-3 px-4 py-3"} ${active ? "bg-cyan-400/15 text-cyan-200 ring-1 ring-cyan-300/20" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
              >
                <span className={`grid h-5 w-5 shrink-0 place-items-center ${active ? "text-cyan-300" : "text-slate-500 group-hover:text-cyan-300"}`}>
                  <Icon className="h-5 w-5" />
                </span>
                {(!isCollapsed || isMobile) && <span className="truncate">{item.label}</span>}
                {active && <span className={`absolute rounded-full bg-cyan-300 ${isCollapsed && !isMobile ? "right-1 h-6 w-1" : "left-1 h-6 w-1"}`} />}
                {isCollapsed && !isMobile && (
                  <span className="pointer-events-none absolute left-[4.7rem] z-50 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-[11px] font-black text-white opacity-0 shadow-xl transition group-hover:translate-x-1 group-hover:opacity-100">
                    {item.label}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="space-y-3 border-t border-white/10 p-3">
          <button
            onClick={() => setActiveTab("search")}
            title={isCollapsed && !isMobile ? "New analysis" : undefined}
            className={`group relative flex w-full items-center rounded-2xl bg-cyan-300 px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-950 shadow-lg shadow-cyan-500/10 transition hover:bg-cyan-200 ${isCollapsed && !isMobile ? "justify-center px-0" : "justify-center gap-2"}`}
          >
            <Zap className="h-4 w-4" />
            {(!isCollapsed || isMobile) && t("sidebar.newAnalysis")}
            {isCollapsed && !isMobile && (
              <span className="pointer-events-none absolute left-[4.7rem] z-50 whitespace-nowrap rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-[11px] font-black text-white opacity-0 shadow-xl transition group-hover:translate-x-1 group-hover:opacity-100">
                {t("sidebar.newAnalysis")}
              </span>
            )}
          </button>

          <div className={`rounded-2xl border border-white/10 bg-white/[0.04] ${isCollapsed && !isMobile ? "p-3" : "p-4"}`}>
            <div className={`flex items-center ${isCollapsed && !isMobile ? "justify-center" : "justify-between gap-3"}`}>
              <div className={`flex items-center gap-2 ${isCollapsed && !isMobile ? "justify-center" : ""}`}>
                <span className={`h-2.5 w-2.5 rounded-full ${statusDot}`} />
                {(!isCollapsed || isMobile) && <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">{statusLabel}</span>}
              </div>
              {(!isCollapsed || isMobile) && <Cloud className="h-4 w-4 text-slate-500" />}
            </div>
            {(!isCollapsed || isMobile) && (
              <p className="mt-3 text-[11px] font-semibold leading-5 text-slate-500">
                {t("sidebar.autoFallback")}: {providerFlow}
              </p>
            )}
          </div>
        </div>
      </aside>
    );
  }

  return (
    <>
      <div className="fixed left-0 top-0 z-50 hidden h-screen lg:block">
        {sidebarContent(collapsed)}
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)}>
          <div className="relative h-full" onClick={(event) => event.stopPropagation()}>
            <button onClick={() => setMobileOpen(false)} className="absolute left-[18.5rem] top-4 rounded-xl bg-white p-2 text-slate-900 shadow-lg" aria-label="Close menu">
              <X className="h-5 w-5" />
            </button>
            {sidebarContent(false, true)}
          </div>
        </div>
      )}
    </>
  );
}

function Dashboard({ onSearch, onOpenSearch, onOpenSequence, t }: { onSearch: (value: string) => void; onOpenSearch: () => void; onOpenSequence: () => void; t: Translate }) {
  return (
    <section className="space-y-6 animate-fadeIn">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <span className="inline-flex items-center rounded-full bg-cyan-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-cyan-700 ring-1 ring-cyan-100">{t("dashboard.badge")}</span>
            <h2 className="mt-5 max-w-3xl text-4xl font-black leading-tight tracking-tight text-slate-950 md:text-5xl">{t("dashboard.title")}</h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-500">{t("dashboard.desc")}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button onClick={onOpenSearch} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-xs font-black uppercase tracking-wider text-white shadow-sm hover:bg-cyan-600">{t("dashboard.startSearch")} <ArrowRight className="h-4 w-4" /></button>
              <button onClick={onOpenSequence} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-5 py-3 text-xs font-black uppercase tracking-wider text-slate-700 hover:bg-white">{t("dashboard.analyzeSequence")} <Dna className="h-4 w-4 text-cyan-500" /></button>
            </div>
          </div>
          <div className="rounded-2xl bg-slate-950 p-5 text-white shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-xs font-black uppercase tracking-widest text-cyan-300">{t("dashboard.quickTargets")}</p>
              <Activity className="h-4 w-4 text-cyan-300" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {sampleGenes.map((gene) => (
                <button key={gene} onClick={() => onSearch(gene)} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4 text-left hover:border-cyan-300/50 hover:bg-cyan-300/10">
                  <span><strong className="block text-sm font-black">{gene}</strong><span className="text-[11px] font-semibold text-slate-400">{t("dashboard.searchViaBackend")}</span></span>
                  <ArrowRight className="h-4 w-4 text-cyan-300" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <FeatureCard icon={Search} title={t("feature.search.title")} text={t("feature.search.text")} />
        <FeatureCard icon={BarChart3} title={t("feature.visualization.title")} text={t("feature.visualization.text")} />
        <FeatureCard icon={Database} title={t("feature.fallback.title")} text={t("feature.fallback.text")} />
      </div>
    </section>
  );
}

function SearchWorkspace(props: {
  query: string;
  setQuery: (value: string) => void;
  dataType: GeneDataType;
  setDataType: (value: GeneDataType) => void;
  searchBy: GeneSearchBy;
  setSearchBy: (value: GeneSearchBy) => void;
  organism: string;
  setOrganism: (value: string) => void;
  mode: SearchMode;
  setMode: (value: SearchMode) => void;
  provider: GeneProvider;
  setProvider: (value: GeneProvider) => void;
  fallbackEnabled: boolean;
  setFallbackEnabled: (value: boolean) => void;
  showFilters: boolean;
  setShowFilters: (value: boolean) => void;
  onSubmit: (event?: FormEvent) => void;
  loading: boolean;
  error: string;
  message: string;
  genes: GeneResult[];
  t: Translate;
}) {
  const { query, setQuery, dataType, setDataType, searchBy, setSearchBy, organism, setOrganism, mode, setMode, provider, setProvider, fallbackEnabled, setFallbackEnabled, showFilters, setShowFilters, onSubmit, loading, error, message, genes, t } = props;

  return (
    <section className="space-y-6 animate-fadeIn">
      <div className="mx-auto max-w-5xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <div className="text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-cyan-600">{t("search.badge")}</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">{t("search.title")}</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-500">{t("search.desc")}</p>
        </div>

        <form onSubmit={onSubmit} className="mx-auto mt-7 max-w-3xl">
          <div className="flex items-center rounded-2xl border border-slate-200 bg-slate-50 p-1.5 shadow-sm transition focus-within:border-cyan-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-cyan-100">
            <Search className="ml-3 h-5 w-5 shrink-0 text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm font-bold outline-none placeholder:text-slate-400" placeholder={t("search.placeholder")} />
            <button type="button" onClick={() => setShowFilters(!showFilters)} className={`hidden items-center gap-2 rounded-xl px-3 py-2 text-xs font-black sm:inline-flex ${showFilters ? "bg-slate-200 text-slate-900" : "text-slate-500 hover:bg-white"}`}>
              <SlidersHorizontal className="h-4 w-4" /> {t("search.filters")}
            </button>
            <button disabled={loading} className="inline-flex w-28 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-xs font-black uppercase tracking-wider text-white hover:bg-cyan-600 disabled:opacity-50">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("search.button")}
            </button>
          </div>

          <button type="button" onClick={() => setShowFilters(!showFilters)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-600 sm:hidden">
            <SlidersHorizontal className="h-4 w-4" /> {t("search.advancedFilters")} <ChevronDown className={`h-4 w-4 transition ${showFilters ? "rotate-180" : ""}`} />
          </button>

          {showFilters && (
            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="grid gap-4 p-5 md:grid-cols-3">
                <FilterSelect label={t("search.dataType")} value={dataType} onChange={(value) => setDataType(value as GeneDataType)} options={[["gene",t("select.gene")],["nucleotide",t("select.nucleotide")],["protein",t("select.protein")]]} />
                <FilterSelect label={t("search.searchBy")} value={searchBy} onChange={(value) => setSearchBy(value as GeneSearchBy)} options={[["name",t("select.name")],["accession",t("select.accession")],["id",t("select.id")]]} />
                <FilterSelect label={t("search.mode")} value={mode} onChange={(value) => setMode(value as SearchMode)} options={[["local_first",t("select.localFirst")],["local_only",t("select.localOnly")],["external_refresh",t("select.externalRefresh")]]} />
                <FilterSelect label={t("search.provider")} value={provider} onChange={(value) => setProvider(value as GeneProvider)} options={[["auto",t("select.autoFallback")],["ncbi","NCBI"],["ensembl","Ensembl"],["uniprot","UniProt"],["bvbrc","BV-BRC"],["phytozome","Phytozome"]]} />
                <label className="space-y-1 md:col-span-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t("search.organism")}</span>
                  <input value={organism} onChange={(event) => setOrganism(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold outline-none focus:border-cyan-400" placeholder={t("search.organismPlaceholder")} />
                </label>
              </div>
              <label className="flex cursor-pointer items-center gap-3 border-t border-slate-100 bg-cyan-50 px-5 py-4 text-xs font-bold text-slate-700">
                <input type="checkbox" checked={fallbackEnabled} onChange={(event) => setFallbackEnabled(event.target.checked)} className="h-4 w-4 accent-cyan-600" />
                {t("search.fallbackFlow")}
              </label>
            </div>
          )}
        </form>
      </div>

      {error && <Notice tone="red" title={t("search.failed")} message={error} />}
      {message && !error && <Notice tone="cyan" title={t("search.backendResponse")} message={message} />}

      <div className="grid gap-4">
        {loading && Array.from({ length: 3 }).map((_, index) => <SkeletonCard key={index} />)}
        {!loading && genes.length === 0 && !error && <EmptyState title={t("search.emptyTitle")} message={t("search.emptyMessage")} />}
        {!loading && genes.map((gene) => <GeneCard key={`${asGeneId(gene)}-${gene.symbol}`} gene={gene} t={t} />)}
      </div>
    </section>
  );
}

function SequenceWorkspace({ sequence, setSequence, loading, error, result, counts, onSubmit, t }: { sequence: string; setSequence: (value: string) => void; loading: boolean; error: string; result: SequenceAnalysis | null; counts: CountMap; onSubmit: (event?: FormEvent) => void; t: Translate }) {
  return (
    <section className="grid gap-6 lg:grid-cols-12 animate-fadeIn">
      <form onSubmit={onSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-5">
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-cyan-600">{t("sequence.badge")}</p>
        <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">{t("sequence.title")}</h2>
        <p className="mt-3 text-sm leading-6 text-slate-500">{t("sequence.desc")}</p>
        <textarea value={sequence} onChange={(event) => setSequence(event.target.value)} className="mt-5 min-h-72 w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-6 outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100" />
        {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700">{error}</p>}
        <button disabled={loading} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-xs font-black uppercase tracking-wider text-white hover:bg-cyan-600 disabled:opacity-50">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          {t("sequence.button")}
        </button>
      </form>

      <div className="space-y-6 lg:col-span-7">
        <MetricsPanel result={result} counts={counts} t={t} />
        {result ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">{t("sequence.outputs")}</h3>
              <button onClick={() => copyText(result.reverse_complement || "")} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"><Copy className="h-4 w-4" />{t("sequence.copyReverse")}</button>
            </div>
            <Output label={t("sequence.reverse")} value={result.reverse_complement} />
            <Output label={t("sequence.rna")} value={result.rna_sequence} />
          </div>
        ) : <EmptyState title={t("sequence.emptyTitle")} message={t("sequence.emptyMessage")} />}
      </div>
    </section>
  );
}

function ApiWorkspace({ pubmedQuery, setPubmedQuery, runApiPlayground, loading, response, articles, t }: { pubmedQuery: string; setPubmedQuery: (value: string) => void; runApiPlayground: (kind: "health" | "status" | "pubmed") => void; loading: boolean; response: string; articles: PubMedResult[]; t: Translate }) {
  return (
    <section className="space-y-6 animate-fadeIn">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-3xl font-black text-slate-950"><Terminal className="h-7 w-7 text-cyan-500" /> {t("api.title")}</h2>
        <p className="mt-2 text-sm text-slate-500">{t("api.desc")}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button onClick={() => runApiPlayground("health")} className="rounded-xl bg-slate-950 px-4 py-3 text-xs font-black uppercase tracking-wider text-white">GET /health</button>
          <button onClick={() => runApiPlayground("status")} className="rounded-xl bg-slate-100 px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-700">GET /system/status</button>
          <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1">
            <input value={pubmedQuery} onChange={(event) => setPubmedQuery(event.target.value)} className="bg-transparent px-3 text-xs font-bold outline-none" />
            <button onClick={() => runApiPlayground("pubmed")} className="rounded-lg bg-white px-3 text-xs font-black text-slate-700 shadow-sm">PubMed</button>
          </div>
        </div>
      </div>
      <pre className="max-h-[520px] overflow-auto rounded-2xl bg-slate-950 p-5 text-xs leading-6 text-cyan-50 shadow-sm">{loading ? t("api.loading") : response || t("api.empty")}</pre>
      {!!articles.length && <p className="text-xs font-bold text-slate-500">Latest PubMed result in this session: {articles[0]?.title}</p>}
    </section>
  );
}

function SettingsWorkspace({ health, t }: { health: HealthData | SystemStatus | null; t: Translate }) {
  return (
    <section className="grid gap-6 lg:grid-cols-2 animate-fadeIn">
      <SettingsCard icon={ShieldCheck} title={t("settings.runtime")} text="Frontend vẫn gọi backend thông qua Next.js proxy `/api/backend`, tránh hard-code host và giữ API key cho endpoint system status qua biến NEXT_PUBLIC_API_KEY." />
      <SettingsCard icon={Database} title={t("settings.data")} text="Luồng dữ liệu giữ nguyên: local_first để ưu tiên cache, local_only để demo offline, external_refresh để ép cập nhật; provider=auto và fallback=true để backend tự thử nhiều nguồn." />
      <SettingsCard icon={FlaskConical} title={t("settings.ux")} text="Các vùng FASTA, sequence, GC content, nucleotide composition và trạng thái fallback được tách thành card rõ ràng để phù hợp đồ án tốt nghiệp." />
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="flex items-center gap-2 text-lg font-black text-slate-950"><Cloud className="h-5 w-5 text-cyan-500" />{t("settings.snapshot")}</h3>
        <pre className="mt-4 max-h-64 overflow-auto rounded-xl bg-slate-950 p-4 text-xs leading-6 text-cyan-50">{health ? JSON.stringify(health, null, 2) : t("settings.snapshotEmpty")}</pre>
      </div>
    </section>
  );
}

function GeneCard({ gene, t }: { gene: GeneResult; t: Translate }) {
  const id = asGeneId(gene);
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-md">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-cyan-50 px-2.5 py-1 font-mono text-[10px] font-black uppercase tracking-wider text-cyan-800 ring-1 ring-cyan-100">{safe(gene.data_type, "gene")}</span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500">{safe(gene.database, "database")}</span>
            {gene.source && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-700 ring-1 ring-emerald-100">{gene.source}</span>}
          </div>
          <h3 className="mt-3 text-2xl font-black text-slate-950">{safe(gene.symbol || gene.name, `Gene ${id}`)}</h3>
          <p className="mt-2 line-clamp-2 max-w-4xl text-sm leading-6 text-slate-500">{safe(gene.description || gene.name, t("geneCard.noDescription"))}</p>
          <div className="mt-4 grid gap-3 text-xs font-bold text-slate-500 sm:grid-cols-3">
            <span><strong className="block text-[10px] uppercase tracking-wider text-slate-400">{t("geneCard.accession")}</strong>{id}</span>
            <span><strong className="block text-[10px] uppercase tracking-wider text-slate-400">{t("geneCard.organism")}</strong>{safe(gene.organism)}</span>
            <span><strong className="block text-[10px] uppercase tracking-wider text-slate-400">{t("geneCard.external")}</strong>{safe(gene.external_id ?? gene.gene_id ?? gene.id)}</span>
          </div>
        </div>
        <Link href={`/genes/${encodeURIComponent(id)}`} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-xs font-black uppercase tracking-wider text-white hover:bg-cyan-600">{t("geneCard.viewDetail")} <ArrowRight className="h-4 w-4" /></Link>
      </div>
    </article>
  );
}

function MetricsPanel({ result, counts, t }: { result: SequenceAnalysis | null; counts: CountMap; t: Translate }) {
  const gc = result?.gc_content_percent ?? 0;
  const circumference = 351.85;
  const offset = circumference - (Number(gc || 0) / 100) * circumference;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">{t("sequence.metrics")}</h3>
      <div className="mt-5 grid gap-6 md:grid-cols-3">
        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <div className="relative flex h-32 w-32 items-center justify-center">
            <svg className="h-full w-full -rotate-90"><circle cx="64" cy="64" r="56" fill="transparent" stroke="currentColor" strokeWidth="8" className="text-slate-200" /><circle cx="64" cy="64" r="56" fill="transparent" stroke="currentColor" strokeWidth="8" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="text-cyan-400" /></svg>
            <div className="absolute text-center"><span className="block text-2xl font-black text-slate-950">{Number(gc).toFixed(1)}%</span><span className="text-[9px] font-black uppercase tracking-wider text-slate-400">GC content</span></div>
          </div>
        </div>
        <div className="space-y-3 md:col-span-2">
          {(["A", "T", "G", "C"] as const).map((base) => <div key={base}><div className="mb-1 flex justify-between font-mono text-xs font-bold text-slate-600"><span>{base}</span><span>{counts[base] || 0}</span></div><div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-cyan-400" style={{ width: `${countWidth(counts, base)}%` }} /></div></div>)}
          <div className="grid gap-3 sm:grid-cols-2"><MiniStat label={t("sequence.length")} value={result ? result.sequence_length.toLocaleString() : "0"} /><MiniStat label={t("sequence.validBases")} value={Object.values(counts).reduce((s, v) => s + Number(v || 0), 0).toLocaleString()} /></div>
        </div>
      </div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<[string, string]> }) {
  return (
    <label className="space-y-1">
      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold outline-none focus:border-cyan-400">
        {options.map(([optionValue, labelText]) => <option key={optionValue} value={optionValue}>{labelText}</option>)}
      </select>
    </label>
  );
}

function Output({ label, value }: { label: string; value?: string }) {
  return <div className="mb-4"><div className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</div><pre className="max-h-40 overflow-auto rounded-xl bg-slate-50 p-4 font-mono text-xs leading-6 text-slate-700">{value || "Not available"}</pre></div>;
}

function Notice({ tone, title, message }: { tone: "red" | "cyan"; title: string; message: string }) {
  const red = tone === "red";
  return <div className={`flex items-start gap-3 rounded-2xl border p-4 text-sm shadow-sm ${red ? "border-red-200 bg-red-50 text-red-800" : "border-cyan-200 bg-cyan-50 text-cyan-900"}`}><AlertCircle className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-black">{title}</p><p className="mt-1 text-xs font-semibold leading-5">{message}</p></div></div>;
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-300 bg-white/85 p-8 text-center shadow-sm"><Dna className="mx-auto h-10 w-10 text-cyan-400" /><h3 className="mt-3 text-lg font-black text-slate-950">{title}</h3><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">{message}</p></div>;
}

function SkeletonCard() {
  return <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="h-4 w-32 rounded bg-slate-100" /><div className="mt-4 h-7 w-64 rounded bg-slate-100" /><div className="mt-3 h-4 w-full rounded bg-slate-100" /><div className="mt-2 h-4 w-2/3 rounded bg-slate-100" /></div>;
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-lg font-black text-slate-950">{value}</p></div>;
}

function FeatureCard({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><Icon className="h-6 w-6 text-cyan-500" /><h3 className="mt-4 text-lg font-black text-slate-950">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{text}</p></div>;
}

function SettingsCard({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h3 className="flex items-center gap-2 text-lg font-black text-slate-950"><Icon className="h-5 w-5 text-cyan-500" />{title}</h3><p className="mt-3 text-sm leading-7 text-slate-500">{text}</p></div>;
}

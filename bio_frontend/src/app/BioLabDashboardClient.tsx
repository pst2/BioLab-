"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
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
  Globe,
  LayoutDashboard,
  Loader2,
  Menu,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Terminal,
  TrendingUp,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { api, GeneDataType, GeneProvider, GeneResult, GeneSearchBy, HealthData, PubMedResult, SequenceAnalysis, SystemStatus, ApiError } from "@/lib/api";
import { LanguageToggle, ThemeToggle, Translate, useLanguage } from "@/lib/i18n";
import { useToast } from "@/lib/Toast";

type ActiveTab = "dashboard" | "search" | "sequence" | "api" | "settings";
type SearchMode = "local_first" | "local_only" | "external_refresh";
type StatusState = "idle" | "checking" | "online" | "offline";
type CountMap = Record<string, number>;

const SEARCH_STATE_KEY = "biolab:search_state";

const sampleGenes = ["BRCA1", "TP53", "EGFR", "NM_007294", "P53_HUMAN", "APOE"];

const PROVIDERS = [
  { name: "NCBI", color: "bg-blue-400" },
  { name: "Ensembl", color: "bg-purple-400" },
  { name: "UniProt", color: "bg-emerald-400" },
  { name: "BV-BRC", color: "bg-orange-400" },
  { name: "Phytozome", color: "bg-teal-400" },
];

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
  if (status === "online") return "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-800";
  if (status === "offline") return "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 ring-red-200 dark:ring-red-800";
  if (status === "checking") return "bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 ring-cyan-200 dark:ring-cyan-800";
  return "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 ring-slate-200 dark:ring-slate-700";
}

/** Return CSS class name for a data_type/source tag */
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
  const toast = useToast();

  // Restore search state from sessionStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = window.sessionStorage.getItem(SEARCH_STATE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.query !== undefined) setQuery(parsed.query);
        if (parsed.dataType) setDataType(parsed.dataType);
        if (parsed.searchBy) setSearchBy(parsed.searchBy);
        if (parsed.organism !== undefined) setOrganism(parsed.organism);
        if (parsed.mode) setMode(parsed.mode);
        if (parsed.provider) setProvider(parsed.provider);
        if (parsed.fallbackEnabled !== undefined) setFallbackEnabled(parsed.fallbackEnabled);
        if (Array.isArray(parsed.genes) && parsed.genes.length > 0) setGenes(parsed.genes);
        if (parsed.geneMessage) setGeneMessage(parsed.geneMessage);
        if (parsed.activeTab) setActiveTab(parsed.activeTab);
      }
    } catch {}
  }, []);

  // Persist search state to sessionStorage whenever state updates
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(
        SEARCH_STATE_KEY,
        JSON.stringify({
          query,
          dataType,
          searchBy,
          organism,
          mode,
          provider,
          fallbackEnabled,
          genes,
          geneMessage,
          activeTab,
        })
      );
    } catch {}
  }, [query, dataType, searchBy, organism, mode, provider, fallbackEnabled, genes, geneMessage, activeTab]);

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
      const results = response.data || [];
      setGenes(results);
      const msg = response.message || `Found ${results.length} matching records.`;
      setGeneMessage(msg);
      if (results.length > 0) {
        toast.success(`${t("toast.searchSuccess")}: ${results.length}`);
      } else {
        toast.info(t("toast.searchEmpty"));
      }
    } catch (error) {
      setGenes([]);
      const errMsg = error instanceof Error ? error.message : "Unable to search genes.";
      setGeneError(errMsg);
      if (error instanceof ApiError && error.status === 429) {
        toast.error(t("toast.rateLimited"));
      } else {
        toast.error(errMsg);
      }
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
      toast.success(t("toast.analysisComplete"));
    } catch (error) {
      setSequenceResult(null);
      const errMsg = error instanceof Error ? error.message : "Unable to analyze sequence.";
      setSequenceError(errMsg);
      toast.error(errMsg);
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
      toast.success(t("toast.serverOnline"));
    } catch {
      setHealth(null);
      setStatus("offline");
      toast.error(t("toast.serverOffline"));
    }
  }

  const statusLabel = status === "online" ? t("status.online") : status === "offline" ? t("status.offline") : status === "checking" ? t("status.checking") : t("status.idle");

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] antialiased transition-colors duration-200">
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
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-slate-200/70 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 px-4 backdrop-blur-md md:px-8" style={{ boxShadow: "0 1px 0 rgba(148,163,184,0.15)" }}>
          <div className="flex min-w-0 items-center gap-3">
            <button onClick={() => setMobileOpen(true)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden" aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <p className="hidden text-[10px] font-medium uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500 sm:block">{t("workspace")}</p>
              <h1 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">{t(`tab.${activeTab}`)}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <LanguageToggle compact />
            <button onClick={checkStatus} className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition ${statusTone(status)}`}>
              {status === "checking" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cloud className="h-4 w-4" />}
              {statusLabel}
            </button>
          </div>
        </header>

        <main className="min-h-[calc(100vh-4rem)] p-4 md:p-8 dna-pattern">
          <div className="mx-auto max-w-7xl">
            {activeTab === "dashboard" && (
              <div className="page-enter">
                <Dashboard
                  onSearch={(value) => runGeneSearch(undefined, { q: value })}
                  onOpenSearch={() => setActiveTab("search")}
                  onOpenSequence={() => setActiveTab("sequence")}
                  t={t}
                />
              </div>
            )}

            {activeTab === "search" && (
              <div className="page-enter">
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
              </div>
            )}

            {activeTab === "sequence" && (
              <div className="page-enter">
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
              </div>
            )}

            {activeTab === "api" && (
              <div className="page-enter">
                <ApiWorkspace
                  pubmedQuery={pubmedQuery}
                  setPubmedQuery={setPubmedQuery}
                  runApiPlayground={runApiPlayground}
                  loading={apiLoading}
                  response={apiResponse}
                  articles={articles}
                  t={t}
                />
              </div>
            )}

            {activeTab === "settings" && (
              <div className="page-enter">
                <SettingsWorkspace health={health} t={t} />
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   SIDEBAR
═══════════════════════════════════════════ */
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

  const statusDot =
    status === "online" ? "bg-emerald-400" :
    status === "offline" ? "bg-red-400" :
    status === "checking" ? "bg-cyan-400 animate-pulse" :
    "bg-slate-500";

  function sidebarContent(isCollapsed: boolean, isMobile = false) {
    return (
      <aside
        className={`flex h-full flex-col border-r border-white/[0.06] text-white shadow-2xl shadow-slate-950/40 transition-[width] duration-300 ease-out sidebar-gradient ${isMobile ? "w-72" : isCollapsed ? "w-20" : "w-72"}`}
      >
        {/* Logo */}
        <div className={`flex h-16 items-center border-b border-white/[0.08] ${isCollapsed && !isMobile ? "justify-center px-3" : "justify-between px-4"}`}>
          <div className={`flex min-w-0 items-center gap-3 ${isCollapsed && !isMobile ? "justify-center" : ""}`}>
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-300 sidebar-logo-glow">
              <Dna className="h-5 w-5" />
            </div>
            {(!isCollapsed || isMobile) && (
              <div className="min-w-0">
                <h1 className="truncate text-sm font-semibold tracking-tight">BIOLAB <span className="text-cyan-300">AI</span></h1>
                <p className="truncate text-[9px] font-medium uppercase tracking-[0.14em] text-cyan-500/70">{t("sidebar.subtitle")}</p>
              </div>
            )}
          </div>

          {!isMobile && (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="hidden rounded-xl border border-white/10 bg-white/5 p-2 text-slate-400 transition hover:bg-white/10 hover:text-cyan-300 lg:inline-flex"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          )}
        </div>

        {/* Nav items */}
        <nav className="flex-1 space-y-1 p-3 pt-5">
          {items.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                title={isCollapsed && !isMobile ? item.label : undefined}
                className={`group relative flex w-full items-center rounded-xl text-left text-xs font-medium transition-all duration-150 ${
                  isCollapsed && !isMobile ? "justify-center px-0 py-3.5" : "gap-3 px-4 py-2.5"
                } ${active ? "sidebar-nav-active text-cyan-200" : "text-slate-400 hover:bg-white/[0.05] hover:text-slate-200"}`}
              >
                <span className={`grid h-4 w-4 shrink-0 place-items-center ${active ? "text-cyan-300" : "text-slate-500 group-hover:text-slate-300 transition-colors"}`}>
                  <Icon className="h-4 w-4" />
                </span>
                {(!isCollapsed || isMobile) && <span className="truncate">{item.label}</span>}
                {isCollapsed && !isMobile && (
                  <span className="pointer-events-none absolute left-[4.7rem] z-50 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-[11px] font-medium text-white opacity-0 shadow-xl transition group-hover:translate-x-1 group-hover:opacity-100">
                    {item.label}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom: CTA + System Status */}
        <div className="space-y-3 border-t border-white/[0.08] p-3">
          {/* New analysis button */}
          <button
            onClick={() => setActiveTab("search")}
            title={isCollapsed && !isMobile ? "New analysis" : undefined}
            className={`group relative flex w-full items-center rounded-xl bg-cyan-400 px-4 py-2.5 text-xs font-semibold text-slate-950 transition hover:bg-cyan-300 ${isCollapsed && !isMobile ? "justify-center px-0" : "justify-center gap-2"}`}
            style={{ boxShadow: "0 2px 8px rgba(34,211,238,0.2)" }}
          >
            <Zap className="h-3.5 w-3.5" />
            {(!isCollapsed || isMobile) && t("sidebar.newAnalysis")}
            {isCollapsed && !isMobile && (
              <span className="pointer-events-none absolute left-[4.7rem] z-50 whitespace-nowrap rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-[11px] font-medium text-white opacity-0 shadow-xl transition group-hover:translate-x-1 group-hover:opacity-100">
                {t("sidebar.newAnalysis")}
              </span>
            )}
          </button>

          {/* System Status Panel */}
          <div className={`rounded-xl border border-white/[0.07] bg-white/[0.03] ${isCollapsed && !isMobile ? "p-3" : "p-3.5"}`}>
            {(!isCollapsed || isMobile) ? (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-slate-500">System Status</span>
                  <span className={`h-1.5 w-1.5 rounded-full ${statusDot}`} />
                </div>
                <div className="space-y-1.5">
                  {PROVIDERS.map((p) => (
                    <div key={p.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`h-1.5 w-1.5 rounded-full ${status === "offline" ? "bg-red-400" : p.color}`} />
                        <span className="text-[10px] font-normal text-slate-500">{p.name}</span>
                      </div>
                      {status === "checking" ? (
                        <span className="text-[9px] text-slate-500 animate-pulse">…</span>
                      ) : status === "offline" ? (
                        <span className="text-[9px] text-red-400">offline</span>
                      ) : (
                        <span className="text-[9px] text-emerald-400">ok</span>
                      )}
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[9px] leading-4 text-slate-600">
                  {t("sidebar.autoFallback")}
                </p>
              </>
            ) : (
              <div className="flex justify-center">
                <span className={`h-2 w-2 rounded-full ${statusDot}`} />
              </div>
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

/* ═══════════════════════════════════════════
   DASHBOARD
═══════════════════════════════════════════ */
const DASHBOARD_METRICS = [
  { labelKey: "metric.genesIndexed", value: "2.1M", icon: Database, delay: "0ms", color: "text-cyan-600" },
  { labelKey: "metric.providers", value: "5", icon: Globe, delay: "60ms", color: "text-purple-600" },
  { labelKey: "metric.successRate", value: "98.7%", icon: TrendingUp, delay: "120ms", color: "text-emerald-600" },
  { labelKey: "metric.queriesToday", value: "128", icon: Activity, delay: "180ms", color: "text-orange-600" },
];

function Dashboard({ onSearch, onOpenSearch, onOpenSequence, t }: { onSearch: (value: string) => void; onOpenSearch: () => void; onOpenSequence: () => void; t: Translate }) {
  const [searchInput, setSearchInput] = useState("BRCA1");

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    if (searchInput.trim()) onSearch(searchInput.trim());
  }

  return (
    <section className="space-y-6 animate-fadeIn">
      {/* Hero — search-first */}
      <div
        className="relative overflow-hidden rounded-xl p-6 md:p-10"
        style={{
          background: "linear-gradient(135deg, #020617 0%, #071827 50%, #0c2340 100%)",
          boxShadow: "0 1px 0 rgba(34,211,238,0.06), 0 16px 48px rgba(2,6,23,0.35)",
        }}
      >
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-md border border-cyan-300/15 bg-cyan-300/8 px-2.5 py-1 text-[10px] font-medium tracking-wide text-cyan-300/90">
            <Dna className="h-3 w-3" />
            {t("dashboard.badge")}
          </span>

          <h2 className="mt-4 text-3xl font-bold leading-tight tracking-tight text-white md:text-4xl">
            {t("dashboard.title")}
          </h2>

          {/* Search box */}
          <form onSubmit={handleSearch} className="mt-6 flex max-w-2xl items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search gene, protein, accession..."
                className="w-full rounded-lg border border-white/8 bg-white/8 py-3 pl-11 pr-4 text-sm text-white placeholder:text-slate-500 outline-none focus:border-white/20 focus:bg-white/12 transition"
              />
            </div>
            <button
              type="submit"
              className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
              style={{ boxShadow: "0 2px 12px rgba(34,211,238,0.25)" }}
            >
              Search <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          {/* Gene suggestion chips */}
          <div className="mt-4 flex flex-wrap gap-1.5">
            <span className="text-[10px] font-medium text-slate-600 self-center mr-1">Try:</span>
            {sampleGenes.map((gene) => (
              <button
                key={gene}
                onClick={() => onSearch(gene)}
                className="rounded-md border border-white/8 bg-white/5 px-2.5 py-1 font-mono text-[11px] text-slate-400 transition hover:border-white/15 hover:bg-white/10 hover:text-white"
              >
                {gene}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Metrics strip */}
      <div className="grid grid-cols-2 gap-3 stagger-children md:grid-cols-4">
        {DASHBOARD_METRICS.map((metric) => {
          const Icon = metric.icon;
          return (
              <div key={metric.labelKey} className="metric-card" style={{ animationDelay: metric.delay }}>
              <div className="flex items-start justify-between">
                <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-slate-400">{t(metric.labelKey)}</p>
                <Icon className={`h-3.5 w-3.5 ${metric.color}`} />
              </div>
              <p className="mt-3 prose-metric">{metric.value}</p>
            </div>
          );
        })}
      </div>

      {/* Feature cards */}
      <div className="grid gap-4 md:grid-cols-3 stagger-children">
        <FeatureCard
          icon={Search}
          title={t("feature.search.title")}
          text={t("feature.search.text")}
          accentColor="#22d3ee"
          delay="0ms"
          onAction={onOpenSearch}
          actionLabel={t("dashboard.startSearch")}
        />
        <FeatureCard
          icon={BarChart3}
          title={t("feature.visualization.title")}
          text={t("feature.visualization.text")}
          accentColor="#818cf8"
          delay="60ms"
        />
        <FeatureCard
          icon={Database}
          title={t("feature.fallback.title")}
          text={t("feature.fallback.text")}
          accentColor="#34d399"
          delay="120ms"
          onAction={onOpenSequence}
          actionLabel={t("dashboard.analyzeSequence")}
        />
      </div>
    </section>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  text,
  accentColor,
  delay,
  onAction,
  actionLabel,
}: {
  icon: LucideIcon;
  title: string;
  text: string;
  accentColor: string;
  delay: string;
  onAction?: () => void;
  actionLabel?: string;
}) {
  return (
    <div
      className="group relative overflow-hidden rounded-xl border border-slate-200/70 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-6 shadow-sm transition-all duration-200 hover:-translate-y-px hover:border-slate-300/80 dark:hover:border-slate-700 hover:shadow-md"
      style={{ animationDelay: delay }}
    >
      <div
        className="mb-4 grid h-8 w-8 place-items-center rounded-lg"
        style={{ background: `${accentColor}14`, color: accentColor }}
      >
        <Icon className="h-4 w-4" />
      </div>
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      <p className="mt-1.5 text-xs leading-5 text-slate-500 dark:text-slate-400">{text}</p>
      {onAction && actionLabel && (
        <button
          onClick={onAction}
          className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-slate-400 dark:text-slate-500 transition-colors hover:text-slate-700 dark:hover:text-slate-300"
        >
          {actionLabel} <ArrowRight className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   SEARCH WORKSPACE
═══════════════════════════════════════════ */
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
    <section className="space-y-5 animate-fadeIn">
      {/* Search bar */}
      <div className="overflow-hidden rounded-xl border border-slate-200/70 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-sm">
        <div className="px-6 pt-6 pb-5">
          <h2 className="text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">{t("search.title")}</h2>

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
                className={`hidden items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition sm:inline-flex ${showFilters ? "bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200" : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200"}`}
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
              <FilterSelect label={t("search.dataType")} value={dataType} onChange={(v) => setDataType(v as GeneDataType)} options={[["gene", t("select.gene")], ["nucleotide", t("select.nucleotide")], ["protein", t("select.protein")]]} />
              <FilterSelect label={t("search.searchBy")} value={searchBy} onChange={(v) => setSearchBy(v as GeneSearchBy)} options={[["name", t("select.name")], ["accession", t("select.accession")], ["id", t("select.id")]]} />
              <FilterSelect label={t("search.mode")} value={mode} onChange={(v) => setMode(v as SearchMode)} options={[["local_first", t("select.localFirst")], ["local_only", t("select.localOnly")], ["external_refresh", t("select.externalRefresh")]]} />
              <FilterSelect label={t("search.provider")} value={provider} onChange={(v) => setProvider(v as GeneProvider)} options={[["auto", t("select.autoFallback")], ["ncbi", "NCBI"], ["ensembl", "Ensembl"], ["uniprot", "UniProt"], ["bvbrc", "BV-BRC"], ["phytozome", "Phytozome"]]} />
              <label className="space-y-1.5 md:col-span-2">
                <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500">{t("search.organism")}</span>
                <input value={organism} onChange={(e) => setOrganism(e.target.value)} className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-slate-400 dark:focus:border-slate-500 transition placeholder:text-slate-400 dark:placeholder:text-slate-500" placeholder={t("search.organismPlaceholder")} />
              </label>
            </div>
            <label className="mt-4 flex cursor-pointer items-center gap-2.5">
              <div className="relative">
                <input type="checkbox" checked={fallbackEnabled} onChange={(e) => setFallbackEnabled(e.target.checked)} className="sr-only" />
                <div className={`h-4 w-7 rounded-full transition-colors ${fallbackEnabled ? "bg-cyan-500" : "bg-slate-300 dark:bg-slate-700"}`} />
                <div className={`absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform ${fallbackEnabled ? "translate-x-3" : "translate-x-0"}`} />
              </div>
              <span className="text-xs text-slate-600 dark:text-slate-400">{t("search.fallbackFlow")}</span>
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

/* ═══════════════════════════════════════════
   GENE CARD — hierarchy + colored tags
═══════════════════════════════════════════ */
function GeneCard({ gene, t }: { gene: GeneResult; t: Translate }) {
  const id = asGeneId(gene);
  const dtClass = dataTypeTagClass(safe(gene.data_type, "gene"));
  const srcClass = sourceTagClass(safe(gene.source || gene.database, ""));

  return (
    <article className="group relative overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-sm transition-all duration-200 hover:-translate-y-px hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md animate-slideInUp">
      {/* Left accent bar on hover */}
      <div className="absolute left-0 top-0 h-full w-[2px] bg-cyan-400 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />

      <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          {/* Tags row */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`tag-base ${dtClass}`}>{safe(gene.data_type, "gene")}</span>
            {gene.database && <span className={`tag-base ${srcClass}`}>{safe(gene.database, "")}</span>}
            {gene.source && gene.source !== gene.database && <span className="tag-base tag-verified">{gene.source}</span>}
          </div>

          {/* Gene name */}
          <h3 className="mt-2.5 text-lg font-semibold leading-snug tracking-tight text-slate-950 dark:text-slate-100">
            {safe(gene.symbol || gene.name, `Gene ${id}`)}
          </h3>
          {gene.organism && (
            <p className="mt-0.5 text-xs italic text-slate-400 dark:text-slate-500">{gene.organism}</p>
          )}
          <p className="mt-2 line-clamp-2 max-w-3xl text-sm leading-5 text-slate-500 dark:text-slate-400">
            {safe(gene.description || gene.name, t("geneCard.noDescription"))}
          </p>

          {/* Accession row */}
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1">
            <span className="flex items-baseline gap-1.5">
              <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500">{t("geneCard.accession")}</span>
              <span className="font-mono text-xs text-slate-600 dark:text-slate-300">{id}</span>
            </span>
            <span className="flex items-baseline gap-1.5">
              <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500">{t("geneCard.organism")}</span>
              <span className="text-xs italic text-slate-600 dark:text-slate-300">{safe(gene.organism)}</span>
            </span>
            <span className="flex items-baseline gap-1.5">
              <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500">{t("geneCard.external")}</span>
              <span className="font-mono text-xs text-slate-600 dark:text-slate-300">{safe(gene.external_id ?? gene.gene_id ?? gene.id)}</span>
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

/* ═══════════════════════════════════════════
   SEQUENCE WORKSPACE
═══════════════════════════════════════════ */
function SequenceWorkspace({ sequence, setSequence, loading, error, result, counts, onSubmit, t }: { sequence: string; setSequence: (v: string) => void; loading: boolean; error: string; result: SequenceAnalysis | null; counts: CountMap; onSubmit: (e?: FormEvent) => void; t: Translate }) {
  return (
    <section className="grid gap-6 lg:grid-cols-12 animate-fadeIn">
      <form onSubmit={onSubmit} className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-6 shadow-sm lg:col-span-5">
        <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-cyan-600 dark:text-cyan-400">{t("sequence.badge")}</p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">{t("sequence.title")}</h2>
        <p className="mt-1.5 text-sm leading-6 text-slate-500 dark:text-slate-400">{t("sequence.desc")}</p>
        <textarea
          value={sequence}
          onChange={(e) => setSequence(e.target.value)}
          className="mt-4 min-h-64 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-4 font-mono text-xs leading-6 text-slate-900 dark:text-slate-100 outline-none focus:border-slate-400 dark:focus:border-slate-500 focus:bg-white dark:focus:bg-slate-800 transition custom-scrollbar"
          spellCheck={false}
        />
        {error && <p className="mt-3 rounded-lg bg-red-50 dark:bg-red-950/40 p-3 text-xs text-red-600 dark:text-red-300">{error}</p>}
        <button
          disabled={loading}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 dark:bg-cyan-500 px-4 py-2.5 text-xs font-medium text-white dark:text-slate-950 hover:bg-slate-700 dark:hover:bg-cyan-400 disabled:opacity-50 transition"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
          {t("sequence.button")}
        </button>
      </form>

      <div className="space-y-5 lg:col-span-7">
        <MetricsPanel result={result} counts={counts} t={t} />
        {result ? (
          <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-6 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-xs font-medium uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">{t("sequence.outputs")}</h3>
              <button onClick={() => copyText(result.reverse_complement || "")} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                <Copy className="h-3.5 w-3.5" />{t("sequence.copyReverse")}
              </button>
            </div>
            <Output label={t("sequence.reverse")} value={result.reverse_complement} />
            <Output label={t("sequence.rna")} value={result.rna_sequence} />
          </div>
        ) : (
          <EmptyState title={t("sequence.emptyTitle")} message={t("sequence.emptyMessage")} />
        )}
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════
   METRICS PANEL — gradient animated bars
═══════════════════════════════════════════ */
const BASE_COLORS: Record<string, string> = {
  A: "linear-gradient(90deg, #60a5fa, #2563eb)",
  T: "linear-gradient(90deg, #4ade80, #16a34a)",
  G: "linear-gradient(90deg, #fbbf24, #d97706)",
  C: "linear-gradient(90deg, #f87171, #dc2626)",
};

function MetricsPanel({ result, counts, t }: { result: SequenceAnalysis | null; counts: CountMap; t: Translate }) {
  const gc = result?.gc_content_percent ?? 0;
  const circumference = 351.85;
  const offset = circumference - (Number(gc || 0) / 100) * circumference;

  return (
    <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-6 shadow-sm">
      <h3 className="text-xs font-medium uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">{t("sequence.metrics")}</h3>
      <div className="mt-5 grid gap-6 md:grid-cols-3">
        {/* GC donut */}
        <div className="flex flex-col items-center justify-center rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-4">
          <div className="relative flex h-32 w-32 items-center justify-center">
            <svg className="h-full w-full -rotate-90">
              <circle cx="64" cy="64" r="56" fill="transparent" stroke="currentColor" strokeWidth="8" className="text-slate-200 dark:text-slate-700" />
              <circle
                cx="64" cy="64" r="56"
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
              <span className="block text-2xl font-bold text-slate-950 dark:text-slate-100">{Number(gc).toFixed(1)}%</span>
              <span className="text-[9px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">GC</span>
            </div>
          </div>
        </div>

        {/* Base bars */}
        <div className="space-y-3 md:col-span-2">
          {(["A", "T", "G", "C"] as const).map((base) => {
            const w = countWidth(counts, base);
            const total = Object.values(counts).reduce((s, v) => s + Number(v || 0), 0);
            const pct = total > 0 ? ((Number(counts[base] || 0) / total) * 100).toFixed(1) : "0.0";
            return (
              <div key={base} className="bar-row">
                <div className="mb-1.5 flex justify-between font-mono text-xs text-slate-600 dark:text-slate-300">
                  <span className="font-semibold">{base}</span>
                  <span className="tabular-nums text-slate-500 dark:text-slate-400">{counts[base] || 0} <span className="text-[10px] text-slate-400 dark:text-slate-500">({pct}%)</span></span>
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
            <MiniStat label={t("sequence.length")} value={result ? result.sequence_length.toLocaleString() : "0"} />
            <MiniStat label={t("sequence.validBases")} value={Object.values(counts).reduce((s, v) => s + Number(v || 0), 0).toLocaleString()} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   API WORKSPACE
═══════════════════════════════════════════ */
function ApiWorkspace({ pubmedQuery, setPubmedQuery, runApiPlayground, loading, response, articles, t }: { pubmedQuery: string; setPubmedQuery: (v: string) => void; runApiPlayground: (kind: "health" | "status" | "pubmed") => void; loading: boolean; response: string; articles: PubMedResult[]; t: Translate }) {
  return (
    <section className="space-y-6 animate-fadeIn">
      <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-950 dark:text-slate-100"><Terminal className="h-5 w-5 text-slate-400 dark:text-slate-500" /> {t("api.title")}</h2>
        <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{t("api.desc")}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button onClick={() => runApiPlayground("health")} className="rounded-lg bg-slate-900 dark:bg-cyan-500 px-4 py-2 text-xs font-medium text-white dark:text-slate-950 hover:bg-slate-700 dark:hover:bg-cyan-400 transition">GET /health</button>
          <button onClick={() => runApiPlayground("status")} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition">GET /system/status</button>
          <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 overflow-hidden">
            <input value={pubmedQuery} onChange={(e) => setPubmedQuery(e.target.value)} className="bg-transparent px-3 py-2 text-xs text-slate-900 dark:text-slate-100 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500" placeholder="PubMed query…" />
            <button onClick={() => runApiPlayground("pubmed")} className="border-l border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-700 px-3 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 transition">PubMed</button>
          </div>
        </div>
      </div>
      <pre className="max-h-[520px] overflow-auto rounded-xl bg-slate-950 p-5 text-xs leading-6 text-cyan-50 custom-scrollbar">{loading ? t("api.loading") : response || t("api.empty")}</pre>
      {!!articles.length && (
        <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-2">
          <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500">PubMed Results ({articles.length})</p>
          {articles.slice(0, 5).map((a) => (
            <div key={a.pmid} className="flex items-start gap-2 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
              <span className="mt-0.5 shrink-0 rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 font-mono text-[9px] text-slate-500 dark:text-slate-400">{a.pmid}</span>
              <p className="text-xs text-slate-700 dark:text-slate-300 line-clamp-2">{a.title}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* ═══════════════════════════════════════════
   SETTINGS WORKSPACE
═══════════════════════════════════════════ */
function SettingsWorkspace({ health, t }: { health: HealthData | SystemStatus | null; t: Translate }) {
  return (
    <section className="grid gap-6 lg:grid-cols-2 animate-fadeIn">
      <SettingsCard icon={ShieldCheck} title={t("settings.runtime")} text={t("settings.runtimeDesc")} />
      <SettingsCard icon={Database} title={t("settings.data")} text={t("settings.dataDesc")} />
      <SettingsCard icon={FlaskConical} title={t("settings.ux")} text={t("settings.uxDesc")} />
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-6 shadow-sm">
        <h3 className="flex items-center gap-2 text-lg font-black text-slate-950 dark:text-slate-100"><Cloud className="h-5 w-5 text-cyan-500" />{t("settings.snapshot")}</h3>
        <pre className="mt-4 max-h-64 overflow-auto rounded-xl bg-slate-950 p-4 text-xs leading-6 text-cyan-50 custom-scrollbar">{health ? JSON.stringify(health, null, 2) : t("settings.snapshotEmpty")}</pre>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════
   SHARED SMALL COMPONENTS
═══════════════════════════════════════════ */
function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: Array<[string, string]> }) {
  return (
    <label className="space-y-1.5">
      <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-700 dark:text-slate-300 outline-none focus:border-slate-400 dark:focus:border-slate-500 transition">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

function Output({ label, value }: { label: string; value?: string }) {
  return (
    <div className="mb-4">
      <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500">{label}</div>
      <pre className="max-h-40 overflow-auto rounded-lg bg-slate-50 dark:bg-slate-800/60 p-4 font-mono text-xs leading-6 text-slate-700 dark:text-slate-300 custom-scrollbar">{value || "Not available"}</pre>
    </div>
  );
}

function Notice({ tone, title, message }: { tone: "red" | "cyan"; title: string; message: string }) {
  const red = tone === "red";
  return (
    <div className={`flex items-start gap-3 rounded-lg border p-4 text-sm ${red ? "border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300" : "border-cyan-200/60 dark:border-cyan-900/50 bg-cyan-50/60 dark:bg-cyan-950/40 text-cyan-900 dark:text-cyan-300"}`}>
      <AlertCircle className={`mt-0.5 h-4 w-4 shrink-0 ${red ? "text-red-500" : "text-cyan-500"}`} />
      <div><p className="font-semibold">{title}</p><p className="mt-1 text-xs leading-5 text-inherit/80">{message}</p></div>
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

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-3 ring-1 ring-slate-100 dark:ring-slate-800">
      <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">{value}</p>
    </div>
  );
}

function SettingsCard({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-6 shadow-sm">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100"><Icon className="h-4 w-4 text-cyan-500" />{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{text}</p>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Activity, Menu } from "lucide-react";
import { HealthData, SystemStatus, api } from "@/lib/api";
import { useLanguage } from "@/lib/i18n";
import { useToast } from "@/lib/Toast";
import { useGeneSearch } from "@/hooks/useGeneSearch";
import { Sidebar } from "@/components/biolab/Sidebar";
import { DashboardPanel } from "@/components/biolab/DashboardPanel";
import { GeneSearchPanel } from "@/components/biolab/GeneSearchPanel";
import { SequenceAnalysisPanel } from "@/components/biolab/SequenceAnalysisPanel";
import { ApiExplorerPanel } from "@/components/biolab/ApiExplorerPanel";
import { PubMedPanel } from "@/components/biolab/PubMedPanel";
import { SettingsPanel } from "@/components/biolab/SettingsPanel";

type ActiveTab = "dashboard" | "search" | "sequence" | "pubmed" | "api" | "settings";
type StatusState = "idle" | "checking" | "online" | "offline";

export default function BioLabDashboard() {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("dashboard");
  const [initialSubTab, setInitialSubTab] = useState<"analyze" | "blast">("analyze");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [status, setStatus] = useState<StatusState>("idle");
  const [health, setHealth] = useState<HealthData | SystemStatus | null>(null);

  const { t } = useLanguage();
  const toast = useToast();
  const geneSearch = useGeneSearch(t);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab") as ActiveTab | null;
      if (tabParam && ["dashboard", "search", "sequence", "pubmed", "api", "settings"].includes(tabParam)) {
        setActiveTab(tabParam);
      }
      const subtabParam = params.get("subtab");
      if (subtabParam === "blast" || subtabParam === "analyze") {
        setInitialSubTab(subtabParam as "analyze" | "blast");
      }
    }
  }, []);

  const handleSelectTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    setMobileOpen(false);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tab);
      if (tab !== "sequence") {
        url.searchParams.delete("subtab");
      }
      window.history.replaceState(null, "", url.toString());
    }
  };

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

  const statusLabel =
    status === "online"
      ? t("status.online")
      : status === "offline"
      ? t("status.offline")
      : status === "checking"
      ? t("status.checking")
      : t("status.idle");

  if (!mounted) return null;

  return (
    <div className="relative min-h-screen bg-[var(--background)] text-[var(--foreground)] antialiased transition-colors duration-200 overflow-x-hidden">
      {/* Ambient decorative background orbs */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-cyan-500/[0.06] dark:bg-cyan-500/[0.09] blur-[100px]" />
        <div className="absolute top-1/3 -right-32 h-96 w-96 rounded-full bg-indigo-500/[0.06] dark:bg-indigo-500/[0.09] blur-[100px]" />
        <div className="absolute -bottom-32 left-1/3 h-80 w-80 rounded-full bg-emerald-500/[0.04] dark:bg-emerald-500/[0.07] blur-[100px]" />
      </div>

      <Sidebar
        activeTab={activeTab}
        setActiveTab={handleSelectTab}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        status={status}
        statusLabel={statusLabel}
        t={t}
      />

      <div
        className={`relative z-10 min-h-screen transition-[padding] duration-300 ease-out ${
          sidebarCollapsed ? "lg:pl-20" : "lg:pl-72"
        }`}
      >
        <header
          className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-slate-200/70 dark:border-slate-800/80 bg-white/75 dark:bg-slate-950/75 px-4 backdrop-blur-xl md:px-8"
          style={{ boxShadow: "0 4px 24px -4px rgba(15, 23, 42, 0.04)" }}
        >
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-xl border border-slate-200/70 dark:border-slate-800 p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden transition"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2.5 rounded-full border border-slate-200/80 dark:border-slate-800/90 bg-slate-50/80 dark:bg-slate-900/80 px-3.5 py-1.5 shadow-2xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-gradient-to-r from-cyan-500 to-indigo-500" />
              </span>
              <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 uppercase tracking-widest">
                {activeTab === "dashboard"
                  ? t("tab.dashboard")
                  : activeTab === "search"
                  ? t("tab.search")
                  : activeTab === "sequence"
                  ? t("tab.sequence")
                  : activeTab === "pubmed"
                  ? t("tab.pubmed")
                  : activeTab === "api"
                  ? t("tab.api")
                  : t("tab.settings")}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={checkStatus}
              className="group inline-flex items-center gap-2 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 shadow-2xs transition-all hover:border-cyan-400/50 dark:hover:border-cyan-500/40 hover:shadow-md hover:shadow-cyan-500/10"
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  status === "online"
                    ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"
                    : status === "offline"
                    ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"
                    : status === "checking"
                    ? "bg-cyan-500 animate-ping"
                    : "bg-slate-400"
                }`}
              />
              <Activity className="h-3.5 w-3.5 text-cyan-500 transition-transform group-hover:scale-110" />
              <span>{statusLabel}</span>
            </button>
          </div>
        </header>

        <main className="p-4 md:p-8 max-w-7xl mx-auto">
          <div key={activeTab} className="animate-fadeIn transition-all duration-300">
            {activeTab === "dashboard" && (
              <DashboardPanel
                setActiveTab={setActiveTab}
                runGeneSearch={geneSearch.runSearch}
                t={t}
              />
            )}

            {activeTab === "search" && (
              <GeneSearchPanel
                query={geneSearch.query}
                setQuery={geneSearch.setQuery}
                dataType={geneSearch.dataType}
                setDataType={geneSearch.setDataType}
                searchBy={geneSearch.searchBy}
                setSearchBy={geneSearch.setSearchBy}
                organism={geneSearch.organism}
                setOrganism={geneSearch.setOrganism}
                mode={geneSearch.mode}
                setMode={geneSearch.setMode}
                provider={geneSearch.provider}
                setProvider={geneSearch.setProvider}
                fallbackEnabled={geneSearch.fallbackEnabled}
                setFallbackEnabled={geneSearch.setFallbackEnabled}
                showFilters={geneSearch.showFilters}
                setShowFilters={geneSearch.setShowFilters}
                onSubmit={geneSearch.runSearch}
                loading={geneSearch.loading}
                error={geneSearch.error}
                message={geneSearch.message}
                genes={geneSearch.genes}
                t={t}
              />
            )}

            {activeTab === "sequence" && <SequenceAnalysisPanel t={t} initialSubTab={initialSubTab} />}

            {activeTab === "pubmed" && <PubMedPanel t={t} />}

            {activeTab === "api" && <ApiExplorerPanel t={t} />}

            {activeTab === "settings" && <SettingsPanel health={health} t={t} />}
          </div>
        </main>
      </div>
    </div>
  );
}

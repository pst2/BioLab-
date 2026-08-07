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
import { SettingsPanel } from "@/components/biolab/SettingsPanel";

type ActiveTab = "dashboard" | "search" | "sequence" | "api" | "settings";
type StatusState = "idle" | "checking" | "online" | "offline";

export default function BioLabDashboard() {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [status, setStatus] = useState<StatusState>("idle");
  const [health, setHealth] = useState<HealthData | SystemStatus | null>(null);

  const { t } = useLanguage();
  const toast = useToast();
  const geneSearch = useGeneSearch(t);

  useEffect(() => {
    setMounted(true);
  }, []);

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
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] antialiased transition-colors duration-200">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setMobileOpen(false);
        }}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        status={status}
        statusLabel={statusLabel}
        t={t}
      />

      <div
        className={`min-h-screen transition-[padding] duration-300 ease-out ${
          sidebarCollapsed ? "lg:pl-20" : "lg:pl-72"
        }`}
      >
        <header
          className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-slate-200/70 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 px-4 backdrop-blur-md md:px-8"
          style={{ boxShadow: "0 1px 0 rgba(148,163,184,0.15)" }}
        >
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-cyan-500 animate-pulse" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-widest">
                {activeTab === "dashboard"
                  ? t("tab.dashboard")
                  : activeTab === "search"
                  ? t("tab.search")
                  : activeTab === "sequence"
                  ? t("tab.sequence")
                  : activeTab === "api"
                  ? t("tab.api")
                  : t("tab.settings")}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={checkStatus}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 transition hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Activity className="h-3.5 w-3.5 text-cyan-500" />
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

            {activeTab === "sequence" && <SequenceAnalysisPanel t={t} />}

            {activeTab === "api" && <ApiExplorerPanel t={t} />}

            {activeTab === "settings" && <SettingsPanel health={health} t={t} />}
          </div>
        </main>
      </div>
    </div>
  );
}

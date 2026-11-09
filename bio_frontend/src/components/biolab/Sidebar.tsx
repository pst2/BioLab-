"use client";

import Link from "next/link";
import {
  Activity,
  BarChart3,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Database,
  Dna,
  FlaskConical,
  Globe,
  LayoutDashboard,
  Search,
  Settings,
  Terminal,
  X,
  type LucideIcon,
} from "lucide-react";
import { LanguageToggle, ThemeToggle, Translate } from "@/lib/i18n";

type ActiveTab = "dashboard" | "search" | "sequence" | "pubmed" | "api" | "settings";
type StatusState = "idle" | "checking" | "online" | "offline";

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  status: StatusState;
  statusLabel: string;
  t: Translate;
}

export function Sidebar({
  activeTab,
  setActiveTab,
  mobileOpen,
  setMobileOpen,
  collapsed,
  setCollapsed,
  status,
  statusLabel,
  t,
}: SidebarProps) {
  const statusToneClass =
    status === "online"
      ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-800"
      : status === "offline"
      ? "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 ring-red-200 dark:ring-red-800"
      : status === "checking"
      ? "bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 ring-cyan-200 dark:ring-cyan-800"
      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 ring-slate-200 dark:ring-slate-700";

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm lg:hidden animate-fadeIn"
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col border-r border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl transition-all duration-300 ease-out shadow-[4px_0_24px_-4px_rgba(15,23,42,0.04)] dark:shadow-[4px_0_32px_-4px_rgba(0,0,0,0.4)] ${
          collapsed ? "w-20" : "w-72"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        {/* Subtle top ambient glow */}
        <div className="pointer-events-none absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-cyan-500/[0.06] via-indigo-500/[0.03] to-transparent dark:from-cyan-500/[0.1] dark:via-indigo-500/[0.04]" />

        {/* Header logo */}
        <div className="relative flex h-16 items-center justify-between px-4 border-b border-slate-200/60 dark:border-slate-800/70">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 via-sky-500 to-indigo-600 text-white shadow-lg shadow-cyan-500/25 ring-1 ring-white/20">
              <Dna className="h-5 w-5" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h1 className="text-sm font-extrabold tracking-tight bg-gradient-to-r from-slate-950 via-slate-800 to-cyan-700 dark:from-white dark:via-slate-100 dark:to-cyan-300 bg-clip-text text-transparent truncate">
                    BioLab Suite
                  </h1>
                  <span className="rounded-md bg-cyan-500/10 dark:bg-cyan-400/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-300 border border-cyan-500/20">
                    AI
                  </span>
                </div>
                <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 truncate mt-0.5">
                  {t("sidebar.subtitle")}
                </p>
              </div>
            )}
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation list */}
        <nav className="relative flex-1 space-y-1.5 p-3 overflow-y-auto custom-scrollbar">
          <NavItem
            icon={LayoutDashboard}
            label={t("tab.dashboard")}
            active={activeTab === "dashboard"}
            collapsed={collapsed}
            onClick={() => setActiveTab("dashboard")}
          />
          <NavItem
            icon={Search}
            label={t("tab.search")}
            active={activeTab === "search"}
            collapsed={collapsed}
            onClick={() => setActiveTab("search")}
          />
          <NavItem
            icon={FlaskConical}
            label={t("tab.sequence")}
            active={activeTab === "sequence"}
            collapsed={collapsed}
            onClick={() => setActiveTab("sequence")}
          />
          <NavItem
            icon={BookOpen}
            label={t("tab.pubmed")}
            active={activeTab === "pubmed"}
            collapsed={collapsed}
            onClick={() => setActiveTab("pubmed")}
          />
          <NavItem
            icon={Terminal}
            label={t("tab.api")}
            active={activeTab === "api"}
            collapsed={collapsed}
            onClick={() => setActiveTab("api")}
          />
          <NavItem
            icon={Settings}
            label={t("tab.settings")}
            active={activeTab === "settings"}
            collapsed={collapsed}
            onClick={() => setActiveTab("settings")}
          />
        </nav>

        {/* Bottom footer controls */}
        <div className="relative border-t border-slate-200/60 dark:border-slate-800/70 bg-slate-50/50 dark:bg-slate-900/40 p-3 space-y-3">
          {!collapsed && (
            <div className={`flex items-center justify-between rounded-xl p-2.5 ring-1 backdrop-blur-sm ${statusToneClass}`}>
              <div className="flex items-center gap-2">
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
                <span className="text-xs font-semibold">{statusLabel}</span>
              </div>
              <Activity className="h-3.5 w-3.5 opacity-60" />
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <LanguageToggle compact={collapsed} />
            <ThemeToggle />
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="hidden lg:flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-800/90 text-slate-500 dark:text-slate-400 hover:border-cyan-400/50 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-cyan-50/40 dark:hover:bg-slate-800 transition shadow-2xs"
              title={t("sidebar.toggleCollapse")}
              aria-label={t("sidebar.toggleCollapse")}
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

function NavItem({
  icon: Icon,
  label,
  active,
  collapsed,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`group relative flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-xs font-semibold transition-all duration-200 ${
        active
          ? "bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 dark:from-cyan-500 dark:via-sky-500 dark:to-indigo-500 text-white dark:text-slate-950 shadow-md shadow-slate-900/10 dark:shadow-cyan-500/20"
          : "text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-slate-100"
      } ${collapsed ? "justify-center px-0" : ""}`}
      title={label}
    >
      <Icon
        className={`h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110 ${
          active
            ? "text-cyan-400 dark:text-slate-950"
            : "text-slate-400 group-hover:text-cyan-600 dark:group-hover:text-cyan-400"
        }`}
      />
      {!collapsed && <span className="truncate">{label}</span>}
      {active && !collapsed && (
        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-cyan-400 dark:bg-slate-950" />
      )}
    </button>
  );
}

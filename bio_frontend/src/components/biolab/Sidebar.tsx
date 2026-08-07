"use client";

import Link from "next/link";
import {
  Activity,
  BarChart3,
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

type ActiveTab = "dashboard" | "search" | "sequence" | "api" | "settings";
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
          className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-xs lg:hidden animate-fadeIn"
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col border-r border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md transition-all duration-300 ease-out ${
          collapsed ? "w-20" : "w-72"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        {/* Header logo */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-slate-100 dark:border-slate-800/60">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 dark:from-cyan-500 dark:to-cyan-600 text-white dark:text-slate-950 shadow-md">
              <Dna className="h-5 w-5" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <h1 className="text-sm font-bold tracking-tight text-slate-950 dark:text-slate-100 truncate">
                  BioLab Suite
                </h1>
                <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 truncate">
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
        <nav className="flex-1 space-y-1 p-3 overflow-y-auto custom-scrollbar">
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
        <div className="border-t border-slate-100 dark:border-slate-800/60 p-3 space-y-3">
          {!collapsed && (
            <div className={`flex items-center justify-between rounded-lg p-2.5 ring-1 ${statusToneClass}`}>
              <div className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${
                    status === "online"
                      ? "bg-emerald-500"
                      : status === "offline"
                      ? "bg-red-500"
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
              className="hidden lg:flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
              title="Toggle sidebar width"
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
      className={`group flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-xs font-semibold transition ${
        active
          ? "bg-slate-900 dark:bg-cyan-500 text-white dark:text-slate-950 shadow-sm"
          : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200"
      } ${collapsed ? "justify-center px-0" : ""}`}
      title={label}
    >
      <Icon className={`h-4 w-4 shrink-0 ${active ? "text-cyan-400 dark:text-slate-950" : "text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300"}`} />
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  );
}

"use client";

import { Activity, Database, ShieldCheck, Zap, type LucideIcon } from "lucide-react";
import { HealthData, SystemStatus } from "@/lib/api";
import { Translate } from "@/lib/i18n";

export function SettingsPanel({
  health,
  t,
}: {
  health: HealthData | SystemStatus | null;
  t: Translate;
}) {
  return (
    <section className="space-y-6 animate-fadeIn">
      <div className="grid gap-6 md:grid-cols-3">
        <SettingsCard
          icon={ShieldCheck}
          title={t("settings.runtime")}
          text={t("settings.runtimeDesc")}
        />
        <SettingsCard
          icon={Database}
          title={t("settings.data")}
          text={t("settings.dataDesc")}
        />
        <SettingsCard icon={Zap} title={t("settings.ux")} text={t("settings.uxDesc")} />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-lg">
        <div className="flex items-center justify-between border-b border-slate-800/80 bg-slate-900/90 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
            <h3 className="ml-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {t("settings.snapshot")}
            </h3>
          </div>
          <Activity className="h-3.5 w-3.5 text-cyan-400" />
        </div>
        <pre className="overflow-x-auto p-5 font-mono text-xs leading-6 text-cyan-100 custom-scrollbar">
          {health ? JSON.stringify(health, null, 2) : t("settings.snapshotEmpty")}
        </pre>
      </div>
    </section>
  );
}

function SettingsCard({
  icon: Icon,
  title,
  text,
}: {
  icon: LucideIcon;
  title: string;
  text: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:border-cyan-400/50 dark:hover:border-cyan-500/40">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-400 via-sky-500 to-indigo-500 opacity-75 group-hover:opacity-100 transition-opacity" />
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/15 to-indigo-500/15 text-cyan-600 dark:text-cyan-400 ring-1 ring-cyan-500/20">
          <Icon className="h-5 w-5" />
        </div>
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
          {title}
        </h3>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">{text}</p>
    </div>
  );
}

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

      <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-6 shadow-sm">
        <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {t("settings.snapshot")}
        </h3>
        <pre className="mt-3 overflow-x-auto rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-4 font-mono text-xs text-slate-800 dark:text-slate-200 custom-scrollbar">
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
    <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-6 shadow-sm">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
        <Icon className="h-4 w-4 text-cyan-500" />
        {title}
      </h3>
      <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{text}</p>
    </div>
  );
}

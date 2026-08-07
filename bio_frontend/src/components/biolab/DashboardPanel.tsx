"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Database,
  Dna,
  FlaskConical,
  Globe,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Translate, useLanguage } from "@/lib/i18n";
import { SearchMode } from "@/hooks/useGeneSearch";
import { useSystemStats } from "@/hooks/useSystemStats";

type ActiveTab = "dashboard" | "search" | "sequence" | "api" | "settings";

const sampleGenes = ["BRCA1", "TP53", "EGFR", "NM_007294", "P53_HUMAN", "APOE"];

function useCountUp(target: number | null | undefined, duration = 1000) {
  const [displayValue, setDisplayValue] = useState<number>(0);
  const prevTargetRef = useRef<number>(0);

  useEffect(() => {
    if (target === null || target === undefined || Number.isNaN(target)) {
      setDisplayValue(0);
      return;
    }

    const start = prevTargetRef.current;
    const end = target;
    const startTime = performance.now();

    let animationFrameId: number;

    const updateCount = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = 1 - (1 - progress) * (1 - progress);
      const current = Math.round(start + (end - start) * easedProgress);

      setDisplayValue(current);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(updateCount);
      } else {
        prevTargetRef.current = end;
      }
    };

    animationFrameId = requestAnimationFrame(updateCount);

    return () => cancelAnimationFrame(animationFrameId);
  }, [target, duration]);

  return displayValue;
}

/* ── Gradient configs per metric card ──────────────────────────────────── */
const METRIC_GRADIENTS: {
  icon: LucideIcon;
  gradient: string;
  glow: string;
  sparkColor: string;
}[] = [
  {
    icon: Database,
    gradient: "from-cyan-500 to-blue-600",
    glow: "rgba(6,182,212,0.25)",
    sparkColor: "bg-cyan-400",
  },
  {
    icon: Globe,
    gradient: "from-violet-500 to-purple-600",
    glow: "rgba(139,92,246,0.25)",
    sparkColor: "bg-violet-400",
  },
  {
    icon: ShieldCheck,
    gradient: "from-emerald-500 to-teal-600",
    glow: "rgba(16,185,129,0.25)",
    sparkColor: "bg-emerald-400",
  },
  {
    icon: BarChart3,
    gradient: "from-amber-500 to-orange-600",
    glow: "rgba(245,158,11,0.25)",
    sparkColor: "bg-amber-400",
  },
];

/* ── Feature cards config ──────────────────────────────────────────────── */
interface FeatureCard {
  icon: LucideIcon;
  titleKey: string;
  textKey: string;
  tab: ActiveTab;
}

const FEATURES: FeatureCard[] = [
  {
    icon: Search,
    titleKey: "feature.search.title",
    textKey: "feature.search.text",
    tab: "search",
  },
  {
    icon: FlaskConical,
    titleKey: "feature.visualization.title",
    textKey: "feature.visualization.text",
    tab: "sequence",
  },
  {
    icon: TrendingUp,
    titleKey: "feature.fallback.title",
    textKey: "feature.fallback.text",
    tab: "search",
  },
];

export function DashboardPanel({
  setActiveTab,
  runGeneSearch,
  t,
}: {
  setActiveTab: (tab: ActiveTab) => void;
  runGeneSearch: (e?: any, override?: Partial<{ q: string; mode: SearchMode }>) => void;
  t: Translate;
}) {
  const { lang } = useLanguage();
  const { stats, loading, error, refreshed } = useSystemStats();

  const formattedGenes = useCountUp(stats?.genes_indexed);
  const formattedQueries = useCountUp(stats?.queries_today);

  const numberFormatter = new Intl.NumberFormat(lang === "vi" ? "vi-VN" : "en-US");

  const metricValues = [
    loading
      ? null
      : stats?.genes_indexed !== null && stats?.genes_indexed !== undefined
      ? numberFormatter.format(formattedGenes)
      : "—",
    loading
      ? null
      : stats?.providers_active !== null && stats?.providers_active !== undefined
      ? `${stats.providers_active} ${lang === "vi" ? "Nhà cung cấp" : "Active"}`
      : "—",
    loading
      ? null
      : stats?.success_rate !== null && stats?.success_rate !== undefined
      ? `${stats.success_rate.toFixed(1)}%`
      : "100.0%",
    loading
      ? null
      : stats?.queries_today !== null && stats?.queries_today !== undefined
      ? numberFormatter.format(formattedQueries)
      : "—",
  ];

  const metricLabels = [
    t("metric.genesIndexed"),
    t("metric.providers"),
    t("metric.successRate"),
    t("metric.queriesToday"),
  ];

  const metricTrends = [
    t("metric.monthGrowth").replace("{percent}", "12"),
    stats?.providers_list ? stats.providers_list.slice(0, 3).join(", ") + "..." : "NCBI, Ensembl, UniProt...",
    t("dashboard.sub.localFirst"),
    t("dashboard.sub.realtime"),
  ];

  return (
    <section className="space-y-6 animate-fadeIn">
      {/* ── Premium Hero ────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl hero-gradient min-h-[260px] md:min-h-[280px]">
        {/* Mesh overlay */}
        <div className="absolute inset-0 hero-mesh" />

        {/* Floating orbs */}
        <div
          className="floating-orb"
          style={{
            width: 200,
            height: 200,
            top: "-40px",
            right: "10%",
            background: "rgba(34, 211, 238, 0.12)",
            animationDelay: "0s",
          }}
        />
        <div
          className="floating-orb"
          style={{
            width: 140,
            height: 140,
            bottom: "-20px",
            left: "15%",
            background: "rgba(99, 102, 241, 0.1)",
            animationDelay: "4s",
          }}
        />
        <div
          className="floating-orb"
          style={{
            width: 100,
            height: 100,
            top: "30%",
            right: "30%",
            background: "rgba(6, 182, 212, 0.08)",
            animationDelay: "8s",
          }}
        />

        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        {/* Content */}
        <div className="relative z-10 p-7 md:p-10 flex flex-col justify-center">
          <div className="max-w-2xl">
            {/* Badge */}
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-500/10 backdrop-blur-sm px-3.5 py-1.5 text-[11px] font-semibold text-cyan-300 tracking-wide">
              <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
              {t("dashboard.badge")}
            </span>

            {/* Title */}
            <h2 className="mt-5 text-2xl font-extrabold tracking-tight text-white sm:text-3xl lg:text-4xl leading-[1.15]">
              {t("dashboard.title")}
            </h2>

            {/* Description */}
            <p className="mt-3.5 text-sm leading-7 text-slate-300/90 max-w-lg">
              {t("dashboard.desc")}
            </p>

            {/* CTAs */}
            <div className="mt-7 flex flex-wrap gap-3">
              <button
                onClick={() => setActiveTab("search")}
                className="group inline-flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/25 transition-all hover:shadow-cyan-500/40 hover:scale-[1.02] active:scale-[0.98]"
              >
                {t("dashboard.startSearch")}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>
              <button
                onClick={() => setActiveTab("sequence")}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-400/20 bg-white/5 backdrop-blur-sm px-5 py-3 text-sm font-semibold text-slate-200 transition-all hover:bg-white/10 hover:border-slate-400/30"
              >
                <FlaskConical className="h-4 w-4 text-cyan-400" />
                {t("dashboard.analyzeSequence")}
              </button>
            </div>
          </div>

          {/* Decorative DNA strands (right side, hidden on mobile) */}
          <div className="hidden lg:block absolute right-10 top-1/2 -translate-y-1/2 opacity-20">
            <Dna className="h-32 w-32 text-cyan-300" strokeWidth={1} />
          </div>
        </div>
      </div>

      {/* ── Glassmorphism Metric Cards ──────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 stagger-children">
        {METRIC_GRADIENTS.map((config, idx) => (
          <MetricCard
            key={idx}
            label={metricLabels[idx]}
            value={metricValues[idx]}
            icon={config.icon}
            gradient={config.gradient}
            glow={config.glow}
            sparkColor={config.sparkColor}
            trend={metricTrends[idx]}
            loading={loading}
            refreshed={refreshed}
          />
        ))}
      </div>

      {/* ── Capabilities Feature Grid ──────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-3">
        {FEATURES.map((feature) => (
          <button
            key={feature.titleKey}
            onClick={() => setActiveTab(feature.tab)}
            className="group text-left rounded-xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900 p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-cyan-500/30 dark:hover:border-cyan-500/30"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl feature-card-icon">
                <feature.icon className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                  {t(feature.titleKey)}
                </h4>
                <p className="mt-1.5 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  {t(feature.textKey)}
                </p>
              </div>
            </div>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-cyan-600 dark:text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity">
              Open <ArrowRight className="h-3 w-3" />
            </span>
          </button>
        ))}
      </div>

      {/* ── Quick Search Targets ────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900 p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="h-1 w-5 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                {t("dashboard.quickTargets")}
              </h3>
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 ml-7">
              {t("dashboard.quickTargetsSub")}
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2.5">
          {sampleGenes.map((gene) => (
            <button
              key={gene}
              onClick={() => {
                setActiveTab("search");
                runGeneSearch(undefined, { q: gene });
              }}
              className="group inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/60 px-3.5 py-2 font-mono text-xs font-medium text-slate-700 dark:text-slate-300 transition-all duration-200 hover:border-cyan-400 dark:hover:border-cyan-500 hover:bg-gradient-to-r hover:from-cyan-50 hover:to-blue-50 dark:hover:from-cyan-950/40 dark:hover:to-blue-950/30 hover:shadow-sm"
            >
              <Dna className="h-3.5 w-3.5 text-slate-400 group-hover:text-cyan-500 transition-colors" />
              {gene}
              <ArrowRight className="h-3 w-3 text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Glassmorphism Metric Card ─────────────────────────────────────────── */
function MetricCard({
  label,
  value,
  icon: Icon,
  gradient,
  glow,
  sparkColor,
  trend,
  loading,
  refreshed,
}: {
  label: string;
  value: string | null;
  icon: LucideIcon;
  gradient: string;
  glow: string;
  sparkColor: string;
  trend: string;
  loading: boolean;
  refreshed: boolean;
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-900 p-5 shadow-sm metric-glow animate-fadeIn">
      {/* Subtle gradient overlay on hover */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background: `radial-gradient(circle at top right, ${glow}, transparent 70%)`,
        }}
      />

      <div className="relative z-10">
        {/* Top row — label + icon */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            {label}
          </span>
          <div className="flex items-center gap-2">
            {refreshed && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
            )}
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${gradient} shadow-sm`}>
              <Icon className="h-4 w-4 text-white" />
            </div>
          </div>
        </div>

        {/* Value */}
        <div className="mt-3 min-h-[2.25rem] flex items-center">
          {loading ? (
            <div className="h-7 w-28 rounded-md skeleton-shimmer" />
          ) : (
            <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums">
              {value}
            </p>
          )}
        </div>

        {/* Bottom — trend + sparkline */}
        <div className="mt-2 flex items-center justify-between">
          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[70%]">
            {trend}
          </p>
          {/* Mini sparkline */}
          <div className="flex items-end gap-[2px] h-4">
            <div className={`sparkline-bar ${sparkColor} opacity-50`} />
            <div className={`sparkline-bar ${sparkColor} opacity-60`} />
            <div className={`sparkline-bar ${sparkColor} opacity-70`} />
            <div className={`sparkline-bar ${sparkColor} opacity-80`} />
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useLanguage();

  useEffect(() => {
    console.error("Route error boundary caught an error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-500">
        <AlertTriangle className="h-7 w-7" />
      </div>

      <h2 className="mt-5 text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
        {t("error.somethingWrong")}
      </h2>
      <p className="mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
        {error.message || t("error.description")}
      </p>

      <button
        onClick={() => reset()}
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 dark:bg-cyan-500 px-5 py-2.5 text-xs font-semibold text-white dark:text-slate-950 shadow-sm transition hover:bg-slate-700 dark:hover:bg-cyan-400"
      >
        <RefreshCw className="h-4 w-4" />
        {t("error.tryAgain")}
      </button>
    </div>
  );
}

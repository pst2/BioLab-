"use client";

import { type ReactNode } from "react";
import { ToastProvider } from "@/lib/Toast";
import { ErrorBoundary } from "@/lib/ErrorBoundary";

export function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <ToastProvider>{children}</ToastProvider>
    </ErrorBoundary>
  );
}

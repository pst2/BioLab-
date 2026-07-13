"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

/* ═══════════════════════════════════════════
   TYPES
═══════════════════════════════════════════ */
type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
  duration: number;
  exiting: boolean;
}

interface ToastAPI {
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
}

/* ═══════════════════════════════════════════
   CONTEXT
═══════════════════════════════════════════ */
const ToastContext = createContext<ToastAPI | null>(null);

export function useToast(): ToastAPI {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Return a no-op toast outside provider
    return {
      success: () => {},
      error: () => {},
      info: () => {},
    };
  }
  return ctx;
}

/* ═══════════════════════════════════════════
   ICONS
═══════════════════════════════════════════ */
const ICONS: Record<ToastType, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

const TONE: Record<ToastType, string> = {
  success: "toast-success",
  error: "toast-error",
  info: "toast-info",
};

/* ═══════════════════════════════════════════
   SINGLE TOAST
═══════════════════════════════════════════ */
function Toast({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  const Icon = ICONS[item.type];
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = progressRef.current;
    if (!el) return;
    // Force reflow then start animation
    el.style.transition = "none";
    el.style.width = "100%";
    void el.offsetHeight;
    el.style.transition = `width ${item.duration}ms linear`;
    el.style.width = "0%";
  }, [item.duration]);

  return (
    <div
      className={`toast-item ${TONE[item.type]} ${item.exiting ? "toast-exit" : "toast-enter"}`}
      role="status"
      aria-live="polite"
    >
      <div className="toast-content">
        <Icon className="toast-icon" />
        <span className="toast-message">{item.message}</span>
        <button className="toast-close" onClick={() => onDismiss(item.id)} aria-label="Dismiss">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="toast-progress-track">
        <div ref={progressRef} className={`toast-progress-bar ${TONE[item.type]}-bar`} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   PROVIDER
═══════════════════════════════════════════ */
const MAX_TOASTS = 4;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idCounter = useRef(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 280);
  }, []);

  const push = useCallback((type: ToastType, message: string, duration = 3500) => {
    const id = ++idCounter.current;
    setToasts((prev) => {
      const next = [...prev, { id, type, message, duration, exiting: false }];
      return next.length > MAX_TOASTS ? next.slice(-MAX_TOASTS) : next;
    });
    setTimeout(() => dismiss(id), duration);
  }, [dismiss]);

  const api = useMemo<ToastAPI>(() => ({
    success: (msg, dur) => push("success", msg, dur),
    error: (msg, dur) => push("error", msg, dur ?? 5000),
    info: (msg, dur) => push("info", msg, dur),
  }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {mounted &&
        createPortal(
          <div className="toast-container" aria-label="Notifications">
            {toasts.map((t) => (
              <Toast key={t.id} item={t} onDismiss={dismiss} />
            ))}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}

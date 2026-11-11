"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AlertCircle, Check, Info, X, TriangleAlert } from "lucide-react";

type ToastType = "success" | "error" | "warning" | "info";
type ToastItem = { id: number; type: ToastType; title: string; message: string; duration: number };
type ToastContextValue = { showToast: (type: ToastType, message: string, title?: string) => void };

const ToastContext = createContext<ToastContextValue | null>(null);
const defaultTitles: Record<ToastType, string> = {
  success: "Success",
  error: "Error",
  warning: "Warning",
  info: "Information",
};
const durations: Record<ToastType, number> = { success: 5000, error: 5000, warning: 5000, info: 4000 };

export default function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastItem | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismissToast = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setToast(null);
  }, []);

  const showToast = useCallback((type: ToastType, message: string, title = defaultTitles[type]) => {
    const duration = durations[type];
    if (timerRef.current) clearTimeout(timerRef.current);
    const id = Date.now();
    setToast({ id, type, title, message, duration });
    timerRef.current = setTimeout(() => {
      setToast((current) => current?.id === id ? null : current);
      timerRef.current = null;
    }, duration);
  }, []);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const icon = toast?.type === "success" ? <Check className="h-4 w-4" />
    : toast?.type === "error" ? <AlertCircle className="h-4 w-4" />
      : toast?.type === "warning" ? <TriangleAlert className="h-4 w-4" />
        : <Info className="h-4 w-4" />;
  const palette = toast?.type === "success" ? "border-emerald-200 text-emerald-700 bg-emerald-100"
    : toast?.type === "error" ? "border-red-200 text-red-700 bg-red-100"
      : toast?.type === "warning" ? "border-amber-200 text-amber-700 bg-amber-100"
        : "border-blue-200 text-blue-700 bg-blue-100";
  const accent = toast?.type === "success" ? "bg-emerald-500"
    : toast?.type === "error" ? "bg-red-500"
      : toast?.type === "warning" ? "bg-amber-500" : "bg-blue-500";

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && <div key={toast.id} role={toast.type === "error" ? "alert" : "status"} aria-live={toast.type === "error" ? "assertive" : "polite"} className="fixed left-1/2 top-4 z-[100] w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl ring-1 ring-black/5 animate-toast-in sm:left-auto sm:right-5 sm:top-5 sm:translate-x-0">
        <div className="flex items-start gap-3 p-4">
          <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${palette}`}>{icon}</span>
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-semibold ${palette.split(" ")[1]}`}>{toast.title}</p>
            <p className="mt-1 break-words text-sm leading-5 text-slate-600">{toast.message}</p>
          </div>
          <button type="button" onClick={dismissToast} aria-label="Dismiss notification" className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"><X className="h-4 w-4" /></button>
        </div>
        <div className="h-1 w-full bg-slate-100"><div className={`h-full w-full origin-left ${accent} animate-toast-progress`} style={{ animationDuration: `${toast.duration}ms` }} /></div>
      </div>}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider.");
  return context;
}

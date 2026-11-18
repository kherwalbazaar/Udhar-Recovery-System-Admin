"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AlertCircle, Check, Info, X, TriangleAlert, ShieldAlert } from "lucide-react";

type ToastType = "success" | "error" | "warning" | "info";
type ToastItem = { id: number; type: ToastType; title: string; message: string; duration: number };
type ConfirmOptions = { title: string; message: string; confirmLabel?: string; cancelLabel?: string; tone?: "danger" | "normal" };
type ToastContextValue = {
  showToast: (type: ToastType, message: string, title?: string) => void;
  confirmAction: (options: ConfirmOptions) => Promise<boolean>;
};

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
  const [confirmation, setConfirmation] = useState<ConfirmOptions | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confirmResolverRef = useRef<((confirmed: boolean) => void) | null>(null);

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

  const confirmAction = useCallback((options: ConfirmOptions) => new Promise<boolean>((resolve) => {
    confirmResolverRef.current?.(false);
    confirmResolverRef.current = resolve;
    setConfirmation(options);
  }), []);

  const finishConfirmation = useCallback((confirmed: boolean) => {
    confirmResolverRef.current?.(confirmed);
    confirmResolverRef.current = null;
    setConfirmation(null);
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
    <ToastContext.Provider value={{ showToast, confirmAction }}>
      {children}
      {confirmation && <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm animate-toast-in" onMouseDown={(event) => { if (event.target === event.currentTarget) finishConfirmation(false); }}>
        <section role="alertdialog" aria-modal="true" aria-labelledby="action-confirm-title" aria-describedby="action-confirm-message" className="w-full max-w-md overflow-hidden rounded-2xl border border-white/70 bg-white shadow-2xl ring-1 ring-black/10">
          <div className={`h-1.5 ${confirmation.tone === "danger" ? "bg-gradient-to-r from-rose-500 to-orange-400" : "bg-gradient-to-r from-blue-500 to-cyan-400"}`} />
          <div className="p-6">
            <div className="flex items-start gap-4">
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${confirmation.tone === "danger" ? "bg-rose-50 text-rose-600" : "bg-blue-50 text-blue-600"}`}><ShieldAlert className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <h2 id="action-confirm-title" className="text-base font-bold text-slate-900">{confirmation.title}</h2>
                <p id="action-confirm-message" className="mt-2 text-sm leading-6 text-slate-600">{confirmation.message}</p>
              </div>
              <button type="button" onClick={() => finishConfirmation(false)} aria-label="Close confirmation" className="-mr-2 -mt-2 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => finishConfirmation(false)} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">{confirmation.cancelLabel ?? "Keep it"}</button>
              <button type="button" autoFocus onClick={() => finishConfirmation(true)} className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 ${confirmation.tone === "danger" ? "bg-rose-600 hover:bg-rose-700" : "bg-blue-600 hover:bg-blue-700"}`}>{confirmation.confirmLabel ?? "Continue"}</button>
            </div>
          </div>
        </section>
      </div>}
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

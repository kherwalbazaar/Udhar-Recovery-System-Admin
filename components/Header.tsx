"use client";

import { useEffect, useState, useCallback } from "react";
import { Crown, Search, Bell, ChevronDown, RefreshCw } from "lucide-react";
import { triggerBackgroundRefresh } from "@/lib/cache";

export default function Header({ title: _title = "Dashboard" }: { title?: string }) {
  const [isSpinning, setIsSpinning] = useState(false);

  const handleRefresh = useCallback(() => {
    setIsSpinning(true);
    // soft refresh: show cached instantly, fetch latest in background
    triggerBackgroundRefresh();
    // also do hard reload fallback for pages using one-time get (ensures fresh via cache)
    // keep window reload optional - comment out to keep fully soft
    setTimeout(() => {
      // dispatch already triggered background fetch via onValueWithCache listeners
      // keep hard reload for full revalidation but instant due to cache
      window.location.reload();
    }, 400);
  }, []);

  const shouldDeferRefresh = useCallback(() => {
    // 1. Tab not visible -> defer
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return true;
    // 2. If any modal/dialog is open (all add/update modals use fixed inset-0) -> defer until closed
    // Covers: Khata Entry/Settle/Edit, Sales QuickAdd, etc.
    if (document.querySelector(".fixed.inset-0")) return true;
    // 3. If any submit is in progress (button shows Saving/Updating) -> wait until submission finishes
    const disabledButtons = document.querySelectorAll("button[disabled]");
    for (const btn of Array.from(disabledButtons)) {
      const t = (btn.textContent || "").toLowerCase();
      if (t.includes("saving") || t.includes("updating") || t.includes("submitting") || t.includes("adding")) {
        return true;
      }
    }
    // 4. If user is actively typing in a form field inside a modal/form -> defer
    // Checks focused input inside a form or modal to avoid wiping unsaved add/update data
    const active = document.activeElement as HTMLElement | null;
    if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT" || active.isContentEditable)) {
      // Only defer if typing in a visible modal/form area, not header search
      // Check if active input is inside a modal or has non-empty value (unsaved data)
      const inModal = active.closest(".fixed.inset-0");
      const hasValue = (active as HTMLInputElement).value?.trim().length > 0;
      if (inModal || hasValue) return true;
    }
    // 5. Optional: global marker if pages set data-submitting on body
    if (document.body?.dataset?.submitting === "true") return true;
    return false;
  }, []);

  useEffect(() => {
    let pendingTimeout: ReturnType<typeof setTimeout> | null = null;

    const attemptRefresh = () => {
      if (shouldDeferRefresh()) {
        // Wait until submissions / typing / modal finishes, then retry in 2s
        pendingTimeout = setTimeout(attemptRefresh, 2000);
        return;
      }
      setIsSpinning(true);
      pendingTimeout = setTimeout(() => {
        triggerBackgroundRefresh();
        window.location.reload();
      }, 800);
    };

    // Auto-refresh every 30 seconds while tab is visible, defer if add/update in progress
    // Shows cached data instantly, fetches latest in background via onValueWithCache/getWithCache
    const interval = setInterval(() => {
      // Visual spin tick
      setIsSpinning(true);
      // Briefly show spin, then decide to refresh or defer
      setTimeout(() => {
        if (shouldDeferRefresh()) {
          // Don't refresh - just stop spin and schedule retry after submission completes
          setIsSpinning(false);
          attemptRefresh();
          return;
        }
        // No submission in progress -> soft background refresh + hard reload (instant due to cache)
        triggerBackgroundRefresh();
        setIsSpinning(false);
        // hard reload still benefits from cache (stale-while-revalidate)
        window.location.reload();
      }, 400);
    }, 30000);

    return () => {
      clearInterval(interval);
      if (pendingTimeout) clearTimeout(pendingTimeout);
    };
  }, [shouldDeferRefresh]);
  return (
    <header className="bg-[#0b1e59] text-white h-16 flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center space-x-3 w-64">
        <div className="p-1 bg-amber-500 rounded-lg">
          <Crown className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="font-bold text-sm tracking-wide leading-tight">
            KHERWAL BAZAAR
          </h1>
          <p className="text-[10px] text-slate-300 tracking-wider">
            UDHAR RECOVERY SYSTEM
          </p>
        </div>
      </div>

      <div className="flex items-center flex-1 max-w-4xl px-4">
        <div className="relative flex-1 max-w-md">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            placeholder="Search customers, transactions..."
            className="w-full bg-[#13286b] text-sm text-white placeholder-slate-400 rounded-md pl-9 pr-4 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 border border-slate-700/50"
          />
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <button
          type="button"
          onClick={handleRefresh}
          className="p-1.5 rounded-full hover:bg-slate-800 text-slate-300"
          aria-label="Refresh"
          title="Refresh (auto every 30s)"
        >
          <RefreshCw className={`w-5 h-5 ${isSpinning ? "animate-spin" : ""}`} />
        </button>
        <div className="relative">
          <button
            type="button"
            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-300 relative"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>
        </div>
        <div className="flex items-center space-x-2 border-l border-slate-700 pl-4">
          <div className="w-8 h-8 rounded-full bg-slate-300 flex items-center justify-center text-slate-700 font-semibold text-xs">
            KA
          </div>
          <div className="text-xs">
            <p className="font-medium">Kherwal</p>
            <p className="text-[10px] text-slate-400">Admin</p>
          </div>
          <ChevronDown className="w-4 h-4 text-slate-400" />
        </div>
      </div>
    </header>
  );
}
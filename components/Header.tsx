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
    // Returns true if user is filling/updating -> auto-refresh should be SKIPPED
    // 1. Tab not visible -> skip
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return true;
    // 2. If any modal/dialog is open (all add/update modals use fixed inset-0) -> filling in modal
    if (document.querySelector(".fixed.inset-0")) return true;
    // 3. If any submit is in progress (button shows Saving/Updating) -> updating
    const disabledButtons = document.querySelectorAll("button[disabled]");
    for (const btn of Array.from(disabledButtons)) {
      const t = (btn.textContent || "").toLowerCase();
      if (t.includes("saving") || t.includes("updating") || t.includes("submitting") || t.includes("adding") || t.includes("deleting")) {
        return true;
      }
    }
    // 4. If any form field has unsaved data (user is filling) -> skip auto-refresh
    // Check all inputs/textareas except search/filter fields
    const inputs = document.querySelectorAll("input, textarea, select");
    for (const el of Array.from(inputs) as HTMLInputElement[]) {
      if (el.type === "hidden") continue;
      // skip search/filter inputs (they shouldn't block auto-refresh)
      const ph = (el.placeholder || "").toLowerCase();
      if (ph.includes("search")) continue;
      const val = (el.value || "").trim();
      // if focused -> user is typing, block
      if (document.activeElement === el) return true;
      // if has value and is inside a form/modal or is an add/update field -> block
      // Check if input is inside modal or near save buttons (add/update context)
      if (val.length > 0) {
        // if inside modal -> definitely filling
        if (el.closest(".fixed.inset-0")) return true;
        // if page has any add/update context: check if input is text/number with label near "Product Name", "Category", etc.
        // For simplicity, block if any non-search input has value and is not a filter/search
        // But don't block for pure search pages where value is search query - those were skipped via placeholder
        // So any remaining non-search input with value means filling
        return true;
      }
      if (el.isContentEditable && (el.textContent || "").trim().length > 0) return true;
    }
    // 5. If any select has non-default value or focused select
    const active = document.activeElement as HTMLElement | null;
    if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT" || active.isContentEditable)) {
      return true;
    }
    // 6. Optional: global marker if pages set data-submitting on body
    if (document.body?.dataset?.submitting === "true") return true;
    return false;
  }, []);

  useEffect(() => {
    // Auto-refresh every 30 seconds ONLY when idle (no filling/updating)
    // If user is filling any form or update is in progress -> skip this tick entirely, wait next 30s
    const interval = setInterval(() => {
      if (shouldDeferRefresh()) {
        // User is filling/updating -> NO auto-refresh this cycle
        return;
      }
      // Idle -> do auto-refresh
      setIsSpinning(true);
      setTimeout(() => {
        // Double-check still idle before actually refreshing (user may have started typing in 400ms)
        if (shouldDeferRefresh()) {
          setIsSpinning(false);
          return;
        }
        triggerBackgroundRefresh();
        setIsSpinning(false);
        window.location.reload();
      }, 400);
    }, 30000);

    return () => clearInterval(interval);
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
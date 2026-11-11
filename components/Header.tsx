"use client";

import { useEffect, useState, useCallback } from "react";
import { Crown, Bell, ChevronDown, RefreshCw } from "lucide-react";
import { triggerBackgroundRefresh } from "@/lib/cache";
import HeaderNavigation from "./HeaderNavigation";

export default function Header({ active = "Dashboard" }: { active?: string }) {
  const [isSpinning, setIsSpinning] = useState(false);

  const handleRefresh = useCallback(() => {
    setIsSpinning(true);
    // show cached instantly, fetch latest in background (stale-while-revalidate)
    triggerBackgroundRefresh();
    setTimeout(() => {
      window.location.reload();
    }, 400);
  }, []);

  // No auto-refresh: refresh only after an action (manual click or after save/update)
  // Listen for programmatic refresh after any successful add/update
  useEffect(() => {
    const onActionRefresh = () => {
      setIsSpinning(true);
      triggerBackgroundRefresh();
      setTimeout(() => {
        setIsSpinning(false);
        window.location.reload();
      }, 400);
    };
    window.addEventListener("udhar:action-refresh", onActionRefresh);
    return () => window.removeEventListener("udhar:action-refresh", onActionRefresh);
  }, []);
  return (
    <header className="bg-[#0b1e59] text-white shrink-0">
      <div className="flex h-16 items-center justify-between px-3 md:px-4">
        <div className="flex min-w-0 items-center space-x-2 md:space-x-3 md:w-64">
          <div className="p-1 bg-amber-500 rounded-lg">
            <Crown className="w-5 h-5 md:w-6 md:h-6 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-xs md:text-sm tracking-wide leading-tight">
              KHERWAL BAZAAR
            </h1>
            <p className="text-[8px] md:text-[10px] text-slate-300 tracking-wider">
              UDHAR RECOVERY SYSTEM
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center space-x-2 md:space-x-4">
          <button
            type="button"
            onClick={handleRefresh}
            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-300"
            aria-label="Refresh"
            title="Refresh"
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
          <div className="flex items-center space-x-2 border-l border-slate-700 pl-2 md:pl-4">
            <div className="w-8 h-8 rounded-full bg-slate-300 flex items-center justify-center text-slate-700 font-semibold text-xs">
              KA
            </div>
            <div className="hidden sm:block text-xs">
              <p className="font-medium">Kherwal</p>
              <p className="text-[10px] text-slate-400">Admin</p>
            </div>
            <ChevronDown className="hidden sm:block w-4 h-4 text-slate-400" />
          </div>
        </div>
      </div>
      {active !== "Product" && <HeaderNavigation active={active} />}
    </header>
  );
}

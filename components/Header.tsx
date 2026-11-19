"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Crown, Bell, ChevronDown, RefreshCw, LogOut } from "lucide-react";
import { triggerBackgroundRefresh } from "@/lib/cache";
import { ADMIN_EMAIL, signOut } from "@/lib/auth";
import LiveAmountCard from "./LiveAmountCard";
import HeaderNavigation from "./HeaderNavigation";

export default function Header({ active = "Dashboard" }: { active?: string }) {
  const [isSpinning, setIsSpinning] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!accountOpen) return;
    const onDocumentClick = (event: MouseEvent) => {
      if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false);
    };
    document.addEventListener("click", onDocumentClick);
    return () => document.removeEventListener("click", onDocumentClick);
  }, [accountOpen]);

  const handleSignOut = () => {
    signOut();
    setAccountOpen(false);
    router.replace("/login");
  };

  const handleRefresh = useCallback(() => {
    setIsSpinning(true);
    // show cached instantly, fetch latest in background (stale-while-revalidate)
    triggerBackgroundRefresh();
    setTimeout(() => {
      window.location.reload();
    }, 400);
  }, []);

  // Refresh data quietly after a successful add/update/delete.
  // Never reload the page: pages already patch their own state, and cached
  // listeners re-fetch in the background.
  useEffect(() => {
    const onActionRefresh = () => {
      setIsSpinning(true);
      triggerBackgroundRefresh();
      const timer = setTimeout(() => setIsSpinning(false), 700);
      return () => clearTimeout(timer);
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
          <LiveAmountCard variant="tab" />
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
          <div ref={accountRef} className="relative border-l border-slate-700 pl-2 md:pl-4">
            <button
              type="button"
              aria-expanded={accountOpen}
              aria-controls="header-account-menu"
              onClick={(event) => {
                event.stopPropagation();
                setAccountOpen((open) => !open);
              }}
              className="flex items-center space-x-2 rounded-lg px-1 py-0.5 transition hover:bg-slate-800"
            >
              <div className="w-8 h-8 rounded-full bg-slate-300 flex items-center justify-center text-slate-700 font-semibold text-xs">
                KA
              </div>
              <div className="hidden sm:block text-xs text-left">
                <p className="font-medium">Kherwal</p>
                <p className="text-[10px] text-slate-400">Admin</p>
              </div>
              <ChevronDown
                className={`hidden sm:block w-4 h-4 text-slate-400 transition-transform duration-200 ${
                  accountOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {accountOpen && (
              <div
                id="header-account-menu"
                className="absolute right-0 top-full z-50 mt-2 w-60 rounded-xl border border-slate-200 bg-white p-2 text-slate-800 shadow-2xl"
              >
                <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  Signed in as
                </p>
                <p className="truncate px-2 pb-2 text-xs font-semibold text-slate-700">
                  {ADMIN_EMAIL}
                </p>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-2 rounded-lg bg-rose-50 px-2.5 py-2 text-xs font-bold text-rose-600 transition hover:bg-rose-100"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      {![
        "Product",
        "Sales",
        "Sale Report",
        "Khata (Customers)",
        "Suppliers",
        "Cash Book",
        "Reminders",
      ].includes(active) && (
        <HeaderNavigation active={active} />
      )}
    </header>
  );
}

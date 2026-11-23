"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ref } from "firebase/database";
import { db } from "@/lib/firebase";
import { onValueWithCache, CACHE_KEYS } from "@/lib/cache";
import { buildMetrics, type Metrics, type RawMap } from "@/lib/metrics";
import { ADMIN_EMAIL, signOut } from "@/lib/auth";
import {
  BarChart3,
  Bell,
  CheckCheck,
  ChevronDown,
  Database,
  Download,
  IndianRupee,
  LogOut,
  Plus,
  Printer,
  ShoppingCart,
  TrendingUp,
  Truck,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const navItems = [
  { label: "Dashboard", href: "/" },
  { label: "Products", href: "/products" },
  { label: "Sales", href: "/sales" },
  { label: "Reports", href: "/sales-report" },
  { label: "Khata", href: "/customers" },
  { label: "Suppliers", href: "/suppliers" },
  { label: "Cash Book", href: "/cashbook" },
  { label: "Reminders", href: "/reminders" },
  { label: "Settings", href: "#" },
];

type KpiCard = {
  title: string;
  value: string;
  note: string;
  icon: LucideIcon;
  text: string;
  accent: string;
  iconBg: string;
};

const fmt = (n: number) =>
  `₹${Math.round(n).toLocaleString("en-IN")}`;

export default function DashboardHome() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [customerCount, setCustomerCount] = useState<number | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [navHighlight, setNavHighlight] = useState({ left: 0, top: 0, width: 0, height: 0 });
  const navListRef = useRef<HTMLUListElement>(null);
  const dashboardLinkRef = useRef<HTMLAnchorElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const moveNavHighlight = (target: HTMLElement | null) => {
    const list = navListRef.current;
    if (!list || !target) return;
    const listRect = list.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    setNavHighlight({
      left: targetRect.left - listRect.left,
      top: targetRect.top - listRect.top,
      width: targetRect.width,
      height: targetRect.height,
    });
  };

  useEffect(() => {
    const positionDashboardHighlight = () => moveNavHighlight(dashboardLinkRef.current);
    positionDashboardHighlight();
    window.addEventListener("resize", positionDashboardHighlight);
    return () => window.removeEventListener("resize", positionDashboardHighlight);
  }, []);

  useEffect(() => {
    let salesReady = false;
    let customersReady = false;
    let sales: RawMap = null;
    let customers: RawMap = null;
    let products: RawMap = null;

    const update = () => {
      if (!salesReady || !customersReady) return;
      setMetrics(buildMetrics(sales, customers, null, products, new Date()));
      setCustomerCount(customers ? Object.keys(customers).length : 0);
    };

    const unsubs = [
      onValueWithCache(
        ref(db, "sales"),
        CACHE_KEYS.SALES,
        (snap) => {
          sales = (snap.val() as RawMap) ?? null;
          salesReady = true;
          update();
        },
        () => {}
      ),
      onValueWithCache(
        ref(db, "customers"),
        CACHE_KEYS.CUSTOMERS,
        (snap) => {
          customers = (snap.val() as RawMap) ?? null;
          customersReady = true;
          update();
        },
        () => {}
      ),
      onValueWithCache(
        ref(db, "products"),
        CACHE_KEYS.PRODUCTS,
        (snap) => {
          products = (snap.val() as RawMap) ?? null;
          update();
        },
        () => {}
      ),
    ];

    return () => unsubs.forEach((unsubscribe) => unsubscribe());
  }, []);

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

  const cards: KpiCard[] = [
    {
      title: "Total Customers",
      value: customerCount === null ? "—" : String(customerCount),
      note: metrics ? `${metrics.dueCustomers} with pending dues` : "Loading…",
      icon: Users,
      text: "text-[#0c4a6e]",
      accent: "bg-[#0284c7]",
      iconBg: "from-[#38bdf8] to-[#0284c7]",
    },
    {
      title: "Total Due Amount",
      value: metrics ? fmt(metrics.totalDue) : "—",
      note: metrics ? `${metrics.dueCustomers} customers to recover from` : "Loading…",
      icon: IndianRupee,
      text: "text-[#e11d48]",
      accent: "bg-[#e11d48]",
      iconBg: "from-[#fb7185] to-[#e11d48]",
    },
    {
      title: "Collected Today",
      value: metrics ? fmt(metrics.collectionToday) : "—",
      note: metrics ? `${metrics.collectionTodayCount} collections recorded` : "Loading…",
      icon: CheckCheck,
      text: "text-[#15803d]",
      accent: "bg-[#16a34a]",
      iconBg: "from-[#4ade80] to-[#15803d]",
    },
    {
      title: "Profit Today",
      value: metrics ? fmt(metrics.profitToday) : "—",
      note: metrics ? `This month ${fmt(metrics.profitThisMonth)}` : "Loading…",
      icon: TrendingUp,
      text: "text-[#6d28d9]",
      accent: "bg-[#7c3aed]",
      iconBg: "from-[#a78bfa] to-[#6d28d9]",
    },
  ];

  const quickActions: { label: string; href: string; icon: LucideIcon; gradient: string }[] = [
    { label: "Sales", href: "/sales", icon: ShoppingCart, gradient: "from-[#0ea5e9] to-[#0369a1]" },
    { label: "New Entry", href: "/sales", icon: Plus, gradient: "from-[#22c55e] to-[#15803d]" },
    { label: "View Reports", href: "/sales-report", icon: BarChart3, gradient: "from-[#38bdf8] to-[#0284c7]" },
    { label: "Khata", href: "/customers", icon: Users, gradient: "from-[#fb7185] to-[#e11d48]" },
    { label: "Supplier", href: "/suppliers", icon: Truck, gradient: "from-[#2dd4bf] to-[#0f766e]" },
  ];

  return (
    <div className="relative flex min-h-0 w-full flex-1 select-none flex-col overflow-x-hidden overflow-y-auto bg-gradient-to-b from-[#29b6f6] via-[#7dd3fc] to-[#e0f2fe] text-slate-800">
      {/* Decorative financial grid, bars, trend line and skyline */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
        <svg className="h-full w-full opacity-35" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="dashboard-grid" width="44" height="44" patternUnits="userSpaceOnUse">
              <path d="M 44 0 L 0 0 0 44" fill="none" stroke="#ffffff" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dashboard-grid)" />
        </svg>

        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 1440 800"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <g fill="#ffffff" fillOpacity="0.22">
            <rect x="80" y="420" width="24" height="160" rx="2" />
            <rect x="120" y="370" width="24" height="210" rx="2" />
            <rect x="160" y="405" width="24" height="175" rx="2" />
            <rect x="200" y="355" width="24" height="225" rx="2" />
            <rect x="240" y="390" width="24" height="190" rx="2" />
            <rect x="280" y="430" width="24" height="150" rx="2" />

            <rect x="1030" y="420" width="24" height="160" rx="2" />
            <rect x="1070" y="390" width="24" height="190" rx="2" />
            <rect x="1110" y="410" width="24" height="170" rx="2" />
            <rect x="1150" y="370" width="24" height="210" rx="2" />
            <rect x="1190" y="340" width="24" height="240" rx="2" />
            <rect x="1230" y="365" width="24" height="215" rx="2" />
            <rect x="1270" y="330" width="24" height="250" rx="2" />
            <rect x="1310" y="300" width="24" height="280" rx="2" />
            <rect x="1350" y="325" width="24" height="255" rx="2" />
            <rect x="1390" y="285" width="24" height="295" rx="2" />
          </g>

          <polyline
            fill="none"
            stroke="#ffffff"
            strokeWidth="3"
            strokeOpacity="0.9"
            points="60,500 200,445 280,465 550,395 750,415 975,435 1190,360 1370,285 1440,320"
          />

          <circle cx="200" cy="445" r="6" fill="#ffffff" />
          <circle cx="280" cy="465" r="6" fill="#ffffff" />
          <circle cx="550" cy="395" r="7" fill="#ffffff" />
          <circle cx="975" cy="435" r="6" fill="#ffffff" />
          <circle cx="1190" cy="360" r="6" fill="#ffffff" />
          <circle cx="1370" cy="285" r="7" fill="#ffffff" />
        </svg>

        <div className="absolute inset-x-0 bottom-0 flex flex-col">
          <svg
            className="h-52 w-full text-[#4ba3e3]/55"
            viewBox="0 0 1440 220"
            preserveAspectRatio="none"
            fill="currentColor"
          >
            <path d="M0,220 L0,165 L25,165 L25,135 L55,135 L55,170 L85,170 L85,115 L120,115 L120,150 L150,150 L150,125 L185,125 L185,165 L220,165 L220,140 L260,140 L260,105 L295,105 L295,155 L330,155 L330,120 L375,120 L375,160 L410,160 L410,95 L445,95 L445,75 L465,75 L465,95 L485,95 L485,145 L520,145 L520,115 L560,115 L560,155 L600,155 L600,130 L645,130 L645,165 L685,165 L685,110 L730,110 L730,150 L775,150 L775,125 L820,125 L820,165 L865,165 L865,100 L905,100 L905,145 L950,145 L950,120 L995,120 L995,155 L1035,155 L1035,85 L1065,65 L1095,85 L1095,140 L1135,140 L1135,110 L1180,110 L1180,155 L1225,155 L1225,125 L1270,125 L1270,160 L1315,160 L1315,115 L1365,115 L1365,150 L1410,150 L1410,130 L1440,130 L1440,220 Z" />
            <path
              className="text-[#1d75bd]/50"
              d="M0,220 L0,185 L45,185 L45,155 L95,155 L95,180 L140,180 L140,145 L195,145 L195,185 L245,185 L245,160 L300,160 L300,190 L355,190 L355,140 L415,140 L415,175 L475,175 L475,150 L535,150 L535,185 L595,185 L595,160 L660,160 L660,190 L725,190 L725,145 L790,145 L790,180 L855,180 L855,155 L920,155 L920,185 L985,185 L985,135 L1055,135 L1055,175 L1120,175 L1120,150 L1185,150 L1185,185 L1250,185 L1250,155 L1320,155 L1320,185 L1390,185 L1390,165 L1440,165 L1440,220 Z"
            />
          </svg>
          <div className="h-28 w-full border-t-2 border-white/60 bg-gradient-to-b from-[#38bdf8]/40 via-[#7dd3fc]/55 to-[#bae6fd]/80 backdrop-blur-[1px]"></div>
        </div>
      </div>

      <div className="relative z-10 mx-auto flex min-h-full w-full max-w-[1440px] flex-col justify-between p-3 sm:p-5">
        <div>
          {/* Header: brand, title banner, admin profile */}
          <header className="relative flex flex-col items-center justify-between gap-4 lg:flex-row">
            <div className="flex items-center gap-2.5 self-start rounded-full border border-white/35 bg-gradient-to-r from-[#074173]/95 to-[#0c5694]/95 px-3 py-1.5 text-white shadow-lg backdrop-blur-md lg:self-center">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-white/95 p-[2px] shadow-md">
                <Image
                  src="/icon.png"
                  alt=""
                  width={512}
                  height={512}
                  priority
                  className="h-full w-full rounded-[8px] object-cover"
                />
              </span>
              <span className="text-sm font-extrabold tracking-tight whitespace-nowrap">Udhar Recovery</span>
            </div>

            <div className="banner-shadow mx-auto w-full max-w-3xl rounded-full border border-white/30 bg-gradient-to-r from-[#075985] via-[#0369a1] to-[#075985] px-8 py-3 text-center text-white">
              <h1 className="text-xl font-extrabold tracking-wide uppercase drop-shadow sm:text-2xl md:text-[26px]">
                UDHAR RECOVERY SYSTEM DASHBOARD
              </h1>
              <div className="mt-1 flex items-center justify-center gap-3">
                <span className="hidden h-[1px] w-12 bg-sky-300/60 sm:inline-block"></span>
                <p className="text-xs font-medium italic tracking-wide text-sky-100 sm:text-sm">
                  Real-Time Financial Tracking &amp; Collection Management
                </p>
                <span className="hidden h-[1px] w-12 bg-sky-300/60 sm:inline-block"></span>
              </div>
            </div>

            <div
              ref={accountRef}
              className="relative flex items-center gap-2.5 self-end lg:self-center"
            >
              <button
                type="button"
                aria-expanded={accountOpen}
                aria-controls="dashboard-account-menu"
                onClick={(event) => {
                  event.stopPropagation();
                  setAccountOpen((open) => !open);
                }}
                className="flex items-center gap-2.5 rounded-full p-0.5 pr-2 text-left transition hover:bg-white/10"
              >
                <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-sky-100 shadow-md">
                  <svg className="h-10 w-10" viewBox="0 0 36 36" fill="none">
                    <circle cx="18" cy="18" r="18" fill="#e0f2fe" />
                    <circle cx="18" cy="13" r="6" fill="#fed7aa" />
                    <path
                      d="M12 12C12 8.5 14.5 6.5 18 6.5C21.5 6.5 24 8.5 24 12C24 10 21.5 9 18 9C14.5 9 12 10 12 12Z"
                      fill="#1e293b"
                    />
                    <path d="M8 33C8 26.5 12.5 23 18 23C23.5 23 28 26.5 28 33" fill="#0369a1" />
                    <path d="M16 23L18 29L20 23" fill="#ffffff" />
                  </svg>
                </div>
                <div className="text-left leading-tight text-white drop-shadow-sm">
                  <div className="flex items-center gap-1 text-sm font-bold">
                    <span>Admin</span>
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform duration-200 ${
                        accountOpen ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                  <p className="text-[11px] font-medium text-sky-50">Super Admin</p>
                </div>
              </button>

              {accountOpen && (
                <div
                  id="dashboard-account-menu"
                  className="absolute right-0 top-full z-30 mt-2 w-60 rounded-xl border border-sky-200/80 bg-white/95 p-2 text-slate-800 shadow-2xl backdrop-blur-md"
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
          </header>

          {/* Navigation bar */}
          <nav
            aria-label="Primary Navigation"
            className="mt-4 rounded-2xl border border-white/40 bg-gradient-to-r from-[#074173]/95 via-[#0c5694]/95 to-[#074173]/95 p-1.5 text-white shadow-xl backdrop-blur-md"
          >
            <ul
              ref={navListRef}
              onMouseLeave={() => moveNavHighlight(dashboardLinkRef.current)}
              className="relative flex flex-wrap items-center justify-between gap-1"
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute rounded-xl border border-white/30 bg-gradient-to-r from-[#0284c7] to-[#38bdf8] shadow-md transition-[left,top,width,height] duration-300 ease-in-out"
                style={navHighlight}
              />
              {navItems.map(({ label, href }) => {
                const isActive = label === "Dashboard";
                return (
                  <li key={label}>
                    <Link
                      ref={isActive ? dashboardLinkRef : undefined}
                      href={href}
                      aria-current={isActive ? "page" : undefined}
                      onMouseEnter={(event) => moveNavHighlight(event.currentTarget)}
                      className={`relative z-10 flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors sm:text-sm ${isActive ? "font-bold text-white" : "text-sky-100 hover:text-white"}`}
                    >
                      <span>{label}</span>
                    </Link>
                  </li>
                );
              })}

            </ul>
          </nav>

          {/* KPI cards */}
          <section className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map(({ title, value, note, icon: Icon, text, accent, iconBg }) => (
              <div
                key={title}
                className="card-shadow relative flex items-center gap-4 overflow-hidden rounded-2xl border border-white bg-white/95 p-4 backdrop-blur-md"
              >
                <div className={`absolute inset-y-0 left-0 w-1.5 ${accent}`}></div>
                <div
                  className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${iconBg} text-white shadow-md`}
                >
                  <Icon className="h-7 w-7" aria-hidden="true" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-[#0c4a6e]">{title}</p>
                  <p className={`mt-0.5 text-2xl font-extrabold ${text}`}>{value}</p>
                  <p className="mt-1 text-right text-[11px] font-semibold text-slate-500">{note}</p>
                </div>
              </div>
            ))}
          </section>
        </div>

        {/* Central database node */}
        <div className="my-8 flex flex-col items-center justify-center">
          <div className="db-glow flex h-24 w-24 items-center justify-center rounded-full border-4 border-white bg-gradient-to-b from-[#38bdf8] to-[#0284c7] p-3">
            <Database className="h-12 w-12 text-white" aria-hidden="true" />
          </div>
          <span className="mt-2.5 text-base font-extrabold tracking-wide text-white drop-shadow-[0_2px_6px_rgba(3,105,161,0.85)]">
            Central Database
          </span>
          {metrics && (
            <span className="mt-1 text-xs font-semibold text-white/90 drop-shadow-[0_1px_4px_rgba(3,105,161,0.9)]">
              {metrics.dateLabel}
            </span>
          )}
        </div>

        {/* Quick actions */}
        <footer className="mx-auto w-full max-w-5xl pb-2">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {quickActions.map(({ label, href, icon: Icon, gradient }, index) => (
              <Link
                key={label}
                href={href}
                className={`action-btn-shadow flex items-center justify-center gap-2.5 rounded-xl border border-white/50 bg-gradient-to-b ${gradient} px-4 py-3.5 text-sm font-bold text-white transition hover:brightness-110 active:scale-95 ${
                  index === quickActions.length - 1 ? "col-span-2 sm:col-span-1" : ""
                }`}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span>{label}</span>
              </Link>
            ))}
          </div>
        </footer>
      </div>
    </div>
  );
}

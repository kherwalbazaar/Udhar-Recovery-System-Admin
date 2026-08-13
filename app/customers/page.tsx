"use client";

import { useEffect, useMemo, useState } from "react";
import { onValue, ref } from "firebase/database";
import {
  Users,
  ArrowDown,
  ArrowUp,
  Clock,
  Check,
  Search,
  Filter,
  ChevronRight,
  Phone,
  Calendar,
  Download,
  Printer,
  Plus,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import { db } from "@/lib/firebase";
import {
  buildKhata,
  runningBalances,
  type KhataCustomer,
  type KhataData,
  type KhataMetrics,
  type RawMap,
} from "@/lib/khata";

const AVATAR_COLORS = [
  "bg-blue-600",
  "bg-purple-500",
  "bg-orange-400",
  "bg-teal-500",
  "bg-emerald-500",
  "bg-purple-600",
  "bg-amber-400",
  "bg-blue-400",
];

function colorFor(name: string) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const second = parts.length > 1 ? parts[1]?.[0] ?? "" : "";
  return `${first}${second}`.toUpperCase();
}

const fmt = (n: number) =>
  n.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

const fmtMoney = (n: number) => `₹${fmt(n)}`;

function formatTime(ts: number) {
  const d = new Date(ts);
  let hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${hours}:${String(minutes).padStart(2, "0")} ${ampm}`;
}

function titleCase(s: string) {
  if (!s) return "General";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

type Metric = {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  bg: string;
  hoverBg: string;
  border: string;
};

function MetricCard({ metric }: { metric: Metric }) {
  const Icon = metric.icon;
  return (
    <div
      className={`${metric.bg} ${metric.hoverBg} ${metric.border} border-b-4 rounded-xl p-3 flex flex-col justify-between text-white shadow-sm hover:shadow-md transition-all duration-100 active:translate-y-[2px] active:border-b-2`}
    >
      <div className="flex items-center justify-center space-x-2">
        <div className="p-2 bg-white/20 text-white rounded-lg">
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-xs text-white/90 font-medium">
          {metric.label}
        </span>
      </div>
      <div className="mt-2 text-center">
        <h3 className="text-xl font-bold">{metric.value}</h3>
        {metric.sub && (
          <p className="text-[11px] text-white/70 mt-0.5">{metric.sub}</p>
        )}
      </div>
    </div>
  );
}

export default function KhataPage() {
  const [data, setData] = useState<KhataData | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const customersRef = ref(db, "customers");
    const unsub = onValue(
      customersRef,
      (snap) => {
        setData(buildKhata((snap.val() as RawMap) ?? null));
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    if (data && data.customers.length > 0 && !selectedId) {
      setSelectedId(data.customers[0].id);
    }
  }, [data, selectedId]);

  const selected: KhataCustomer | undefined = useMemo(
    () =>
      data?.customers.find((c) => c.id === selectedId) ?? data?.customers[0],
    [data, selectedId]
  );

  const balances = useMemo(
    () => (selected ? runningBalances(selected.transactions) : new Map()),
    [selected]
  );

  const filtered = (data?.customers ?? []).filter((c) => {
    const q = search.trim().toLowerCase();
    return (
      !q ||
      c.name.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q)
    );
  });

  const metrics: KhataMetrics | null = data?.metrics ?? null;
  const metricCards: Metric[] = [
    {
      label: "Total Customer",
      value: String(metrics?.totalCustomers ?? "—"),
      icon: Users,
      bg: "bg-red-500",
      hoverBg: "hover:bg-red-600",
      border: "border-red-700",
    },
    {
      label: "You Give",
      value: metrics ? fmtMoney(metrics.totalGiven) : "—",
      icon: ArrowDown,
      bg: "bg-amber-500",
      hoverBg: "hover:bg-amber-600",
      border: "border-amber-700",
    },
    {
      label: "You Got",
      value: metrics ? fmtMoney(metrics.totalRecovered) : "—",
      icon: ArrowUp,
      bg: "bg-emerald-500",
      hoverBg: "hover:bg-emerald-600",
      border: "border-emerald-700",
    },
    {
      label: "Overdue",
      value: String(metrics?.overdueCount ?? "—"),
      icon: Clock,
      bg: "bg-purple-500",
      hoverBg: "hover:bg-purple-600",
      border: "border-purple-700",
    },
    {
      label: "Paid",
      value: String(metrics?.paidCount ?? "—"),
      icon: Check,
      bg: "bg-blue-500",
      hoverBg: "hover:bg-blue-600",
      border: "border-blue-700",
    },
  ];

  return (
    <AppShell title="Khata (Customers)" active="Khata (Customers)">
      {/* PAGE TITLE */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-800">
            Khata (Customers)
          </h2>
          <p className="text-xs text-slate-500">
            Manage all customer accounts and their transaction history
          </p>
        </div>
        <button
          type="button"
          className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-2 rounded-lg flex items-center space-x-1.5 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add Customer</span>
        </button>
      </div>

      {/* METRICS CARDS */}
      <div className="grid grid-cols-5 gap-3">
        {metricCards.map((m) => (
          <MetricCard key={m.label} metric={m} />
        ))}
      </div>

      {loading && (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-xs text-slate-400">
          Loading customers...
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center text-xs text-red-500">
          Failed to load: {error}
        </div>
      )}

      {!loading && !error && data && (
        <div className="grid grid-cols-12 gap-4">
          {/* COLUMN 1: CUSTOMER LIST */}
          <div className="col-span-4 bg-white rounded-xl border border-slate-200 p-3 flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-800 mb-3">
                All Customers
              </h3>

              <div className="flex items-center space-x-2 mb-3">
                <div className="relative flex-1">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-slate-400">
                    <Search className="w-3.5 h-3.5" />
                  </span>
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search customer..."
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <button
                  type="button"
                  className="p-1.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-500 hover:bg-slate-100"
                  aria-label="Filter"
                >
                  <Filter className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-1.5">
                {filtered.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-6">
                    No customers found.
                  </p>
                )}
                {filtered.map((c) => {
                  const active = selected?.id === c.id;
                  const due = c.balance > 0;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedId(c.id)}
                      className={`w-full border rounded-lg p-2.5 flex items-center justify-between cursor-pointer text-left ${
                        active
                          ? "bg-blue-50/70 border-blue-200"
                          : "border-slate-100 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center space-x-2.5">
                        <span
                          className={`w-8 h-8 rounded-full ${colorFor(
                            c.name
                          )} text-white text-xs flex items-center justify-center font-bold`}
                        >
                          {initialsFor(c.name)}
                        </span>
                        <div>
                          <p
                            className={`text-xs ${
                              active ? "font-bold" : "font-semibold"
                            } text-slate-800`}
                          >
                            {c.name}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {c.phone}
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex items-center space-x-1">
                        <div>
                          <p
                            className={`text-xs font-bold ${
                              due ? "text-red-500" : "text-emerald-600"
                            }`}
                          >
                            ₹{fmt(c.balance)}
                          </p>
                          <p className="text-[9px] text-slate-400">
                            {due ? "Due" : "Paid"}
                          </p>
                        </div>
                        <ChevronRight
                          className={`w-3.5 h-3.5 ${
                            active ? "text-blue-500" : "text-slate-300"
                          }`}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              className="w-full text-xs text-slate-500 font-medium py-2 border border-slate-200 rounded-lg bg-slate-50 flex items-center justify-center space-x-1 hover:bg-slate-100 mt-3"
            >
              <span>Load More</span>
            </button>
          </div>

          {/* COLUMN 2: CUSTOMER LEDGER */}
          <div className="col-span-8 space-y-3">
            {selected && (
              <>
                {/* Selected Customer Profile Card */}
                <div className="bg-white rounded-xl p-4 border border-slate-200">
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-11 h-11 rounded-full ${colorFor(
                        selected.name
                      )} text-white font-bold text-base flex items-center justify-center shrink-0`}
                    >
                      {initialsFor(selected.name)}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-800 leading-tight">
                        {selected.name}
                      </h3>
                      <span className="bg-blue-50 text-blue-600 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-blue-100">
                        {titleCase(selected.collectionType)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-100 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center space-x-1.5 text-slate-500">
                        <Phone className="w-3 h-3" />
                        <span>{selected.phone}</span>
                      </span>
                      <span className="text-slate-400">Installments</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-red-50 border border-red-100 rounded-lg p-2 text-center">
                        <p className="text-[10px] text-red-500 font-medium">
                          Total Udhar
                        </p>
                        <p className="text-sm font-bold text-red-500">
                          {fmtMoney(selected.balance)}
                        </p>
                      </div>
                      <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-2 text-center">
                        <p className="text-[10px] text-emerald-600 font-medium">
                          Total Paid
                        </p>
                        <p className="text-sm font-bold text-emerald-600">
                          {fmtMoney(selected.got)}
                        </p>
                      </div>
                      <div className="bg-blue-50 border border-blue-100 rounded-lg p-2 text-center">
                        <p className="text-[10px] text-blue-600 font-medium">
                          Total Purchase
                        </p>
                        <p className="text-sm font-bold text-blue-600">
                          {fmtMoney(selected.gave)}
                        </p>
                      </div>
                      <div className="bg-purple-50 border border-purple-100 rounded-lg p-2 text-center">
                        <p className="text-[10px] text-purple-600 font-medium">
                          Balance
                        </p>
                        <p className="text-sm font-bold text-purple-600">
                          {selected.balance < 0
                            ? `₹${fmtMoney(-selected.balance)}`
                            : fmtMoney(selected.balance)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Ledger Table Container */}
                <div className="bg-white rounded-xl p-4 border border-slate-200">

                  <div className="flex items-center justify-between mb-3 text-xs">
                    <div className="flex items-center space-x-2">
                      <div className="flex items-center space-x-1.5 border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50 text-slate-600">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>All Dates</span>
                      </div>
                      <select className="border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50 text-slate-600 focus:outline-none">
                        <option>All Transactions</option>
                      </select>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-600 flex items-center space-x-1 hover:bg-slate-50"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Export</span>
                      </button>
                      <button
                        type="button"
                        className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-600 flex items-center space-x-1 hover:bg-slate-50"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Print</span>
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="text-[10px] text-slate-400 border-b border-slate-100">
                          <th className="pb-2 font-normal">Date & Time</th>
                          <th className="pb-2 font-normal">Type</th>
                          <th className="pb-2 font-normal">
                            Description / Items
                          </th>
                          <th className="pb-2 font-normal text-right">
                            Amount (₹)
                          </th>
                          <th className="pb-2 font-normal text-right">
                            Paid (₹)
                          </th>
                          <th className="pb-2 font-normal text-right">
                            Due (₹)
                          </th>
                          <th className="pb-2 font-normal text-right">
                            Balance (₹)
                          </th>
                        </tr>
                      </thead>
                      <tbody className="text-[11px] divide-y divide-slate-100">
                        {selected.transactions.length === 0 && (
                          <tr>
                            <td
                              colSpan={7}
                              className="py-6 text-center text-slate-400"
                            >
                              No transactions yet.
                            </td>
                          </tr>
                        )}
                        {selected.transactions.map((t) => {
                          const isSale = t.type === "gave";
                          const running = balances.get(t.id) ?? 0;
                          return (
                            <tr key={t.id}>
                              <td className="py-2.5 text-slate-700 font-medium">
                                {t.date}
                                <br />
                                <span className="text-[10px] text-slate-400">
                                  {formatTime(t.createdAt)}
                                </span>
                              </td>
                              <td className="py-2.5">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                                    isSale
                                      ? "bg-blue-50 text-blue-600"
                                      : "bg-emerald-50 text-emerald-600"
                                  }`}
                                >
                                  {isSale ? "Sale" : "Payment"}
                                </span>
                              </td>
                              <td className="py-2.5 text-slate-800 font-medium">
                                {t.itemName}
                              </td>
                              <td className="py-2.5 text-right font-medium text-slate-700">
                                {isSale ? fmt(t.amount) : "—"}
                              </td>
                              <td className="py-2.5 text-right font-semibold text-emerald-600">
                                {isSale ? "—" : fmt(t.amount)}
                              </td>
                              <td className="py-2.5 text-right font-bold text-red-500">
                                {isSale ? fmt(t.amount) : "—"}
                              </td>
                              <td className="py-2.5 text-right font-bold text-red-500">
                                {fmt(running)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-3 text-xs text-slate-500">
                    <p>
                      Showing 1 to {selected.transactions.length} of{" "}
                      {selected.transactions.length} entries
                    </p>
                    <div className="flex items-center space-x-1">
                      <button
                        type="button"
                        className="px-2 py-1 border border-slate-200 rounded text-slate-400 hover:bg-slate-50"
                      >
                        «
                      </button>
                      <button
                        type="button"
                        className="px-2 py-1 border border-slate-200 rounded text-slate-400 hover:bg-slate-50"
                      >
                        ‹
                      </button>
                      <button
                        type="button"
                        className="px-2.5 py-1 bg-blue-600 text-white rounded font-medium"
                      >
                        1
                      </button>
                      <button
                        type="button"
                        className="px-2 py-1 border border-slate-200 rounded text-slate-600 hover:bg-slate-50"
                      >
                        ›
                      </button>
                      <button
                        type="button"
                        className="px-2 py-1 border border-slate-200 rounded text-slate-600 hover:bg-slate-50"
                      >
                        »
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
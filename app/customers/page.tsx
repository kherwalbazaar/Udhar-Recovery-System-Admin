"use client";

import { useEffect, useMemo, useState } from "react";
import { ref, push, update } from "firebase/database";
import { onValueWithCache, CACHE_KEYS, triggerActionRefresh } from "@/lib/cache";import {
  Users,
  ArrowDown,
  ArrowUp,
  Clock,
  Check,
  Search,
  Filter,
  ChevronRight,
  Calendar,
  Download,
  Printer,
  Plus,
  Trash2,
  X,
  Edit3,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import { db } from "@/lib/firebase";
import {
  buildKhata,
  runningBalances,
  type KhataTransaction,
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
  const [entryOpen, setEntryOpen] = useState(false);
  const [settleOpen, setSettleOpen] = useState(false);
  const [settleAmount, setSettleAmount] = useState("");
  const [settleDesc, setSettleDesc] = useState("");
  const [settleError, setSettleError] = useState<string | null>(null);
  const [settleSubmitting, setSettleSubmitting] = useState(false);
  const [entryItems, setEntryItems] = useState<
    { name: string; mrp: number; sale: number }[]
  >([]);
  const [entryForm, setEntryForm] = useState({
    name: "",
    mrp: "",
    sale: "",
  });
  const [entryError, setEntryError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [editTxn, setEditTxn] = useState<KhataTransaction | null>(null);
  const [editForm, setEditForm] = useState({ itemName: "", amount: "" });
  const [editError, setEditError] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);

  useEffect(() => {
    const customersRef = ref(db, "customers");
    const unsub = onValueWithCache(
      customersRef,
      CACHE_KEYS.CUSTOMERS,
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
      label: "You will Give",
      value: metrics ? fmtMoney(metrics.giveBack) : "—",
      icon: ArrowDown,
      bg: "bg-emerald-500",
      hoverBg: "hover:bg-emerald-600",
      border: "border-emerald-700",
    },
    {
      label: "You will Get",
      value: metrics ? fmtMoney(metrics.totalDue) : "—",
      icon: ArrowUp,
      bg: "bg-red-500",
      hoverBg: "hover:bg-red-600",
      border: "border-red-700",
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

  const addEntryItem = () => {
    const name = entryForm.name.trim();
    const mrp = Number(entryForm.mrp);
    const sale = Number(entryForm.sale);
    if (!name) {
      setEntryError("Please enter item name.");
      return;
    }
    if (!mrp || mrp <= 0) {
      setEntryError("Please enter a valid MRP.");
      return;
    }
    if (!sale || sale <= 0) {
      setEntryError("Please enter a valid sale price.");
      return;
    }
    setEntryItems((prev) => [...prev, { name, mrp, sale }]);
    setEntryForm({ name: "", mrp: "", sale: "" });
    setEntryError(null);
  };

  const submitEntry = async () => {
    if (!selected) return;
    if (entryItems.length === 0) {
      setEntryError("Please add at least one item.");
      return;
    }
    setSubmitting(true);
    setEntryError(null);
    try {
      const date = new Date();
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const dateKey = `${y}-${m}-${day}`;
      const createdAt = Date.now();
      const updates: Record<string, unknown> = {};
      let creditTotal = 0;
      for (const item of entryItems) {
        creditTotal += item.sale;
        const txnKey = push(
          ref(db, `customers/${selected.id}/transactions`)
        ).key;
        updates[`customers/${selected.id}/transactions/${txnKey}`] = {
          amount: item.sale,
          itemName: item.name,
          date: dateKey,
          type: "gave",
          createdAt,
        };
      }
      updates[`customers/${selected.id}/totalAmount`] =
        (selected.totalAmount ?? 0) + creditTotal;
      await update(ref(db), updates);
      triggerActionRefresh();
      setEntryItems([]);
      setEntryOpen(false);
    } catch (e) {
      setEntryError(e instanceof Error ? e.message : "Failed to save entry.");
    } finally {
      setSubmitting(false);
    }
  };

  const submitSettle = async () => {
    if (!selected) return;
    const amount = Number(settleAmount);
    if (!amount || amount <= 0) {
      setSettleError("Please enter a valid amount.");
      return;
    }
    setSettleSubmitting(true);
    setSettleError(null);
    try {
      const date = new Date();
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const dateKey = `${y}-${m}-${day}`;
      const createdAt = Date.now();
      const txnKey = push(
        ref(db, `customers/${selected.id}/transactions`)
      ).key;
      const updates: Record<string, unknown> = {};
      updates[`customers/${selected.id}/transactions/${txnKey}`] = {
        amount,
        itemName: settleDesc.trim() || "Settlement Payment",
        date: dateKey,
        type: "got",
        createdAt,
      };
      updates[`customers/${selected.id}/totalAmount`] =
        (selected.totalAmount ?? 0) - amount;
      await update(ref(db), updates);
      triggerActionRefresh();
      setSettleAmount("");
      setSettleDesc("");
      setSettleOpen(false);
    } catch (e) {
      setSettleError(
        e instanceof Error ? e.message : "Failed to settle payment."
      );
    } finally {
      setSettleSubmitting(false);
    }
  };

  const openEdit = (t: KhataTransaction) => {
    setEditTxn(t);
    setEditForm({ itemName: t.itemName, amount: String(t.amount) });
    setEditError(null);
  };

  const saveEdit = async () => {
    if (!selected || !editTxn) return;
    const itemName = editForm.itemName.trim();
    const amount = Number(editForm.amount);
    if (!itemName) {
      setEditError("Please enter a description.");
      return;
    }
    if (!amount || amount <= 0) {
      setEditError("Please enter a valid amount.");
      return;
    }
    setEditSubmitting(true);
    setEditError(null);
    try {
      const updates: Record<string, unknown> = {};
      updates[
        `customers/${selected.id}/transactions/${editTxn.id}/itemName`
      ] = itemName;
      updates[`customers/${selected.id}/transactions/${editTxn.id}/amount`] =
        amount;
      await update(ref(db), updates);
      triggerActionRefresh();
      setEditTxn(null);
    } catch (e) {
      setEditError(
        e instanceof Error ? e.message : "Failed to update transaction."
      );
    } finally {
      setEditSubmitting(false);
    }
  };

  return (
    <AppShell title="Khata (Customers)" active="Khata (Customers)">
      {/* PAGE TITLE */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">
          Khata (Customers)
        </h1>
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
        {metricCards.map((m) =>
          m.label === "Total Customer" ? (
            <div
              key={m.label}
              className="bg-pink-500 border-b-4 border-pink-700 shadow-sm rounded-xl p-3 flex flex-col justify-between"
            >
              <div className="flex items-center justify-center space-x-2">
                <div className="p-2 bg-white/20 text-white rounded-lg">
                  <m.icon className="w-4 h-4" />
                </div>
                <span className="text-xs text-white/90 font-medium">
                  {m.label}
                </span>
              </div>
              <div className="mt-2 text-center">
                <h3 className="text-xl font-bold text-white">{m.value}</h3>
                {m.sub && (
                  <p className="text-[11px] text-white/70 mt-0.5">{m.sub}</p>
                )}
              </div>
            </div>
          ) : (
            <MetricCard key={m.label} metric={m} />
          )
        )}
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
                      className={`w-full border rounded-lg p-2.5 flex items-center justify-between cursor-pointer text-left transition-colors ${
                        active
                          ? "bg-blue-600 border-blue-600 shadow-sm"
                          : "border-slate-100 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center space-x-2.5">
                        <span
                          className={`w-8 h-8 rounded-full ${
                            active ? "bg-white/20" : colorFor(c.name)
                          } text-white text-xs flex items-center justify-center font-bold`}
                        >
                          {initialsFor(c.name)}
                        </span>
                        <div>
                          <p
                            className={`text-xs ${
                              active
                                ? "font-bold text-white"
                                : "font-semibold text-slate-800"
                            }`}
                          >
                            {c.name}
                          </p>
                          <p
                            className={`text-[10px] ${
                              active ? "text-blue-100" : "text-slate-400"
                            }`}
                          >
                            {c.phone}
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex items-center space-x-1">
                        <div>
                          <p
                            className={`text-xs font-bold ${
                              active
                                ? "text-white"
                                : due
                                ? "text-red-500"
                                : "text-emerald-600"
                            }`}
                          >
                            ₹{fmt(c.balance)}
                          </p>
                          <p
                            className={`text-[9px] ${
                              active ? "text-blue-100" : "text-slate-400"
                            }`}
                          >
                            {due ? "Due" : "Paid"}
                          </p>
                        </div>
                        <ChevronRight
                          className={`w-3.5 h-3.5 ${
                            active ? "text-white" : "text-slate-300"
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
                <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                  <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 p-4 flex items-center space-x-3">
                    <div
                      className={`w-11 h-11 rounded-full ${colorFor(
                        selected.name
                      )} text-white font-bold text-base flex items-center justify-center shrink-0`}
                    >
                      {initialsFor(selected.name)}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-base font-bold text-slate-800 leading-tight">
                        {selected.name}
                      </h3>
                      <div className="flex items-center space-x-2">
                        <span className="bg-blue-50 text-blue-600 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-blue-100">
                          {selected.phone}
                        </span>
                        <span className="text-[10px] font-medium text-slate-400">
                          {titleCase(selected.collectionType)}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSettleOpen(true);
                        setSettleError(null);
                      }}
                      className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg px-3 py-2 flex items-center space-x-1.5 transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Settle</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEntryOpen(true);
                        setEntryError(null);
                      }}
                      className="text-xs bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg px-3 py-2 flex items-center space-x-1.5 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Entry</span>
                    </button>
                  </div>

                  <div className="bg-white p-4 mt-0 space-y-2 text-xs">
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
                    <table className="w-full table-fixed text-left border-collapse">
                      <colgroup>
                        <col className="w-1/6" />
                        <col className="w-1/6" />
                        <col className="w-1/6" />
                        <col className="w-1/6" />
                        <col className="w-1/6" />
                        <col className="w-1/6" />
                      </colgroup>
                      <thead>
                        <tr className="text-[10px] text-slate-400 border-b border-slate-100">
                          <th className="pb-2 font-normal">Date & Time</th>
                          <th className="pb-2 font-normal text-center">Type</th>
                          <th className="pb-2 font-normal text-center">
                            Description / Items
                          </th>
                          <th className="pb-2 font-normal text-center">
                            Amount (₹)
                          </th>
                          <th className="pb-2 font-normal text-center">
                            Balance (₹)
                          </th>
                          <th className="pb-2 font-normal text-center">
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody className="text-[11px] divide-y divide-slate-100">
                        {selected.transactions.length === 0 && (
                          <tr>
                            <td
                              colSpan={6}
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
                            <tr
                              key={t.id}
                              className={
                                isSale
                                  ? "bg-red-50/50"
                                  : "bg-emerald-50/50"
                              }
                            >
                              <td className="py-2.5 text-slate-700 font-medium whitespace-nowrap">
                                {t.date}
                                <br />
                                <span className="text-[10px] text-slate-400">
                                  {formatTime(t.createdAt)}
                                </span>
                              </td>
                              <td className="py-2.5 text-center">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${
                                    isSale
                                      ? "bg-blue-50 text-blue-600"
                                      : "bg-emerald-50 text-emerald-600"
                                  }`}
                                >
                                  {isSale ? "Sale" : "Payment"}
                                </span>
                              </td>
                              <td className="py-2.5 text-slate-800 font-medium text-center truncate px-2">
                                {t.itemName}
                              </td>
                              <td
                                className={`py-2.5 text-center font-semibold ${
                                  isSale ? "text-red-500" : "text-emerald-600"
                                }`}
                              >
                                {isSale ? fmt(t.amount) : `+${fmt(t.amount)}`}
                              </td>
                              <td className="py-2.5 text-center font-bold text-red-500">
                                {fmt(running)}
                              </td>
                              <td className="py-2.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => openEdit(t)}
                                  className="text-blue-500 hover:text-blue-700"
                                  aria-label="Edit transaction"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
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

      {entryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800">
                Add Entry — {selected?.name}
              </h3>
              <button
                type="button"
                onClick={() => setEntryOpen(false)}
                className="text-slate-400 hover:text-slate-600"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  value={entryForm.name}
                  onChange={(e) =>
                    setEntryForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="Items name"
                  className="col-span-1 text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <input
                  type="number"
                  value={entryForm.mrp}
                  onChange={(e) =>
                    setEntryForm((f) => ({ ...f, mrp: e.target.value }))
                  }
                  placeholder="MRP"
                  className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <input
                  type="number"
                  value={entryForm.sale}
                  onChange={(e) =>
                    setEntryForm((f) => ({ ...f, sale: e.target.value }))
                  }
                  placeholder="Sale"
                  className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <button
                type="button"
                onClick={addEntryItem}
                className="w-full text-xs bg-blue-50 text-blue-600 font-semibold rounded-lg py-2 border border-blue-100 hover:bg-blue-100"
              >
                + Add Items
              </button>

              {entryItems.length > 0 && (
                <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-40 overflow-y-auto">
                  {entryItems.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between px-3 py-2 text-xs"
                    >
                      <span className="font-medium text-slate-800 truncate">
                        {item.name}
                      </span>
                      <div className="flex items-center space-x-3 text-slate-500">
                        <span>MRP ₹{fmt(item.mrp)}</span>
                        <span className="font-semibold text-slate-700">
                          Sale ₹{fmt(item.sale)}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setEntryItems((prev) =>
                              prev.filter((_, idx) => idx !== i)
                            )
                          }
                          className="text-red-400 hover:text-red-600"
                          aria-label="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {entryError && (
                <p className="text-[11px] text-red-500">{entryError}</p>
              )}

              <button
                type="button"
                onClick={submitEntry}
                disabled={submitting || entryItems.length === 0}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-xs py-2.5 rounded-lg"
              >
                {submitting ? "Saving..." : "Submit Entry"}
              </button>
            </div>
          </div>
        </div>
      )}

      {settleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800">
                Settle Payment — {selected?.name}
              </h3>
              <button
                type="button"
                onClick={() => setSettleOpen(false)}
                className="text-slate-400 hover:text-slate-600"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div>
                <label className="text-[11px] text-slate-500 font-medium">
                  Amount (₹)
                </label>
                <input
                  type="number"
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 mt-1 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-500 font-medium">
                  Description
                </label>
                <input
                  type="text"
                  value={settleDesc}
                  onChange={(e) => setSettleDesc(e.target.value)}
                  placeholder="Enter description"
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 mt-1 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {settleError && (
                <p className="text-[11px] text-red-500">{settleError}</p>
              )}

              <button
                type="button"
                onClick={submitSettle}
                disabled={settleSubmitting}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-xs py-2.5 rounded-lg"
              >
                {settleSubmitting ? "Saving..." : "Settlement"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editTxn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800">
                Edit Transaction — {selected?.name}
              </h3>
              <button
                type="button"
                onClick={() => setEditTxn(null)}
                className="text-slate-400 hover:text-slate-600"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div>
                <label className="text-[11px] text-slate-500 font-medium">
                  Description / Items
                </label>
                <input
                  type="text"
                  value={editForm.itemName}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, itemName: e.target.value }))
                  }
                  placeholder="Enter description"
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 mt-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-500 font-medium">
                  Amount (₹)
                </label>
                <input
                  type="number"
                  value={editForm.amount}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, amount: e.target.value }))
                  }
                  placeholder="Enter amount"
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 mt-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {editError && (
                <p className="text-[11px] text-red-500">{editError}</p>
              )}

              <button
                type="button"
                onClick={saveEdit}
                disabled={editSubmitting}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-xs py-2.5 rounded-lg"
              >
                {editSubmitting ? "Saving..." : "Update"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
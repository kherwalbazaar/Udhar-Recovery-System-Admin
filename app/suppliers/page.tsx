"use client";

import { useEffect, useMemo, useState } from "react";
import { onValue, ref, push, set, update, remove } from "firebase/database";import {
  Users,
  ArrowUpRight,
  Clock,
  Check,
  Minus,
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
  ShoppingCart,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import { db } from "@/lib/firebase";
import {
  buildSuppliers,
  supplierRunningBalances,
  type Supplier,
  type SupplierData,
  type SupplierMetrics,
  type SupplierTransaction,
  type RawMap,
} from "@/lib/suppliers";

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

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
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
  materialIcon?: string;
};

function MetricCard({ metric }: { metric: Metric }) {
  const Icon = metric.icon;
  return (
    <div
      className={`${metric.bg} ${metric.hoverBg} ${metric.border} border-b-4 rounded-xl p-3 flex flex-col justify-between text-white shadow-sm hover:shadow-md transition-all duration-100 active:translate-y-[2px] active:border-b-2`}
    >
      <div className="flex items-center justify-center space-x-2">
        <div className="p-2 bg-white/20 text-white rounded-lg">
          {metric.materialIcon ? (
            <span className="font-['Material_Symbols_Outlined'] text-[24px] [font-variation-settings:'FILL'_0,'wght'_400,'GRAD'_0,'opsz'_24] select-none align-middle inline-block text-white">
              {metric.materialIcon}
            </span>
          ) : (
            <Icon className="w-4 h-4" />
          )}
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

export default function SuppliersPage() {
  const [data, setData] = useState<SupplierData | null>(null);
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
  const [entryForm, setEntryForm] = useState({
    details: "",
    amount: "",
    date: "",
  });
  const [entryError, setEntryError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [settleDate, setSettleDate] = useState("");
  const [editTxn, setEditTxn] = useState<SupplierTransaction | null>(null);
  const [editForm, setEditForm] = useState({ itemName: "", amount: "" });
  const [editError, setEditError] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    name: "",
    phone: "",
    address: "",
  });
  const [addError, setAddError] = useState<string | null>(null);
  const [addSubmitting, setAddSubmitting] = useState(false);

  useEffect(() => {
    const suppliersRef = ref(db, "suppliers");
    const unsub = onValue(
      suppliersRef,
      (snap) => {
        setData(buildSuppliers((snap.val() as RawMap) ?? null));
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
    if (data && data.suppliers.length > 0 && !selectedId) {
      setSelectedId(data.suppliers[0].id);
    }
  }, [data, selectedId]);

  const selected: Supplier | undefined = useMemo(
    () =>
      data?.suppliers.find((c) => c.id === selectedId) ?? data?.suppliers[0],
    [data, selectedId]
  );

  const balances = useMemo(
    () =>
      selected
        ? supplierRunningBalances(selected.transactions)
        : new Map<string, number>(),
    [selected]
  );

  const filtered = (data?.suppliers ?? []).filter((c) => {
    const q = search.trim().toLowerCase();
    return (
      !q ||
      c.name.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q)
    );
  });

  const metrics: SupplierMetrics | null = data?.metrics ?? null;
  const metricCards: Metric[] = [
    {
      label: "Total Supplier",
      value: String(metrics?.totalSuppliers ?? "—"),
      icon: Users,
      bg: "bg-red-500",
      hoverBg: "hover:bg-red-600",
      border: "border-red-700",
    },
    {
      label: "Purchase",
      value: metrics ? fmtMoney(metrics.totalPurchase) : "—",
      icon: ShoppingCart,
      materialIcon: "add_shopping_cart",
      bg: "bg-red-500",
      hoverBg: "hover:bg-red-600",
      border: "border-red-700",
    },
    {
      label: "Payment",
      value: metrics ? fmtMoney(metrics.totalPaid) : "—",
      icon: ArrowUpRight,
      materialIcon: "arrow_outward",
      bg: "bg-emerald-500",
      hoverBg: "hover:bg-emerald-600",
      border: "border-emerald-700",
    },
    {
      label: "Due Suppliers",
      value: String(metrics?.dueSuppliers ?? "—"),
      icon: Clock,
      bg: "bg-purple-500",
      hoverBg: "hover:bg-purple-600",
      border: "border-purple-700",
    },
    {
      label: "Settled",
      value: String(metrics?.settledSuppliers ?? "—"),
      icon: Check,
      bg: "bg-blue-500",
      hoverBg: "hover:bg-blue-600",
      border: "border-blue-700",
    },
  ];

  const submitEntry = async () => {
    if (!selected) return;
    const details = entryForm.details.trim();
    const amount = Number(entryForm.amount);
    if (!details) {
      setEntryError("Please enter details.");
      return;
    }
    if (!amount || amount <= 0) {
      setEntryError("Please enter a valid amount.");
      return;
    }
    setSubmitting(true);
    setEntryError(null);
    try {
      const dateKey = entryForm.date || todayKey();
      const createdAt = Date.now();
      const txnKey = push(
        ref(db, `suppliers/${selected.id}/transactions`)
      ).key;
      const updates: Record<string, unknown> = {
        [`suppliers/${selected.id}/transactions/${txnKey}`]: {
          amount,
          itemName: details,
          date: dateKey,
          type: "purchase",
          createdAt,
        },
        [`suppliers/${selected.id}/totalAmount`]:
          (selected.totalAmount ?? 0) + amount,
      };
      await update(ref(db), updates);
      setEntryForm({ details: "", amount: "", date: "" });
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
      const dateKey = settleDate || todayKey();
      const createdAt = Date.now();
      const txnKey = push(
        ref(db, `suppliers/${selected.id}/transactions`)
      ).key;
      const updates: Record<string, unknown> = {};
      updates[`suppliers/${selected.id}/transactions/${txnKey}`] = {
        amount,
        itemName: settleDesc.trim() || "Settlement Payment",
        date: dateKey,
        type: "payment",
        createdAt,
      };
      updates[`suppliers/${selected.id}/totalAmount`] =
        (selected.totalAmount ?? 0) - amount;
      await update(ref(db), updates);
      setSettleAmount("");
      setSettleDesc("");
      setSettleDate("");
      setSettleOpen(false);
    } catch (e) {
      setSettleError(
        e instanceof Error ? e.message : "Failed to settle payment."
      );
    } finally {
      setSettleSubmitting(false);
    }
  };

  const submitAdd = async () => {
    const name = addForm.name.trim();
    const phone = addForm.phone.trim();
    const address = addForm.address.trim();
    if (!name) {
      setAddError("Please enter supplier name.");
      return;
    }
    setAddSubmitting(true);
    setAddError(null);
    try {
      const createdAt = Date.now();
      const supplierRef = push(ref(db, "suppliers"));
      const record: Record<string, unknown> = {
        name,
        phone,
        address,
        totalAmount: 0,
        collectionType: "General",
        createdAt,
      };
      await set(supplierRef, record);
      setAddOpen(false);
      setAddForm({ name: "", phone: "", address: "" });
    } catch (e) {
      setAddError(e instanceof Error ? e.message : "Failed to add supplier.");
    } finally {
      setAddSubmitting(false);
    }
  };

  const openEdit = (t: SupplierTransaction) => {
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
        `suppliers/${selected.id}/transactions/${editTxn.id}/itemName`
      ] = itemName;
      updates[`suppliers/${selected.id}/transactions/${editTxn.id}/amount`] =
        amount;
      await update(ref(db), updates);
      setEditTxn(null);
    } catch (e) {
      setEditError(
        e instanceof Error ? e.message : "Failed to update transaction."
      );
    } finally {
      setEditSubmitting(false);
    }
  };

  const cancelEdit = () => {
    setEditTxn(null);
    setEditForm({ itemName: "", amount: "" });
    setEditError(null);
  };

  const askDelete = () => {
    setDeleteOpen(true);
    setDeleteError(null);
  };

  const deleteTxn = async () => {
    if (!selected || !editTxn) return;
    setDeleteSubmitting(true);
    setDeleteError(null);
    try {
      await remove(
        ref(db, `suppliers/${selected.id}/transactions/${editTxn.id}`)
      );
      setDeleteOpen(false);
      setEditTxn(null);
    } catch (e) {
      setDeleteError(
        e instanceof Error ? e.message : "Failed to delete transaction."
      );
    } finally {
      setDeleteSubmitting(false);
    }
  };

  return (
    <AppShell title="Suppliers" active="Suppliers">
      {/* PAGE TITLE */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">Suppliers</h1>
        <button
          type="button"
          onClick={() => {
            setAddOpen(true);
            setAddError(null);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-2 rounded-lg flex items-center space-x-1.5 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add Supplier</span>
        </button>
      </div>

      {/* METRICS CARDS */}
      <div className="grid grid-cols-5 gap-3">
        {metricCards.map((m) =>
          m.label === "Total Supplier" ? (
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
          Loading suppliers...
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center text-xs text-red-500">
          Failed to load: {error}
        </div>
      )}

      {!loading && !error && data && (
        <div className="grid grid-cols-12 gap-4">
          {/* COLUMN 1: SUPPLIER LIST */}
          <div className="col-span-4 bg-white rounded-xl border border-slate-200 p-3 flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-800 mb-3">
                All Suppliers
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
                    placeholder="Search supplier..."
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
                    No suppliers found.
                  </p>
                )}
                {filtered.map((c) => {
                  const active = selected?.id === c.id;
                  const give = c.balance > 0;
                  const advance = c.balance < 0;
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
                              give ? "text-red-500" : "text-emerald-600"
                            }`}
                          >
                            ₹{fmt(Math.abs(c.balance))}
                          </p>
                          <p className="text-[9px] text-slate-400">
                            {give
                              ? "Due"
                              : advance
                              ? "Advance Paid"
                              : "Settled"}
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

          {/* COLUMN 2: SUPPLIER LEDGER */}
          <div className="col-span-8 space-y-3">
            {selected && (
              <>
                {/* Selected Supplier Profile Card */}
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
                      <Minus className="w-3.5 h-3.5" />
                      <span>Payment</span>
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
                      <span>Purchase</span>
                    </button>
                  </div>

                  <div className="bg-white p-4 mt-0 space-y-2 text-xs">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-blue-50 border border-blue-100 rounded-lg p-2 text-center">
                        <p className="text-[10px] text-blue-600 font-medium">
                          Total Purchase
                        </p>
                        <p className="text-sm font-bold text-blue-600">
                          {fmtMoney(selected.totalPurchase)}
                        </p>
                      </div>
                      <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-2 text-center">
                        <p className="text-[10px] text-emerald-600 font-medium">
                          Total Paid
                        </p>
                        <p className="text-sm font-bold text-emerald-600">
                          {fmtMoney(selected.totalPaid)}
                        </p>
                      </div>
                      <div className="bg-red-50 border border-red-100 rounded-lg p-2 text-center">
                        <p className="text-[10px] text-red-500 font-medium">
                          You will Give
                        </p>
                        <p className="text-sm font-bold text-red-500">
                          {selected.balance > 0
                            ? fmtMoney(selected.balance)
                            : "—"}
                        </p>
                      </div>
                      <div className="bg-purple-50 border border-purple-100 rounded-lg p-2 text-center">
                        <p className="text-[10px] text-purple-600 font-medium">
                          {selected.balance < 0 ? "Advance Paid" : "Net Balance"}
                        </p>
                        <p className="text-sm font-bold text-purple-600">
                          {selected.balance < 0
                            ? fmtMoney(-selected.balance)
                            : selected.balance === 0
                            ? "Settled"
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
                          const isPurchase = t.type === "purchase";
                          const running = balances.get(t.id) ?? 0;
                          return (
                            <tr
                              key={t.id}
                              className={
                                isPurchase
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
                                    isPurchase
                                      ? "bg-blue-50 text-blue-600"
                                      : "bg-emerald-50 text-emerald-600"
                                  }`}
                                >
                                  {isPurchase ? "Purchase" : "Payment"}
                                </span>
                              </td>
                              <td className="py-2.5 text-slate-800 font-medium text-center truncate px-2">
                                {t.itemName}
                              </td>
                              <td
                                className={`py-2.5 text-center font-semibold ${
                                  isPurchase
                                    ? "text-red-500"
                                    : "text-emerald-600"
                                }`}
                              >
                                {isPurchase ? fmt(t.amount) : `+${fmt(t.amount)}`}
                              </td>
                              <td
                                className={`py-2.5 text-center font-bold ${
                                  running > 0
                                    ? "text-red-500"
                                    : running < 0
                                    ? "text-emerald-600"
                                    : "text-slate-400"
                                }`}
                              >
                                {fmt(Math.abs(running))}
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
          <div className="bg-white rounded-xl w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800">
                Add Purchase — {selected?.name}
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
              <div>
                <label className="text-[11px] text-slate-500 font-medium">
                  Date
                </label>
                <input
                  type="date"
                  value={entryForm.date || todayKey()}
                  onChange={(e) =>
                    setEntryForm((f) => ({ ...f, date: e.target.value }))
                  }
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 mt-1 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-500 font-medium">
                  Amount (₹)
                </label>
                <input
                  type="number"
                  value={entryForm.amount}
                  onChange={(e) =>
                    setEntryForm((f) => ({ ...f, amount: e.target.value }))
                  }
                  placeholder="Enter amount"
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 mt-1 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-500 font-medium">
                  Details
                </label>
                <input
                  type="text"
                  value={entryForm.details}
                  onChange={(e) =>
                    setEntryForm((f) => ({ ...f, details: e.target.value }))
                  }
                  placeholder="Enter details"
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 mt-1 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {entryError && (
                <p className="text-[11px] text-red-500">{entryError}</p>
              )}

              <button
                type="button"
                onClick={submitEntry}
                disabled={submitting}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-xs py-2.5 rounded-lg"
              >
                {submitting ? "Saving..." : "Save Purchase"}
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
                Payment — {selected?.name}
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
                  Date
                </label>
                <input
                  type="date"
                  value={settleDate || todayKey()}
                  onChange={(e) => setSettleDate(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 mt-1 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
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
                {settleSubmitting ? "Saving..." : "Save Payment"}
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

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={cancelEdit}
                  disabled={editSubmitting}
                  className="flex-1 border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 font-semibold text-xs py-2.5 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveEdit}
                  disabled={editSubmitting}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-xs py-2.5 rounded-lg"
                >
                  {editSubmitting ? "Saving..." : "Update"}
                </button>
                <button
                  type="button"
                  onClick={askDelete}
                  disabled={editSubmitting}
                  className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold text-xs py-2.5 rounded-lg flex items-center justify-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteOpen && editTxn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl w-full max-w-xs shadow-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800">
                Delete Transaction
              </h3>
              <button
                type="button"
                onClick={() => setDeleteOpen(false)}
                className="text-slate-400 hover:text-slate-600"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Are you sure you want to delete this transaction for{" "}
                <span className="font-semibold text-slate-800">
                  {selected?.name}
                </span>
                ? This action cannot be undone.
              </p>

              {deleteError && (
                <p className="text-[11px] text-red-500 mt-2">{deleteError}</p>
              )}

              <div className="flex items-center gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setDeleteOpen(false)}
                  disabled={deleteSubmitting}
                  className="flex-1 border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 font-semibold text-xs py-2.5 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={deleteTxn}
                  disabled={deleteSubmitting}
                  className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold text-xs py-2.5 rounded-lg"
                >
                  {deleteSubmitting ? "Deleting..." : "Yes, Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800">Add Supplier</h3>
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                className="text-slate-400 hover:text-slate-600"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div>
                <label className="text-[11px] text-slate-500 font-medium">
                  Supplier Name *
                </label>
                <input
                  type="text"
                  value={addForm.name}
                  onChange={(e) =>
                    setAddForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="Enter supplier name"
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 mt-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-500 font-medium">
                  Phone
                </label>
                <input
                  type="tel"
                  value={addForm.phone}
                  onChange={(e) =>
                    setAddForm((f) => ({ ...f, phone: e.target.value }))
                  }
                  placeholder="Enter phone number"
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 mt-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-500 font-medium">
                  Address
                </label>
                <input
                  type="text"
                  value={addForm.address}
                  onChange={(e) =>
                    setAddForm((f) => ({ ...f, address: e.target.value }))
                  }
                  placeholder="Enter address"
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 mt-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {addError && (
                <p className="text-[11px] text-red-500">{addError}</p>
              )}

              <button
                type="button"
                onClick={submitAdd}
                disabled={addSubmitting}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-xs py-2.5 rounded-lg"
              >
                {addSubmitting ? "Saving..." : "Add Supplier"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
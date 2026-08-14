"use client";

import { useEffect, useMemo, useState } from "react";
import { onValue, ref, push } from "firebase/database";
import {
  Chart as ChartJS,
  ArcElement,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Filler,
  Tooltip,
} from "chart.js";
import { Doughnut, Line } from "react-chartjs-2";
import {
  Wallet,
  ArrowDown,
  ArrowUp,
  Scale,
  Calculator,
  Calendar,
  Search,
  Filter,
  MoreHorizontal,
  Info,
  ShoppingBag,
  User,
  Home,
  ShoppingCart,
  PlusSquare,
  Zap,
  PieChart,
  Printer,
  ArrowRightLeft,
  Plus,
  X,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import { db } from "@/lib/firebase";
import {
  buildCashbook,
  type CashbookData,
  type RawMap,
} from "@/lib/cashbook";

ChartJS.register(
  ArcElement,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Filler,
  Tooltip
);

const fmt = (n: number) =>
  n.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

function formatTime(ts: number) {
  const d = new Date(ts);
  let hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${hours}:${String(minutes).padStart(2, "0")} ${ampm}`;
}

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type Metric = {
  label: string;
  value: string;
  sub: string;
  icon: React.ElementType;
  iconClass: string;
  valueClass: string;
};

function MetricCard({ metric }: { metric: Metric }) {
  const Icon = metric.icon;
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex items-center space-x-3">
      <div className={`p-2.5 ${metric.iconClass} rounded-lg`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-[11px] text-slate-400 font-medium">{metric.label}</p>
        <h3 className={`text-lg font-bold ${metric.valueClass}`}>
          {metric.value}
        </h3>
        <p className="text-[10px] text-slate-400">{metric.sub}</p>
      </div>
    </div>
  );
}

export default function CashBookPage() {
  const [data, setData] = useState<CashbookData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [txnType, setTxnType] = useState<"in" | "out">("in");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [mode, setMode] = useState("cash");
  const [date, setDate] = useState("");
  const [remark, setRemark] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const cashbookRef = ref(db, "cashbook");
    const unsub = onValue(
      cashbookRef,
      (snap) => {
        setData(buildCashbook((snap.val() as RawMap) ?? null, new Date()));
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const openAdd = (type: "in" | "out") => {
    setTxnType(type);
    setAmount("");
    setCategory("");
    setMode("cash");
    setDate(toDateKey(new Date()));
    setRemark("");
    setFormError(null);
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      setFormError("Please enter a valid amount.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await push(ref(db, "cashbook"), {
        amount: amt,
        category: category.trim() || (txnType === "in" ? "Other Income" : "Other"),
        mode,
        remark: remark.trim(),
        date: date || toDateKey(new Date()),
        type: txnType,
        createdAt: Date.now(),
      });
      setModalOpen(false);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Failed to save transaction.");
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data.entries;
    return data.entries.filter(
      (e) =>
        e.category.toLowerCase().includes(q) ||
        e.remark.toLowerCase().includes(q) ||
        e.date.includes(q) ||
        e.mode.toLowerCase().includes(q)
    );
  }, [data, search]);

  const metrics = data?.metrics;
  const metricCards: Metric[] = [
    {
      label: "Opening Balance",
      value: metrics ? `₹${fmt(metrics.opening)}` : "—",
      sub: metrics
        ? `As on 01 ${new Date()
            .toLocaleDateString("en-IN", { month: "short", year: "numeric" })
            .replace(" ", " ")}`
        : "Loading...",
      icon: Wallet,
      iconClass: "bg-blue-500 text-white",
      valueClass: "text-slate-800",
    },
    {
      label: "Total Collection (Inflow)",
      value: metrics ? `₹${fmt(metrics.monthIn)}` : "—",
      sub: "This Month",
      icon: ArrowDown,
      iconClass: "bg-emerald-500 text-white",
      valueClass: "text-emerald-600",
    },
    {
      label: "Total Expenses (Outflow)",
      value: metrics ? `₹${fmt(metrics.monthOut)}` : "—",
      sub: "This Month",
      icon: ArrowUp,
      iconClass: "bg-red-500 text-white",
      valueClass: "text-red-500",
    },
    {
      label: "Closing Balance",
      value: metrics ? `₹${fmt(metrics.closing)}` : "—",
      sub: "As on Today",
      icon: Scale,
      iconClass: "bg-purple-600 text-white",
      valueClass: "text-slate-800",
    },
    {
      label: "Cash in Hand",
      value: metrics ? `₹${fmt(metrics.closing)}` : "—",
      sub: "Current Balance",
      icon: Calculator,
      iconClass: "bg-amber-500 text-white",
      valueClass: "text-amber-500",
    },
  ];

  const monthIn = metrics?.monthIn ?? 0;
  const monthOut = metrics?.monthOut ?? 0;
  const totalFlow = monthIn + monthOut;
  const inPct = totalFlow > 0 ? Math.round((monthIn / totalFlow) * 1000) / 10 : 0;
  const outPct = totalFlow > 0 ? Math.round((monthOut / totalFlow) * 1000) / 10 : 0;
  const netFlow = monthIn - monthOut;

  const doughnutData = {
    labels: ["Inflow", "Outflow"],
    datasets: [
      {
        data: [monthIn, monthOut],
        backgroundColor: ["#10b981", "#ef4444"],
        borderWidth: 0,
        hoverOffset: 2,
      },
    ],
  };
  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "75%",
    plugins: { legend: { display: false } },
  };

  const trendValues = data?.trend ?? [];
  const trendMax = Math.max(
    100000,
    Math.ceil((Math.max(0, ...trendValues.map((t) => t.value)) + 2000) / 1000) *
      1000
  );
  const lineData = {
    labels: trendValues.map((t) => t.label),
    datasets: [
      {
        data: trendValues.map((t) => t.value),
        borderColor: "#2563eb",
        borderWidth: 2,
        backgroundColor: "rgba(37, 99, 235, 0.15)",
        fill: true,
        tension: 0.3,
        pointRadius: 3,
        pointBackgroundColor: "#2563eb",
      },
    ],
  };
  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { size: 9 }, color: "#94a3b8" },
      },
      y: {
        grid: { color: "#f1f5f9" },
        ticks: {
          font: { size: 9 },
          color: "#94a3b8",
          callback: (v: string | number) =>
            v === 0 ? "₹0" : `${Number(v) / 1000}K`,
        },
        min: 0,
        max: trendMax,
      },
    },
  };

  return (
    <AppShell title="Cash Book" active="Cash Book">
      {/* PAGE TITLE */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">Cash Book</h1>
        <button
          type="button"
          onClick={() => openAdd("in")}
          className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-2 rounded-lg flex items-center space-x-1.5 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add Transaction</span>
        </button>
      </div>

      {/* METRIC CARDS */}
      <div className="grid grid-cols-5 gap-3">
        {metricCards.map((m) => (
          <MetricCard key={m.label} metric={m} />
        ))}
      </div>

      {loading && (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-xs text-slate-400">
          Loading cash book...
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center text-xs text-red-500">
          Failed to load: {error}
        </div>
      )}

      {!loading && !error && data && (
        <div className="grid grid-cols-12 gap-4">
          {/* LEFT: TRANSACTIONS TABLE */}
          <div className="col-span-8 bg-white rounded-xl p-4 border border-slate-200 flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-800 mb-3">
                Cash Book Transactions
              </h3>

              <div className="flex items-center space-x-2 mb-4">
                <div className="flex items-center space-x-1.5 border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50 text-xs text-slate-600">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>All Dates</span>
                </div>

                <select className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50 text-slate-600 focus:outline-none">
                  <option>All Types</option>
                </select>

                <div className="relative flex-1">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-slate-400">
                    <Search className="w-3.5 h-3.5" />
                  </span>
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search description or ref..."
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <button
                  type="button"
                  className="flex items-center space-x-1 text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50 text-slate-600 hover:bg-slate-100"
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>Filter</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-[10px] text-slate-400 border-b border-slate-100">
                      <th className="pb-2 font-normal">Date & Time</th>
                      <th className="pb-2 font-normal">Type</th>
                      <th className="pb-2 font-normal">Category</th>
                      <th className="pb-2 font-normal">
                        Description / Reference
                      </th>
                      <th className="pb-2 font-normal text-right">
                        Inflow (₹)
                      </th>
                      <th className="pb-2 font-normal text-right">
                        Outflow (₹)
                      </th>
                      <th className="pb-2 font-normal text-right">
                        Balance (₹)
                      </th>
                      <th className="pb-2 font-normal text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="text-[11px] divide-y divide-slate-100">
                    {filtered.length === 0 && (
                      <tr>
                        <td
                          colSpan={8}
                          className="py-6 text-center text-slate-400"
                        >
                          No transactions found.
                        </td>
                      </tr>
                    )}
                    {filtered.map((e) => {
                      const isIn = e.type === "in";
                      const balance = data.running.get(e.id) ?? 0;
                      return (
                        <tr key={e.id}>
                          <td className="py-3 text-slate-700 font-medium">
                            {e.date}
                            <br />
                            <span className="text-[10px] text-slate-400">
                              {formatTime(e.createdAt)}
                            </span>
                          </td>
                          <td className="py-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                                isIn
                                  ? "bg-emerald-50 text-emerald-600"
                                  : "bg-red-50 text-red-500"
                              }`}
                            >
                              {isIn ? "Inflow" : "Outflow"}
                            </span>
                          </td>
                          <td className="py-3 text-slate-700">
                            {e.category || "—"}
                          </td>
                          <td className="py-3 text-slate-800 font-medium">
                            {e.remark || e.category || "—"}
                          </td>
                          <td className="py-3 text-right font-bold text-emerald-600">
                            {isIn ? fmt(e.amount) : "—"}
                          </td>
                          <td className="py-3 text-right font-bold text-red-500">
                            {isIn ? "—" : fmt(e.amount)}
                          </td>
                          <td className="py-3 text-right font-semibold text-slate-800">
                            {fmt(balance)}
                          </td>
                          <td className="py-3 text-center">
                            <button
                              type="button"
                              className="text-slate-400 hover:text-slate-600"
                              aria-label="More options"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-3 text-xs text-slate-500">
                <p>Showing 1 to {filtered.length} of {filtered.length} entries</p>
                <div className="flex items-center space-x-1">
                  <button
                    type="button"
                    className="px-2 py-1 border border-slate-200 rounded text-slate-400 hover:bg-slate-50"
                  >
                    &lt;
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
                    &gt;
                  </button>
                </div>
              </div>

              <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-2.5 mt-3 flex items-center space-x-2 text-xs text-blue-600">
                <Info className="w-4 h-4 shrink-0" />
                <span>
                  Note: Cash Book shows your all cash inflow and outflow
                  transactions.
                </span>
              </div>
            </div>
          </div>

          {/* RIGHT: CHARTS & QUICK ACTIONS */}
          <div className="col-span-4 space-y-4">
            {/* Cash Flow Overview */}
            <div className="bg-white rounded-xl p-4 border border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-slate-800">
                  Cash Flow Overview{" "}
                  <span className="text-slate-400 font-normal">
                    (This Month)
                  </span>
                </h3>
                <select className="text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 text-slate-600 focus:outline-none">
                  <option>This Month</option>
                </select>
              </div>

              <div className="flex items-center">
                <div className="w-1/2 space-y-3 text-xs">
                  <div>
                    <div className="flex items-center space-x-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                      <span className="text-slate-500 font-medium">
                        Total Inflow
                      </span>
                    </div>
                    <p className="text-sm font-bold text-emerald-600 pl-4">
                      ₹{fmt(monthIn)}
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center space-x-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                      <span className="text-slate-500 font-medium">
                        Total Outflow
                      </span>
                    </div>
                    <p className="text-sm font-bold text-red-500 pl-4">
                      ₹{fmt(monthOut)}
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center space-x-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                      <span className="text-slate-500 font-medium">
                        Net Cash Flow
                      </span>
                    </div>
                    <p className="text-sm font-bold text-blue-600 pl-4">
                      ₹{fmt(netFlow)}
                    </p>
                  </div>
                </div>

                <div className="w-1/2 relative h-36 flex items-center justify-center">
                  <Doughnut data={doughnutData} options={doughnutOptions} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-[9px] text-slate-400">Net Inflow</span>
                    <span className="text-xs font-bold text-slate-800">
                      ₹{fmt(netFlow)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-center space-x-4 text-[10px] text-slate-400 pt-3 border-t border-slate-100 mt-2">
                <span className="flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>Inflow ({inPct}%)</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-red-500"></span>
                  <span>Outflow ({outPct}%)</span>
                </span>
              </div>
            </div>

            {/* Cash Balance Trend */}
            <div className="bg-white rounded-xl p-4 border border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-slate-800">
                  Cash Balance Trend
                </h3>
                <select className="text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 text-slate-600 focus:outline-none">
                  <option>All Periods</option>
                </select>
              </div>

              <div className="relative w-full h-36">
                {trendValues.length > 0 ? (
                  <Line data={lineData} options={lineOptions} />
                ) : (
                  <div className="flex items-center justify-center h-full text-xs text-slate-400">
                    No data yet.
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-xl p-4 border border-slate-200 space-y-3">
              <h3 className="text-xs font-bold text-slate-800">Quick Actions</h3>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => openAdd("in")}
                  className="flex flex-col items-center justify-center bg-emerald-50/60 border border-emerald-100 rounded-lg p-2.5 hover:bg-emerald-100"
                >
                  <ArrowDown className="w-4 h-4 text-emerald-600 mb-1" />
                  <span className="text-[10px] font-medium text-emerald-700 text-center">
                    Add Inflow
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => openAdd("out")}
                  className="flex flex-col items-center justify-center bg-red-50/60 border border-red-100 rounded-lg p-2.5 hover:bg-red-100"
                >
                  <ArrowUp className="w-4 h-4 text-red-500 mb-1" />
                  <span className="text-[10px] font-medium text-red-700 text-center">
                    Add Outflow
                  </span>
                </button>

                <button
                  type="button"
                  className="flex flex-col items-center justify-center bg-blue-50/60 border border-blue-100 rounded-lg p-2.5 hover:bg-blue-100"
                >
                  <ArrowRightLeft className="w-4 h-4 text-blue-600 mb-1" />
                  <span className="text-[10px] font-medium text-blue-700 text-center">
                    Add Transfer
                  </span>
                </button>

                <button
                  type="button"
                  className="flex flex-col items-center justify-center bg-purple-50/60 border border-purple-100 rounded-lg p-2.5 hover:bg-purple-100"
                >
                  <Wallet className="w-4 h-4 text-purple-600 mb-1" />
                  <span className="text-[10px] font-medium text-purple-700 text-center leading-tight">
                    Add Opening
                    <br />
                    Balance
                  </span>
                </button>

                <button
                  type="button"
                  className="flex flex-col items-center justify-center bg-amber-50/60 border border-amber-100 rounded-lg p-2.5 hover:bg-amber-100"
                >
                  <PieChart className="w-4 h-4 text-amber-600 mb-1" />
                  <span className="text-[10px] font-medium text-amber-700 text-center leading-tight">
                    Cash
                    <br />
                    Summary
                  </span>
                </button>

                <button
                  type="button"
                  className="flex flex-col items-center justify-center bg-teal-50/60 border border-teal-100 rounded-lg p-2.5 hover:bg-teal-100"
                >
                  <Printer className="w-4 h-4 text-teal-600 mb-1" />
                  <span className="text-[10px] font-medium text-teal-700 text-center leading-tight">
                    Print
                    <br />
                    Cash Book
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD TRANSACTION MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl w-full max-w-md border border-slate-200 shadow-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800">
                Add Transaction
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div>
                <p className="text-[11px] text-slate-500 font-medium mb-1.5">
                  Transaction Type
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTxnType("in")}
                    className={`flex items-center justify-center space-x-1.5 rounded-lg py-2 text-xs font-semibold ${
                      txnType === "in"
                        ? "border-2 border-emerald-500 bg-emerald-50/50 text-emerald-600"
                        : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <ArrowDown className="w-4 h-4" />
                    <span>Inflow</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTxnType("out")}
                    className={`flex items-center justify-center space-x-1.5 rounded-lg py-2 text-xs font-semibold ${
                      txnType === "out"
                        ? "border-2 border-red-500 bg-red-50/50 text-red-600"
                        : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <ArrowUp className="w-4 h-4" />
                    <span>Outflow</span>
                  </button>
                </div>
              </div>

              <div>
                <p className="text-[11px] text-slate-500 font-medium mb-1">
                  Amount (₹)
                </p>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <p className="text-[11px] text-slate-500 font-medium mb-1">
                  Category
                </p>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder={
                    txnType === "in" ? "e.g. Sale Collection" : "e.g. Purchase"
                  }
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[11px] text-slate-500 font-medium mb-1">
                    Mode
                  </p>
                  <select
                    value={mode}
                    onChange={(e) => setMode(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 focus:outline-none"
                  >
                    <option value="cash">Cash</option>
                    <option value="online">Online</option>
                    <option value="upi">UPI</option>
                  </select>
                </div>
                <div>
                  <p className="text-[11px] text-slate-500 font-medium mb-1">
                    Date
                  </p>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <p className="text-[11px] text-slate-500 font-medium mb-1">
                  Remark / Reference
                </p>
                <input
                  type="text"
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  placeholder="Optional note..."
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {formError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs font-semibold text-red-600">
                  {formError}
                </div>
              )}

              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-xs py-2.5 rounded-lg flex items-center justify-center space-x-1.5 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>{submitting ? "Saving..." : "Save Transaction"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
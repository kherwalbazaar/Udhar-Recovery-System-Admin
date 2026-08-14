"use client";

import { useEffect, useMemo, useState } from "react";
import { onValue, ref } from "firebase/database";
import { ShoppingCart, Search, ArrowRight } from "lucide-react";
import AppShell from "@/components/AppShell";
import { db } from "@/lib/firebase";

type RawMap = Record<string, Record<string, unknown>> | null;

type SaleRow = {
  id: string;
  product: string;
  mrp: number;
  quantity: number;
  total: number;
  date: string;
  createdAt: number;
};

const fmtMoney = (n: number) =>
  "₹ " + n.toLocaleString("en-IN");

const fmt = (n: number) =>
  n.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatTime(ts: number) {
  const d = new Date(ts);
  let hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${hours}:${String(minutes).padStart(2, "0")} ${ampm}`;
}

export default function AllSalesPage() {
  const [rows, setRows] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 20;

  useEffect(() => {
    const unsub = onValue(
      ref(db, "sales"),
      (snap) => {
        const raw = (snap.val() as RawMap) ?? null;
        const all: SaleRow[] = raw
          ? Object.entries(raw).map(([id, s]) => ({
              id,
              product: String(s.productName ?? ""),
              mrp: Number(s.mrp ?? 0),
              quantity: Number(s.quantity ?? 1),
              total: Number(s.sale ?? 0),
              date: String(s.date ?? ""),
              createdAt: Number(s.createdAt ?? 0),
            }))
          : [];
        setRows(
          all
            .filter((r) => r.product)
            .sort((a, b) => b.createdAt - a.createdAt)
        );
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !r.product.toLowerCase().includes(q)) return false;
      if (dateFilter && r.date !== dateFilter) return false;
      return true;
    });
  }, [rows, query, dateFilter]);

  useEffect(() => {
    setPage(1);
  }, [query, dateFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const pageRows = filtered.slice((page - 1) * perPage, page * perPage);

  const totals = useMemo(() => {
    let count = 0;
    let amount = 0;
    for (const r of filtered) {
      count += 1;
      amount += r.total;
    }
    return { count, amount };
  }, [filtered]);

  return (
    <AppShell title="" active="Sales">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">All Sales</h1>
        <div className="flex items-center space-x-2">
          <div className="relative w-56">
            <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-slate-400">
              <Search className="w-3.5 h-3.5" />
            </span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search product..."
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <a
            href="/sales"
            className="text-xs text-slate-600 font-medium hover:text-slate-900 flex items-center space-x-1 border border-slate-200 rounded-lg px-3 py-1.5 bg-white shadow-sm"
          >
            <span>Add Sale</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex items-center space-x-3">
          <div className="p-2.5 bg-emerald-100 text-emerald-600 rounded-lg">
            <ShoppingCart className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-medium">Total Sales</p>
            <h3 className="text-lg font-bold text-emerald-600">
              {fmtMoney(totals.amount)}
            </h3>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex items-center space-x-3">
          <div className="p-2.5 bg-blue-100 text-blue-600 rounded-lg">
            <ShoppingCart className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-medium">
              Total Transactions
            </p>
            <h3 className="text-lg font-bold text-blue-600">
              {totals.count}
            </h3>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-4 border border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <label className="text-[11px] text-slate-500 font-medium">
              Date
            </label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {dateFilter && (
              <button
                type="button"
                onClick={() => setDateFilter("")}
                className="text-[11px] text-blue-600 hover:underline"
              >
                Clear
              </button>
            )}
          </div>
          <p className="text-[11px] text-slate-400">
            {filtered.length} records
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[11px]">
                <th className="pb-2 pr-2">
                  <span className="inline-block w-full text-left bg-[#0b1e59] text-white font-semibold rounded-md px-3 py-1.5">
                    Product
                  </span>
                </th>
                <th className="pb-2 pr-2">
                  <span className="inline-block w-full text-left bg-[#0b1e59] text-white font-semibold rounded-md px-3 py-1.5">
                    MRP (₹)
                  </span>
                </th>
                <th className="pb-2 pr-2">
                  <span className="inline-block w-full text-left bg-[#0b1e59] text-white font-semibold rounded-md px-3 py-1.5">
                    Qty
                  </span>
                </th>
                <th className="pb-2 pr-2">
                  <span className="inline-block w-full text-left bg-[#0b1e59] text-white font-semibold rounded-md px-3 py-1.5">
                    Sale (₹)
                  </span>
                </th>
                <th className="pb-2 pr-2">
                  <span className="inline-block w-full text-left bg-[#0b1e59] text-white font-semibold rounded-md px-3 py-1.5">
                    Date
                  </span>
                </th>
                <th className="pb-2">
                  <span className="inline-block w-full text-left bg-[#0b1e59] text-white font-semibold rounded-md px-3 py-1.5">
                    Time
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-slate-100">
              {loading && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">
                    Loading sales...
                  </td>
                </tr>
              )}
              {error && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-red-500">
                    {error}
                  </td>
                </tr>
              )}
              {!loading && !error && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">
                    No sales found.
                  </td>
                </tr>
              )}
              {pageRows.map((r) => (
                <tr key={r.id}>
                  <td className="py-2 pr-2 font-medium text-slate-800">
                    {r.product}
                  </td>
                  <td className="py-2 pr-2 text-slate-600">{fmt(r.mrp)}</td>
                  <td className="py-2 pr-2 text-slate-600">{r.quantity}</td>
                  <td className="py-2 pr-2 font-semibold text-slate-800">
                    {fmt(r.total)}
                  </td>
                  <td className="py-2 pr-2 text-slate-500">{r.date}</td>
                  <td className="py-2 text-slate-400">
                    {formatTime(r.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-3 text-xs text-slate-500">
          <p>
            Showing {(page - 1) * perPage + 1} to{" "}
            {Math.min(page * perPage, filtered.length)} of {filtered.length}{" "}
            entries
          </p>
          <div className="flex items-center space-x-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-2 py-1 border border-slate-200 rounded text-slate-400 hover:bg-slate-50 disabled:opacity-40"
            >
              &lt;
            </button>
            <button
              type="button"
              className="px-2.5 py-1 bg-blue-600 text-white rounded font-medium"
            >
              {page}
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-2 py-1 border border-slate-200 rounded text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              &gt;
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
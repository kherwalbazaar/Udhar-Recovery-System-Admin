"use client";

import { useEffect, useState } from "react";
import { onValue, ref } from "firebase/database";
import {
  ShoppingCart,
  PlusCircle,
  BarChart2,
  ArrowRight,
} from "lucide-react";
import { db } from "@/lib/firebase";

type RawMap = Record<string, Record<string, unknown>> | null;

type SaleRow = {
  id: string;
  product: string;
  quantity: number;
  total: number;
  date: string;
  createdAt: number;
};

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

export default function SalesSection({ limit = 6 }: { limit?: number }) {
  const [rows, setRows] = useState<SaleRow[]>([]);
  const [todayTotal, setTodayTotal] = useState(0);
  const [count, setCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onValue(
      ref(db, "sales"),
      (snap) => {
        const raw = (snap.val() as RawMap) ?? null;
        const today = toDateKey(new Date());
        const all: SaleRow[] = raw
          ? Object.entries(raw).map(([id, s]) => ({
              id,
              product: String(s.productName ?? ""),
              quantity: Number(s.quantity ?? 1),
              total: Number(s.sale ?? 0),
              date: String(s.date ?? ""),
              createdAt: Number(s.createdAt ?? 0),
            }))
          : [];
        setTodayTotal(
          all.filter((r) => r.date === today).reduce((sum, r) => sum + r.total, 0)
        );
        setCount(all.length);
        setRows(
          all.filter((r) => r.product).sort((a, b) => b.createdAt - a.createdAt)
        );
      },
      (err) => setError(err.message)
    );
    return () => unsub();
  }, []);

  return (
    <div className="bg-white rounded-xl p-4 border border-slate-200">
      <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-3">
        <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-800">
          <ShoppingCart className="w-4 h-4 text-emerald-600" />
          <span>Sale Section</span>
        </div>
        <div className="flex items-center space-x-2">
          <a
            href="/sales/all"
            className="text-[11px] text-emerald-600 font-medium hover:underline flex items-center space-x-0.5"
          >
            <span>View All</span>
            <ArrowRight className="w-3 h-3" />
          </a>
          <a
            href="/sales"
            className="text-[11px] text-emerald-600 font-medium hover:underline"
          >
            Add Sale
          </a>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-2 text-center">
          <p className="text-[9px] text-emerald-600 font-medium">Today&apos;s Sales</p>
          <p className="text-sm font-bold text-emerald-600">₹{fmt(todayTotal)}</p>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-2 text-center">
          <p className="text-[9px] text-blue-600 font-medium">Total Bills</p>
          <p className="text-sm font-bold text-blue-600">{count}</p>
        </div>
      </div>

      {error && (
        <p className="text-[11px] text-red-500 text-center py-2">{error}</p>
      )}

      <div className="space-y-2 text-xs">
        {!error && rows.length === 0 && (
          <p className="text-center text-slate-400 text-[11px] py-3">
            No sales yet. Make your first sale.
          </p>
        )}
        {rows.slice(0, limit).map((r) => (
          <div
            key={r.id}
            className="flex items-center justify-between pb-2 border-b border-slate-50 last:border-b-0"
          >
            <div className="min-w-0">
              <p className="font-semibold text-slate-700 truncate">{r.product}</p>
              <p className="text-[10px] text-slate-400">
                {r.date} &bull; {formatTime(r.createdAt)}
                {r.quantity > 1 ? ` &bull; Qty ${r.quantity}` : ""}
              </p>
            </div>
            <p className="font-bold text-slate-800 shrink-0 pl-2">
              ₹{fmt(r.total)}
            </p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-100">
        <a
          href="/sales-report"
          className="text-[11px] text-blue-600 font-medium hover:underline flex items-center space-x-1"
        >
          <BarChart2 className="w-3 h-3" />
          <span>Sales Report</span>
        </a>
        <a
          href="/sales"
          className="text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg px-2.5 py-1.5 flex items-center space-x-1"
        >
          <PlusCircle className="w-3 h-3" />
          <span>New Sale</span>
        </a>
      </div>
    </div>
  );
}
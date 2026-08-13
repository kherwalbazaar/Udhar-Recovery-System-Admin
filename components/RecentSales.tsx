"use client";

import { useEffect, useState } from "react";
import { onValue, ref } from "firebase/database";
import { db } from "@/lib/firebase";
import {
  buildRecentSales,
  type RecentSaleRow,
  type RawMap,
} from "@/lib/sales";

const AVATAR_COLORS = [
  "bg-blue-500",
  "bg-orange-400",
  "bg-emerald-500",
  "bg-teal-500",
  "bg-purple-500",
  "bg-rose-500",
  "bg-indigo-500",
];

function colorFor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "";
  const second = parts.length > 1 ? parts[1]?.[0] ?? "" : "";
  return `${first}${second}`.toUpperCase();
}

function formatRupee(amount: number) {
  return `₹ ${amount.toLocaleString("en-IN")}`;
}

export default function RecentSales() {
  const [rows, setRows] = useState<RecentSaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const salesRef = ref(db, "sales");
    const customersRef = ref(db, "customers");

    let salesData: RawMap = null;
    let customersData: RawMap = null;

    const update = () => {
      if (salesData !== null && customersData !== null) {
        setRows(buildRecentSales(salesData, customersData, 5));
        setLoading(false);
      }
    };

    const onError = (err: Error) => {
      setError(err.message);
      setLoading(false);
    };

    const unsubSales = onValue(salesRef, (snap) => {
      salesData = (snap.val() as RawMap) ?? null;
      update();
    }, onError);

    const unsubCustomers = onValue(customersRef, (snap) => {
      customersData = (snap.val() as RawMap) ?? null;
      update();
    }, onError);

    return () => {
      unsubSales();
      unsubCustomers();
    };
  }, []);

  return (
    <div className="col-span-7 bg-white rounded-xl p-4 border border-slate-200">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-slate-800">Recent Sales</h3>
        <a href="#" className="text-xs text-blue-600 font-medium hover:underline">
          View All
        </a>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-[11px] text-slate-400 border-b border-slate-100">
              <th className="pb-2 font-normal">Bill No.</th>
              <th className="pb-2 font-normal">Customer</th>
              <th className="pb-2 font-normal">Amount</th>
              <th className="pb-2 font-normal">Type</th>
              <th className="pb-2 font-normal">Status</th>
              <th className="pb-2 font-normal text-right">Time</th>
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
                  Failed to load: {error}
                </td>
              </tr>
            )}
            {!loading && !error && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-slate-400">
                  No sales found.
                </td>
              </tr>
            )}
            {!loading &&
              !error &&
              rows.map((row) => (
                <tr key={row.billNo}>
                  <td className="py-2.5 font-medium text-slate-700">
                    {row.billNo}
                  </td>
                  <td className="py-2.5">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`w-6 h-6 rounded-full ${colorFor(
                          row.customer
                        )} text-white text-[10px] flex items-center justify-center font-semibold`}
                      >
                        {initialsFor(row.customer)}
                      </span>
                      <span className="font-medium text-slate-700">
                        {row.customer}
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 font-semibold text-slate-800">
                    {formatRupee(row.amount)}
                  </td>
                  <td className="py-2.5 text-slate-500">{row.type}</td>
                  <td className="py-2.5">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                        row.status === "Paid"
                          ? "bg-emerald-100 text-emerald-600"
                          : "bg-amber-100 text-amber-600"
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="py-2.5 text-right text-slate-400">
                    {row.time}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
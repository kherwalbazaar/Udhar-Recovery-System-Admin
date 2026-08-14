"use client";

import { useEffect, useMemo, useState } from "react";
import { onValue, ref } from "firebase/database";
import {
  Search,
  Calendar,
  Filter,
  Download,
  Printer,
  Receipt,
  TrendingUp,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import { db } from "@/lib/firebase";
import {
  buildProductSalesReport,
  type ProductSaleRow,
  type RawMap,
} from "@/lib/sales";

const fmt = (n: number) =>
  `₹ ${n.toLocaleString("en-IN")}`;

export default function SalesReportPage() {
  const [rows, setRows] = useState<ProductSaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 20;

  useEffect(() => {
    const salesRef = ref(db, "sales");
    const productsRef = ref(db, "products");

    let salesData: RawMap = null;
    let productsData: RawMap = null;
    let salesReady = false;
    let productsReady = false;

    const update = () => {
      if (salesReady && productsReady) {
        setRows(buildProductSalesReport(salesData, productsData));
        setLoading(false);
      }
    };

    const onError = (err: Error) => {
      setError(err.message);
      setLoading(false);
    };

    const unsubSales = onValue(salesRef, (snap) => {
      salesData = (snap.val() as RawMap) ?? null;
      salesReady = true;
      update();
    }, onError);

    const unsubProducts = onValue(productsRef, (snap) => {
      productsData = (snap.val() as RawMap) ?? null;
      productsReady = true;
      update();
    }, onError);

    return () => {
      unsubSales();
      unsubProducts();
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !r.product.toLowerCase().includes(q)) return false;
      if (dateFilter && r.date !== dateFilter) return false;
      return true;
    });
  }, [rows, search, dateFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const pageRows = filtered.slice((page - 1) * perPage, page * perPage);

  useEffect(() => {
    setPage(1);
  }, [search, dateFilter]);

  const totals = useMemo(() => {
    let mrp = 0;
    let sale = 0;
    let profit = 0;
    for (const r of filtered) {
      mrp += r.mrp;
      sale += r.sale;
      profit += r.profit;
    }
    return { mrp, sale, profit };
  }, [filtered]);

  return (
    <AppShell title="Sales Report" active="Sales">
      {/* PAGE TITLE */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">Sales Report</h1>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-600 flex items-center space-x-1 hover:bg-slate-50 bg-white"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>
          <button
            type="button"
            className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-600 flex items-center space-x-1 hover:bg-slate-50 bg-white"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* SUMMARY METRICS */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex items-center space-x-3">
          <div className="p-2.5 bg-blue-100 text-blue-600 rounded-lg">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-medium">Total Sale</p>
            <h3 className="text-lg font-bold text-slate-800">{fmt(totals.sale)}</h3>
            <p className="text-[10px] text-slate-400">
              {filtered.length} Transactions
            </p>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex items-center space-x-3">
          <div className="p-2.5 bg-slate-100 text-slate-600 rounded-lg">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-medium">Total MRP</p>
            <h3 className="text-lg font-bold text-slate-800">{fmt(totals.mrp)}</h3>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex items-center space-x-3">
          <div className="p-2.5 bg-emerald-100 text-emerald-600 rounded-lg">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-medium">Total Profit</p>
            <h3 className="text-lg font-bold text-emerald-600">{fmt(totals.profit)}</h3>
          </div>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-xl p-4 border border-slate-200">
        <div className="flex items-center space-x-2 mb-4">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-slate-400">
              <Search className="w-3.5 h-3.5" />
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by product name..."
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center space-x-1.5 border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50 text-xs text-slate-600">
            <Calendar className="w-3.5 h-3.5" />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="bg-transparent focus:outline-none"
            />
          </div>

          <button
            type="button"
            className="flex items-center space-x-1 text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-slate-50 text-slate-600 hover:bg-slate-100"
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Filter</span>
          </button>
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
              <tr className="text-[11px] text-slate-400 border-b border-slate-100">
                <th className="pb-2 font-normal">Product Name</th>
                <th className="pb-2 font-normal text-center">MRP (₹)</th>
                <th className="pb-2 font-normal text-center">Qty</th>
                <th className="pb-2 font-normal text-center">Sale (₹)</th>
                <th className="pb-2 font-normal text-center">Profit (₹)</th>
                <th className="pb-2 font-normal text-center">Date</th>
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
              {!loading && !error && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">
                    No sales found.
                  </td>
                </tr>
              )}
              {!loading &&
                !error &&
                pageRows.map((row, index) => (
                  <tr key={`${row.product}-${row.date}-${index}`}>
                    <td className="py-2.5 px-2 font-medium text-slate-700 truncate">
                      {row.product}
                    </td>
                    <td className="py-2.5 px-2 text-center text-slate-500">
                      {fmt(row.mrp)}
                    </td>
                    <td className="py-2.5 px-2 text-center text-slate-500">
                      {row.quantity}
                    </td>
                    <td className="py-2.5 px-2 text-center font-semibold text-slate-800">
                      {fmt(row.sale)}
                    </td>
                    <td
                      className={`py-2.5 px-2 text-center font-semibold ${
                        row.profit >= 0 ? "text-emerald-600" : "text-red-500"
                      }`}
                    >
                      {fmt(row.profit)}
                    </td>
                    <td className="py-2.5 px-2 text-center text-slate-400">
                      {row.date}{" "}
                      <span className="text-slate-300">{row.time}</span>
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
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPage(p)}
                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                  p === page
                    ? "bg-blue-600 text-white"
                    : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {p}
              </button>
            ))}
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
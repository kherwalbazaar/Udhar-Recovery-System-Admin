"use client";

import { useEffect, useMemo, useState } from "react";
import { ref, update, remove } from "firebase/database";
import { onValueWithCache, CACHE_KEYS } from "@/lib/cache";
import {
  Search,
  Calendar,
  Filter,
  Download,
  Printer,
  Receipt,
  TrendingUp,
  Pencil,
  Trash2,
  X,
  Check,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import { db } from "@/lib/firebase";
import {
  buildProductSalesReport,
  type ProductSaleRow,
  type RawMap,
} from "@/lib/sales";

const fmt = (n: number) => `₹ ${n.toLocaleString("en-IN")}`;

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatDate(key: string): string {
  const [y, m, d] = key.split("-");
  const idx = parseInt(m, 10) - 1;
  return `${parseInt(d, 10)}-${MONTHS[idx]}-${y}`;
}

export default function SalesReportPage() {
  const [rows, setRows] = useState<ProductSaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<ProductSaleRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editMrp, setEditMrp] = useState("");
  const [editSale, setEditSale] = useState("");
  const [editQty, setEditQty] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const perPage = 20;

  useEffect(() => {
    setPage(1);
  }, [search, dateFilter]);

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

    const unsubSales = onValueWithCache(salesRef, CACHE_KEYS.SALES, (snap) => {
      salesData = (snap.val() as RawMap) ?? null;
      salesReady = true;
      update();
    }, onError);

    const unsubProducts = onValueWithCache(productsRef, CACHE_KEYS.PRODUCTS, (snap) => {
      productsData = (snap.val() as RawMap) ?? null;
      productsReady = true;
      update();
    }, onError);

    return () => {
      unsubSales();
      unsubProducts();
    };
  }, []);

  const todayKey = useMemo(() => toDateKey(new Date()), []);

  const todayRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(
      (r) => r.date === todayKey && (!q || r.product.toLowerCase().includes(q))
    );
  }, [rows, search, todayKey]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !r.product.toLowerCase().includes(q)) return false;
      if (dateFilter && r.date !== dateFilter) return false;
      return true;
    });
  }, [rows, search, dateFilter]);

  const summaryGroups = useMemo(() => {
    const map = new Map<
      string,
      { mrp: number; sale: number; profit: number }
    >();
    for (const r of filtered) {
      const g = map.get(r.date) ?? { mrp: 0, sale: 0, profit: 0 };
      g.mrp += r.mrp;
      g.sale += r.sale;
      g.profit += r.profit;
      map.set(r.date, g);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, t]) => ({ date, ...t }));
  }, [filtered]);

  const totalPages = Math.max(1, Math.ceil(summaryGroups.length / perPage));
  const pageSummary = summaryGroups.slice(
    (page - 1) * perPage,
    page * perPage
  );

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

  const openEdit = (row: ProductSaleRow) => {
    setEditing(row);
    setEditName(row.product);
    setEditMrp(String(row.mrp));
    setEditSale(String(row.salePrice));
    setEditQty(String(row.quantity));
    setActionError(null);
  };

  const saveEdit = async () => {
    if (!editing) return;
    const name = editName.trim();
    const mrp = Number(editMrp);
    const salePrice = Number(editSale);
    const quantity = Number(editQty);
    if (!name || !(mrp > 0) || !(salePrice > 0) || !(quantity > 0)) {
      setActionError("Product name, MRP, Sale Price and Qty must be valid.");
      return;
    }
    setSavingEdit(true);
    setActionError(null);
    try {
      await update(ref(db, `sales/${editing.id}`), {
        productName: name,
        mrp,
        salePrice,
        quantity,
        sale: salePrice * quantity,
      });
      setEditing(null);
    } catch (e) {
      setActionError(
        e instanceof Error ? e.message : "Failed to update sale entry."
      );
    } finally {
      setSavingEdit(false);
    }
  };

  const deleteSale = async (row: ProductSaleRow) => {
    if (!window.confirm(`Delete sale entry for "${row.product}"?`)) return;
    try {
      await remove(ref(db, `sales/${row.id}`));
    } catch (e) {
      setActionError(
        e instanceof Error ? e.message : "Failed to delete sale entry."
      );
    }
  };

  return (
    <AppShell title="Sales Report" active="Sale Report">
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
        <div className="bg-gradient-to-br from-blue-500 to-blue-700 border-b-4 border-blue-900 rounded-xl p-3.5 flex items-center space-x-3 text-white shadow-md hover:shadow-lg transition-all duration-100 active:translate-y-[2px] active:border-b-2">
          <div className="p-2.5 bg-white/20 text-white rounded-lg">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-white/80 font-medium">Total Sale</p>
            <h3 className="text-lg font-bold text-white">{fmt(totals.sale)}</h3>
            <p className="text-[10px] text-white/70">
              {filtered.length} Transactions
            </p>
          </div>
        </div>
        <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 border-b-4 border-indigo-900 rounded-xl p-3.5 flex items-center space-x-3 text-white shadow-md hover:shadow-lg transition-all duration-100 active:translate-y-[2px] active:border-b-2">
          <div className="p-2.5 bg-white/20 text-white rounded-lg">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-white/80 font-medium">Total MRP</p>
            <h3 className="text-lg font-bold text-white">{fmt(totals.mrp)}</h3>
          </div>
        </div>
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 border-b-4 border-emerald-900 rounded-xl p-3.5 flex items-center space-x-3 text-white shadow-md hover:shadow-lg transition-all duration-100 active:translate-y-[2px] active:border-b-2">
          <div className="p-2.5 bg-white/20 text-white rounded-lg">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-white/80 font-medium">Total Profit</p>
            <h3 className="text-lg font-bold text-white">{fmt(totals.profit)}</h3>
          </div>
        </div>
      </div>

      {/* TODAY'S SALE REPORT */}
      <div className="bg-white rounded-xl p-4 border border-slate-200">
        <h3 className="text-xs font-bold text-slate-800 mb-3">
          Today&apos;s Sale Report
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-left border-collapse">
            <colgroup>
              <col className="w-[26%]" />
              <col className="w-[12%]" />
              <col className="w-[10%]" />
              <col className="w-[12%]" />
              <col className="w-[12%]" />
              <col className="w-[16%]" />
              <col className="w-[12%]" />
            </colgroup>
            <thead>
              <tr className="text-[11px] text-slate-400 border-b border-slate-100">
                <th className="pb-2 font-normal">Product Name</th>
                <th className="pb-2 font-normal text-center">MRP (₹)</th>
                <th className="pb-2 font-normal text-center">Qty</th>
                <th className="pb-2 font-normal text-center">Sale (₹)</th>
                <th className="pb-2 font-normal text-center">Profit (₹)</th>
                <th className="pb-2 font-normal text-center">Date</th>
                <th className="pb-2 font-normal text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-slate-100">
              {loading && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-400">
                    Loading sales...
                  </td>
                </tr>
              )}
              {error && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-red-500">
                    Failed to load: {error}
                  </td>
                </tr>
              )}
              {!loading && !error && todayRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-400">
                    No sales today.
                  </td>
                </tr>
              )}
              {!loading &&
                !error &&
                todayRows.map((row) => (
                  <tr key={row.id}>
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
                    <td className="py-2.5 px-2 text-center">
                      <div className="flex items-center justify-center space-x-1.5">
                        <button
                          type="button"
                          onClick={() => openEdit(row)}
                          aria-label={`Edit ${row.product}`}
                          className="p-1.5 rounded-md text-blue-600 hover:bg-blue-50"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteSale(row)}
                          aria-label={`Delete ${row.product}`}
                          className="p-1.5 rounded-md text-red-500 hover:bg-red-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ALL SALES BY DATE */}
      <div className="bg-white rounded-xl p-4 border border-slate-200">
        <h3 className="text-xs font-bold text-slate-800 mb-3">
          All Sales by Date
        </h3>
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
              <col className="w-[30%]" />
              <col className="w-[23%]" />
              <col className="w-[23%]" />
              <col className="w-[24%]" />
            </colgroup>
            <thead>
              <tr className="text-[11px] text-slate-400 border-b border-slate-100">
                <th className="pb-2 font-normal">Date</th>
                <th className="pb-2 font-normal text-center">MRP (₹)</th>
                <th className="pb-2 font-normal text-center">Sale (₹)</th>
                <th className="pb-2 font-normal text-center">Profit (₹)</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-slate-100">
              {loading && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate-400">
                    Loading sales...
                  </td>
                </tr>
              )}
              {error && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-red-500">
                    Failed to load: {error}
                  </td>
                </tr>
              )}
              {!loading && !error && summaryGroups.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate-400">
                    No sales found.
                  </td>
                </tr>
              )}
              {!loading &&
                !error &&
                pageSummary.map((g) => (
                  <tr key={g.date}>
                    <td className="py-2.5 px-2 font-semibold text-slate-700">
                      {formatDate(g.date)}
                    </td>
                    <td className="py-2.5 px-2 text-center text-slate-500">
                      {fmt(g.mrp)}
                    </td>
                    <td className="py-2.5 px-2 text-center font-semibold text-slate-800">
                      {fmt(g.sale)}
                    </td>
                    <td
                      className={`py-2.5 px-2 text-center font-semibold ${
                        g.profit >= 0 ? "text-emerald-600" : "text-red-500"
                      }`}
                    >
                      {fmt(g.profit)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-3 text-xs text-slate-500">
          <p>
            Showing {(page - 1) * perPage + 1} to{" "}
            {Math.min(page * perPage, summaryGroups.length)} of{" "}
            {summaryGroups.length} date groups
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

      {/* EDIT SALE MODAL */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800">Edit Sale Entry</h3>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="p-1 rounded-md text-slate-400 hover:bg-slate-100"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Product Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    MRP (₹)
                  </label>
                  <input
                    type="number"
                    value={editMrp}
                    onChange={(e) => setEditMrp(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Sale (₹)
                  </label>
                  <input
                    type="number"
                    value={editSale}
                    onChange={(e) => setEditSale(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Qty
                  </label>
                  <input
                    type="number"
                    value={editQty}
                    onChange={(e) => setEditQty(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {actionError && (
                <p className="text-[11px] text-red-500 font-medium">
                  {actionError}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end space-x-2 px-4 py-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="px-3.5 py-2 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEdit}
                disabled={savingEdit}
                className="px-3.5 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center space-x-1 disabled:opacity-50"
              >
                {savingEdit ? (
                  <span>Updating...</span>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Save</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
"use client";

import { useEffect, useState } from "react";
import { onValue, ref, remove, update } from "firebase/database";
import { Edit2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { triggerActionRefresh } from "@/lib/cache";
import { useToast } from "@/components/ToastProvider";

interface SaleRecord {
  id: string;
  productName: string;
  mrp: number;
  sale: number;
  salePrice?: number;
  quantity?: number;
  date: string;
  createdAt: number;
}

function getCostPrice(productName: string, mrp: number): number {
  const name = (productName || "").toLowerCase();
  if (name.includes("galaxy") || name.includes("essa")) {
    return mrp * 0.6;
  }
  if (name.replace(/[^a-z0-9]/g, "").includes("saree100")) {
    return 75;
  }
  return isNaN(mrp) ? 0 : mrp / 2;
}

function isToday(ts: number): boolean {
  if (ts == null) return false;
  const d = new Date(ts);
  const n = new Date();
  return (
    d.getDate() === n.getDate() &&
    d.getMonth() === n.getMonth() &&
    d.getFullYear() === n.getFullYear()
  );
}

function fmtDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getDate()} ${d.toLocaleString("default", { month: "short" })} ${d.getFullYear()}`;
}

export default function DesktopEditSalePanel() {
  const { showToast } = useToast();
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [editingSale, setEditingSale] = useState<SaleRecord | null>(null);
  const [editSaleForm, setEditSaleForm] = useState({
    productName: "",
    mrp: "",
    sale: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const salesRef = ref(db, "sales");
    const unsub = onValue(salesRef, (snap) => {
      const data: Record<string, Omit<SaleRecord, "id">> | null = snap.val();
      setSales(
        data
          ? Object.entries(data)
              .filter(([id]) => id !== "_persist")
              .map(([id, v]) => ({ id, ...v }))
              .sort((a, b) => b.createdAt - a.createdAt)
          : []
      );
    });
    return () => unsub();
  }, []);

  const updateSale = async () => {
    if (
      !editingSale ||
      !editSaleForm.productName.trim() ||
      !editSaleForm.mrp ||
      !editSaleForm.sale
    ) {
      return;
    }
    setSaving(true);
    try {
      await update(ref(db, `sales/${editingSale.id}`), {
        productName: editSaleForm.productName.trim(),
        mrp: Number(editSaleForm.mrp),
        sale: Number(editSaleForm.sale),
      });
      triggerActionRefresh();
      showToast("success", "Sale updated.");
      setEditingSale(null);
      setEditSaleForm({ productName: "", mrp: "", sale: "" });
    } catch (e) {
      showToast(
        "error",
        e instanceof Error ? e.message : "Failed to update sale."
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteSale = async () => {
    if (!editingSale) return;
    setSaving(true);
    try {
      await remove(ref(db, `sales/${editingSale.id}`));
      triggerActionRefresh();
      showToast("success", "Sale deleted.");
      setEditingSale(null);
      setEditSaleForm({ productName: "", mrp: "", sale: "" });
    } catch (e) {
      showToast(
        "error",
        e instanceof Error ? e.message : "Failed to delete sale."
      );
    } finally {
      setSaving(false);
    }
  };

  const allSaleMRP = sales.reduce((s, r) => s + (r.mrp || 0), 0);
  const allSaleCollected = sales.reduce((s, r) => s + (r.sale || 0), 0);
  const allProfit = sales.reduce(
    (s, r) =>
      s +
      ((r.sale || 0) -
        getCostPrice(r.productName, r.mrp || 0) * (r.quantity ?? 1)),
    0
  );

  const groups: Record<string, SaleRecord[]> = {};
  sales.forEach((s) => {
    const k = fmtDate(s.createdAt);
    if (!groups[k]) groups[k] = [];
    groups[k].push(s);
  });

  return (
    <div className="space-y-3">
      {/* Top 3 Summary Totals */}
      <div className="rounded-xl bg-gradient-to-br from-slate-900 to-blue-900 p-4 text-white shadow-lg">
        <div className="grid grid-cols-3 items-center gap-3 text-center">
          <div className="border-r border-blue-700/60 px-2">
            <p className="mb-1 text-xs font-medium uppercase tracking-wider text-gray-300">
              Total Sale
            </p>
            <p className="text-2xl font-extrabold text-white">
              ₹ {allSaleMRP.toLocaleString()}
            </p>
          </div>
          <div className="border-r border-blue-700/60 px-2">
            <p className="mb-1 text-xs font-medium uppercase tracking-wider text-gray-300">
              Total Collection
            </p>
            <p className="text-2xl font-extrabold text-white">
              ₹ {allSaleCollected.toLocaleString()}
            </p>
          </div>
          <div className="px-2">
            <p className="mb-1 text-xs font-medium uppercase tracking-wider text-gray-300">
              Total Profit
            </p>
            <p
              className={`text-2xl font-extrabold ${
                allProfit >= 0 ? "text-emerald-400" : "text-red-400"
              }`}
            >
              ₹ {allProfit.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Inline Edit Panel */}
      {editingSale && (
        <div className="space-y-3 rounded-xl border border-blue-300 bg-white p-4 shadow">
          <p className="text-sm font-bold text-blue-700">
            Editing: {editingSale.productName}
          </p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <input
              type="text"
              placeholder="Product Name"
              value={editSaleForm.productName}
              onChange={(e) =>
                setEditSaleForm({ ...editSaleForm, productName: e.target.value })
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="number"
              placeholder="MRP"
              value={editSaleForm.mrp}
              onChange={(e) =>
                setEditSaleForm({ ...editSaleForm, mrp: e.target.value })
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="number"
              placeholder="Sale"
              value={editSaleForm.sale}
              onChange={(e) =>
                setEditSaleForm({ ...editSaleForm, sale: e.target.value })
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void updateSale()}
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Update
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void deleteSale()}
              className="rounded-lg bg-red-600 px-5 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
            >
              Delete
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                setEditingSale(null);
                setEditSaleForm({ productName: "", mrp: "", sale: "" });
              }}
              className="rounded-lg bg-gray-200 px-5 py-2 text-sm font-bold text-gray-700 hover:bg-gray-300 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Date-Grouped Sale List */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {Object.keys(groups).length === 0 ? (
          <p className="py-8 text-center text-xs text-gray-400">
            No sales recorded yet
          </p>
        ) : (
          <>
            <div className="grid grid-cols-[1.2fr_0.6fr_1fr_1fr] gap-2 bg-slate-800 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-white">
              <span>Date</span>
              <span className="text-center">Qty</span>
              <span className="text-right">Sale</span>
              <span className="text-right">Profit</span>
            </div>
            <div className="divide-y divide-gray-200">
              {Object.entries(groups).map(([dateStr, items]) => {
                const qty = items.length;
                const totalSale = items.reduce((s, r) => s + r.sale, 0);
                const totalProfit = items.reduce(
                  (s, r) =>
                    s +
                    r.sale -
                    getCostPrice(r.productName, r.mrp) * (r.quantity ?? 1),
                  0
                );
                const isTodayGroup = isToday(items[0].createdAt);

                return (
                  <div key={dateStr}>
                    <div className="grid grid-cols-[1.2fr_0.6fr_1fr_1fr] items-center gap-2 bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-700">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate">{dateStr}</span>
                        {isTodayGroup && (
                          <span className="shrink-0 rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                            Today
                          </span>
                        )}
                      </span>
                      <span className="text-center">{qty}</span>
                      <span className="text-right">
                        ₹{totalSale.toLocaleString()}
                      </span>
                      <span
                        className={`text-right ${
                          totalProfit >= 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        ₹{totalProfit.toLocaleString()}
                      </span>
                    </div>

                    {isTodayGroup &&
                      items.map((s) => {
                        const canEdit = isToday(s.createdAt);
                        return (
                          <div
                            key={s.id}
                            className="flex min-w-0 items-center justify-between gap-3 border-t border-green-100 bg-white px-5 py-2.5 hover:bg-slate-50"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-bold text-gray-800">
                                {s.productName}
                              </p>
                              <div className="mt-0.5 flex gap-3 text-[11px] text-gray-500">
                                <span>
                                  MRP:{" "}
                                  <span className="font-semibold text-gray-700">
                                    ₹{s.mrp}
                                  </span>
                                </span>
                                <span>
                                  Sale:{" "}
                                  <span className="font-semibold text-green-600">
                                    ₹{s.sale}
                                  </span>
                                </span>
                                {(s.quantity ?? 1) > 1 && (
                                  <span>
                                    Qty:{" "}
                                    <span className="font-semibold text-gray-700">
                                      {s.quantity}
                                    </span>
                                  </span>
                                )}
                              </div>
                            </div>
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingSale(s);
                                  setEditSaleForm({
                                    productName: s.productName,
                                    mrp: String(s.mrp),
                                    sale: String(s.sale),
                                  });
                                }}
                                title={`Edit ${s.productName}`}
                                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                                <span>Edit</span>
                              </button>
                            )}
                          </div>
                        );
                      })}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

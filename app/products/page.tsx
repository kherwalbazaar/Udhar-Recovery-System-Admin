"use client";

import { useEffect, useState } from "react";
import {
  Package,
  ScanLine,
  Clock,
  ArrowRight,
  Check,
  AlertCircle,
} from "lucide-react";
import SalesSection from "@/components/SalesSection";
import AppShell from "@/components/AppShell";
import {
  saveProduct,
  fetchRecentProducts,
  type ProductRecord,
  type RecentProduct,
} from "@/lib/products";

const fmt = (n: number) =>
  n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const inputClass =
  "w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500";

const labelClass = "block text-[11px] font-medium text-slate-700 mb-1";

function formatDate(ts: number) {
  const d = new Date(ts);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const dressSvg = (
  <svg
    viewBox="0 0 200 200"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="w-full h-full"
  >
    <path
      d="M45 70 L50 50 L55 70 L75 75 L55 80 L50 100 L45 80 L25 75 Z"
      fill="#38bdf8"
    />
    <path
      d="M155 90 L160 75 L165 90 L180 95 L165 100 L160 115 L155 100 L140 95 Z"
      fill="#38bdf8"
    />
    <path
      d="M70 30 C70 30, 85 55, 100 55 C115 55, 130 30, 130 30 L145 65 L125 90 L75 90 L55 65 Z"
      fill="#e0f2fe"
      stroke="#1e1b4b"
      strokeWidth="10"
      strokeLinejoin="round"
    />
    <path
      d="M75 90 L125 90 L150 165 C150 165, 125 180, 100 175 C75 180, 50 165, 50 165 Z"
      fill="#3b82f6"
      stroke="#1e1b4b"
      strokeWidth="10"
      strokeLinejoin="round"
    />
    <path
      d="M85 130 C85 130, 80 160, 95 170"
      stroke="#e0f2fe"
      strokeWidth="8"
      strokeLinecap="round"
    />
    <path
      d="M115 140 C115 140, 120 160, 122 170"
      stroke="#e0f2fe"
      strokeWidth="8"
      strokeLinecap="round"
    />
  </svg>
);

export default function AddProductPage() {
  const [name, setName] = useState("");
  const [barcode, setBarcode] = useState("");
  const [mrp, setMrp] = useState(0);
  const [cost, setCost] = useState(0);
  const [costDiscount, setCostDiscount] = useState("");
  const [sale, setSale] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentProduct[]>([]);

  useEffect(() => {
    fetchRecentProducts()
      .then(setRecent)
      .catch(() => {});
  }, []);

  const generateBarcode = () => {
    const timestamp = Date.now().toString().slice(-6);
    const rand = Math.floor(1000 + Math.random() * 9000);
    setBarcode(`KB${timestamp}${rand}`);
  };

  const resetForm = () => {
    setName("");
    setBarcode("");
    setMrp(0);
    setCost(0);
    setCostDiscount("");
    setSale(0);
    setError(null);
    setSaved(false);
  };

  const doSave = async (clearAfter: boolean) => {
    if (!name.trim()) {
      setError("Product Name is required.");
      return;
    }
    if (mrp <= 0) {
      setError("MRP must be greater than 0.");
      return;
    }
    if (cost <= 0) {
      setError("Cost Price is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const generatedBarcode =
        barcode.trim() ||
        `KB${Date.now().toString().slice(-6)}${Math.floor(1000 + Math.random() * 9000)}`;
      const record: ProductRecord = {
        name: name.trim(),
        barcode: generatedBarcode,
        mrp: Number(mrp),
        cost: Number(cost) || undefined,
        sale: Number(sale) > 0 ? Number(sale) : undefined,
        active: true,
        trackStock: true,
        createdAt: Date.now(),
      };
      await saveProduct(record);
      setSaved(true);
      setRecent((prev) => [
        {
          name: record.name,
          sku: record.barcode ?? "",
          mrp: record.mrp,
          createdAt: record.createdAt,
        },
        ...prev,
      ]);
      if (clearAfter) {
        resetForm();
      }
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save product.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell title="Add Product" active="Products">
      {/* Top Action Navigation */}
      <div className="flex justify-end">
        <a
          href="/products/all"
          className="text-xs text-slate-600 font-medium hover:text-slate-900 flex items-center space-x-1 border border-slate-200 rounded-lg px-3 py-1.5 bg-white shadow-sm"
        >
          <span>View All Products</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </a>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* LEFT: PRODUCT FORM */}
        <div className="col-span-8 space-y-4">
          <div className="bg-white rounded-xl p-4 border border-slate-200 space-y-4">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-2 text-blue-600 font-bold text-xs">
              <Package className="w-4 h-4" />
              <span>Product Information</span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>
                  Product Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter product name"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Barcode / SKU <span className="text-slate-400 font-normal">(Optional)</span></label>
                <div className="flex space-x-1">
                  <input
                    type="text"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    placeholder="Scan or enter barcode"
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-l-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    className="bg-blue-600 hover:bg-blue-700 text-white px-2.5 rounded-r-lg text-xs flex items-center space-x-1 shrink-0"
                  >
                    <ScanLine className="w-3.5 h-3.5" />
                    <span>Scan</span>
                  </button>
                </div>
              </div>

              <div>
                <label className={labelClass}>
                  MRP (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={mrp || ""}
                  onChange={(e) => setMrp(Number(e.target.value))}
                  className={inputClass}
                  placeholder="Enter MRP"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>Cost Price (₹) <span className="text-red-500">*</span></label>
                <div className="flex space-x-1">
                  <input
                    type="number"
                    value={cost || ""}
                    onChange={(e) => setCost(Number(e.target.value))}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-l-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Auto-fill by discount"
                  />
                  <select
                    value={costDiscount}
                    onChange={(e) => {
                      const pct = Number(e.target.value);
                      setCostDiscount(e.target.value);
                      if (e.target.value !== "" && mrp > 0) {
                        setCost(Math.round((mrp * (100 - pct)) / 100));
                      }
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white rounded-r-lg px-2 py-2 text-xs shrink-0 focus:outline-none"
                  >
                    <option value="" className="bg-white text-slate-800">%</option>
                    <option value="30" className="bg-white text-slate-800">30%</option>
                    <option value="40" className="bg-white text-slate-800">40%</option>
                    <option value="50" className="bg-white text-slate-800">50%</option>
                    <option value="60" className="bg-white text-slate-800">60%</option>
                    <option value="70" className="bg-white text-slate-800">70%</option>
                    <option value="80" className="bg-white text-slate-800">80%</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={labelClass}>Sale Price (₹) <span className="text-slate-400 font-normal">(Optional)</span></label>
                <input
                  type="number"
                  value={sale || ""}
                  onChange={(e) => setSale(Number(e.target.value))}
                  className={inputClass}
                  placeholder="Enter sale price"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-lg"
            >
              Reset
            </button>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => doSave(true)}
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center space-x-1.5 disabled:opacity-50"
              >
                {submitting ? (
                  <span>Saving...</span>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Save Product</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs font-semibold text-red-600 flex items-center space-x-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {saved && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-xs font-semibold text-emerald-600 flex items-center space-x-1.5">
              <Check className="w-3.5 h-3.5 shrink-0" />
              <span>Product saved to Firebase successfully.</span>
            </div>
          )}
        </div>

        {/* RIGHT: RECENT PRODUCTS */}
        <div className="col-span-4 space-y-4">
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
              <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-800">
                <Clock className="w-4 h-4 text-blue-600" />
                <span>Recently Added Products</span>
              </div>
              <a href="/products/all" className="text-xs text-blue-600 font-medium hover:underline">
                View All
              </a>
            </div>

            <div className="space-y-3 text-xs">
              {recent.length === 0 && (
                <p className="text-center text-slate-400 text-[11px] py-4">
                  No products added yet. Save your first product.
                </p>
              )}
              {recent.map((p) => (
                <div
                  key={`${p.name}-${p.createdAt}`}
                  className="flex items-center justify-between pb-2 border-b border-slate-50 last:border-b-0"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0 p-1">
                      {dressSvg}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">{p.name}</p>
                      <p className="text-[10px] text-slate-400">
                        {p.sku ? `SKU: ${p.sku}` : "No SKU"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-800">₹{fmt(p.mrp)}</p>
                    <p className="text-[10px] text-slate-400">
                      {formatDate(p.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <SalesSection limit={5} />
        </div>
      </div>
    </AppShell>
  );
}
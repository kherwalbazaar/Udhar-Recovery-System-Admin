"use client";

import { useEffect, useState } from "react";
import {
  Package,
  Layers,
  ScanLine,
  CloudUpload,
  Lightbulb,
  Clock,
  ArrowLeft,
  Check,
  AlertCircle,
  Sparkles,
} from "lucide-react";
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
  const [category, setCategory] = useState("");
  const [brand, setBrand] = useState("");
  const [unit, setUnit] = useState("");
  const [hsn, setHsn] = useState("");
  const [mrp, setMrp] = useState(0);
  const [cost, setCost] = useState(0);
  const [sale, setSale] = useState(0);
  const [tax, setTax] = useState(0);
  const [profitMargin, setProfitMargin] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [stock, setStock] = useState(0);
  const [reorderLevel, setReorderLevel] = useState(0);
  const [stockLocation, setStockLocation] = useState("");
  const [supplier, setSupplier] = useState("");
  const [rack, setRack] = useState("");
  const [warranty, setWarranty] = useState("");
  const [active, setActive] = useState(true);
  const [trackStock, setTrackStock] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentProduct[]>([]);

  useEffect(() => {
    fetchRecentProducts()
      .then(setRecent)
      .catch(() => {});
  }, []);

  const resetForm = () => {
    setName("");
    setBarcode("");
    setCategory("");
    setBrand("");
    setUnit("");
    setHsn("");
    setMrp(0);
    setCost(0);
    setSale(0);
    setTax(0);
    setProfitMargin(0);
    setDiscount(0);
    setStock(0);
    setReorderLevel(0);
    setStockLocation("");
    setSupplier("");
    setRack("");
    setWarranty("");
    setActive(true);
    setTrackStock(true);
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
    setSubmitting(true);
    setError(null);
    try {
      const record: ProductRecord = {
        name: name.trim(),
        barcode: barcode.trim() || undefined,
        category: category || undefined,
        brand: brand.trim() || undefined,
        unit: unit || undefined,
        hsn: hsn.trim() || undefined,
        mrp: Number(mrp),
        cost: Number(cost) || undefined,
        sale: Number(sale) > 0 ? Number(sale) : Number(mrp),
        tax: Number(tax) || undefined,
        profitMargin: Number(profitMargin) || undefined,
        discount: Number(discount) || undefined,
        stock: Number(stock) || undefined,
        reorderLevel: Number(reorderLevel) || undefined,
        stockLocation: stockLocation.trim() || undefined,
        supplier: supplier || undefined,
        rack: rack.trim() || undefined,
        warranty: warranty.trim() || undefined,
        active,
        trackStock,
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
        setSaved(false);
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
          href="/products"
          className="text-xs text-slate-600 font-medium hover:text-slate-900 flex items-center space-x-1 border border-slate-200 rounded-lg px-3 py-1.5 bg-white shadow-sm"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Products</span>
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
                <label className={labelClass}>Barcode / SKU</label>
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
                <label className={labelClass}>Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select category</option>
                  <option>Men&apos;s Wear</option>
                  <option>Women&apos;s Wear</option>
                  <option>Kids Wear</option>
                  <option>Sarees</option>
                  <option>Innerwear</option>
                  <option>Accessories</option>
                  <option>Household</option>
                  <option>Other</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>
                  Brand <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="Enter brand name"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Unit</label>
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select unit</option>
                  <option>Pieces</option>
                  <option>Pack</option>
                  <option>Pair</option>
                  <option>Set</option>
                  <option>Metre</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>
                  HSN Code <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={hsn}
                  onChange={(e) => setHsn(e.target.value)}
                  placeholder="Enter HSN code"
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>
                  MRP (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={mrp}
                  onChange={(e) => setMrp(Number(e.target.value))}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Cost Price (₹)</label>
                <input
                  type="number"
                  value={cost}
                  onChange={(e) => setCost(Number(e.target.value))}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Sale Price (₹)</label>
                <input
                  type="number"
                  value={sale}
                  onChange={(e) => setSale(Number(e.target.value))}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>Tax (%)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={tax}
                    onChange={(e) => setTax(Number(e.target.value))}
                    className={inputClass}
                  />
                  <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 text-xs pointer-events-none">
                    %
                  </span>
                </div>
              </div>

              <div>
                <label className={labelClass}>Profit Margin (%)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={profitMargin}
                    onChange={(e) => setProfitMargin(Number(e.target.value))}
                    className={inputClass}
                  />
                  <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 text-xs pointer-events-none">
                    %
                  </span>
                </div>
              </div>

              <div>
                <label className={labelClass}>Discount (%)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={discount}
                    onChange={(e) => setDiscount(Number(e.target.value))}
                    className={inputClass}
                  />
                  <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 text-xs pointer-events-none">
                    %
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>Initial Stock</label>
                <input
                  type="number"
                  value={stock}
                  onChange={(e) => setStock(Number(e.target.value))}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Reorder Level</label>
                <input
                  type="number"
                  value={reorderLevel}
                  onChange={(e) => setReorderLevel(Number(e.target.value))}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Stock Location</label>
                <input
                  type="text"
                  value={stockLocation}
                  onChange={(e) => setStockLocation(e.target.value)}
                  placeholder="Enter stock location"
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border border-slate-200 space-y-4">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-2 text-blue-600 font-bold text-xs">
              <Layers className="w-4 h-4" />
              <span>More Details</span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>
                  Supplier <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <select
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select supplier</option>
                  <option>Local Market</option>
                  <option>Wholesale</option>
                  <option>Direct Manufacturer</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>
                  Rack / Shelf <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={rack}
                  onChange={(e) => setRack(e.target.value)}
                  placeholder="Enter rack or shelf name"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>
                  Warranty <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={warranty}
                  onChange={(e) => setWarranty(e.target.value)}
                  placeholder="Enter warranty details"
                  className={inputClass}
                />
              </div>
            </div>

            <div className="flex items-center space-x-6 text-xs text-slate-700 font-medium pt-1">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <span>This product is active</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={trackStock}
                  onChange={(e) => setTrackStock(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <span>Track stock for this product</span>
              </label>
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
                className="px-4 py-2 border border-blue-600 text-blue-600 hover:bg-blue-50 text-xs font-semibold rounded-lg disabled:opacity-50"
              >
                Save &amp; Add Another
              </button>
              <button
                type="button"
                onClick={() => doSave(false)}
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

        {/* RIGHT: IMAGE UPLOAD & RECENT PRODUCTS */}
        <div className="col-span-4 space-y-4">
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-2 text-slate-800 font-bold text-xs mb-3">
              <CloudUpload className="w-4 h-4 text-blue-600" />
              <span>Product Image</span>
            </div>

            <div className="border-2 border-dashed border-blue-200 rounded-xl bg-blue-50/30 p-6 text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-500 mx-auto flex items-center justify-center">
                <CloudUpload className="w-6 h-6" />
              </div>
              <p className="text-xs text-slate-600 font-medium">
                Drag &amp; drop product image here
              </p>
              <p className="text-[10px] text-slate-400">or</p>
              <button
                type="button"
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-lg"
              >
                Choose Image
              </button>
              <p className="text-[10px] text-slate-400 mt-2">
                JPG, PNG or WEBP (Max. 2MB)
              </p>
            </div>

            <div className="bg-amber-50/70 border border-amber-100 rounded-xl p-2.5 mt-3 flex items-start space-x-2 text-xs text-amber-700">
              <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <span className="text-[11px] leading-snug">
                Tip: Upload a clear product image for better identification and
                faster sales.
              </span>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
              <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-800">
                <Clock className="w-4 h-4 text-blue-600" />
                <span>Recently Added Products</span>
              </div>
              <a href="/products" className="text-xs text-blue-600 font-medium hover:underline">
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
                  key={p.name}
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
        </div>
      </div>
    </AppShell>
  );
}
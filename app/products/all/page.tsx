"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Package,
  Pencil,
  Trash2,
  Search,
  ArrowRight,
  Check,
  AlertCircle,
  X,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import ProductImage from "@/components/ProductImage";
import {
  fetchSoldProducts,
  updateProduct,
  deleteProduct,
  type ProductWithSales,
  type ProductRecord,
} from "@/lib/products";

const fmt = (n: number) =>
  n.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

const inputClass =
  "w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500";

const labelClass = "block text-[11px] font-medium text-slate-700 mb-1";

export default function AllProductsPage() {
  const [products, setProducts] = useState<ProductWithSales[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ProductRecord | null>(null);
  const [editName, setEditName] = useState("");
  const [editBarcode, setEditBarcode] = useState("");
  const [editMrp, setEditMrp] = useState(0);
  const [editCost, setEditCost] = useState(0);
  const [editSale, setEditSale] = useState(0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetchSoldProducts()
      .then(setProducts)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.barcode ?? "").toLowerCase().includes(q)
    );
  }, [products, query]);

  const openEdit = (p: ProductWithSales) => {
    setEditing({
      name: p.name,
      barcode: p.barcode,
      mrp: p.mrp,
      cost: p.cost,
      sale: p.sale,
      active: true,
      trackStock: true,
      createdAt: Date.now(),
    });
    setEditName(p.name);
    setEditBarcode(p.barcode ?? "");
    setEditMrp(p.mrp);
    setEditCost(p.cost ?? 0);
    setEditSale(p.sale ?? 0);
    setConfirmDelete(false);
    setMessage(null);
  };

  const closeEdit = () => {
    setEditing(null);
    setConfirmDelete(false);
    setMessage(null);
  };

  const handleUpdate = async () => {
    if (!editing) return;
    if (!editName.trim()) {
      setMessage({ type: "error", text: "Product Name is required." });
      return;
    }
    if (editMrp <= 0) {
      setMessage({ type: "error", text: "MRP must be greater than 0." });
      return;
    }
    if (editCost <= 0) {
      setMessage({ type: "error", text: "Cost Price is required." });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const record: ProductRecord = {
        ...editing,
        name: editName.trim(),
        barcode: editBarcode.trim() || undefined,
        mrp: Number(editMrp),
        cost: Number(editCost) || undefined,
        sale: Number(editSale) > 0 ? Number(editSale) : undefined,
      };
      await updateProduct(editing.name, record);
      setProducts((prev) =>
        prev
          .filter((p) => p.name !== editing.name)
          .concat({
            name: record.name,
            barcode: record.barcode,
            mrp: record.mrp,
            cost: record.cost,
            sale: record.sale,
            totalQty:
              prev.find((p) => p.name === editing.name)?.totalQty ?? 0,
            inCatalog: true,
          })
          .sort((a, b) => a.name.localeCompare(b.name))
      );
      setMessage({ type: "success", text: "Product updated successfully." });
      setEditing(null);
      setConfirmDelete(false);
    } catch (e) {
      setMessage({
        type: "error",
        text: e instanceof Error ? e.message : "Failed to update product.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editing) return;
    setSaving(true);
    setMessage(null);
    try {
      await deleteProduct(editing.name);
      setProducts((prev) => prev.filter((p) => p.name !== editing.name));
      setMessage({ type: "success", text: "Product deleted successfully." });
      setEditing(null);
      setConfirmDelete(false);
    } catch (e) {
      setMessage({
        type: "error",
        text: e instanceof Error ? e.message : "Failed to delete product.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell title="All Products" active="All Product">
      <div className="flex items-center justify-between">
        <a
          href="/products"
          className="text-xs text-slate-600 font-medium hover:text-slate-900 flex items-center space-x-1 border border-slate-200 rounded-lg px-3 py-1.5 bg-white shadow-sm"
        >
          <span>Add New Product</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </a>

        <div className="relative w-72">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
            <Search className="w-3.5 h-3.5" />
          </span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or barcode"
            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl p-4 border border-slate-200">
        <div className="flex items-center space-x-2 border-b border-slate-100 pb-2 mb-3">
          <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-800">
            <Package className="w-4 h-4 text-blue-600" />
            <span>All Products</span>
            <span className="text-slate-400 font-normal">
              ({products.length})
            </span>
          </div>
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
                    Barcode / SKU
                  </span>
                </th>
                <th className="pb-2 pr-2">
                  <span className="inline-block w-full text-left bg-[#0b1e59] text-white font-semibold rounded-md px-3 py-1.5">
                    MRP (₹)
                  </span>
                </th>
                <th className="pb-2 pr-2">
                  <span className="inline-block w-full text-left bg-[#0b1e59] text-white font-semibold rounded-md px-3 py-1.5">
                    Cost (₹)
                  </span>
                </th>
                <th className="pb-2 pr-2">
                  <span className="inline-block w-full text-left bg-[#0b1e59] text-white font-semibold rounded-md px-3 py-1.5">
                    Sale (₹)
                  </span>
                </th>
                <th className="pb-2">
                  <span className="inline-block w-full text-right bg-[#0b1e59] text-white font-semibold rounded-md px-3 py-1.5">
                    Action
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-slate-100">
              {loading && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">
                    Loading products...
                  </td>
                </tr>
              )}
              {!loading && error && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-red-500">
                    {error}
                  </td>
                </tr>
              )}
              {!loading && !error && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">
                    No products found.
                  </td>
                </tr>
              )}
              {filtered.map((p) => (
                <tr key={p.name}>
                  <td className="py-2">
                    <div className="flex items-center space-x-2">
                      <ProductImage name={p.name} />
                      <span className="font-medium text-slate-800">
                        {p.name}
                      </span>
                    </div>
                  </td>
                  <td className="py-2 text-slate-500">{p.barcode ?? "—"}</td>
                  <td className="py-2 text-slate-700">{fmt(p.mrp)}</td>
                  <td className="py-2 text-slate-700">
                    {p.cost != null ? fmt(p.cost) : "—"}
                  </td>
                  <td className="py-2 text-slate-700">
                    {p.sale != null ? fmt(p.sale) : "—"}
                  </td>
                  <td className="py-2 text-right">
                    {p.inCatalog ? (
                      <button
                        type="button"
                        onClick={() => openEdit(p)}
                        className="text-blue-600 hover:text-blue-800 p-1.5 hover:bg-blue-50 rounded-lg"
                        aria-label={`Edit ${p.name}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    ) : (
                      <span className="text-slate-300 text-[10px]">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {error && (
          <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-2 text-xs font-semibold text-red-600 flex items-center space-x-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-pink-50 rounded-xl border border-pink-200 shadow-2xl w-full max-w-lg space-y-4">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <h3 className="text-xs font-bold text-slate-800">Edit Product</h3>
              <button
                type="button"
                onClick={closeEdit}
                className="text-slate-400 hover:text-slate-600"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {confirmDelete ? (
              <div className="px-4 py-6 text-center space-y-4">
                <p className="text-sm font-medium text-slate-700">
                  Delete <span className="font-bold">{editing.name}</span>?
                </p>
                <p className="text-xs text-slate-400">
                  This action cannot be undone.
                </p>
                <div className="flex items-center justify-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={saving}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50"
                  >
                    {saving ? "Deleting..." : "Yes, Delete"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="px-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className={labelClass}>
                      Product Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className={inputClass}
                    />
                  </div>

                  <div className="col-span-2">
                    <label className={labelClass}>Barcode / SKU</label>
                    <input
                      type="text"
                      value={editBarcode}
                      onChange={(e) => setEditBarcode(e.target.value)}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>
                      MRP (₹) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={editMrp || ""}
                      onChange={(e) => setEditMrp(Number(e.target.value))}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>
                      Cost Price (₹) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={editCost || ""}
                      onChange={(e) => setEditCost(Number(e.target.value))}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Sale Price (₹)</label>
                    <input
                      type="number"
                      value={editSale || ""}
                      onChange={(e) => setEditSale(Number(e.target.value))}
                      className={inputClass}
                    />
                  </div>
                </div>

                {message && (
                  <div
                    className={`rounded-lg p-2 text-xs font-semibold flex items-center space-x-1.5 ${
                      message.type === "error"
                        ? "bg-red-50 border border-red-200 text-red-600"
                        : "bg-emerald-50 border border-emerald-200 text-emerald-600"
                    }`}
                  >
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{message.text}</span>
                  </div>
                )}
              </div>
            )}

            {!confirmDelete && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold rounded-lg flex items-center space-x-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={closeEdit}
                    className="px-4 py-2 bg-white border border-pink-300 text-pink-700 hover:bg-pink-100 text-xs font-semibold rounded-lg shadow-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleUpdate}
                    disabled={saving}
                    className="px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white text-xs font-semibold rounded-lg flex items-center space-x-1.5 disabled:opacity-50 shadow-sm"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{saving ? "Saving..." : "Update"}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
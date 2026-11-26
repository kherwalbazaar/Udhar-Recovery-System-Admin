'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { onValue, push, ref, set } from 'firebase/database';
import {
  AlertCircle,
  ArrowLeft,
  Boxes,
  Check,
  PackagePlus,
  Plus,
  Tag,
  X,
} from 'lucide-react';
import { db } from '@/lib/firebase';
import {
  saveProduct,
  updateProduct,
  type ProductRecord,
} from '@/lib/products';

const DEFAULT_CATEGORIES = [
  'ESSA',
  'GALAXY',
  'KOLKATA',
  'Stroberry',
  'SK Dreams',
  'Rupa Footline',
  'UR Image',
  'LUX',
  'Lungi',
  'Saree',
  'Half Pants',
  'Ganji',
];

const inputCls =
  'w-full mt-1.5 px-3.5 py-2.5 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
const labelCls = 'block text-xs font-semibold text-gray-700';

export default function MobileAddProduct({ onBack }: { onBack: () => void }) {
  const [allProducts, setAllProducts] = useState<ProductRecord[]>([]);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);

  const [editingName, setEditingName] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [mrp, setMrp] = useState('');
  const [cost, setCost] = useState('');
  const [costDiscount, setCostDiscount] = useState('');
  const [sale, setSale] = useState('');
  const [category, setCategory] = useState('');
  const [size, setSize] = useState('');
  const [stock, setStock] = useState('');
  const [barcode, setBarcode] = useState('');

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [newCategoryOpen, setNewCategoryOpen] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    const unsubCat = onValue(ref(db, 'productCategories'), (snapshot) => {
      const values = snapshot.val() as Record<string, { name?: string } | string> | null;
      const saved = values
        ? Object.values(values).map((entry) =>
            typeof entry === 'string' ? entry : String(entry?.name ?? ''),
          )
        : [];
      setCategories(Array.from(new Set([...DEFAULT_CATEGORIES, ...saved].filter(Boolean))));
    });

    const unsubProducts = onValue(ref(db, 'products'), (snapshot) => {
      const raw = snapshot.val() as Record<string, Record<string, unknown>> | null;
      if (!raw) {
        setAllProducts([]);
        return;
      }
      const list = Object.values(raw)
        .map((r): ProductRecord => ({
          name: String(r.name ?? '').trim(),
          origin: r.origin === 'catalog' || r.origin === 'sales' ? r.origin : undefined,
          barcode: r.barcode ? String(r.barcode) : undefined,
          qrCode: r.qrCode ? String(r.qrCode) : undefined,
          category: r.category ? String(r.category) : undefined,
          unit: r.unit ? String(r.unit) : undefined,
          mrp: Number(r.mrp ?? 0),
          cost: r.cost != null ? Number(r.cost) : undefined,
          sale: r.sale != null ? Number(r.sale) : undefined,
          stock: r.stock != null ? Number(r.stock) : undefined,
          active: Boolean(r.active ?? true),
          trackStock: Boolean(r.trackStock ?? true),
          createdAt: Number(r.createdAt ?? 0),
        }))
        .filter((p) => p.name && p.origin !== 'sales')
        .sort((a, b) => b.createdAt - a.createdAt);
      setAllProducts(list);
    });

    return () => {
      unsubCat();
      unsubProducts();
    };
  }, []);

  const suggestions = useMemo(() => {
    const q = name.trim().toLowerCase();
    if (!q) return [];
    return allProducts
      .filter((p) => p.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [name, allProducts]);

  const resetForm = () => {
    setEditingName(null);
    setName('');
    setMrp('');
    setCost('');
    setCostDiscount('');
    setSale('');
    setCategory('');
    setSize('');
    setStock('');
    setBarcode('');
    setError(null);
  };

  const selectExistingProduct = (p: ProductRecord) => {
    setEditingName(p.name);
    setName(p.name);
    setMrp(p.mrp ? String(p.mrp) : '');
    setCost(p.cost != null ? String(p.cost) : '');
    setSale(p.sale != null ? String(p.sale) : '');
    setCategory(p.category ?? '');
    setSize(p.unit ?? '');
    setStock(p.stock != null ? String(p.stock) : '');
    setBarcode(p.barcode ?? '');
    setCostDiscount('');
    setShowSuggestions(false);
    setError(null);
    setSuccessMsg(null);
  };

  const handleAddCategory = async () => {
    const categoryName = newCategory.trim();
    if (!categoryName) return;
    if (categories.some((c) => c.toLowerCase() === categoryName.toLowerCase())) {
      setCategory(
        categories.find((c) => c.toLowerCase() === categoryName.toLowerCase()) ?? categoryName,
      );
      setNewCategory('');
      setNewCategoryOpen(false);
      return;
    }
    try {
      const catRef = push(ref(db, 'productCategories'));
      await set(catRef, { name: categoryName });
      setCategories((curr) => [...curr, categoryName]);
      setCategory(categoryName);
      setNewCategory('');
      setNewCategoryOpen(false);
    } catch {
      setError('Could not save the new category.');
    }
  };

  const handleSave = async () => {
    const cleanName = name.trim();
    const mrpVal = Number(mrp);
    const costVal = Number(cost);
    const saleVal = Number(sale);
    const stockVal = stock.trim() === '' ? undefined : Number(stock);

    if (!cleanName) return setError('Product Name is required.');
    if (/[.#$\[\]\/]/.test(cleanName)) {
      return setError('Product Name cannot contain . # $ / or brackets.');
    }
    if (!Number.isFinite(mrpVal) || mrpVal <= 0) return setError('MRP must be greater than 0.');
    if (!category) return setError('Category is required.');
    if (!Number.isFinite(costVal) || costVal <= 0) return setError('Cost Price is required.');
    if (!Number.isFinite(saleVal) || saleVal <= 0) return setError('Sale Price is required.');
    if (stockVal !== undefined && (!Number.isInteger(stockVal) || stockVal < 0)) {
      return setError('Stock quantity must be a whole number of 0 or more.');
    }

    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const existingMatch = editingName
        ? allProducts.find((p) => p.name === editingName)
        : undefined;
      const generatedBarcode =
        barcode.trim() ||
        `KB${Date.now().toString().slice(-6)}${Math.floor(1000 + Math.random() * 9000)}`;

      const record: ProductRecord = {
        name: cleanName,
        origin: 'catalog',
        barcode: generatedBarcode,
        qrCode: existingMatch?.qrCode,
        category: category || undefined,
        mrp: mrpVal,
        cost: costVal,
        sale: saleVal,
        unit: size.trim() || undefined,
        stock: stockVal,
        active: true,
        trackStock: true,
        createdAt: existingMatch?.createdAt || Date.now(),
      };

      if (editingName) {
        await updateProduct(editingName, record);
        setSuccessMsg(`"${cleanName}" updated successfully.`);
      } else {
        await saveProduct(record);
        setSuccessMsg(`"${cleanName}" added to catalog.`);
      }
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save product.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-slate-50 overflow-hidden">
      {/* Mobile Header */}
      <div className="bg-gradient-to-b from-blue-600 to-blue-700 text-white px-4 py-4 shrink-0 shadow">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="hover:bg-blue-500 rounded-full p-1.5 transition flex items-center justify-center"
            aria-label="Back to Home"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <PackagePlus className="w-5 h-5" />
              <span>{editingName ? 'Edit Product' : 'Add Product'}</span>
            </h2>
            <p className="text-xs text-blue-100 truncate">
              {editingName ? `Updating ${editingName}` : 'Add new item to product catalog'}
            </p>
          </div>
          <Link
            href="/products"
            className="bg-white/15 hover:bg-white/25 text-white px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 shrink-0"
          >
            <Boxes className="w-3.5 h-3.5" />
            <span>All</span>
          </Link>
        </div>
      </div>

      {/* Form Body */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 pb-12 space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs font-semibold text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs font-semibold text-emerald-700 flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <div
          className={`rounded-2xl p-4 border shadow-sm space-y-4 ${editingName ? 'bg-pink-50/70 border-pink-200' : 'bg-white border-gray-200'}`}
        >
          {/* Product Name with suggestions */}
          <div className="relative">
            <label className={labelCls}>
              Product Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              onChange={(e) => {
                setName(e.target.value);
                setShowSuggestions(true);
                if (error) setError(null);
              }}
              placeholder="Enter product name"
              className={inputCls}
              autoComplete="off"
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 z-20 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-44 overflow-y-auto divide-y divide-gray-100">
                {suggestions.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectExistingProduct(p)}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 flex items-center justify-between gap-2"
                  >
                    <span className="font-semibold text-gray-800 truncate">{p.name}</span>
                    <span className="text-[10px] text-gray-500 shrink-0">
                      MRP ₹{p.mrp} · Sale ₹{p.sale ?? '—'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* MRP & Sale Price */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>
                MRP (₹) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={mrp}
                onChange={(e) => {
                  const val = e.target.value;
                  setMrp(val);
                  if (costDiscount !== '' && Number(val) > 0) {
                    setCost(String(Math.round((Number(val) * (100 - Number(costDiscount))) / 100)));
                  }
                }}
                placeholder="0"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>
                Sale Price (₹) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={sale}
                onChange={(e) => setSale(e.target.value)}
                placeholder="0"
                className={inputCls}
              />
            </div>
          </div>

          {/* Cost Price + % discount */}
          <div>
            <label className={labelCls}>
              Cost Price (₹) <span className="text-red-500">*</span>
            </label>
            <div className="flex mt-1.5">
              <input
                type="number"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="Enter cost or pick % off MRP"
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-gray-300 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={costDiscount}
                onChange={(e) => {
                  const pct = Number(e.target.value);
                  setCostDiscount(e.target.value);
                  if (e.target.value !== '' && Number(mrp) > 0) {
                    setCost(String(Math.round((Number(mrp) * (100 - pct)) / 100)));
                  }
                }}
                className="bg-blue-600 text-white font-bold text-xs px-3 rounded-r-lg focus:outline-none shrink-0"
              >
                <option value="" className="bg-white text-gray-800">
                  %
                </option>
                <option value="30" className="bg-white text-gray-800">
                  30%
                </option>
                <option value="40" className="bg-white text-gray-800">
                  40%
                </option>
                <option value="50" className="bg-white text-gray-800">
                  50%
                </option>
                <option value="60" className="bg-white text-gray-800">
                  60%
                </option>
                <option value="70" className="bg-white text-gray-800">
                  70%
                </option>
                <option value="80" className="bg-white text-gray-800">
                  80%
                </option>
              </select>
            </div>
          </div>

          {/* Category + New Category */}
          <div>
            <div className="flex items-center justify-between">
              <label className={labelCls}>
                Category <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => setNewCategoryOpen((v) => !v)}
                className="text-[11px] font-bold text-blue-600 flex items-center gap-0.5 hover:underline"
              >
                <Tag className="w-3 h-3" />
                <span>+ New Category</span>
              </button>
            </div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={inputCls}
            >
              <option value="">Select category</option>
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            {newCategoryOpen && (
              <div className="flex gap-2 mt-2">
                <input
                  type="text"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="New category name"
                  className="flex-1 px-3 py-2 text-xs bg-white border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={handleAddCategory}
                  disabled={!newCategory.trim()}
                  className="px-3 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg disabled:opacity-50"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNewCategoryOpen(false);
                    setNewCategory('');
                  }}
                  className="px-2.5 py-2 bg-gray-100 text-gray-600 text-xs font-bold rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Size & Stock */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Size (Optional)</label>
              <input
                type="text"
                value={size}
                onChange={(e) => setSize(e.target.value)}
                placeholder="e.g. M, L, 32"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Stock Qty (Optional)</label>
              <input
                type="number"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                placeholder="0"
                className={inputCls}
              />
            </div>
          </div>

          {/* Barcode */}
          <div>
            <label className={labelCls}>Barcode / SKU (Optional)</label>
            <input
              type="text"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="Auto-generated if left blank"
              className={inputCls}
            />
          </div>
        </div>

        <div className="flex gap-2">
          {editingName && (
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-3.5 rounded-xl bg-white border border-gray-300 text-gray-700 font-bold text-sm"
            >
              Cancel Edit
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={submitting}
            className={`flex-1 py-3.5 rounded-xl font-bold text-sm text-white shadow flex items-center justify-center gap-2 disabled:opacity-50 ${
              editingName ? 'bg-pink-700 hover:bg-pink-800' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            <Plus className="w-5 h-5" />
            <span>
              {submitting
                ? editingName
                  ? 'Updating...'
                  : 'Saving...'
                : editingName
                  ? 'Update Product'
                  : 'Save Product'}
            </span>
          </button>
        </div>

        {/* Recent Products Quick List */}
        {allProducts.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-3 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                Recent Catalog Products ({allProducts.length})
              </h3>
              <Link href="/products" className="text-[11px] font-bold text-blue-600 hover:underline">
                View All ›
              </Link>
            </div>
            <div className="divide-y divide-gray-100">
              {allProducts.slice(0, 5).map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => selectExistingProduct(p)}
                  className="w-full py-2 flex items-center justify-between gap-2 text-left hover:bg-slate-50 px-1 rounded"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-gray-800 truncate">{p.name}</p>
                    <p className="text-[10px] text-gray-500">
                      {p.category || 'Uncategorized'}
                      {p.unit ? ` · ${p.unit}` : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-extrabold text-green-600">
                      ₹{p.sale ?? p.mrp}
                    </p>
                    <p className="text-[10px] text-gray-400">MRP ₹{p.mrp}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

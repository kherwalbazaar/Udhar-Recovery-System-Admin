"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Package,
  ScanLine,
  Clock,
  Check,
  AlertCircle,
  Pencil,
  X,
  Search,
  Trash2,
  Boxes,
  Plus,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import ProductImage from "@/components/ProductImage";
import {
  saveProduct,
  updateProduct,
  deleteProduct,
  fetchRecentProducts,
  fetchAllProducts,
  fetchSoldProducts,
  type ProductRecord,
  type RecentProduct,
  type ProductWithSales,
} from "@/lib/products";
import { fetchProducts } from "@/lib/store";

const fmt = (n: number) =>
  n.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

const inputClass =
  "w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500";

const labelClass = "block text-[11px] font-medium text-slate-700 mb-1";

export default function ProductPage() {
  const [name, setName] = useState("");
  const [barcode, setBarcode] = useState("");
  const [mrp, setMrp] = useState(0);
  const [cost, setCost] = useState(0);
  const [costDiscount, setCostDiscount] = useState("");
  const [sale, setSale] = useState(0);
  const [category, setCategory] = useState("");
  const [tax, setTax] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [stock, setStock] = useState(0);
  const [showImage, setShowImage] = useState(false);
  const [showQty, setShowQty] = useState(false);
  const [showTax, setShowTax] = useState(false);
  const [showDiscount, setShowDiscount] = useState(false);
  const [showBarcode, setShowBarcode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentProduct[]>([]);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [allProducts, setAllProducts] = useState<ProductRecord[]>([]);

  const [productList, setProductList] = useState<ProductWithSales[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [listQuery, setListQuery] = useState("");
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchRecentProducts()
      .then(setRecent)
      .catch(() => {});
    fetchProducts()
      .then((prods) => {
        const recs: ProductRecord[] = prods.map((p) => ({
          name: p.name,
          mrp: p.mrp,
          sale: p.sale,
          active: true,
          trackStock: true,
          createdAt: p.createdAt ?? 0,
        }));
        fetchAllProducts()
          .then((all) => {
            const map = new Map<string, ProductRecord>();
            for (const r of recs) map.set(r.name.toLowerCase(), r);
            for (const p of all) {
              const k = p.name.toLowerCase();
              const existing = map.get(k);
              if (existing) {
                map.set(k, { ...existing, ...p });
              } else {
                map.set(k, p);
              }
            }
            setAllProducts(Array.from(map.values()));
          })
          .catch(() => setAllProducts(recs));
      })
      .catch(() => {
        fetchAllProducts()
          .then(setAllProducts)
          .catch(() => {});
      });
    fetchSoldProducts()
      .then(setProductList)
      .catch((e: Error) => setListError(e.message))
      .finally(() => setListLoading(false));
  }, []);

  const refreshList = () => {
    setListLoading(true);
    fetchSoldProducts()
      .then((data) => {
        setProductList(data);
        setListError(null);
      })
      .catch((e: Error) => setListError(e.message))
      .finally(() => setListLoading(false));
    fetchRecentProducts()
      .then(setRecent)
      .catch(() => {});
  };

  const filteredProductList = useMemo(() => {
    const q = listQuery.trim().toLowerCase();
    if (!q) return productList;
    return productList.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.barcode ?? "").toLowerCase().includes(q)
    );
  }, [productList, listQuery]);

  const addProductSource = (() => {
    const recentAsProducts: ProductRecord[] = recent.map((r) => ({
      name: r.name,
      barcode: r.sku || undefined,
      mrp: r.mrp,
      cost: r.cost,
      sale: r.sale,
      category: undefined,
      active: true,
      trackStock: true,
      createdAt: 0,
      tax: undefined,
      discount: undefined,
      stock: undefined,
    }));
    const map = new Map<string, ProductRecord>();
    for (const p of [...allProducts, ...recentAsProducts]) {
      const k = p.name.trim().toLowerCase();
      if (!map.has(k)) map.set(k, p);
    }
    return Array.from(map.values());
  })();

  const addProductMatches = (() => {
    const q = name.trim().toLowerCase().replace(/\s+/g, " ");
    if (!q) return addProductSource;
    const qWords = q.split(" ").filter(Boolean);
    const isSingleConcatenatedInitials = qWords.length === 1 && q.length <= 5;
    return addProductSource.filter((p) => {
      const words = p.name.toLowerCase().split(/\s+/).filter(Boolean);
      const initials = words.map((w) => w[0]).join("");
      if (words.some((w) => w.startsWith(q))) return true;
      if (qWords.length > 1) {
        if (qWords.length > words.length) return false;
        return qWords.every((qw, i) => words[i].startsWith(qw));
      }
      if (isSingleConcatenatedInitials) {
        if (initials.startsWith(q)) return true;
        if (initials.includes(q)) {
          return words.some((w) => w.startsWith(q));
        }
      }
      return false;
    });
  })();

  const renderHighlightedName = (productName: string) => {
    const q = name.trim().toLowerCase().replace(/\s+/g, " ");
    if (!q) return <>{productName}</>;
    const qWords = q.split(" ").filter(Boolean);
    const words = productName.split(/\s+/);
    const lowerWords = words.map((w) => w.toLowerCase());
    const initials = lowerWords.map((w) => w[0]).join("");
    const hl = (word: string, len: number) => {
      if (len <= 0 || len > word.length) return <>{word}</>;
      return (
        <>
          <span className="bg-yellow-200 font-bold text-blue-700">{word.slice(0, len)}</span>
          {word.slice(len)}
        </>
      );
    };
    if (qWords.length > 1) {
      return (
        <>
          {words.map((w, i) => (
            <span key={i}>
              {i > 0 ? " " : ""}
              {i < qWords.length && lowerWords[i].startsWith(qWords[i]) ? hl(w, qWords[i].length) : w}
            </span>
          ))}
        </>
      );
    }
    if (qWords.length === 1 && q.length > 1 && initials.startsWith(q) && q.length === words.length) {
      return (
        <>
          {words.map((w, i) => (
            <span key={i}>
              {i > 0 ? " " : ""}
              {i < q.length ? hl(w, 1) : w}
            </span>
          ))}
        </>
      );
    }
    const qw = qWords[0];
    let highlighted = false;
    return (
      <>
        {words.map((w, i) => {
          const lw = lowerWords[i];
          if (!highlighted && lw.startsWith(qw)) {
            highlighted = true;
            return (
              <span key={i}>
                {i > 0 ? " " : ""}
                {hl(w, qw.length)}
              </span>
            );
          }
          return (
            <span key={i}>
              {i > 0 ? " " : ""}
              {w}
            </span>
          );
        })}
      </>
    );
  };

  const selectProductToForm = (p: ProductWithSales | RecentProduct | ProductRecord) => {
    const isWithSales = (x: any): x is ProductWithSales => "totalQty" in x;
    const isRecent = (x: any): x is RecentProduct => "sku" in x;
    let rec: ProductRecord | null = null;
    if (isWithSales(p)) {
      rec = allProducts.find((a) => a.name === p.name) || null;
      setEditingName(p.name);
      setName(p.name);
      setBarcode(p.barcode ?? rec?.barcode ?? "");
      setMrp(p.mrp);
      setCost(p.cost ?? rec?.cost ?? 0);
      setSale(p.sale ?? rec?.sale ?? 0);
      setCategory(rec?.category ?? "");
      setTax(rec?.tax ?? 0);
      setDiscount(rec?.discount ?? 0);
      setStock(rec?.stock ?? 0);
      if (p.barcode || rec?.barcode) setShowBarcode(true);
      if (rec?.tax) setShowTax(true);
      if (rec?.discount) setShowDiscount(true);
      if (rec?.stock) setShowQty(true);
    } else if (isRecent(p)) {
      setEditingName(p.name);
      setName(p.name);
      setBarcode(p.sku);
      if (p.sku) setShowBarcode(true);
      setMrp(p.mrp);
      setCost(p.cost ?? 0);
      setSale(p.sale ?? 0);
      setCategory("");
    } else {
      setEditingName(p.name);
      setName(p.name);
      setBarcode(p.barcode ?? "");
      setMrp(p.mrp);
      setCost(p.cost ?? 0);
      setSale(p.sale ?? 0);
      setCategory((p.category as string) ?? "");
      setTax((p.tax as number) ?? 0);
      setDiscount((p.discount as number) ?? 0);
      setStock((p.stock as number) ?? 0);
      if (p.barcode) setShowBarcode(true);
      if (p.tax) setShowTax(true);
      if (p.discount) setShowDiscount(true);
      if (p.stock) setShowQty(true);
    }
    setError(null);
    setSaved(false);
    setShowForm(true);
  };

  const editProduct = (p: RecentProduct) => {
    selectProductToForm(p);
  };

  const handleDeleteList = async (p: ProductWithSales) => {
    if (!window.confirm(`Delete "${p.name}"?`)) return;
    try {
      await deleteProduct(p.name);
      setProductList((prev) => prev.filter((x) => x.name !== p.name));
      setAllProducts((prev) => prev.filter((x) => x.name !== p.name));
      setRecent((prev) => prev.filter((x) => x.name !== p.name));
      if (editingName === p.name) {
        resetForm();
        setShowForm(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete product.");
    }
  };

  const resetForm = () => {
    setEditingName(null);
    setName("");
    setBarcode("");
    setMrp(0);
    setCost(0);
    setCostDiscount("");
    setSale(0);
    setCategory("");
    setTax(0);
    setDiscount(0);
    setStock(0);
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
    if (!category) {
      setError("Category is required.");
      return;
    }
    if (cost <= 0) {
      setError("Cost Price is required.");
      return;
    }
    if (sale <= 0) {
      setError("Sale Price is required.");
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
        category: category || undefined,
        mrp: Number(mrp),
        cost: Number(cost) || undefined,
        sale: Number(sale) > 0 ? Number(sale) : undefined,
        tax: Number(tax) || undefined,
        discount: Number(discount) || undefined,
        stock: Number(stock) || undefined,
        active: true,
        trackStock: true,
        createdAt:
          editingName === name.trim()
            ? recent.find((p) => p.name === editingName)?.createdAt ?? Date.now()
            : Date.now(),
      };
      if (editingName && editingName !== name.trim()) {
        await updateProduct(editingName, record);
        setEditingName(null);
      } else if (editingName) {
        await updateProduct(editingName, record);
        setEditingName(null);
      } else {
        await saveProduct(record);
      }
      setSaved(true);
      setRecent((prev) => [
        {
          name: record.name,
          sku: record.barcode ?? "",
          mrp: record.mrp,
          cost: record.cost,
          sale: record.sale,
          createdAt: record.createdAt,
        },
        ...prev.filter((p) => p.name !== editingName),
      ]);
      if (clearAfter) {
        resetForm();
        setShowForm(false);
      }
      refreshList();
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save product.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell title="" active="Product">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">Product</h1>
        <button
          type="button"
          onClick={() => {
            if (showForm) {
              resetForm();
              setShowForm(false);
            } else {
              resetForm();
              setShowForm(true);
            }
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-2 rounded-lg flex items-center space-x-1.5 transition-colors"
        >
          {showForm ? <Boxes className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          <span>{showForm ? "All Products" : "Add Product"}</span>
        </button>
      </div>

      {showForm && (
        <div id="product-form" className="">
          <div className="space-y-4">
            <div className={`rounded-xl p-4 border space-y-4 ${editingName ? "bg-pink-50 border-pink-200" : "bg-white border-slate-200"}`}>
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center space-x-2 text-blue-600 font-bold text-xs">
                  <Package className="w-4 h-4" />
                  <span>{editingName ? `Edit Product: ${editingName}` : "Product Information"}</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-600">
                  <label className="flex items-center space-x-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showImage}
                      onChange={(e) => setShowImage(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500 w-3 h-3"
                    />
                    <span>Image</span>
                  </label>
                  <label className="flex items-center space-x-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showQty}
                      onChange={(e) => setShowQty(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500 w-3 h-3"
                    />
                    <span>Qty / Stock</span>
                  </label>
                  <label className="flex items-center space-x-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showTax}
                      onChange={(e) => setShowTax(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500 w-3 h-3"
                    />
                    <span>Tax</span>
                  </label>
                  <label className="flex items-center space-x-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showDiscount}
                      onChange={(e) => setShowDiscount(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500 w-3 h-3"
                    />
                    <span>Discount</span>
                  </label>
                  <label className="flex items-center space-x-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showBarcode}
                      onChange={(e) => setShowBarcode(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500 w-3 h-3"
                    />
                    <span>Barcode</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3">
                <div className="relative col-span-2">
                  <label className={labelClass}>
                    Product Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter product name"
                    className={inputClass}
                    autoComplete="off"
                  />
                  {name.trim().length > 0 && addProductMatches.length > 0 && (
                    <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden">
                      <div>
                        <table className="w-full text-left border-collapse">
                          <thead className="bg-white">
                            <tr className="text-[10px] text-slate-400 border-b border-slate-100">
                              <th className="py-1.5 px-2 font-normal">Product Name</th>
                              <th className="py-1.5 px-2 font-normal text-right">MRP</th>
                              <th className="py-1.5 px-2 font-normal text-right">Sale</th>
                            </tr>
                          </thead>
                          <tbody className="text-xs divide-y divide-slate-100">
                            {addProductMatches.map((p) => (
                              <tr
                                key={p.name}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  setEditingName(p.name);
                                  setName(p.name);
                                  setBarcode(p.barcode ?? "");
                                  setMrp(p.mrp);
                                  setCost(p.cost ?? 0);
                                  setSale(p.sale ?? 0);
                                  setCategory((p.category as string) ?? "");
                                  setTax((p.tax as number) ?? 0);
                                  setDiscount((p.discount as number) ?? 0);
                                  setStock((p.stock as number) ?? 0);
                                  setError(null);
                                  setSaved(false);
                                  if (p.barcode) setShowBarcode(true);
                                  if (p.tax) setShowTax(true);
                                  if (p.discount) setShowDiscount(true);
                                  if (p.stock) setShowQty(true);
                                }}
                                className="cursor-pointer hover:bg-blue-50"
                              >
                                <td className="py-1.5 px-2 font-medium text-slate-800 truncate max-w-[120px]">{renderHighlightedName(p.name)}</td>
                                <td className="py-1.5 px-2 text-right text-slate-500">₹{fmt(p.mrp)}</td>
                                <td className="py-1.5 px-2 text-right font-semibold text-slate-700">₹{p.sale != null ? fmt(p.sale) : "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
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
              </div>

              {showBarcode && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
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
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Sale Price (₹) <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    value={sale || ""}
                    onChange={(e) => setSale(Number(e.target.value))}
                    className={inputClass}
                    placeholder="Enter sale price"
                  />
                </div>
                <div>
                  <label className={labelClass}>Category <span className="text-red-500">*</span></label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Select category</option>
                    <option>ESSA</option>
                    <option>GALAXY</option>
                    <option>KOLKATA</option>
                    <option>Stroberry</option>
                    <option>SK Dreams</option>
                    <option>Rupa Footline</option>
                    <option>UR Image</option>
                    <option>LUX</option>
                    <option>Lungi</option>
                    <option>Saree</option>
                    <option>Half Pants</option>
                    <option>Ganji</option>
                  </select>
                </div>
              </div>

              {showImage && (
                <div className="flex items-center space-x-3 bg-blue-50/30 border border-dashed border-blue-200 rounded-xl p-3">
                  <ProductImage className="w-12 h-12 p-2" />
                  <div className="text-[11px] text-slate-500">
                    <p className="font-semibold text-slate-600">Product Image</p>
                    <p>Upload an image for this product.</p>
                  </div>
                  <button
                    type="button"
                    className="ml-auto text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold px-3 py-1.5 rounded-lg"
                  >
                    Choose Image
                  </button>
                </div>
              )}

              {showQty && (
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={labelClass}>Initial Stock (Qty)</label>
                    <input
                      type="number"
                      value={stock || ""}
                      onChange={(e) => setStock(Number(e.target.value))}
                      className={inputClass}
                      placeholder="Enter stock"
                    />
                  </div>
                </div>
              )}

              {showTax && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Tax (%)</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={tax || ""}
                        onChange={(e) => setTax(Number(e.target.value))}
                        className={inputClass}
                        placeholder="Enter tax %"
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
                        value={discount || ""}
                        onChange={(e) => setDiscount(Number(e.target.value))}
                        className={inputClass}
                        placeholder="Enter discount %"
                      />
                      <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 text-xs pointer-events-none">
                        %
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setShowForm(false);
                }}
                className={`px-4 py-2 text-xs font-semibold rounded-lg border shadow-sm flex items-center space-x-1 ${
                  editingName
                    ? "bg-white border-pink-300 text-pink-700 hover:bg-pink-100"
                    : "bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-600"
                }`}
              >
                {editingName && <X className="w-3.5 h-3.5" />}
                <span>{editingName ? "Cancel Edit" : "Cancel"}</span>
              </button>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => doSave(true)}
                  disabled={submitting}
                  className={`px-4 py-2 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center space-x-1.5 disabled:opacity-50 ${
                    editingName
                      ? "bg-pink-700 hover:bg-pink-800"
                      : "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  {submitting ? (
                    <span>{editingName ? "Updating..." : "Saving..."}</span>
                  ) : editingName ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Update Product</span>
                    </>
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
        </div>
      )}

      <div className="bg-white rounded-xl p-4 border border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
          <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-800">
            <Boxes className="w-4 h-4 text-blue-600" />
            <span>All Products</span>
            <span className="text-slate-400 font-normal">({filteredProductList.length})</span>
          </div>
          <div className="relative w-72">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
              <Search className="w-3.5 h-3.5" />
            </span>
            <input
              type="text"
              value={listQuery}
              onChange={(e) => setListQuery(e.target.value)}
              placeholder="Search by name or barcode"
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
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
              {listLoading && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">
                    Loading products...
                  </td>
                </tr>
              )}
              {!listLoading && listError && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-red-500">
                    {listError}
                  </td>
                </tr>
              )}
              {!listLoading && !listError && filteredProductList.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">
                    No products found.
                  </td>
                </tr>
              )}
              {!listLoading &&
                !listError &&
                filteredProductList.map((p) => (
                  <tr
                    key={p.name}
                    className={`hover:bg-blue-50 cursor-pointer ${editingName === p.name ? "bg-blue-50" : ""}`}
                    onClick={() => selectProductToForm(p)}
                  >
                    <td className="py-2">
                      <div className="flex items-center space-x-2">
                        <ProductImage name={p.name} />
                        <span className="font-medium text-slate-800">{p.name}</span>
                      </div>
                    </td>
                    <td className="py-2 text-slate-500">{p.barcode ?? "—"}</td>
                    <td className="py-2 text-slate-700">{fmt(p.mrp)}</td>
                    <td className="py-2 text-slate-700">{p.cost != null ? fmt(p.cost) : "—"}</td>
                    <td className="py-2 text-slate-700">{p.sale != null ? fmt(p.sale) : "—"}</td>
                    <td className="py-2 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end space-x-1">
                        <button
                          type="button"
                          onClick={() => selectProductToForm(p)}
                          className="text-blue-600 hover:text-blue-800 p-1.5 hover:bg-blue-50 rounded-lg"
                          aria-label={`Edit ${p.name}`}
                          title="Edit - fill form"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        {p.inCatalog ? (
                          <button
                            type="button"
                            onClick={() => handleDeleteList(p)}
                            className="text-red-500 hover:text-red-700 p-1.5 hover:bg-red-50 rounded-lg"
                            aria-label={`Delete ${p.name}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        ) : (
                          <span className="text-slate-300 text-[10px] px-1.5">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-slate-400 mt-2">Click any row or pencil icon to load product into form above for editing.</p>
      </div>
    </AppShell>
  );
}

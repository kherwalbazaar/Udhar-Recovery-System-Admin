"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { onValue, push, ref, set, update } from "firebase/database";
import {
  Package,
  ArrowLeft,
  ScanLine,
  Clock,
  Check,
  AlertCircle,
  X,
  Search,
  Boxes,
  Plus,
  Download,
  Upload,
  Tag,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import { useToast } from "@/components/ToastProvider";
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
import { db } from "@/lib/firebase";
import { triggerActionRefresh } from "@/lib/cache";
import QRCode from "qrcode";

const fmt = (n: number) =>
  n.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

const inputClass =
  "w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500";

const labelClass = "block text-[11px] font-medium text-slate-700 mb-1";
const DEFAULT_CATEGORIES = [
  "ESSA", "GALAXY", "KOLKATA", "Stroberry", "SK Dreams", "Rupa Footline",
  "UR Image", "LUX", "Lungi", "Saree", "Half Pants", "Ganji",
];

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"' && quoted && text[i + 1] === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function printProductQR(product: ProductWithSales) {
  const qrCode = product.qrCode;
  if (!qrCode) return;
  const printWindow = window.open("", "_blank", "width=420,height=320");
  if (!printWindow) return;
  const escapeHtml = (value: string) =>
    value.replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[char] ?? char);
  printWindow.document.write(`<!doctype html><html><head><title>Product QR Code</title><style>
    @page{size:60mm 35mm;margin:3mm}body{font:12px Arial,sans-serif;text-align:center;color:#111}
    h1{font-size:14px;margin:2mm 0 3mm}.qr{width:24mm;height:24mm;image-rendering:pixelated}.code{font:10px monospace;margin-top:1mm}
    @media screen{body{width:54mm;margin:20px auto;border:1px dashed #aaa;padding:8px}}
  </style></head><body><h1>${escapeHtml(product.name)}</h1><img class="qr" src="${escapeHtml(qrCode)}" alt="Product QR code"><div class="code">${escapeHtml(product.barcode ?? "")}</div><script>window.onload=()=>window.print()</script></body></html>`);
  printWindow.document.close();
}

export default function ProductPage() {
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [barcode, setBarcode] = useState("");
  const [mrp, setMrp] = useState(0);
  const [cost, setCost] = useState(0);
  const [costDiscount, setCostDiscount] = useState("");
  const [sale, setSale] = useState(0);
  const [size, setSize] = useState("");
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
  const [isAddingRow, setIsAddingRow] = useState(false);
  const [newRow, setNewRow] = useState({ name: "", purchase: "", barcode: "", mrp: "", sale: "", size: "" });
  const [newRowError, setNewRowError] = useState<string | null>(null);
  const [savingNewRow, setSavingNewRow] = useState(false);
  const [inlineEditingName, setInlineEditingName] = useState<string | null>(null);
  const [inlineEditRow, setInlineEditRow] = useState({ name: "", purchase: "", barcode: "", mrp: "", sale: "", size: "" });
  const [savingInlineEdit, setSavingInlineEdit] = useState(false);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [newCategoryOpen, setNewCategoryOpen] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [importing, setImporting] = useState(false);
  const [generatingQrFor, setGeneratingQrFor] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubscribe = onValue(ref(db, "productCategories"), (snapshot) => {
      const values = snapshot.val() as Record<string, { name?: string } | string> | null;
      const saved = values
        ? Object.values(values).map((entry) =>
            typeof entry === "string" ? entry : String(entry?.name ?? "")
          )
        : [];
      setCategories(Array.from(new Set([...DEFAULT_CATEGORIES, ...saved].filter(Boolean))));
    });
    return unsubscribe;
  }, []);

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

  const handleExport = () => {
    const headers = ["Product", "Purchase", "Barcode", "MRP", "Sale", "Size", "Category", "Stock"];
    const quote = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const rows = productList.map((product) => {
      const catalog = allProducts.find((item) => item.name === product.name);
      return [product.name, product.cost ?? "", product.barcode ?? "", product.mrp,
        product.sale ?? "", catalog?.unit ?? product.unit ?? "", catalog?.category ?? product.category ?? "",
        catalog?.stock ?? product.stock ?? ""];
    });
    const csv = [headers, ...rows].map((row) => row.map(quote).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `products-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("success", `Exported ${rows.length} products.`);
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setImporting(true);
    try {
      const rows = parseCsv(await file.text());
      if (rows.length < 2) throw new Error("The CSV needs a header row and at least one product.");
      const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
      const headers = rows[0].map(normalize);
      const field = (row: string[], names: string[]) => {
        const index = headers.findIndex((header) => names.includes(header));
        return index < 0 ? "" : row[index] ?? "";
      };
      const updates: Record<string, ProductRecord> = {};
      let skipped = 0;
      for (const [index, row] of rows.slice(1).entries()) {
        const productName = field(row, ["product", "productname", "name"]).trim();
        if (!productName || /[.#$\[\]\/]/.test(productName)) {
          skipped += 1;
          continue;
        }
        const numeric = (aliases: string[]) => {
          const value = Number(field(row, aliases).replace(/,/g, ""));
          return Number.isFinite(value) && value >= 0 ? value : undefined;
        };
        const record: ProductRecord = {
          name: productName,
          barcode: field(row, ["barcode", "sku"]).trim() || undefined,
          qrCode: allProducts.find((item) => item.name.toLowerCase() === productName.toLowerCase())?.qrCode,
          category: field(row, ["category"]).trim() || undefined,
          unit: field(row, ["size", "unit"]).trim() || undefined,
          mrp: numeric(["mrp"]) ?? 0,
          cost: numeric(["purchase", "cost", "purchaseprice"]),
          sale: numeric(["sale", "saleprice"]),
          stock: numeric(["stock", "quantity", "qty"]),
          active: true,
          trackStock: true,
          createdAt: Date.now() + index,
        };
        updates[`products/${productName}`] = Object.fromEntries(
          Object.entries(record).filter(([, value]) => value !== undefined)
        ) as ProductRecord;
      }
      if (!Object.keys(updates).length) throw new Error("No valid products found in the CSV.");
      await update(ref(db), updates);
      const importedCount = Object.keys(updates).length;
      showToast(skipped ? "warning" : "success", `Imported ${importedCount} products${skipped ? `; skipped ${skipped} invalid rows` : ""}.`);
      triggerActionRefresh();
    } catch (importError) {
      showToast("error", importError instanceof Error ? importError.message : "Could not import this CSV file.");
    } finally {
      setImporting(false);
    }
  };

  const handleAddCategory = async () => {
    const categoryName = newCategory.trim();
    if (!categoryName) return;
    if (categories.some((item) => item.toLowerCase() === categoryName.toLowerCase())) {
      showToast("warning", "That category already exists.");
      return;
    }
    try {
      const categoryRef = push(ref(db, "productCategories"));
      await set(categoryRef, { name: categoryName });
      setCategories((current) => [...current, categoryName]);
      setCategory(categoryName);
      setNewCategory("");
      setNewCategoryOpen(false);
      showToast("success", `Added category “${categoryName}”.`);
    } catch {
      showToast("error", "Could not save the category.");
    }
  };

  const handleGenerateQR = async (product: ProductWithSales) => {
    setGeneratingQrFor(product.name);
    let generatedBarcode: string | null = null;
    try {
      const barcode = product.barcode?.trim() || `KB${Date.now().toString().slice(-8)}${Math.floor(100 + Math.random() * 900)}`;
      generatedBarcode = barcode;
      const qrCode = await QRCode.toDataURL(barcode, { errorCorrectionLevel: "M", margin: 2, width: 256 });
      // Show the generated barcode immediately while Firebase persists it.
      setProductList((current) => current.map((item) => item.name === product.name ? { ...item, barcode, qrCode } : item));
      const existing = allProducts.find((item) => item.name === product.name);
      const record: ProductRecord = {
        ...existing,
        name: product.name,
        barcode,
        qrCode,
        category: existing?.category ?? product.category,
        unit: existing?.unit ?? product.unit,
        mrp: product.mrp,
        cost: existing?.cost,
        sale: product.sale ?? existing?.sale,
        stock: existing?.stock ?? product.stock,
        active: existing?.active ?? true,
        trackStock: existing?.trackStock ?? true,
        createdAt: existing?.createdAt ?? Date.now(),
      };
      if (product.inCatalog) await updateProduct(product.name, record);
      else await saveProduct(record);
      setProductList((current) => current.map((item) => item.name === product.name ? { ...item, barcode, qrCode, inCatalog: true } : item));
      setAllProducts((current) => [...current.filter((item) => item.name !== product.name), record]);
      showToast("success", `Generated and saved a QR code for ${product.name}.`);
    } catch (generationError) {
      if (generatedBarcode && !product.barcode?.trim()) {
        setProductList((current) => current.map((item) => item.name === product.name ? { ...item, barcode: product.barcode, qrCode: product.qrCode } : item));
      }
      showToast("error", generationError instanceof Error ? generationError.message : "Could not generate the barcode.");
    } finally {
      setGeneratingQrFor(null);
    }
  };

  const handlePrintProductQR = async (product: ProductWithSales) => {
    const barcode = product.barcode?.trim() || allProducts.find((item) => item.name === product.name)?.barcode?.trim();
    if (!barcode) return;
    try {
      const qrCode = product.qrCode?.trim() || await QRCode.toDataURL(barcode, { errorCorrectionLevel: "M", margin: 2, width: 256 });
      printProductQR({ ...product, barcode, qrCode });
    } catch (printError) {
      showToast("error", printError instanceof Error ? printError.message : "Could not create the product QR code.");
    }
  };

  const saveNewProductRow = async () => {
    const productName = newRow.name.trim();
    if (!productName) return setNewRowError("Product name is required.");
    if (/[.#$\[\]\/]/.test(productName)) return setNewRowError("Product name cannot contain . # $ / or brackets.");
    if (allProducts.some((product) => product.name.toLowerCase() === productName.toLowerCase())) {
      return setNewRowError("A product with this name already exists.");
    }
    const mrpValue = Number(newRow.mrp);
    const saleValue = Number(newRow.sale);
    const purchaseValue = newRow.purchase === "" ? undefined : Number(newRow.purchase);
    if (!Number.isFinite(mrpValue) || mrpValue <= 0) return setNewRowError("Enter a valid MRP greater than zero.");
    if (!Number.isFinite(saleValue) || saleValue <= 0) return setNewRowError("Enter a valid sale price greater than zero.");
    if (purchaseValue !== undefined && (!Number.isFinite(purchaseValue) || purchaseValue < 0)) {
      return setNewRowError("Enter a valid purchase price.");
    }

    setSavingNewRow(true);
    setNewRowError(null);
    try {
      const record: ProductRecord = {
        name: productName,
        barcode: newRow.barcode.trim() || undefined,
        mrp: mrpValue,
        sale: saleValue,
        cost: purchaseValue,
        unit: newRow.size.trim() || undefined,
        active: true,
        trackStock: true,
        createdAt: Date.now(),
      };
      await saveProduct(record);
      showToast("success", `${productName} added successfully!`);
      setIsAddingRow(false);
      setNewRow({ name: "", purchase: "", barcode: "", mrp: "", sale: "", size: "" });
    } catch (saveError) {
      setNewRowError(saveError instanceof Error ? saveError.message : "Could not save this product.");
    } finally {
      setSavingNewRow(false);
    }
  };

  const startInlineEdit = (product: ProductWithSales) => {
    const record = allProducts.find((item) => item.name === product.name);
    setInlineEditingName(product.name);
    setNewRowError(null);
    setInlineEditRow({
      name: product.name,
      purchase: String(product.cost ?? record?.cost ?? ""),
      barcode: product.barcode ?? record?.barcode ?? "",
      mrp: String(product.mrp),
      sale: String(product.sale ?? record?.sale ?? ""),
      size: record?.unit ?? product.unit ?? "",
    });
  };

  const saveInlineEdit = async (product: ProductWithSales) => {
    const productName = inlineEditRow.name.trim();
    const mrpValue = Number(inlineEditRow.mrp);
    const saleValue = Number(inlineEditRow.sale);
    const purchaseValue = inlineEditRow.purchase === "" ? undefined : Number(inlineEditRow.purchase);
    if (!productName) return setNewRowError("Product name is required.");
    if (/[.#$\[\]\/]/.test(productName)) return setNewRowError("Product name cannot contain . # $ / or brackets.");
    if (productName !== product.name && allProducts.some((item) => item.name.toLowerCase() === productName.toLowerCase())) return setNewRowError("A product with this name already exists.");
    if (!Number.isFinite(mrpValue) || mrpValue <= 0 || !Number.isFinite(saleValue) || saleValue <= 0) return setNewRowError("Enter valid MRP and sale prices greater than zero.");
    if (purchaseValue !== undefined && (!Number.isFinite(purchaseValue) || purchaseValue < 0)) return setNewRowError("Enter a valid purchase price.");
    setSavingInlineEdit(true);
    setNewRowError(null);
    try {
      const existing = allProducts.find((item) => item.name === product.name);
      const record: ProductRecord = {
        ...existing,
        name: productName,
        barcode: inlineEditRow.barcode.trim() || undefined,
        mrp: mrpValue,
        sale: saleValue,
        cost: purchaseValue,
        unit: inlineEditRow.size.trim() || undefined,
        active: existing?.active ?? true,
        trackStock: existing?.trackStock ?? true,
        createdAt: existing?.createdAt ?? Date.now(),
      };
      await updateProduct(product.name, record);
      setInlineEditingName(null);
      setProductList((current) => current.map((item) => item.name === product.name ? { ...item, name: productName, barcode: record.barcode, mrp: mrpValue, sale: saleValue, cost: purchaseValue, unit: record.unit, inCatalog: true } : item));
      setAllProducts((current) => [...current.filter((item) => item.name !== product.name), record]);
      showToast("success", `${productName} updated successfully!`);
      refreshList();
    } catch (saveError) {
      setNewRowError(saveError instanceof Error ? saveError.message : "Could not update this product.");
    } finally {
      setSavingInlineEdit(false);
    }
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
    setIsAddingRow(false);
    if (isWithSales(p)) {
      rec = allProducts.find((a) => a.name === p.name) || null;
      setEditingName(p.name);
      setName(p.name);
      setBarcode(p.barcode ?? rec?.barcode ?? "");
      setMrp(p.mrp);
      setCost(p.cost ?? rec?.cost ?? 0);
      setSale(p.sale ?? rec?.sale ?? 0);
      setSize(rec?.unit ?? p.unit ?? "");
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
      setSize("");
    } else {
      setEditingName(p.name);
      setName(p.name);
      setBarcode(p.barcode ?? "");
      setMrp(p.mrp);
      setCost(p.cost ?? 0);
      setSale(p.sale ?? 0);
      setSize(p.unit ?? "");
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
    setSize("");
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
        qrCode: allProducts.find((item) => item.name === editingName)?.qrCode,
        category: category || undefined,
        mrp: Number(mrp),
        cost: Number(cost) || undefined,
        sale: Number(sale) > 0 ? Number(sale) : undefined,
        unit: size.trim() || undefined,
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

  const inlineInput = (key: keyof typeof inlineEditRow, label: string, numeric = false) => (
    <input
      aria-label={label}
      type={numeric ? "number" : "text"}
      min={numeric ? "0" : undefined}
      step={numeric ? "0.01" : undefined}
      value={inlineEditRow[key]}
      onChange={(event) => setInlineEditRow((row) => ({ ...row, [key]: event.target.value }))}
      onKeyDown={(event) => { if (event.key === "Escape") { setInlineEditingName(null); setNewRowError(null); } }}
      className="w-full min-w-20 bg-yellow-200 px-2 py-2 text-xs outline-none focus:bg-yellow-100 focus:ring-1 focus:ring-inset focus:ring-blue-500"
    />
  );
  const missingDataCell = <span title="No data available" aria-label="No data available" className="font-bold text-amber-600">⚠</span>;
  return (
    <AppShell title="" active="Product">
      {showForm && <button type="button" onClick={() => { resetForm(); setShowForm(false); }} className="mb-3 flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"><Boxes className="h-4 w-4" /> All Products</button>}

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

              <div className="grid grid-cols-3 gap-3">
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
                    {categories.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Size</label>
                  <input
                    type="text"
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    className={inputClass}
                    placeholder="e.g. M, L, 32"
                  />
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

      {!showForm && <div className="-mx-4 -mt-4 -mb-4 flex min-h-[calc(100vh-4rem)] flex-col border border-slate-300 bg-white p-3 shadow-sm">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-slate-300 pb-2">
          <div className="flex w-full flex-wrap items-center gap-3 xl:w-auto">
            <div className="flex items-center gap-1.5 text-base font-bold text-slate-800">
              <Link href="/" aria-label="Go to home" title="Go to home" className="mr-1 flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 shadow-sm transition hover:bg-slate-100 hover:text-slate-900">
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <Boxes className="h-5 w-5 text-emerald-700" />
              <span>All Products ({productList.length})</span>
            </div>
            <div className="relative w-full sm:w-64">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400"><Search className="w-3.5 h-3.5" /></span>
              <input type="text" value={listQuery} onChange={(e) => setListQuery(e.target.value)} placeholder="Search by name or barcode" className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
          </div>
          <div className="flex w-full flex-wrap items-center justify-end gap-3 xl:w-auto">
            <button type="button" onClick={() => {
              if (isAddingRow) { setIsAddingRow(false); setNewRowError(null); }
              else { setNewRow({ name: "", purchase: "", barcode: "", mrp: "", sale: "", size: "" }); setNewRowError(null); setIsAddingRow(true); }
            }} className="flex items-center gap-1.5 rounded-md border border-emerald-700 border-b-4 bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-md transition hover:bg-emerald-700 active:translate-y-0.5 active:border-b-2 active:shadow-sm"><Plus className="h-4 w-4" />{isAddingRow ? "Cancel Add" : "Add Product"}</button>
            <button type="button" onClick={handleExport} className="flex items-center gap-1.5 rounded-md border border-blue-700 border-b-4 bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-md transition hover:bg-blue-700 active:translate-y-0.5 active:border-b-2 active:shadow-sm"><Download className="h-4 w-4" /> Export</button>
            <button type="button" onClick={() => importInputRef.current?.click()} disabled={importing} className="flex items-center gap-1.5 rounded-md border border-pink-700 border-b-4 bg-pink-600 px-3 py-2 text-xs font-semibold text-white shadow-md transition hover:bg-pink-700 active:translate-y-0.5 active:border-b-2 active:shadow-sm disabled:opacity-50"><Upload className="h-4 w-4" />{importing ? "Importing..." : "Import"}</button>
            <input ref={importInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleImport} />
            <button type="button" onClick={() => { setNewCategory(""); setNewCategoryOpen(true); }} className="flex items-center gap-1.5 rounded-md border border-violet-700 border-b-4 bg-violet-600 px-3 py-2 text-xs font-semibold text-white shadow-md transition hover:bg-violet-700 active:translate-y-0.5 active:border-b-2 active:shadow-sm"><Tag className="h-4 w-4" /><Plus className="h-3 w-3" /> New Category</button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto border border-slate-300">
          <table className="w-full min-w-[1120px] border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-slate-100">
              <tr className="text-[11px] text-slate-700">
                <th className="sticky left-0 z-20 min-w-56 border border-slate-300 bg-slate-100 px-3 py-2 font-semibold">Product</th>
                <th className="min-w-28 border border-slate-300 px-3 py-2 text-right font-semibold">Purchase (₹)</th>
                <th className="min-w-44 border border-slate-300 px-3 py-2 font-semibold">Barcode</th>
                <th className="min-w-28 border border-slate-300 px-3 py-2 text-right font-semibold">MRP (₹)</th>
                <th className="min-w-28 border border-slate-300 px-3 py-2 text-right font-semibold">Sale (₹)</th>
                <th className="min-w-24 border border-slate-300 px-3 py-2 font-semibold">Size</th>
                <th className="min-w-28 border border-slate-300 px-2 py-2 text-center font-semibold">Save/Update</th>
                <th className="min-w-20 border border-slate-300 px-2 py-2 text-center font-semibold">Delete</th>
                <th className="min-w-28 border border-slate-300 px-2 py-2 text-center font-semibold">Barcode</th>
              </tr>
            </thead>
            <tbody className="text-xs">
              {listLoading && !isAddingRow && (
                <tr>
                  <td colSpan={9} className="py-6 text-center text-slate-400">
                    Loading products...
                  </td>
                </tr>
              )}
              {!listLoading && listError && !isAddingRow && (
                <tr>
                  <td colSpan={9} className="py-6 text-center text-red-500">
                    {listError}
                  </td>
                </tr>
              )}
              {!listLoading && !listError && filteredProductList.length === 0 && !isAddingRow && (
                <tr>
                  <td colSpan={9} className="py-6 text-center text-slate-400">
                    No products found.
                  </td>
                </tr>
              )}
              {isAddingRow && (
                <>
                  <tr className="h-11 bg-amber-50">
                    <td className="sticky left-0 border border-slate-300 bg-amber-50 p-0">
                      <input autoFocus aria-label="Product name" value={newRow.name} onChange={(event) => setNewRow((row) => ({ ...row, name: event.target.value }))} onKeyDown={(event) => { if (event.key === "Enter") void saveNewProductRow(); }} placeholder="Product name" className="w-full min-w-44 bg-transparent px-2 py-2 text-xs outline-none focus:bg-white focus:ring-1 focus:ring-inset focus:ring-blue-500" />
                    </td>
                    <td className="border border-slate-300 p-0">
                      <input aria-label="Purchase price" type="number" min="0" value={newRow.purchase} onChange={(event) => setNewRow((row) => ({ ...row, purchase: event.target.value }))} onKeyDown={(event) => { if (event.key === "Enter") void saveNewProductRow(); }} placeholder="Purchase" className="w-full min-w-24 bg-transparent px-2 py-2 text-right text-xs outline-none focus:bg-white focus:ring-1 focus:ring-inset focus:ring-blue-500" />
                    </td>
                    <td className="border border-slate-300 p-0">
                      <input aria-label="Barcode" value={newRow.barcode} onChange={(event) => setNewRow((row) => ({ ...row, barcode: event.target.value }))} onKeyDown={(event) => { if (event.key === "Enter") void saveNewProductRow(); }} placeholder="Barcode (optional)" className="w-full min-w-40 bg-transparent px-2 py-2 text-xs outline-none focus:bg-white focus:ring-1 focus:ring-inset focus:ring-blue-500" />
                    </td>
                    <td className="border border-slate-300 p-0">
                      <input aria-label="MRP" type="number" min="0" step="0.01" value={newRow.mrp} onChange={(event) => setNewRow((row) => ({ ...row, mrp: event.target.value }))} onKeyDown={(event) => { if (event.key === "Enter") void saveNewProductRow(); }} placeholder="MRP" className="w-full min-w-24 bg-transparent px-2 py-2 text-right text-xs outline-none focus:bg-white focus:ring-1 focus:ring-inset focus:ring-blue-500" />
                    </td>
                    <td className="border border-slate-300 p-0">
                      <input aria-label="Sale price" type="number" min="0" step="0.01" value={newRow.sale} onChange={(event) => setNewRow((row) => ({ ...row, sale: event.target.value }))} onKeyDown={(event) => { if (event.key === "Enter") void saveNewProductRow(); }} placeholder="Sale" className="w-full min-w-24 bg-transparent px-2 py-2 text-right text-xs outline-none focus:bg-white focus:ring-1 focus:ring-inset focus:ring-blue-500" />
                    </td>
                    <td className="border border-slate-300 p-0">
                      <input aria-label="Size" value={newRow.size} onChange={(event) => setNewRow((row) => ({ ...row, size: event.target.value }))} onKeyDown={(event) => { if (event.key === "Enter") void saveNewProductRow(); }} placeholder="Size" className="w-full min-w-20 bg-transparent px-2 py-2 text-xs outline-none focus:bg-white focus:ring-1 focus:ring-inset focus:ring-blue-500" />
                    </td>
                    <td className="border border-slate-300 p-1">
                      <button type="button" onClick={() => void saveNewProductRow()} disabled={savingNewRow} className="w-full border border-blue-700 bg-blue-600 px-2 py-1.5 text-[10px] font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{savingNewRow ? "Saving..." : "Save"}</button>
                    </td>
                    <td className="border border-slate-300 p-1">
                      <button type="button" onClick={() => { setIsAddingRow(false); setNewRowError(null); }} className="w-full border border-slate-300 bg-white px-2 py-1.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
                    </td>
                    <td className="border border-slate-300 px-2 text-center text-slate-300">—</td>
                  </tr>
                  {newRowError && <tr><td colSpan={9} className="border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{newRowError}</td></tr>}
                </>
              )}
              {!listLoading &&
                !listError &&
                filteredProductList.map((p) => (
                  <tr
                    key={p.name}
                    className={`h-10 cursor-pointer ${inlineEditingName === p.name ? "!bg-yellow-300 hover:!bg-yellow-300" : "even:bg-slate-50 hover:bg-emerald-50"}`}
                    onDoubleClick={() => startInlineEdit(p)}
                  >
                    <td className="sticky left-0 border border-slate-200 bg-inherit p-0 font-medium text-slate-800" title={inlineEditingName === p.name ? newRowError ?? undefined : undefined}>{inlineEditingName === p.name ? inlineInput("name", "Product name") : <span className="block px-3 py-2">{p.name}</span>}</td>
                    <td className="border border-slate-200 p-0 text-right tabular-nums text-slate-700">{inlineEditingName === p.name ? inlineInput("purchase", "Purchase price", true) : <span className="block px-3 py-2">{(p.cost ?? allProducts.find((product) => product.name === p.name)?.cost) != null ? fmt((p.cost ?? allProducts.find((product) => product.name === p.name)?.cost)!) : missingDataCell}</span>}</td>
                    <td className="border border-slate-200 p-0 text-slate-600">{inlineEditingName === p.name ? inlineInput("barcode", "Barcode") : <span className="block px-3 py-2">{(p.barcode ?? allProducts.find((product) => product.name === p.name)?.barcode)?.trim() || missingDataCell}</span>}</td>
                    <td className="border border-slate-200 p-0 text-right tabular-nums text-slate-700">{inlineEditingName === p.name ? inlineInput("mrp", "MRP", true) : <span className="block px-3 py-2">{p.mrp > 0 ? fmt(p.mrp) : missingDataCell}</span>}</td>
                    <td className="border border-slate-200 p-0 text-right tabular-nums text-slate-700">{inlineEditingName === p.name ? inlineInput("sale", "Sale price", true) : <span className="block px-3 py-2">{(p.sale ?? allProducts.find((product) => product.name === p.name)?.sale) != null ? fmt((p.sale ?? allProducts.find((product) => product.name === p.name)?.sale)!) : missingDataCell}</span>}</td>
                    <td className="border border-slate-200 p-0 text-slate-600">{inlineEditingName === p.name ? inlineInput("size", "Size") : <span className="block px-3 py-2">{allProducts.find((product) => product.name === p.name)?.unit?.trim() || p.unit?.trim() || missingDataCell}</span>}</td>
                    <td className="border border-slate-200 px-1 py-1" onClick={(e) => e.stopPropagation()}>
                      {inlineEditingName === p.name ? <><button type="button" onClick={() => void saveInlineEdit(p)} disabled={savingInlineEdit} className="w-full border border-blue-700 bg-blue-600 px-2 py-1.5 text-[10px] font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{savingInlineEdit ? "Saving..." : "Save"}</button>{newRowError && <span className="block max-w-28 pt-1 text-[10px] text-red-600">{newRowError}</span>}</> : <button type="button" onClick={() => startInlineEdit(p)} className="w-full border border-slate-300 bg-white px-2 py-1.5 text-[10px] font-semibold text-blue-700 hover:bg-blue-50">Update</button>}
                    </td>
                    <td className="border border-slate-200 px-1 py-1" onClick={(e) => e.stopPropagation()}>
                      {p.inCatalog ? (
                        <button type="button" onClick={() => handleDeleteList(p)} className="w-full border border-slate-300 bg-white px-2 py-1.5 text-[10px] font-semibold text-red-600 hover:bg-red-50">Delete</button>
                      ) : (
                        <button type="button" disabled className="w-full border border-slate-200 bg-slate-50 px-2 py-1.5 text-[10px] font-semibold text-slate-300">Delete</button>
                      )}
                    </td>
                    <td className="border border-slate-200 px-1 py-1" onClick={(e) => e.stopPropagation()}>
                      {(p.barcode?.trim() || allProducts.find((product) => product.name === p.name)?.barcode?.trim()) ? (
                        <button type="button" onClick={() => void handlePrintProductQR(p)} className="w-full border border-slate-300 bg-white px-2 py-1.5 text-[10px] font-semibold text-slate-700 hover:bg-slate-50" title={`Print QR code for ${p.name}`}>Print</button>
                      ) : (
                        <button type="button" onClick={() => void handleGenerateQR(p)} disabled={generatingQrFor === p.name} className="w-full border border-slate-300 bg-white px-2 py-1.5 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50" title={`Generate and save a QR code for ${p.name}`}>{generatingQrFor === p.name ? "Generating..." : "Generate"}</button>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>}
      {newCategoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setNewCategoryOpen(false);
        }}>
          <section role="dialog" aria-modal="true" aria-labelledby="new-category-title" className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
            <h2 id="new-category-title" className="text-base font-bold text-slate-800">New Category</h2>
            <p className="mt-1 text-xs text-slate-500">Add a category to the product catalog.</p>
            <input autoFocus value={newCategory} onChange={(event) => setNewCategory(event.target.value)} onKeyDown={(event) => {
              if (event.key === "Enter") void handleAddCategory();
            }} placeholder="Category name" className={`${inputClass} mt-4`} />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setNewCategoryOpen(false)} className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
              <button type="button" onClick={() => void handleAddCategory()} disabled={!newCategory.trim()} className="rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">Save Category</button>
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}

"use client";

import { useCallback, useEffect, useState, useRef, type KeyboardEvent } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ShoppingCart,
  UserPlus,
  Trash2,
  Wallet,
  Check,
  Minus,
  Plus,
  X,
  AlertCircle,
  Printer,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import { useToast } from "@/components/ToastProvider";
import OptionalSupabaseAdminSignIn from "@/components/OptionalSupabaseAdminSignIn";
import {
  fetchProducts,
  fetchCustomers,
  createCustomer,
  submitSale,
  type Product,
  type CustomerSummary,
} from "@/lib/store";
import { saveProduct } from "@/lib/products";
import { savePayableAmount } from "@/lib/supabase";
import QRCode from "qrcode";

type CartItem = {
  name: string;
  chipBg: string;
  purchase: number;
  barcode: string;
  mrp: number;
  sale: number;
  size: string;
  qty: number;
};

const CHIP_COLORS = [
  "bg-emerald-100 text-emerald-700",
  "bg-blue-100 text-blue-700",
  "bg-amber-100 text-amber-700",
  "bg-purple-100 text-purple-700",
  "bg-teal-100 text-teal-700",
  "bg-rose-100 text-rose-700",
  "bg-indigo-100 text-indigo-700",
];

function chipColor(name: string) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return CHIP_COLORS[hash % CHIP_COLORS.length];
}

const fmt = (n: number) =>
  n.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

const GST_RATE = 18;

export default function AddSalePage() {
  const { showToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [productTab, setProductTab] = useState<"scan" | "add">("scan");
  const [scanCode, setScanCode] = useState("");
  const [selectedCustomer, setSelectedCustomer] =
    useState<CustomerSummary | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [activeCustomerSuggestion, setActiveCustomerSuggestion] = useState(-1);
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerSaveError, setCustomerSaveError] = useState<string | null>(null);
  const [customerSaving, setCustomerSaving] = useState(false);
  const [priceInputs, setPriceInputs] = useState<Record<string, number>>({});
  const [cgstAmount, setCgstAmount] = useState(0);
  const [received, setReceived] = useState(0);
  const [receivedTouched, setReceivedTouched] = useState(false);
  const [autoSendWhatsapp, setAutoSendWhatsapp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pendingPayable, setPendingPayable] = useState<number | null>(null);
  const [syncingPayable, setSyncingPayable] = useState(false);
  const [syncAuthorized, setSyncAuthorized] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [qaName, setQaName] = useState("");
  const [qaMrp, setQaMrp] = useState("");
  const [qaSale, setQaSale] = useState("");
  const [qaCategory, setQaCategory] = useState("");
  const [qaBarcode, setQaBarcode] = useState("");
  const [qaError, setQaError] = useState<string | null>(null);
  const [qaSaving, setQaSaving] = useState(false);
  const [barcodeNotice, setBarcodeNotice] = useState<string | null>(null);
  const [missingBarcode, setMissingBarcode] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);

  const genSku = () =>
    `KB${Date.now().toString().slice(-6)}${Math.floor(1000 + Math.random() * 9000)}`;

  useEffect(() => {
    let active = true;
    fetchProducts()
      .then((p) => {
        if (!active) return;
        setProducts(p);
        setPriceInputs(Object.fromEntries(p.map((x) => [x.name, x.sale])));
        setProductsLoading(false);

        // If returned from adding a product, automatically add it to cart
        if (typeof window !== "undefined") {
          const params = new URLSearchParams(window.location.search);
          const addedBarcode = (params.get("addedBarcode") || params.get("barcode") || "").trim().toLowerCase();
          const addedProduct = (params.get("addedProduct") || "").trim().toLowerCase();

          if (addedBarcode || addedProduct) {
            const match = p.find((item) => {
              if (addedBarcode && item.barcode?.trim().toLowerCase() === addedBarcode) return true;
              if (addedProduct && item.name.trim().toLowerCase() === addedProduct) return true;
              return false;
            });

            if (match) {
              setCart((prev) => {
                const existing = prev.find((i) => i.name === match.name);
                if (existing) {
                  return prev.map((i) =>
                    i.name === match.name ? { ...i, qty: i.qty + 1 } : i
                  );
                }
                return [
                  ...prev,
                  {
                    name: match.name,
                    chipBg: chipColor(match.name),
                    purchase: match.purchase ?? 0,
                    barcode: match.barcode ?? "",
                    mrp: match.mrp,
                    sale: match.sale,
                    size: match.size ?? "",
                    qty: 1,
                  },
                ];
              });
              window.history.replaceState({}, "", "/sales");
            }
          }
        }
      })
      .catch((e: Error) => {
        if (!active) return;
        setError(`Failed to load products: ${e.message}`);
        setProductsLoading(false);
      });
    fetchCustomers()
      .then((c) => {
        if (active) setCustomers(c);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!productsLoading && productTab === "scan" && scanInputRef.current) {
      scanInputRef.current.focus();
    }
  }, [productsLoading, productTab]);

  const subtotal = cart.reduce((sum, item) => sum + item.sale * item.qty, 0);
  const gstAmount = Number((subtotal * GST_RATE / 100).toFixed(2));
  const discount = Number((gstAmount + cgstAmount).toFixed(2));
  const totalWithTax = subtotal + gstAmount + cgstAmount;
  const payable = Math.ceil(Math.max(0, Number((totalWithTax - discount).toFixed(2))));

  useEffect(() => {
    if (!receivedTouched) setReceived(selectedCustomer ? 0 : payable);
  }, [payable, receivedTouched, selectedCustomer]);

  const addToCart = (product: Product) => {
    const price = priceInputs[product.name] ?? product.sale;
    setCart((prev) => {
      const existing = prev.find((i) => i.name === product.name);
      if (existing) {
        return prev.map((i) =>
          i.name === product.name ? { ...i, qty: i.qty + 1, sale: price } : i
        );
      }
      return [
        ...prev,
        {
          name: product.name,
          chipBg: chipColor(product.name),
          purchase: product.purchase ?? 0,
          barcode: product.barcode ?? "",
          mrp: product.mrp,
          sale: price,
          size: product.size ?? "",
          qty: 1,
        },
      ];
    });
  };

  const handleBarcodeScan = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const code = scanCode.trim().toLocaleLowerCase();
    if (!code) return;
    const product = products.find(
      (item) => item.barcode?.trim().toLocaleLowerCase() === code
    );
    if (!product) {
      const missingCode = scanCode.trim();
      setBarcodeNotice(`No product found for barcode “${missingCode}”.`);
      setMissingBarcode(missingCode);
      setScanCode("");
      return;
    }
    addToCart(product);
    setBarcodeNotice(null);
    setMissingBarcode(null);
    setScanCode("");
    requestAnimationFrame(() => scanInputRef.current?.focus());
  };

  const selectCustomer = (customer: CustomerSummary) => {
    setSelectedCustomer(customer);
    setCustomerName("");
    setActiveCustomerSuggestion(-1);
    setCustomerPhone("");
    setCustomerAddress("");
    setCustomerSaveError(null);
    setProductTab("scan");
    requestAnimationFrame(() => scanInputRef.current?.focus());
  };

  const saveNewCustomer = async () => {
    const name = customerName.trim();
    const phone = customerPhone.trim();
    const address = customerAddress.trim();
    if (!name || !phone || !address) {
      setCustomerSaveError("Enter the customer name, mobile number, and address.");
      return;
    }

    const existing = customers.find(
      (customer) => customer.name.trim().toLowerCase() === name.toLowerCase()
    );
    if (existing) {
      setCustomerSaveError("This customer already exists. Select them from the suggestions.");
      return;
    }

    setCustomerSaving(true);
    setCustomerSaveError(null);
    try {
      const customer = await createCustomer({ name, phone, address });
      setCustomers((current) => [customer, ...current]);
      selectCustomer(customer);
    } catch (saveError) {
      setCustomerSaveError(
        saveError instanceof Error ? saveError.message : "Could not save customer."
      );
    } finally {
      setCustomerSaving(false);
    }
  };

  const handleQuickAdd = async () => {
    const name = qaName.trim();
    const mrp = Number(qaMrp);
    const sale = Number(qaSale);
    if (!name) {
      setQaError("Product Name is required.");
      return;
    }
    if (!(mrp > 0)) {
      setQaError("MRP must be greater than 0.");
      return;
    }
    if (!(sale > 0)) {
      setQaError("Sale Price must be greater than 0.");
      return;
    }
    if (!qaCategory) {
      setQaError("Category is required.");
      return;
    }
    setQaSaving(true);
    setQaError(null);
    try {
      const barcode = qaBarcode.trim() || genSku();
      await saveProduct({
        name,
        origin: "sales",
        barcode,
        category: qaCategory,
        mrp,
        sale,
        active: true,
        trackStock: true,
        createdAt: Date.now(),
      });
      addToCart({ name, barcode, purchase: 0, mrp, sale, size: "" });
      setProducts((prev) => [
        { name, mrp, sale, createdAt: Date.now() },
        ...prev.filter((x) => x.name !== name),
      ]);
      setSearch("");
      setQuickAddOpen(false);
      setQaName("");
      setQaMrp("");
      setQaSale("");
      setQaCategory("");
      setQaBarcode("");
    } catch (e) {
      setQaError(e instanceof Error ? e.message : "Failed to save product.");
    } finally {
      setQaSaving(false);
    }
  };

  const updateQty = (name: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => (i.name === name ? { ...i, qty: i.qty + delta } : i))
        .filter((i) => i.qty > 0)
    );
  };

  const setItemSale = (name: string, value: string) => {
    setCart((prev) =>
      prev.map((i) =>
        i.name === name ? { ...i, sale: Math.max(0, Number(value) || 0) } : i
      )
    );
  };

  const stepSale = (name: string, delta: number) => {
    setCart((prev) =>
      prev.map((i) =>
        i.name === name ? { ...i, sale: Math.max(0, i.sale + delta) } : i
      )
    );
  };

  const setItemQty = (name: string, value: string) => {
    setCart((prev) =>
      prev.map((i) =>
        i.name === name
          ? { ...i, qty: Math.max(1, Math.floor(Number(value) || 1)) }
          : i
      )
    );
  };

  const removeItem = (name: string) => {
    setCart((prev) => prev.filter((i) => i.name !== name));
  };

  const clearCart = () => setCart([]);

  const handlePrintReceipt = async () => {
    if (!selectedCustomer || cart.length === 0) return;
    if (payable <= 0) {
      showToast("warning", "The bill total must be greater than zero to make a payment QR.");
      return;
    }
    const printWindow = window.open("", "_blank", "width=480,height=640");
    if (!printWindow) {
      showToast("warning", "Allow pop-ups to print the receipt.");
      return;
    }
    try {
      const escapeHtml = (value: string) =>
        value.replace(/[&<>"']/g, (char) => ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[char] ?? char);
      const upiId = process.env.NEXT_PUBLIC_UPI_ID?.trim();
      const upiName = process.env.NEXT_PUBLIC_UPI_NAME?.trim() || "KHERWAL BAZAAR";
      const paymentParams = new URLSearchParams({
        pa: upiId || "",
        pn: upiName,
        am: payable.toFixed(2),
        cu: "INR",
        tn: `Sale for ${selectedCustomer.name}`,
      });
      const qrCode = upiId
        ? await QRCode.toDataURL(`upi://pay?${paymentParams.toString()}`, {
            errorCorrectionLevel: "M",
            margin: 1,
            width: 512,
          })
        : null;
      const rows = cart.map((item) => `
        <tr><td>${escapeHtml(item.name)}</td><td class="center">${item.qty}</td><td class="right">₹${fmt(item.sale * item.qty)}</td></tr>
      `).join("");
      printWindow.onload = () => printWindow.print();
      printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Sales Bill</title><style>
        @page{size:76.2mm auto;margin:0}
        *{box-sizing:border-box}
        html,body{width:76.2mm;margin:0;padding:0;color:#000;background:#fff;font:11px Arial,Helvetica,sans-serif}
        body{padding:3mm 4mm}
        h1{margin:0;text-align:center;font-size:15px;font-weight:800;letter-spacing:.3px}
        .subtitle{text-align:center;margin:1mm 0 3mm;font-size:10px}
        .meta{margin:0 0 3mm;line-height:1.5}
        table{width:100%;border-collapse:collapse}
        th,td{padding:1.4mm 0;border-bottom:1px dashed #777;vertical-align:top}
        th{text-align:left;font-size:10px}
        .center{text-align:center}.right{text-align:right;white-space:nowrap}
        .summary{margin-top:2mm}.summary div{display:flex;justify-content:space-between;padding:.8mm 0}
        .total{margin-top:1mm;padding-top:1.5mm;border-top:1px solid #000;font-size:14px;font-weight:800}
        .payment{margin-top:4mm;padding-top:3mm;border-top:1px dashed #555;text-align:center}
        .payment img{display:block;width:46mm;height:46mm;margin:2mm auto;image-rendering:pixelated}
        .note{font-size:9px;line-height:1.4}.unconfigured{margin-top:3mm;font-size:9px}
        </style></head><body><h1>KHERWAL BAZAAR</h1><div class="subtitle">Sales Bill</div><p class="meta"><strong>Customer:</strong> ${escapeHtml(selectedCustomer.name)}<br><strong>Mobile:</strong> ${escapeHtml(selectedCustomer.phone)}<br><strong>Date:</strong> ${escapeHtml(new Date().toLocaleString("en-IN"))}</p><table><thead><tr><th>Product</th><th class="center">Qty</th><th class="right">Amount</th></tr></thead><tbody>${rows}</tbody></table><div class="summary"><div><span>Product Amount</span><span>₹${fmt(subtotal)}</span></div><div><span>GST (${GST_RATE}%)</span><span>₹${fmt(gstAmount)}</span></div><div><span>CGST</span><span>₹${fmt(cgstAmount)}</span></div><div><span>Total</span><span>₹${fmt(totalWithTax)}</span></div><div><span>Discount</span><span>−₹${fmt(discount)}</span></div><div class="total"><span>Net Pay</span><span>₹${fmt(payable)}</span></div><div><span>Received</span><span>₹${fmt(received)}</span></div><div><span>Balance</span><span>₹${fmt(Math.max(0, payable - received))}</span></div></div>${qrCode ? `<div class="payment"><strong>Scan to Pay ₹${fmt(payable)}</strong><img src="${qrCode}" alt="UPI payment QR code"><div class="note">UPI ID: ${escapeHtml(upiId!)}<br>Thank you for shopping with us!</div></div>` : `<div class="payment unconfigured">UPI QR is unavailable. Configure NEXT_PUBLIC_UPI_ID to print payment QR codes.</div>`}</body></html>`);
      printWindow.document.close();
    } catch (printError) {
      printWindow.close();
      showToast("error", printError instanceof Error ? printError.message : "Could not generate the thermal bill.");
    }
  };

  const handleSubmit = async (quickPay = false) => {
    if (!selectedCustomer) {
      setError("Select a customer before submitting this sale.");
      return;
    }
    if (cart.length === 0) return;
    const finalPayable = Number(payable.toFixed(2));
    if (finalPayable <= 0) {
      setError("Final payable must be greater than zero to sync with the QR amount.");
      return;
    }
    if (pendingPayable !== null) {
      setError("Sync the previous sale amount before submitting another sale.");
      return;
    }

    const receivedAmount = quickPay ? finalPayable : received;
    if (quickPay) {
      setReceived(receivedAmount);
      setReceivedTouched(true);
    }
    const whatsappWindow = autoSendWhatsapp
      ? window.open("about:blank", "_blank")
      : null;

    setSubmitting(true);
    setError(null);
    setSyncError(null);
    try {
      await submitSale({
        items: cart.map((i) => ({
          name: i.name,
          mrp: i.mrp,
          sale: i.sale,
          qty: i.qty,
        })),
        saleType: selectedCustomer ? "credit" : "cash",
        customer: selectedCustomer,
        received: receivedAmount,
      });

      if (autoSendWhatsapp && selectedCustomer.phone.trim()) {
        const digits = selectedCustomer.phone.replace(/\D/g, "");
        const whatsappPhone = digits.length === 10
          ? `91${digits}`
          : digits.startsWith("0") && digits.length === 11
            ? `91${digits.slice(1)}`
            : digits;
        const message = [
          "*KHERWAL BAZAAR*",
          "Sale receipt",
          `Customer: ${selectedCustomer.name}`,
          "",
          ...cart.map((item) => `${item.name} × ${item.qty} — ₹${fmt(item.sale * item.qty)}`),
          `GST (${GST_RATE}%): ₹${fmt(gstAmount)}`,
          `CGST: ₹${fmt(cgstAmount)}`,
          `Total: ₹${fmt(totalWithTax)}`,
          `Discount: ₹${fmt(discount)}`,
          `Net Pay: ₹${fmt(finalPayable)}`,
          `Received: ₹${fmt(receivedAmount)}`,
          `Balance: ₹${fmt(Math.max(0, finalPayable - receivedAmount))}`,
        ].join("\n");
        const whatsappUrl = `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}`;
        if (whatsappWindow && !whatsappWindow.closed) {
          whatsappWindow.location.href = whatsappUrl;
        } else {
          showToast("warning", "Allow pop-ups to open the WhatsApp receipt.");
        }
      }

      setCart([]);
      setCgstAmount(0);
      setSelectedCustomer(null);
      setCustomerName("");
      setCustomerPhone("");
      setCustomerAddress("");
      setCustomerSaveError(null);
      setAutoSendWhatsapp(false);
      setReceivedTouched(false);
      setPendingPayable(finalPayable);

      try {
        await savePayableAmount(finalPayable);
        setPendingPayable(null);
        showToast("success", "Sale added successfully!");
      } catch (e) {
        setSyncError(
          `Sale was saved to Firebase, but its final payable amount was not synced to Supabase. ${e instanceof Error ? e.message : "Try syncing again."}`
        );
      }
    } catch (e) {
      whatsappWindow?.close();
      setError(e instanceof Error ? e.message : "Failed to submit sale.");
    } finally {
      setSubmitting(false);
    }
  };

  const retryPayableSync = useCallback(async () => {
    if (pendingPayable === null || syncingPayable) return;

    setSyncingPayable(true);
    setSyncError(null);
    try {
      await savePayableAmount(pendingPayable);
      setPendingPayable(null);
      showToast("success", "Sale added successfully!");
    } catch (e) {
      setSyncError(
        `Sale is saved to Firebase, but its final payable amount is still not synced. ${e instanceof Error ? e.message : "Try syncing again."}`
      );
    } finally {
      setSyncingPayable(false);
    }
  }, [pendingPayable, showToast, syncingPayable]);

  useEffect(() => {
    if (syncAuthorized && pendingPayable !== null && !syncingPayable) {
      void retryPayableSync();
    }
  }, [pendingPayable, retryPayableSync, syncAuthorized, syncingPayable]);

  const filteredProducts = (() => {
    const q = search.trim().toLowerCase().replace(/\s+/g, " ");
    if (!q) return products;
    const qWords = q.split(" ").filter(Boolean);
    const isSingleConcatenatedInitials = qWords.length === 1 && q.length <= 5;
    const qAsNumber = Number(q);
    return products.filter((p) => {
      if (p.barcode && p.barcode.toLowerCase().includes(q)) return true;
      if (qAsNumber > 0 && (p.mrp === qAsNumber || p.sale === qAsNumber)) return true;
      const words = p.name.toLowerCase().split(/\s+/).filter(Boolean);
      const initials = words.map((w) => w[0]).join("");
      if (words.some((w) => w.startsWith(q))) return true;
      if (qWords.length > 1) {
        if (qWords.length > words.length) return false;
        return qWords.every((qw, i) => words[i].startsWith(qw));
      }
      if (isSingleConcatenatedInitials) {
        if (initials.startsWith(q)) return true;
        if (initials.includes(q)) return words.some((w) => w.startsWith(q));
      }
      return false;
    });
  })();

  const visibleProducts = search.trim()
    ? filteredProducts
    : filteredProducts.slice(0, 10);

  const chip = (name: string) => name.charAt(0).toUpperCase();
  const customerQuery = customerName.trim().toLocaleLowerCase();
  const matchingCustomers = customerQuery
    ? customers
        .filter((customer) =>
          customer.name.trim().toLocaleLowerCase().includes(customerQuery)
        )
        .sort((a, b) => {
          const aStartsWith = a.name.trim().toLocaleLowerCase().startsWith(customerQuery);
          const bStartsWith = b.name.trim().toLocaleLowerCase().startsWith(customerQuery);
          return Number(bStartsWith) - Number(aStartsWith);
        })
        .slice(0, 8)
    : [];

  const handleCustomerNameKeyDown = (
    event: KeyboardEvent<HTMLInputElement>
  ) => {
    if (!matchingCustomers.length) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveCustomerSuggestion((current) =>
        current < 0 ? 0 : (current + 1) % matchingCustomers.length
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveCustomerSuggestion((current) =>
        current < 0
          ? matchingCustomers.length - 1
          : (current - 1 + matchingCustomers.length) % matchingCustomers.length
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      selectCustomer(matchingCustomers[activeCustomerSuggestion >= 0 ? activeCustomerSuggestion : 0]);
    } else if (event.key === "Escape") {
      setActiveCustomerSuggestion(-1);
    }
  };

  return (
    <AppShell title="" active="Sales">
      <div className="flex items-center gap-2">
        <Link
          href="/"
          aria-label="Go to home"
          title="Go to home"
          className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 shadow-sm transition hover:bg-slate-100 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <ShoppingCart className="h-5 w-5 text-violet-700" aria-hidden="true" />
        <h1 className="text-xl font-bold text-slate-800">Sales</h1>
      </div>

      <div suppressHydrationWarning className="grid grid-cols-12 gap-4">
        {/* LEFT SECTION: FORM AND PRODUCT SELECTION */}
        <div className="col-span-12 space-y-2">
          {/* 1. Customer Section */}
          <div suppressHydrationWarning className="bg-white rounded-none p-4 border border-slate-200">
            <h3 suppressHydrationWarning className="text-xs font-bold text-slate-800 mb-2">1. Customer</h3>

            {selectedCustomer ? (
              <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-none px-3 py-2">
                <div className="flex min-w-0 items-center space-x-2">
                  <span className="w-7 h-7 rounded-full bg-emerald-500 text-white text-xs flex items-center justify-center font-medium">
                    {selectedCustomer.name.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-800">
                      {selectedCustomer.name}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {selectedCustomer.phone} · {selectedCustomer.address || "No address"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCustomer(null);
                    setCustomerName("");
                    setCustomerPhone("");
                    setCustomerAddress("");
                    setCustomerSaveError(null);
                  }}
                  className="text-slate-400 hover:text-red-500"
                  aria-label="Clear customer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-12 md:items-end">
                <div className="relative md:col-span-3">
                  <input
                    id="sales-customer-name"
                    type="text"
                    autoComplete="off"
                    aria-label="Input Name"
                    value={customerName}
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={matchingCustomers.length > 0}
                    aria-controls="sales-customer-suggestions"
                    aria-activedescendant={
                      activeCustomerSuggestion >= 0 && matchingCustomers[activeCustomerSuggestion]
                        ? `sales-customer-suggestion-${matchingCustomers[activeCustomerSuggestion].id}`
                        : undefined
                    }
                    onKeyDown={handleCustomerNameKeyDown}
                    onChange={(event) => {
                      setCustomerName(event.target.value);
                      setActiveCustomerSuggestion(-1);
                      setCustomerSaveError(null);
                    }}
                    placeholder="Input Name"
                    className="w-full border border-slate-300 bg-white px-3 py-2 text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                  {matchingCustomers.length > 0 && (
                    <div
                      id="sales-customer-suggestions"
                      role="listbox"
                      className="absolute left-0 right-0 top-full z-30 max-h-52 overflow-y-auto border border-slate-300 bg-white shadow-lg"
                    >
                      {matchingCustomers.map((customer, index) => (
                        <button
                          key={customer.id}
                          id={`sales-customer-suggestion-${customer.id}`}
                          type="button"
                          role="option"
                          aria-selected={activeCustomerSuggestion === index}
                          onClick={() => selectCustomer(customer)}
                          className={`flex w-full items-center justify-between border-b border-slate-100 px-3 py-2 text-left hover:bg-blue-100 ${activeCustomerSuggestion === index ? "bg-blue-200 hover:bg-blue-200" : ""}`}
                        >
                          <span className="text-xs font-medium text-slate-800">
                            {customer.name}
                          </span>
                          <span className="ml-3 text-[10px] text-slate-500">
                            {customer.phone}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="md:col-span-3">
                  <input
                    id="sales-customer-phone"
                    type="tel"
                    inputMode="tel"
                    aria-label="Mobile Number"
                    value={customerPhone}
                    onChange={(event) => {
                      setCustomerPhone(event.target.value);
                      setCustomerSaveError(null);
                    }}
                    placeholder="Mobile Number"
                    className="w-full border border-slate-300 bg-white px-3 py-2 text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="md:col-span-4">
                  <input
                    id="sales-customer-address"
                    type="text"
                    aria-label="Address"
                    value={customerAddress}
                    onChange={(event) => {
                      setCustomerAddress(event.target.value);
                      setCustomerSaveError(null);
                    }}
                    placeholder="Address"
                    className="w-full border border-slate-300 bg-white px-3 py-2 text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => void saveNewCustomer()}
                  disabled={
                    customerSaving ||
                    !customerName.trim() ||
                    !customerPhone.trim() ||
                    !customerAddress.trim()
                  }
                  className="h-[34px] bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 md:col-span-2"
                >
                  {customerSaving ? "Saving..." : "Save"}
                </button>

                {customerSaveError && (
                  <p role="alert" className="text-xs font-medium text-red-600 md:col-span-12">
                    {customerSaveError}
                  </p>
                )}
              </div>
            )}
            {cart.length > 0 && !selectedCustomer && (
              <p role="status" className="mt-2 text-xs font-medium text-amber-700">
                Select a customer before recording this sale.
              </p>
            )}
          </div>

          {/* 2. Product Details for Sales */}
          <div suppressHydrationWarning className="bg-white rounded-xl p-4 border border-slate-200">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <h3 suppressHydrationWarning className="flex-none text-xs font-bold text-slate-800">2. Product Details for Sales</h3>
              <div className="order-3 flex w-full flex-1 items-center justify-center sm:order-none sm:w-auto" aria-live="polite">
                <div className="flex flex-none items-center gap-2">
                  {selectedCustomer && (
                    <span className="max-w-48 truncate text-sm font-semibold text-slate-700">
                      {selectedCustomer.name}
                    </span>
                  )}
                  <span className="text-lg font-bold text-green-700">Net Pay:</span>
                  <span className="text-2xl font-bold text-green-700">₹{fmt(payable)}</span>
                </div>
              </div>
              {productTab === "scan" ? (
                <input
                  ref={scanInputRef}
                  id="sales-barcode-scan"
                  type="text"
                  inputMode="text"
                  autoComplete="off"
                  value={scanCode}
                  onChange={(event) => {
                    setScanCode(event.target.value);
                    setBarcodeNotice(null);
                    setMissingBarcode(null);
                  }}
                  onKeyDown={handleBarcodeScan}
                  placeholder="Scan or enter product barcode"
                  aria-label="Scan or enter product barcode"
                  disabled={productsLoading}
                  className="w-48 flex-none border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              ) : (
                <input
                  ref={searchInputRef}
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search product name or barcode"
                  aria-label="Search products to add"
                  className="min-w-[180px] flex-1 border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              )}
              <div className="flex items-center rounded-md border border-slate-200 p-0.5" aria-label="Product entry mode">
                <button
                  type="button"
                  onClick={() => setProductTab("scan")}
                  aria-pressed={productTab === "scan"}
                  className={`rounded px-3 py-1.5 text-xs font-semibold ${productTab === "scan" ? "bg-pink-600 text-white" : "bg-green-600 text-white hover:bg-green-700"}`}
                >
                  Scan
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setProductTab("add");
                    requestAnimationFrame(() => searchInputRef.current?.focus());
                  }}
                  aria-pressed={productTab === "add"}
                  className={`rounded px-3 py-1.5 text-xs font-semibold ${productTab === "add" ? "bg-green-600 text-white" : "bg-pink-600 text-white hover:bg-pink-700"}`}
                >
                  + Add
                </button>
              </div>
            </div>

            {productTab === "scan" ? (
              barcodeNotice && (
                <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                  <p role="status" className={missingBarcode ? "text-amber-700" : "text-slate-600"}>{barcodeNotice}</p>
                  {missingBarcode && (
                    <Link
                      href={`/products?barcode=${encodeURIComponent(missingBarcode)}&from=sales`}
                      className="rounded bg-blue-600 px-3 py-1.5 font-semibold text-white hover:bg-blue-700"
                    >
                      Add Product
                    </Link>
                  )}
                </div>
              )
            ) : (
              <div className="mb-3">
                {search.trim() && (
                  <div className="max-h-52 overflow-y-auto border border-slate-200">
                    {productsLoading ? (
                      <p className="px-3 py-2 text-xs text-slate-500">Loading products…</p>
                    ) : visibleProducts.length ? (
                      visibleProducts.map((product) => (
                        <div key={product.name} className="flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-2 last:border-0">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium text-slate-800">{product.name}</p>
                            <p className="text-[10px] text-slate-500">Sale ₹{fmt(priceInputs[product.name] ?? product.sale)}{product.barcode ? ` · ${product.barcode}` : ""}</p>
                          </div>
                          <button type="button" onClick={() => addToCart(product)} className="flex-none rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700">Add</button>
                        </div>
                      ))
                    ) : (
                      <p className="px-3 py-2 text-xs text-slate-500">No matching products.</p>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="max-h-[calc(100vh-340px)] overflow-auto border border-slate-300 scroll-smooth">
              <table className="w-full min-w-[1000px] text-left border-collapse table-fixed">
                <thead className="sticky top-0 bg-white z-10">
                  <tr className="text-[11px] text-slate-400 border-b border-slate-100">
                    <th className="border border-slate-300 bg-slate-100 px-2 py-2 font-semibold text-left text-slate-700">Product</th>
                    <th className="border border-slate-300 bg-slate-100 px-2 py-2 font-semibold text-right text-slate-700">Purchase (₹)</th>
                    <th className="border border-slate-300 bg-slate-100 px-2 py-2 font-semibold text-left text-slate-700">Barcode</th>
                    <th className="border border-slate-300 bg-slate-100 px-2 py-2 font-semibold text-right text-slate-700">MRP (₹)</th>
                    <th className="border border-slate-300 bg-slate-100 px-2 py-2 font-semibold text-right text-slate-700">Sale (₹)</th>
                    <th className="border border-slate-300 bg-slate-100 px-2 py-2 font-semibold text-center text-slate-700">Qty</th>
                    <th className="border border-slate-300 bg-slate-100 px-2 py-2 font-semibold text-left text-slate-700">Size</th>
                    <th className="border border-slate-300 bg-slate-100 px-2 py-2 font-semibold text-center text-slate-700">Delete</th>
                  </tr>
                </thead>
                <tbody className="text-xs">
                  {cart.length === 0 ? (
                    <tr><td colSpan={8} className="h-24 border border-slate-300 text-center text-slate-400">Scan a barcode or use + Add to select products.</td></tr>
                  ) : cart.map((item) => (
                    <tr key={item.name} className="border-b border-slate-200">
                      <td className="border border-slate-300 px-2 py-2 font-medium text-slate-800">{item.name}</td>
                      <td className="border border-slate-300 px-2 py-2 text-right text-slate-600">{fmt(item.purchase)}</td>
                      <td className="border border-slate-300 px-2 py-2 text-slate-600">{item.barcode || "—"}</td>
                      <td className="border border-slate-300 px-2 py-2 text-right text-slate-600">{fmt(item.mrp)}</td>
                      <td className="border border-slate-300 px-2 py-2 text-right">
                        <input aria-label={`Sale price for ${item.name}`} type="number" min="0" value={item.sale} onChange={(event) => setItemSale(item.name, event.target.value)} className="w-20 border border-slate-200 px-1 py-1 text-right" />
                      </td>
                      <td className="border border-slate-300 px-2 py-2 text-center">
                        <input aria-label={`Quantity for ${item.name}`} type="number" min="1" value={item.qty} onChange={(event) => setItemQty(item.name, event.target.value)} className="w-14 border border-slate-200 px-1 py-1 text-center" />
                      </td>
                      <td className="border border-slate-300 px-2 py-2 text-slate-600">{item.size || "—"}</td>
                      <td className="border border-slate-300 px-2 py-2 text-center"><button type="button" onClick={() => removeItem(item.name)} aria-label={`Delete ${item.name}`} className="text-red-600 hover:text-red-800"><Trash2 className="mx-auto h-4 w-4" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* RIGHT SECTION: YOUR CART & PAYMENT DETAILS */}
        <div className="hidden col-span-7 space-y-4">
          {/* Your Cart */}
          <div suppressHydrationWarning className="bg-white rounded-xl p-4 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 suppressHydrationWarning className="text-xs font-bold text-slate-800">
                Your Cart <span className="text-slate-400 font-normal">({cart.length} items)</span>
              </h3>
              <button
                type="button"
                onClick={clearCart}
                className="text-[11px] text-red-500 hover:underline flex items-center space-x-1"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear Cart</span>
              </button>
            </div>

            <table className="w-full text-left my-2 border-collapse">
              <thead>
                <tr className="bg-pink-100 text-pink-800 text-[10px] font-semibold">
                  <th className="py-2 pl-2 pr-2 text-left rounded-l-lg">Product</th>
                  <th className="py-2 px-2 text-right">MRP (₹)</th>
                  <th className="py-2 px-2 text-right">Sale (₹)</th>
                  <th className="py-2 px-2 text-center">Qty</th>
                  <th className="py-2 px-2 text-right">Total (₹)</th>
                  <th className="py-2 pl-2 pr-2 w-6 rounded-r-lg"></th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-slate-100">
                {cart.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-400">
                      Your cart is empty. Add products from the left.
                    </td>
                  </tr>
                )}
                {cart.map((item) => (
                  <tr key={item.name}>
                    <td className="py-2.5 pl-2 pr-2">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`w-6 h-6 rounded ${item.chipBg} text-[10px] flex items-center justify-center font-bold`}
                        >
                          {chip(item.name)}
                        </span>
                        <span className="font-medium text-slate-700">
                          {item.name}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-right text-slate-400">
                      {fmt(item.mrp)}
                    </td>
                    <td className="py-2.5 px-2 text-right">
                      <div className="inline-flex items-center border border-slate-200 rounded">
                        <button
                          type="button"
                          onClick={() => stepSale(item.name, -10)}
                          className="px-1.5 text-slate-400 hover:bg-slate-200 transition-colors self-stretch flex items-center"
                          aria-label="Decrease price by 10"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <input
                          type="number"
                          value={item.sale}
                          onChange={(e) =>
                            setItemSale(item.name, e.target.value)
                          }
                          className="w-14 px-1 py-0.5 text-right text-xs font-medium text-slate-700 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <button
                          type="button"
                          onClick={() => stepSale(item.name, 10)}
                          className="px-1.5 text-slate-400 hover:bg-slate-200 transition-colors self-stretch flex items-center"
                          aria-label="Increase price by 10"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <div className="inline-flex items-center border border-slate-200 rounded">
                        <button
                          type="button"
                          onClick={() => updateQty(item.name, -1)}
                          className="px-1.5 text-slate-400 hover:bg-slate-200 transition-colors self-stretch flex items-center"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <input
                          type="number"
                          value={item.qty}
                          onChange={(e) => setItemQty(item.name, e.target.value)}
                          className="w-9 px-1 py-0.5 text-center text-xs font-medium focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <button
                          type="button"
                          onClick={() => updateQty(item.name, 1)}
                          className="px-1.5 text-slate-400 hover:bg-slate-200 transition-colors self-stretch flex items-center"
                          aria-label="Increase quantity"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-right font-semibold text-slate-800">
                      {fmt(item.sale * item.qty)}
                    </td>
                    <td className="py-2.5 pl-2 pr-2 text-right">
                      <button
                        type="button"
                        onClick={() => removeItem(item.name)}
                        className="text-red-400 hover:text-red-600"
                        aria-label={`Remove ${item.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>



            <div className="space-y-2 pt-3 border-t border-slate-100 text-xs">
              <div className="flex justify-between text-slate-600 font-medium">
                <span>Subtotal ({cart.length} items)</span>
                <span className="text-slate-800 font-semibold">
                  ₹{fmt(subtotal)}
                </span>
              </div>

              <div className="space-y-1 text-slate-600 font-medium">
                <div className="flex justify-between"><span>GST ({GST_RATE}%)</span><span>₹{fmt(gstAmount)}</span></div>
                <div className="flex justify-between"><span>CGST</span><span>₹{fmt(cgstAmount)}</span></div>
                <div className="flex justify-between"><span>Total</span><span>₹{fmt(totalWithTax)}</span></div>
                <div className="flex justify-between"><span>Discount</span><span>−₹{fmt(discount)}</span></div>
              </div>

              <div className="rounded-lg p-0.5 animate-multicolor mt-2">
                <div className="bg-white rounded-[7px] px-3 py-2.5 animate-search-blink flex justify-between items-center">
                  <span className="text-base font-bold text-emerald-600">
                    Final Payable
                  </span>
                  <span className="text-2xl font-extrabold text-emerald-600">
                    ₹{fmt(payable)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Details */}
          {cart.length > 0 && (
          <div suppressHydrationWarning className="bg-white rounded-xl p-4 border border-slate-200 space-y-3">
            <h3 suppressHydrationWarning className="text-xs font-bold text-slate-800">Payment Details</h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col">
                <p className="text-[11px] text-slate-500 font-medium mb-1">
                  Amount Received
                </p>
                <div className="relative flex-1">
                  <div className="inline-flex items-center w-full border border-slate-200 rounded-lg bg-slate-50 overflow-hidden focus-within:ring-1 focus-within:ring-blue-500">
                    <button
                      type="button"
                      onClick={() => {
                        setReceived(Math.max(0, received - 10));
                        setReceivedTouched(true);
                      }}
                      className="px-2 text-slate-400 hover:bg-slate-200 transition-colors self-stretch flex items-center shrink-0"
                      aria-label="Decrease amount by 10"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <div className="flex-1 flex items-center justify-center min-w-0">
                      <span className="text-lg font-bold text-slate-400 mr-0.5">
                        ₹
                      </span>
                      <input
                        type="number"
                        value={received}
                        onChange={(e) => {
                          setReceived(Number(e.target.value));
                          setReceivedTouched(true);
                        }}
                        className="w-24 text-lg font-bold bg-transparent text-center py-1.5 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setReceived(received + 10);
                        setReceivedTouched(true);
                      }}
                      className="px-2 text-slate-400 hover:bg-slate-200 transition-colors self-stretch flex items-center shrink-0"
                      aria-label="Increase amount by 10"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-col">
                <p className="text-[11px] text-slate-500 font-medium mb-1">
                  Change
                </p>
                <div className="flex-1 flex items-center bg-emerald-50/60 border border-emerald-100 rounded-lg pl-7 pr-3 py-1.5 text-lg font-bold text-emerald-600">
                  ₹ {fmt(Math.max(0, received - payable))}
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs font-semibold text-red-600 flex items-center space-x-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={
                submitting || cart.length === 0 || !selectedCustomer || pendingPayable !== null
              }
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-xs py-2.5 rounded-lg flex items-center justify-center space-x-1.5 transition-colors"
            >
              <Check className="w-4 h-4" />
              <span>
                {submitting
                  ? "Saving..."
                  : pendingPayable !== null
                    ? "Sync previous sale first"
                    : "Submit Sale"}
              </span>
            </button>
          </div>
          )}
        </div>
      </div>

      {syncError && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800"
        >
          <div className="w-full space-y-3">
            <p>{syncError}</p>
            <OptionalSupabaseAdminSignIn
              onAuthorizationChange={setSyncAuthorized}
            />
            {pendingPayable !== null && !syncAuthorized && (
              <button
                type="button"
                onClick={() => void retryPayableSync()}
                disabled={syncingPayable}
                className="rounded-md bg-amber-700 px-3 py-1.5 text-white hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {syncingPayable ? "Syncing..." : "Retry amount sync"}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-2 shadow-[0_-4px_12px_rgba(15,23,42,0.08)] backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Net Pay</p>
              <p className="text-xl font-bold text-green-700">₹{fmt(payable)}</p>
            </div>
            <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
              <span>CGST ₹</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={cgstAmount}
                onChange={(event) => setCgstAmount(Math.max(0, Number(event.target.value) || 0))}
                disabled={submitting}
                aria-label="CGST amount in rupees"
                className="w-20 border border-slate-300 bg-white px-2 py-1.5 text-right text-sm font-semibold text-slate-800 disabled:bg-slate-100"
              />
            </label>
            <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
              <span>Received</span>
              <span className="flex items-center border border-slate-300 bg-white px-2">
                <span className="text-slate-400">₹</span>
                <input
                  type="number"
                  min="0"
                  value={received}
                  onChange={(event) => {
                    setReceived(Math.max(0, Number(event.target.value) || 0));
                    setReceivedTouched(true);
                  }}
                  aria-label="Amount received"
                  className="w-20 px-1.5 py-1.5 text-right text-sm font-semibold text-slate-800 outline-none"
                />
              </span>
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <label className={`flex items-center gap-2 text-xs font-medium ${selectedCustomer?.phone.trim() ? "text-slate-700" : "text-slate-400"}`}>
              <input
                type="checkbox"
                checked={autoSendWhatsapp}
                onChange={(event) => setAutoSendWhatsapp(event.target.checked)}
                disabled={submitting || !selectedCustomer?.phone.trim()}
                className="h-4 w-4 accent-green-600"
              />
              Auto Send WhatsApp
            </label>
            <button
              type="button"
              onClick={() => void handleSubmit(false)}
              disabled={submitting || cart.length === 0 || !selectedCustomer || pendingPayable !== null}
              className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Wallet className="h-4 w-4" />
              {submitting ? "Paying..." : "Pay"}
            </button>
            <button
              type="button"
              onClick={() => void handleSubmit(true)}
              disabled={submitting || cart.length === 0 || !selectedCustomer || pendingPayable !== null}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              Quick Pay
            </button>
            <button
              type="button"
              onClick={handlePrintReceipt}
              disabled={cart.length === 0 || !selectedCustomer}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Printer className="h-4 w-4" />
              Bill Print
            </button>
          </div>
        </div>
        {autoSendWhatsapp && (
          <p className="mt-2 text-right text-[10px] text-slate-500">
            WhatsApp opens with the receipt ready; review it and tap Send to share.
          </p>
        )}
      </div>
      <div aria-hidden="true" className="h-28" />

      {quickAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-800">
                New Add Product
              </h3>
              <button
                type="button"
                onClick={() => setQuickAddOpen(false)}
                className="text-slate-400 hover:text-slate-600"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">
                  Product Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={qaName}
                  onChange={(e) => setQaName(e.target.value)}
                  placeholder="Enter product name"
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  value={qaCategory}
                  onChange={(e) => setQaCategory(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">
                  SKU / Barcode <span className="text-slate-400 font-normal">(Auto-generated)</span>
                </label>
                <div className="flex space-x-1">
                  <input
                    type="text"
                    value={qaBarcode}
                    onChange={(e) => setQaBarcode(e.target.value)}
                    placeholder="Auto SKU"
                    className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setQaBarcode(genSku())}
                    className="px-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-[11px] font-medium text-slate-600 shrink-0"
                  >
                    Regenerate
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">
                    MRP (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={qaMrp}
                    onChange={(e) => setQaMrp(e.target.value)}
                    placeholder="MRP"
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">
                    Sale Price (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={qaSale}
                    onChange={(e) => setQaSale(e.target.value)}
                    placeholder="Sale"
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {qaError && (
              <p className="text-xs text-red-500 mt-3">{qaError}</p>
            )}

            <button
              type="button"
              onClick={handleQuickAdd}
              disabled={qaSaving}
              className="mt-4 w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold py-2 rounded-lg"
            >
              {qaSaving ? "Adding..." : "Add"}
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
}

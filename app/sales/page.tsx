"use client";

import { useCallback, useEffect, useState, useRef, type KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShoppingCart,
  UserPlus,
  Trash2,
  Wallet,
  Check,
  Minus,
  Plus,
  X,
  AlertCircle,
  Banknote,
  QrCode,
  PackagePlus,
  Keyboard,
  TrendingUp,
  Users,
  Package,
  IndianRupee,
  Pencil,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import DesktopEditSalePanel from "@/components/DesktopEditSalePanel";
import PageBackButton from "@/components/PageBackButton";
import { useToast } from "@/components/ToastProvider";
import {
  fetchProducts,
  fetchCustomers,
  createCustomer,
  submitSale,
  RUNNING_CUSTOMER_ID,
  RUNNING_CUSTOMER_NAME,
  type Product,
  type CustomerSummary,
} from "@/lib/store";
import {
  draftToCustomer,
  isLocalCustomer,
  pushLocalCustomer,
  readLocalCustomerDrafts,
  removeLocalCustomerDraft,
  saveLocalCustomerDraft,
} from "@/lib/local-customers";
import { saveProduct } from "@/lib/products";
import { resolveUnitCost } from "@/lib/cost";
import { createThermalReceiptPdf } from "@/lib/thermal-receipt-pdf";
import { sendReceiptAutomatically } from "@/lib/whatsapp-receipts";
import { CACHE_KEYS, readCache } from "@/lib/cache";
import {
  completePendingBill,
  deleteLocalPendingBill,
  deletePendingBill,
  fetchLocalPendingBills,
  fetchPendingBillSnapshot,
  isPendingBillExpired,
  markLocalPendingBillCompleted,
  PENDING_BILL_MAX_AGE_MS,
  saveLocalPendingBill,
  savePendingBill,
  type PendingBill,
} from "@/lib/pending-bills";
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

type PaymentMode = "Cash" | "UPI" | "Credit";
type ReceiptDeliveryStatus = "Automatically Sent" | "Manual Sending" | "Sent" | "Failed";
type ReceiptDelivery = {
  status: ReceiptDeliveryStatus;
  pdf: Blob | null;
  fileName: string;
  customerName: string;
  customerPhone: string;
  whatsappUrl: string;
  error?: string;
};

const PAYMENT_MODES: { label: PaymentMode; icon: typeof Banknote }[] = [
  { label: "Cash", icon: Banknote },
  { label: "UPI", icon: QrCode },
  { label: "Credit", icon: Wallet },
];

const DRAFT_KEY = "udhar_sales_draft_v1";
const INVOICE_SEQ_KEY = "udhar_sales_invoice_seq_v1";
const DRAFT_MAX_AGE_MS = PENDING_BILL_MAX_AGE_MS;
const MAX_OPEN_BILLS = 5;
const BILL_LIMIT_MESSAGE = `Maximum ${MAX_OPEN_BILLS} bills allowed at a time. Close a bill to create another.`;

type SalesDraft = {
  cart: CartItem[];
  customerId: string | null;
  paymentMode: PaymentMode;
  invoiceNo: string | null;
  updatedAt: number;
};

type TodayStats = {
  bills: number;
  items: number;
  amount: number;
  profit: number;
};

/** Unique id for one customer billing session. */
function makeBillId(): string {
  return `bill_${globalThis.crypto.randomUUID()}`;
}

function toDayKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Bill number per day: KB-YYYYMMDD-001 */
function makeInvoiceNo(): string {
  const day = toDayKey().replace(/-/g, "");
  let seq = 1;
  try {
    const raw = JSON.parse(localStorage.getItem(INVOICE_SEQ_KEY) ?? "null") as
      | { day?: string; seq?: number }
      | null;
    if (raw && raw.day === day) seq = Math.max(1, Number(raw.seq ?? 0) + 1);
    localStorage.setItem(INVOICE_SEQ_KEY, JSON.stringify({ day, seq }));
  } catch {
    // storage blocked - bill number is still usable without persistence
  }
  return `KB-${day}-${String(seq).padStart(3, "0")}`;
}

function readDraft(): SalesDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as SalesDraft;
    if (!Array.isArray(draft.cart) || draft.cart.length === 0) return null;
    if (!draft.updatedAt || Date.now() - draft.updatedAt > DRAFT_MAX_AGE_MS) {
      localStorage.removeItem(DRAFT_KEY);
      return null;
    }
    return {
      cart: draft.cart,
      customerId: draft.customerId ?? null,
      paymentMode: (PAYMENT_MODES.some((m) => m.label === draft.paymentMode)
        ? draft.paymentMode
        : "Cash") as PaymentMode,
      invoiceNo: draft.invoiceNo ?? null,
      updatedAt: draft.updatedAt,
    };
  } catch {
    return null;
  }
}

function writeDraft(draft: SalesDraft | null) {
  if (typeof window === "undefined") return;
  try {
    if (!draft || draft.cart.length === 0) localStorage.removeItem(DRAFT_KEY);
    else localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // storage full or blocked - the bill still works in memory
  }
}

export default function AddSalePage() {
  const { showToast, confirmAction } = useToast();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [activeProductSuggestion, setActiveProductSuggestion] = useState(-1);
  const [selectedCustomer, setSelectedCustomer] =
    useState<CustomerSummary | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [activeCustomerSuggestion, setActiveCustomerSuggestion] = useState(-1);
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerSaveError, setCustomerSaveError] = useState<string | null>(null);
  const [customerFormOpen, setCustomerFormOpen] = useState(false);
  const [priceInputs, setPriceInputs] = useState<Record<string, number>>({});
  const [cgstAmount, setCgstAmount] = useState(0);
  const [received, setReceived] = useState(0);
  const [receivedTouched, setReceivedTouched] = useState(false);
  const [autoSendWhatsapp, setAutoSendWhatsapp] = useState(true);
  const [receiptDelivery, setReceiptDelivery] = useState<ReceiptDelivery | null>(null);
  const [submitting, setSubmitting] = useState(false);
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
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("Cash");
  const [upiDialogOpen, setUpiDialogOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [receivedDialogOpen, setReceivedDialogOpen] = useState(false);
  const [receivedInput, setReceivedInput] = useState("");
  const [upiQrCode, setUpiQrCode] = useState<string | null>(null);
  const [upiQrError, setUpiQrError] = useState<string | null>(null);
  const [invoiceNo, setInvoiceNo] = useState<string | null>(null);
  const [todayStats, setTodayStats] = useState<TodayStats | null>(null);
  const [customersLoaded, setCustomersLoaded] = useState(false);
  const [restoredCustomerId, setRestoredCustomerId] = useState<string | null>(null);
  const [billTabs, setBillTabs] = useState<PendingBill[]>([]);
  const [closedBillTabIds, setClosedBillTabIds] = useState<string[]>([]);
  const [activeBillId, setActiveBillId] = useState<string | null>(null);
  const [pendingBillsLoaded, setPendingBillsLoaded] = useState(false);
  const [isAddingBill, setIsAddingBill] = useState(false);
  const [editingBillId, setEditingBillId] = useState<string | null>(null);
  const [editSaleTabActive, setEditSaleTabActive] = useState(false);
  const [pendingAction, setPendingAction] = useState(false);
  const suppressPendingSaveRef = useRef(false);
  const activeBillIdRef = useRef<string | null>(null);
  const sessionTouchedRef = useRef(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const submitRef = useRef<((quickPay?: boolean) => void) | null>(null);

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

            if (match && activeBillIdRef.current) {
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
        if (!active) return;
        // Device-only customers (saved here, not yet in Firebase) belong at the top.
        setCustomers([...readLocalCustomerDrafts().map(draftToCustomer), ...c]);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setCustomersLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    let refreshGeneration = 0;
    const refreshProducts = () => {
      const generation = ++refreshGeneration;
      fetchProducts()
        .then((products) => {
          if (!active || generation !== refreshGeneration) return;
          setProducts(products);
          setPriceInputs((current) =>
            Object.fromEntries(
              products.map((product) => [
                product.name,
                current[product.name] ?? product.sale,
              ])
            )
          );
        })
        .catch((loadError: Error) => {
          if (active && generation === refreshGeneration) {
            setError(`Failed to load products: ${loadError.message}`);
          }
        });
    };

    window.addEventListener("udhar:refresh", refreshProducts);
    return () => {
      active = false;
      window.removeEventListener("udhar:refresh", refreshProducts);
    };
  }, []);

  const resetSession = useCallback(() => {
    activeBillIdRef.current = null;
    setActiveBillId(null);
    setCart([]);
    setSelectedCustomer(null);
    setCustomerName("");
    setCustomerPhone("");
    setCustomerAddress("");
    setCustomerSaveError(null);
    setInvoiceNo(null);
    setPaymentMode("Cash");
    setCgstAmount(0);
    setReceived(0);
    setReceivedTouched(false);
    writeDraft(null);
    setBillTabs([]);
    setIsAddingBill(false);
    setEditingBillId(null);
  }, []);

  // Keep a ref copy so async restores never work from stale state.
  useEffect(() => {
    activeBillIdRef.current = activeBillId;
  }, [activeBillId]);

  // Restore saved billing sessions. The device copy is applied first so the tabs
  // appear instantly after a refresh; Firebase (the shared source) is merged after.
  useEffect(() => {
    let active = true;
    const merged = new Map<string, PendingBill>();

    const applyBill = (bill: PendingBill) => {
      setActiveBillId(bill.id);
      activeBillIdRef.current = bill.id;
      setCart(bill.items || []);
      const billCustomer =
        bill.customer?.name?.trim().toLowerCase() === "kherwal bazaar"
          ? null
          : bill.customer || null;
      setSelectedCustomer(billCustomer);
      setCustomerName(bill.name || billCustomer?.name || "");
      setCustomerPhone(bill.mobile || billCustomer?.phone || "");
      setCustomerAddress(bill.address || billCustomer?.address || "");
      setCustomerSaveError(null);
      setInvoiceNo(bill.invoiceNo || null);
      setPaymentMode((PAYMENT_MODES.some((mode) => mode.label === bill.paymentMode)
        ? bill.paymentMode
        : "Cash") as PaymentMode);
      setCgstAmount(bill.cgstAmount ?? 0);
      setReceived(bill.received ?? 0);
      setReceivedTouched(Boolean(bill.receivedTouched));
    };
    const sorted = () => [...merged.values()].sort((a, b) => b.updatedAt - a.updatedAt);
    const publish = () => {
      const all = sorted();
      let idx = 1;
      for (const b of all) {
        if (!b.title) {
          b.title = b.isSaved && b.name ? b.name : `Bill ${idx}`;
        }
        idx++;
      }
      setBillTabs(all);
    };

    for (const localBill of fetchLocalPendingBills()) {
      if (!isPendingBillExpired(localBill)) {
        if (localBill.customer?.name?.trim().toLowerCase() === "kherwal bazaar") {
          localBill.customer = null;
          localBill.name = "";
          localBill.isSaved = false;
          saveLocalPendingBill(localBill);
        }
        if (localBill.isSaved && localBill.name) {
          merged.set(localBill.id, localBill);
        }
      }
    }
    const savedLocal = sorted().filter((b) => b.isSaved && b.name);
    if (savedLocal.length) {
      setBillTabs(savedLocal);
      if (!activeBillIdRef.current) applyBill(savedLocal[0]);
    } else {
      setBillTabs([]);
      setActiveBillId(null);
      activeBillIdRef.current = null;
    }

    fetchPendingBillSnapshot()
      .then(({ bills, completedIds }) => {
        if (!active) return;
        const finished = new Set(completedIds);
        for (const id of finished) {
          merged.delete(id);
          deleteLocalPendingBill(id);
        }
        for (const bill of bills) {
          if (isPendingBillExpired(bill)) continue;
          if (bill.customer?.name?.trim().toLowerCase() === "kherwal bazaar") {
            bill.customer = null;
            bill.name = "";
            bill.isSaved = false;
          }
          if (bill.isSaved && bill.name) {
            const local = merged.get(bill.id);
            if (local && local.updatedAt > bill.updatedAt) {
              void savePendingBill(local).catch(() => {});
            } else {
              merged.set(bill.id, bill);
            }
          }
        }
        const savedAll = sorted().filter((b) => b.isSaved && b.name);
        if (savedAll.length === 0) {
          setBillTabs([]);
          setActiveBillId(null);
          activeBillIdRef.current = null;
        } else {
          setBillTabs(savedAll);
          if (activeBillIdRef.current) {
            const currentBill = savedAll.find((b) => b.id === activeBillIdRef.current);
            if (currentBill) applyBill(currentBill);
            else applyBill(savedAll[0]);
          } else {
            applyBill(savedAll[0]);
          }
        }
      })
      .catch((loadError) => {
        if (!active || !merged.size) return;
        showToast("warning", `Could not reach Firebase; using the pending bills saved on this device. ${loadError instanceof Error ? loadError.message : "Database error"}`);
      })
      .finally(() => {
        if (active) setPendingBillsLoaded(true);
      });

    return () => { active = false; };
  }, [showToast]);

  // Reset all pending bills and active drafts after 20 minutes of inactivity
  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      const currentActiveId = activeBillIdRef.current;

      // 1. Check if the active draft has exceeded 20 minutes
      const rawDraft = typeof window !== "undefined" ? localStorage.getItem(DRAFT_KEY) : null;
      if (rawDraft) {
        try {
          const parsed = JSON.parse(rawDraft) as { updatedAt?: number };
          if (parsed?.updatedAt && now - parsed.updatedAt > DRAFT_MAX_AGE_MS) {
            localStorage.removeItem(DRAFT_KEY);
            if (currentActiveId) {
              void deletePendingBill(currentActiveId).catch(() => {});
              deleteLocalPendingBill(currentActiveId);
            }
            resetSession();
            showToast("info", "Bill was reset after 20 minutes of inactivity.");
          }
        } catch {}
      }

      // 2. Remove any expired pending bills from state, device storage, and Firebase
      setBillTabs((current) => {
        let changed = false;
        const valid: PendingBill[] = [];
        for (const bill of current) {
          if (isPendingBillExpired(bill)) {
            changed = true;
            void deletePendingBill(bill.id).catch(() => {});
            deleteLocalPendingBill(bill.id);
            if (bill.id === currentActiveId) {
              resetSession();
              showToast("info", "Pending bill was reset after 20 minutes.");
            }
          } else {
            valid.push(bill);
          }
        }
        return changed ? valid : current;
      });
    }, 10000);

    return () => window.clearInterval(timer);
  }, [resetSession, showToast]);

  // Persist the active tab after edits. The device copy is written immediately so
  // a refresh or crash never loses the bill; Firebase follows once the saved
  // sessions are merged (never overwriting newer data from another device).
  useEffect(() => {
    if (!activeBillId || suppressPendingSaveRef.current) return;
    const currentTab = billTabs.find((b) => b.id === activeBillId);
    // Never invent a pending bill for a tab that was removed or is still loading.
    if (!currentTab) return;
    const isSaved = Boolean(currentTab.isSaved);
    const name = isSaved
      ? (currentTab?.name || selectedCustomer?.name || customerName.trim())
      : customerName.trim();
    const mobile = isSaved
      ? (currentTab?.mobile || selectedCustomer?.phone || customerPhone.trim())
      : customerPhone.trim();
    const address = isSaved
      ? (currentTab?.address || selectedCustomer?.address || customerAddress.trim())
      : customerAddress.trim();
    const currentTitle = isSaved && name ? name : (currentTab?.title || "Bill 1");
    const bill: PendingBill = {
      id: activeBillId,
      name,
      mobile,
      address,
      isSaved,
      title: currentTitle,
      customer: selectedCustomer,
      items: cart,
      invoiceNo,
      paymentMode,
      cgstAmount,
      received,
      receivedTouched,
      updatedAt: Date.now(),
      status: "PENDING",
    };
    saveLocalPendingBill(bill);
    setBillTabs((current) =>
      current.some((entry) => entry.id === bill.id)
        ? current.map((entry) => (entry.id === bill.id ? bill : entry))
        : [...current, bill]
    );
    if (!pendingBillsLoaded) return;
    const timer = window.setTimeout(() => {
      void savePendingBill(bill).catch((saveError) => {
        showToast("error", `Pending bill could not be saved: ${saveError instanceof Error ? saveError.message : "Database error"}`);
      });
    }, 450);
    return () => window.clearTimeout(timer);
  }, [pendingBillsLoaded, activeBillId, cart, selectedCustomer, customerName, customerPhone, customerAddress, invoiceNo, paymentMode, cgstAmount, received, receivedTouched, showToast]);

  // Attach the customer of a restored bill once the customer list arrives
  useEffect(() => {
    if (!customersLoaded || !restoredCustomerId || selectedCustomer) return;
    const match = customers.find((customer) => customer.id === restoredCustomerId);
    if (match && match.name?.trim().toLowerCase() !== "kherwal bazaar") {
      setSelectedCustomer(match);
    }
    setRestoredCustomerId(null);
  }, [customers, customersLoaded, restoredCustomerId, selectedCustomer]);

  // Keep the in-progress bill saved on this device so nothing is lost on refresh
  useEffect(() => {
    if (cart.length === 0) return;
    writeDraft({
      cart,
      customerId: selectedCustomer?.id ?? null,
      paymentMode,
      invoiceNo,
      updatedAt: Date.now(),
    });
  }, [cart, invoiceNo, paymentMode, selectedCustomer]);

  // Today's numbers straight from the cached sales, no extra network call
  useEffect(() => {
    if (productsLoading) return;
    const raw =
      readCache<Record<string, Record<string, unknown>>>(CACHE_KEYS.SALES) ?? {};
    const day = toDayKey();
    const bills = new Set<number>();
    let items = 0;
    let amount = 0;
    let profit = 0;
    for (const row of Object.values(raw)) {
      if (!row || String(row.date ?? "") !== day) continue;
      const qty = Math.max(1, Number(row.quantity ?? 1) || 1);
      const sale = Number(row.sale ?? 0);
      const mrp = Number(row.mrp ?? 0);
      const product = products.find((p) => p.name === String(row.productName ?? ""));
      const cost = resolveUnitCost(
        String(row.productName ?? ""),
        mrp,
        product?.purchase
      );
      items += qty;
      amount += sale;
      profit += sale - cost * qty;
      if (row.createdAt) bills.add(Number(row.createdAt));
    }
    setTodayStats({ bills: bills.size, items, amount, profit });
  }, [products, productsLoading]);

  useEffect(() => {
    if (!productsLoading && activeBillId && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [productsLoading, activeBillId]);

  const subtotal = cart.reduce((sum, item) => sum + item.sale * item.qty, 0);
  const isRunningCustomer = selectedCustomer?.id === RUNNING_CUSTOMER_ID;
  const gstAmount = Number((subtotal * GST_RATE / 100).toFixed(2));
  const discount = Number((gstAmount + cgstAmount).toFixed(2));
  const totalWithTax = subtotal + gstAmount + cgstAmount;
  const payable = Math.ceil(Math.max(0, Number((totalWithTax - discount).toFixed(2))));
  const upiPaymentAmount = paymentMode === "UPI" && receivedTouched && received > 0
    ? Math.min(received, payable)
    : payable;

  useEffect(() => {
    if (!receivedTouched) setReceived(selectedCustomer ? 0 : payable);
  }, [payable, receivedTouched, selectedCustomer]);

  useEffect(() => {
    if (!upiDialogOpen) return;
    let active = true;
    setUpiQrCode(null);
    setUpiQrError(null);
    const upiId = process.env.NEXT_PUBLIC_UPI_ID?.trim();
    if (!upiId) {
      setUpiQrError("UPI payments are not configured. Add NEXT_PUBLIC_UPI_ID to enable QR payments.");
      return () => { active = false; };
    }
    if (payable <= 0) {
      setUpiQrError("Add products to this bill to create a payment QR code.");
      return () => { active = false; };
    }
    const params = new URLSearchParams({
      pa: upiId,
      pn: process.env.NEXT_PUBLIC_UPI_NAME?.trim() || "KHERWAL BAZAAR",
      am: upiPaymentAmount.toFixed(2),
      cu: "INR",
      tn: invoiceNo ? `Bill ${invoiceNo}` : "Kherwal Bazaar sale",
    });
    QRCode.toDataURL(`upi://pay?${params.toString()}`, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 512,
    }).then((code) => {
      if (active) setUpiQrCode(code);
    }).catch((qrError: unknown) => {
      if (active) setUpiQrError(qrError instanceof Error ? qrError.message : "Could not create the UPI QR code.");
    });
    return () => { active = false; };
  }, [upiDialogOpen, upiPaymentAmount, invoiceNo]);

  const addToCart = (product: Product) => {
    sessionTouchedRef.current = true;
    if (!activeBillIdRef.current) {
      showToast("warning", "Select Running Customer or create a bill before adding products.");
      return;
    }
    if (!invoiceNo) setInvoiceNo(makeInvoiceNo());
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

  const handleProductKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const q = search.trim().toLowerCase();

    if (event.key === "ArrowDown") {
      if (!visibleProducts.length) return;
      event.preventDefault();
      setActiveProductSuggestion((curr) =>
        curr < 0 ? 0 : (curr + 1) % visibleProducts.length
      );
      return;
    }

    if (event.key === "ArrowUp") {
      if (!visibleProducts.length) return;
      event.preventDefault();
      setActiveProductSuggestion((curr) =>
        curr <= 0 ? visibleProducts.length - 1 : curr - 1
      );
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      if (!q) return;

      // 1. Check if the query is an exact barcode match
      const exactBarcodeProduct = products.find(
        (item) => item.barcode?.trim().toLowerCase() === q
      );
      if (exactBarcodeProduct) {
        addToCart(exactBarcodeProduct);
        setSearch("");
        setActiveProductSuggestion(-1);
        setBarcodeNotice(null);
        setMissingBarcode(null);
        requestAnimationFrame(() => searchInputRef.current?.focus());
        return;
      }

      // 2. If the user highlighted a product with arrow keys
      if (activeProductSuggestion >= 0 && activeProductSuggestion < visibleProducts.length) {
        addToCart(visibleProducts[activeProductSuggestion]);
        setSearch("");
        setActiveProductSuggestion(-1);
        setBarcodeNotice(null);
        setMissingBarcode(null);
        requestAnimationFrame(() => searchInputRef.current?.focus());
        return;
      }

      // 3. If there are visible products matching the query, add the top match
      if (visibleProducts.length > 0) {
        addToCart(visibleProducts[0]);
        setSearch("");
        setActiveProductSuggestion(-1);
        setBarcodeNotice(null);
        setMissingBarcode(null);
        requestAnimationFrame(() => searchInputRef.current?.focus());
        return;
      }

      // 4. No product matched this barcode / search text
      const missingCode = search.trim();
      setBarcodeNotice(`No product found for “${missingCode}”.`);
      setMissingBarcode(missingCode);
      setSearch("");
      setActiveProductSuggestion(-1);
      requestAnimationFrame(() => searchInputRef.current?.focus());
      return;
    }

    if (event.key === "Escape") {
      if (search) {
        event.preventDefault();
        setSearch("");
        setActiveProductSuggestion(-1);
        setBarcodeNotice(null);
      }
    }
  };

  const handleStartAddBill = () => {
    setEditSaleTabActive(false);
    if (billTabs.length >= MAX_OPEN_BILLS) {
      showToast("warning", BILL_LIMIT_MESSAGE);
      return;
    }
    setEditingBillId(null);
    setCustomerName("");
    setCustomerPhone("");
    setCustomerAddress("");
    setCustomerSaveError(null);
    setIsAddingBill(true);
  };

  const handleStartRunningCustomerBill = () => {
    setEditSaleTabActive(false);
    if (billTabs.length >= MAX_OPEN_BILLS) {
      showToast("warning", BILL_LIMIT_MESSAGE);
      return;
    }

    const customer: CustomerSummary = {
      id: RUNNING_CUSTOMER_ID,
      name: RUNNING_CUSTOMER_NAME,
      phone: "",
      address: "",
      totalAmount: 0,
    };
    const nextNum = billTabs.reduce((max, bill) => {
      const match = bill.title?.match(/Bill\s*(\d+)/i);
      return match ? Math.max(max, parseInt(match[1], 10)) : max;
    }, 0) + 1;
    const newBill: PendingBill = {
      id: makeBillId(),
      name: RUNNING_CUSTOMER_NAME,
      mobile: "",
      address: "",
      isSaved: true,
      title: `Bill ${nextNum} (${RUNNING_CUSTOMER_NAME})`,
      customer,
      items: [],
      invoiceNo: null,
      paymentMode: "Cash",
      cgstAmount: 0,
      received: 0,
      receivedTouched: false,
      updatedAt: Date.now(),
      status: "PENDING",
    };

    saveLocalPendingBill(newBill);
    void savePendingBill(newBill).catch((saveError) => {
      showToast(
        "error",
        `Pending bill could not be saved: ${saveError instanceof Error ? saveError.message : "Database error"}`
      );
    });
    setBillTabs((current) => [...current, newBill]);
    activeBillIdRef.current = newBill.id;
    setActiveBillId(newBill.id);
    setCart([]);
    setSelectedCustomer(customer);
    setCustomerName(RUNNING_CUSTOMER_NAME);
    setCustomerPhone("");
    setCustomerAddress("");
    setCustomerSaveError(null);
    setInvoiceNo(null);
    setPaymentMode("Cash");
    setCgstAmount(0);
    setReceived(0);
    setReceivedTouched(false);
    setReceiptDelivery(null);
    setIsAddingBill(false);
    setEditingBillId(null);
    requestAnimationFrame(() => searchInputRef.current?.focus());
  };

  const handleCancelAddBill = () => {
    setIsAddingBill(false);
    setEditingBillId(null);
    setCustomerName("");
    setCustomerPhone("");
    setCustomerAddress("");
    setCustomerSaveError(null);
  };

  const handleEditCustomer = (billId: string) => {
    const target = billTabs.find((b) => b.id === billId);
    if (!target) return;
    setEditingBillId(billId);
    setCustomerName(target.name || target.customer?.name || "");
    setCustomerPhone(target.mobile || target.customer?.phone || "");
    setCustomerAddress(target.address || target.customer?.address || "");
    setCustomerSaveError(null);
    setIsAddingBill(true);
  };

  const selectCustomer = (customer: CustomerSummary) => {
    sessionTouchedRef.current = true;
    setCustomerName(customer.name);
    setCustomerPhone(customer.phone);
    setCustomerAddress(customer.address || "");
    setActiveCustomerSuggestion(-1);
    setCustomerSaveError(null);

    if (editingBillId) {
      const targetBill = billTabs.find((b) => b.id === editingBillId);
      const billNumMatch = targetBill?.title?.match(/Bill\s*(\d+)/i);
      const billNum = billNumMatch ? billNumMatch[1] : "1";
      const title = `Bill ${billNum} (${customer.name})`;

      setBillTabs((prev) =>
        prev.map((b) =>
          b.id === editingBillId
            ? {
                ...b,
                name: customer.name,
                mobile: customer.phone,
                address: customer.address || "",
                customer,
                title,
                isSaved: true,
                updatedAt: Date.now(),
              }
            : b
        )
      );
      if (activeBillIdRef.current === editingBillId) {
        setSelectedCustomer(customer);
      }
      setIsAddingBill(false);
      setEditingBillId(null);
      showToast("success", "Customer details updated.");
      requestAnimationFrame(() => searchInputRef.current?.focus());
      return;
    }

    // Creating a new bill with this customer
    if (billTabs.length >= MAX_OPEN_BILLS) {
      showToast("warning", BILL_LIMIT_MESSAGE);
      setIsAddingBill(false);
      setEditingBillId(null);
      return;
    }
    const nextNum = billTabs.reduce((max, b) => {
      const match = b.title?.match(/Bill\s*(\d+)/i);
      return match ? Math.max(max, parseInt(match[1], 10)) : max;
    }, 0) + 1;

    const newId = makeBillId();
    const title = `Bill ${nextNum} (${customer.name})`;
    const newBill: PendingBill = {
      id: newId,
      name: customer.name,
      mobile: customer.phone,
      address: customer.address || "",
      isSaved: true,
      title,
      customer,
      items: [],
      invoiceNo: null,
      paymentMode: "Cash",
      cgstAmount: 0,
      received: 0,
      receivedTouched: false,
      updatedAt: Date.now(),
      status: "PENDING",
    };

    saveLocalPendingBill(newBill);
    void savePendingBill(newBill).catch(() => {});

    setBillTabs((prev) => [...prev, newBill]);
    activeBillIdRef.current = newId;
    setActiveBillId(newId);
    setCart([]);
    setSelectedCustomer(customer);
    setInvoiceNo(null);
    setPaymentMode("Cash");
    setCgstAmount(0);
    setReceived(0);
    setReceivedTouched(false);
    setIsAddingBill(false);
    setEditingBillId(null);
    showToast("success", `Created ${title}`);
    requestAnimationFrame(() => searchInputRef.current?.focus());
  };

  const saveNewCustomer = () => {
    const name = customerName.trim();
    const address = customerAddress.trim();
    const phoneDigits = customerPhone.replace(/\D/g, "").slice(0, 10);
    if (!name || !phoneDigits) {
      setCustomerSaveError("Enter the customer name and mobile number.");
      return;
    }
    if (phoneDigits.length !== 10) {
      setCustomerSaveError("Mobile number must be exactly 10 digits.");
      return;
    }

    const existing = customers.find(
      (customer) =>
        customer.name.trim().toLowerCase() === name.toLowerCase() ||
        customer.phone.replace(/\D/g, "") === phoneDigits
    );
    if (existing) {
      selectCustomer(existing);
      showToast("info", "Using the existing customer profile.");
      return;
    }

    // Keep the new customer on this device. It is written to Firebase only when
    // the bill is completed, so a wrong entry never reaches the shared database.
    const draft = saveLocalCustomerDraft({ name, phone: phoneDigits, address });
    const customer = draftToCustomer(draft);
    setCustomers((current) => [customer, ...current]);
    setCustomerSaveError(null);
    selectCustomer(customer);
    showToast("success", "Customer saved on this device. It will sync when the bill is completed.");
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
      showToast("success", `${name} added to products and this bill.`);
    } catch (e) {
      setQaError(e instanceof Error ? e.message : "Failed to save product.");
    } finally {
      setQaSaving(false);
    }
  };

  const updateQty = (name: string, delta: number) => {
    sessionTouchedRef.current = true;
    setCart((prev) =>
      prev
        .map((i) => (i.name === name ? { ...i, qty: i.qty + delta } : i))
        .filter((i) => i.qty > 0)
    );
  };

  const setItemSale = (name: string, value: string) => {
    sessionTouchedRef.current = true;
    setCart((prev) =>
      prev.map((i) =>
        i.name === name ? { ...i, sale: Math.max(0, Number(value) || 0) } : i
      )
    );
  };

  const stepSale = (name: string, delta: number) => {
    sessionTouchedRef.current = true;
    setCart((prev) =>
      prev.map((i) =>
        i.name === name ? { ...i, sale: Math.max(0, i.sale + delta) } : i
      )
    );
  };

  const setItemQty = (name: string, value: string) => {
    sessionTouchedRef.current = true;
    setCart((prev) =>
      prev.map((i) =>
        i.name === name
          ? { ...i, qty: Math.max(1, Math.floor(Number(value) || 1)) }
          : i
      )
    );
  };

  const removeItem = (name: string) => {
    sessionTouchedRef.current = true;
    setCart((prev) => prev.filter((i) => i.name !== name));
  };

  // Drop a device-only customer once no saved bill refers to it any more.
  const discardUnusedLocalCustomer = (
    customer: CustomerSummary | null,
    remaining: PendingBill[]
  ) => {
    if (!customer || !isLocalCustomer(customer.id)) return;
    if (remaining.some((bill) => bill.customer?.id === customer.id)) return;
    removeLocalCustomerDraft(customer.id);
    setCustomers((current) => current.filter((entry) => entry.id !== customer.id));
  };

  const clearCart = async () => {
    const confirmed = await confirmAction({
      title: "Clear this bill?",
      message:
        "All products in this bill will be removed and the bill tab will close. This cannot be undone.",
      confirmLabel: "Clear bill",
      cancelLabel: "Keep bill",
      tone: "danger",
    });
    if (!confirmed) return;

    sessionTouchedRef.current = true;
    writeDraft(null);
    const id = activeBillIdRef.current;
    if (!id) {
      setCart([]);
      setInvoiceNo(null);
      return;
    }
    // Deleting the tab resets (or switches away from) the active bill, so the
    // cleared bill cannot be re-saved later by the pending bill autosave.
    await handleRemoveBillTab(id);
  };

  const handlePrintReceipt = async (preopenedWindow?: Window | null) => {
    if (cart.length === 0) return;
    if (!selectedCustomer) {
      showToast("warning", "Add customer details before printing the bill.");
      return;
    }
    if (payable <= 0) {
      showToast("warning", "The bill total must be greater than zero to make a payment QR.");
      return;
    }
    const printWindow = preopenedWindow === undefined
      ? window.open("", "_blank", "width=480,height=640")
      : preopenedWindow;
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
        am: upiPaymentAmount.toFixed(2),
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
        <tr><td class="bold">${escapeHtml(item.name)}</td><td class="right">${item.qty}</td><td class="right">${item.sale.toFixed(2)}</td><td class="right">${(item.sale * item.qty).toFixed(2)}</td></tr>
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
        .header-red th{color:#dc2626;font-weight:bold}
        .bold{font-weight:bold}
        .center{text-align:center}.right{text-align:right;white-space:nowrap}
        .summary{margin-top:2mm}.summary div{display:flex;justify-content:space-between;padding:.8mm 0}
        .total{margin-top:1mm;padding-top:1.5mm;border-top:1px solid #000;font-size:14px;font-weight:800;color:#dc2626}
        .payment{margin-top:4mm;padding-top:3mm;border-top:1px dashed #555;text-align:center}
        .payment img{display:block;width:46mm;height:46mm;margin:2mm auto;image-rendering:pixelated}
        .note{font-size:9px;line-height:1.4}.unconfigured{margin-top:3mm;font-size:9px}
        </style></head><body><h1>KHERWAL BAZAAR</h1><div class="subtitle">Sales Bill</div><p class="meta">${invoiceNo ? `<strong>Bill No:</strong> ${escapeHtml(invoiceNo)}<br>` : ""}<strong>Customer:</strong> ${escapeHtml(selectedCustomer.name)}<br><strong>Mobile:</strong> ${escapeHtml(selectedCustomer.phone)}<br><strong>Date:</strong> ${escapeHtml(new Date().toLocaleString("en-IN"))}<br><strong>Payment:</strong> ${escapeHtml(paymentMode)}</p><table><thead><tr class="header-red"><th>Item</th><th class="right">Quantity</th><th class="right">Unit Price</th><th class="right">Total</th></tr></thead><tbody>${rows}</tbody></table><div class="summary"><div><span>Product Amount</span><span>₹${fmt(subtotal)}</span></div><div><span>GST (${GST_RATE}%)</span><span>₹${fmt(gstAmount)}</span></div><div><span>Total</span><span>₹${fmt(totalWithTax)}</span></div><div><span>Discount</span><span>−₹${fmt(discount)}</span></div><div class="total"><span>NET PAY</span><span>INR ${fmt(payable)}</span></div><div><span>Received</span><span>₹${fmt(received)}</span></div><div><span>Balance</span><span>₹${fmt(Math.max(0, payable - received))}</span></div></div>${qrCode ? `<div class="payment"><strong>Scan to Pay ₹${fmt(upiPaymentAmount)}</strong><img src="${qrCode}" alt="UPI payment QR code"><div class="note">UPI ID: ${escapeHtml(upiId!)}<br>Thank you for shopping with us!</div></div>` : `<div class="payment unconfigured">UPI QR is unavailable. Configure NEXT_PUBLIC_UPI_ID to print payment QR codes.</div>`}</body></html>`);
      printWindow.document.close();
    } catch (printError) {
      printWindow.close();
      showToast("error", printError instanceof Error ? printError.message : "Could not generate the thermal bill.");
    }
  };

  const downloadReceiptPdf = (pdf: Blob, fileName: string) => {
    const objectUrl = URL.createObjectURL(pdf);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  };

  const handleSubmit = async (
    quickPay = false,
    printAfterSubmit = false,
    preopenedPrintWindow?: Window | null,
    redirectToKhata = false,
    paymentModeOverride?: PaymentMode,
  ) => {
    if (submitting) return;
    if (!isRunningCustomer && !selectedCustomer && (!customerName.trim() || customerPhone.replace(/\D/g, "").length !== 10)) {
      setError("Enter the customer name and a valid 10-digit mobile number before checkout.");
      return;
    }
    if (cart.length === 0) return;
    const salePaymentMode = paymentModeOverride ?? paymentMode;
    const finalPayable = Number(payable.toFixed(2));
    if (finalPayable <= 0) {
      setError("Final payable must be greater than zero to sync with the QR amount.");
      return;
    }

    // Open a blank tab directly from the checkout click so browsers do not
    // block the later redirect while Firebase saves the sale.
    const whatsappWindow = autoSendWhatsapp && !isRunningCustomer
      ? window.open("about:blank", "_blank")
      : null;

    // A customer saved on this device is written to Firebase together with the
    // bill, so the shared customer list only gets customers that really bought.
    let saleCustomer: CustomerSummary;
    if (selectedCustomer) {
      saleCustomer = selectedCustomer;
    } else {
      const name = customerName.trim();
      const phone = customerPhone.replace(/\D/g, "").slice(0, 10);
      const existingCustomer = customers.find(
        (entry) => entry.name.trim().toLowerCase() === name.toLowerCase() && entry.phone.replace(/\D/g, "") === phone
      );
      try {
        const checkoutCustomer = existingCustomer ?? await createCustomer({
          name,
          phone,
          address: customerAddress.trim(),
        });
        saleCustomer = checkoutCustomer;
        setSelectedCustomer(checkoutCustomer);
        setCustomers((current) => [checkoutCustomer, ...current.filter((entry) => entry.id !== checkoutCustomer.id)]);
      } catch (customerError) {
        setError(`Customer could not be saved to Firebase: ${customerError instanceof Error ? customerError.message : "Database error"}`);
        return;
      }
    }
    if (isLocalCustomer(saleCustomer.id)) {
      try {
        const localCustomerId = saleCustomer.id;
        saleCustomer = await pushLocalCustomer(saleCustomer);
        setSelectedCustomer(saleCustomer);
        setCustomers((current) => [
          saleCustomer,
          ...current.filter(
            (entry) => entry.id !== localCustomerId && entry.id !== saleCustomer.id
          ),
        ]);
      } catch (customerError) {
        setError(
          `Customer could not be saved to Firebase: ${customerError instanceof Error ? customerError.message : "Database error"}`
        );
        return;
      }
    }

    const receivedAmount = quickPay ? finalPayable : received;
    if (quickPay) {
      setReceived(receivedAmount);
      setReceivedTouched(true);
    }
    setSubmitting(true);
    setError(null);
    try {
      await submitSale({
        items: cart.map((i) => ({
          name: i.name,
          mrp: i.mrp,
          sale: i.sale,
          qty: i.qty,
        })),
        saleType: salePaymentMode === "Credit" || selectedCustomer ? "credit" : "cash",
        customer: saleCustomer,
        received: receivedAmount,
        paymentMethod: salePaymentMode,
        invoiceNo: invoiceNo ?? undefined,
        idempotencyKey: activeBillId ?? undefined,
      });

      if (printAfterSubmit && !isRunningCustomer) {
        await handlePrintReceipt(preopenedPrintWindow);
        setUpiDialogOpen(false);
      }

      if (isRunningCustomer) {
        setUpiDialogOpen(false);
        setReceiptDelivery(null);
      } else {
        const receiptCreatedAt = new Date();
        const fileSafeInvoice = (invoiceNo || `bill-${Date.now()}`).replace(/[^a-z0-9-_]/gi, "-");
        const receiptFileName = `${fileSafeInvoice}.pdf`;
        const customerDigits = saleCustomer.phone.replace(/\D/g, "");
        const whatsappPhone = customerDigits.length === 10
          ? `91${customerDigits}`
          : customerDigits.startsWith("0") && customerDigits.length === 11
            ? `91${customerDigits.slice(1)}`
            : customerDigits;
        const receiptMessage = [
          `Hello ${saleCustomer.name},`,
          "Your Kherwal Bazaar bill receipt is ready.",
          ...(invoiceNo ? [`Bill No: ${invoiceNo}`] : []),
          `Net Pay: INR ${fmt(finalPayable)}`,
        ].join("\n");
        const deliveryBase = {
          fileName: receiptFileName,
          customerName: saleCustomer.name,
          customerPhone: saleCustomer.phone,
          whatsappUrl: `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(receiptMessage)}`,
        };
        let receiptPdf: Blob | null = null;
        try {
          receiptPdf = createThermalReceiptPdf({
            billNumber: invoiceNo,
            customerName: saleCustomer.name,
            customerPhone: saleCustomer.phone,
            createdAt: receiptCreatedAt,
            paymentMode: salePaymentMode,
            items: cart.map((item) => ({ name: item.name, quantity: item.qty, unitPrice: item.sale })),
            subtotal,
            gst: gstAmount,
            total: totalWithTax,
            discount,
            payable: finalPayable,
            received: receivedAmount,
          });
        } catch (pdfError) {
          console.error("Failed to create the bill receipt PDF", pdfError);
        }

        if (!receiptPdf) {
          setReceiptDelivery({
            ...deliveryBase,
            status: "Failed",
            pdf: null,
            error: "The sale was saved, but the receipt PDF could not be generated.",
          });
        } else {
          // Automatically download the PDF receipt upon checkout
          downloadReceiptPdf(receiptPdf, receiptFileName);

          if (!whatsappPhone) {
            setReceiptDelivery({
              ...deliveryBase,
              status: "Manual Sending",
              pdf: receiptPdf,
              error: "Sale saved and PDF downloaded. No 10-digit mobile number for WhatsApp sharing.",
            });
          } else {
            const delivery: ReceiptDelivery = {
              ...deliveryBase,
              status: "Manual Sending",
              pdf: receiptPdf,
            };
            setReceiptDelivery(delivery);
            if (autoSendWhatsapp) {
              const startManualFallback = () => {
                try {
                  if (whatsappWindow && !whatsappWindow.closed) {
                    whatsappWindow.location.href = delivery.whatsappUrl;
                  } else {
                    showToast("warning", "WhatsApp could not open automatically. Use the manual receipt action below.");
                  }
                  setReceiptDelivery({ ...delivery, status: "Manual Sending" });
                } catch (deliveryError) {
                  console.error("Could not start manual WhatsApp receipt sharing", deliveryError);
                  setReceiptDelivery({
                    ...delivery,
                    status: "Failed",
                    error: "Sale saved. The PDF is ready, but WhatsApp could not open. Allow pop-ups and try again.",
                  });
                }
              };
              void sendReceiptAutomatically({
                phone: whatsappPhone,
                fileName: receiptFileName,
                pdf: receiptPdf,
                caption: receiptMessage,
              }).then((automaticStatus) => {
                if (automaticStatus === "sent") {
                  whatsappWindow?.close();
                  setReceiptDelivery({ ...delivery, status: "Automatically Sent" });
                } else {
                  startManualFallback();
                }
              }).catch(() => startManualFallback());
            }
          }
        }
      }

      const completedBillId = activeBillIdRef.current;
      if (completedBillId) {
        markLocalPendingBillCompleted(completedBillId);
        deleteLocalPendingBill(completedBillId);
        void completePendingBill(completedBillId).catch(() => {});
        void deletePendingBill(completedBillId).catch(() => {});

        const remaining = billTabs.filter((b) => b.id !== completedBillId);
        if (remaining.length > 0) {
          setBillTabs(remaining);
          const nextBill = remaining[0];
          activeBillIdRef.current = nextBill.id;
          setActiveBillId(nextBill.id);
          setCart(nextBill.items || []);
          setSelectedCustomer(nextBill.customer || null);
          setCustomerName(nextBill.name || nextBill.customer?.name || "");
          setCustomerPhone(nextBill.mobile || nextBill.customer?.phone || "");
          setCustomerAddress(nextBill.address || nextBill.customer?.address || "");
          setCustomerSaveError(null);
          setInvoiceNo(nextBill.invoiceNo || null);
          setPaymentMode((PAYMENT_MODES.some((m) => m.label === nextBill.paymentMode) ? nextBill.paymentMode : "Cash") as PaymentMode);
          setCgstAmount(nextBill.cgstAmount || 0);
          setReceived(nextBill.received || 0);
          setReceivedTouched(Boolean(nextBill.receivedTouched));
        } else {
          activeBillIdRef.current = null;
          setActiveBillId(null);
          setCart([]);
          setSelectedCustomer(null);
          setCustomerName("");
          setCustomerPhone("");
          setCustomerAddress("");
          setCustomerSaveError(null);
          setInvoiceNo(null);
          setPaymentMode("Cash");
          setCgstAmount(0);
          setReceived(0);
          setReceivedTouched(false);
          setBillTabs([]);
          setIsAddingBill(false);
          setEditingBillId(null);
          writeDraft(null);
        }
      }

      setCustomerName("");
      setCustomerPhone("");
      setCustomerAddress("");
      setCustomerSaveError(null);
      setCustomerFormOpen(false);
      setAutoSendWhatsapp(true);
      showToast("success", "Sale added successfully!");
      if (redirectToKhata) {
        router.push(`/customers?customer=${encodeURIComponent(saleCustomer.id)}`);
      }
    } catch (e) {
      preopenedPrintWindow?.close();
      whatsappWindow?.close();
      setError(e instanceof Error ? e.message : "Failed to submit sale.");
    } finally {
      setSubmitting(false);
    }
  };

  // Cash and UPI bills record the received amount before continuing checkout.
  const openReceivedDialog = () => {
    if (submitting) return;
    const starting = receivedTouched && received > 0 ? received : payable;
    setReceivedInput(String(Number(starting.toFixed(2))));
    setReceivedDialogOpen(true);
  };

  const confirmReceived = () => {
    const amount = Math.max(0, Number(receivedInput) || 0);
    setReceived(amount);
    setReceivedTouched(true);
    setReceivedDialogOpen(false);
    if (paymentMode === "UPI") setUpiDialogOpen(true);
    else setCheckoutOpen(true);
  };

  const confirmCheckout = () => {
    if (submitting) return;
    if (!selectedCustomer && (!customerName.trim() || customerPhone.replace(/\D/g, "").length !== 10)) {
      setError("Enter the customer name and a valid 10-digit mobile number to check out.");
      return;
    }
    setError(null);
    setCheckoutOpen(false);
    void handleSubmit(false, false, undefined, paymentMode === "Credit", paymentMode);
  };

  const requestSubmit = (quickPay = false) => {
    if (submitting) return;
    if (paymentMode === "Cash") {
      if (quickPay) {
        setReceived(Number(payable.toFixed(2)));
        setReceivedTouched(true);
        setCheckoutOpen(true);
      } else {
        openReceivedDialog();
      }
      return;
    }
    void handleSubmit(quickPay);
  };

  // Keep the latest submit handler reachable from keyboard shortcuts
  useEffect(() => {
    submitRef.current = requestSubmit;
  });

  // Keyboard shortcuts for fast billing
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "F2") {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      } else if (event.key === "F9") {
        event.preventDefault();
        submitRef.current?.(true);
      } else if (event.key === "Escape" && receivedDialogOpen) {
        setReceivedDialogOpen(false);
      } else if (event.key === "Escape" && checkoutOpen) {
        setCheckoutOpen(false);
      } else if (event.key === "Escape" && upiDialogOpen) {
        setUpiDialogOpen(false);
      } else if (event.key === "Escape" && quickAddOpen) {
        setQuickAddOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [quickAddOpen, upiDialogOpen, checkoutOpen, receivedDialogOpen]);

  useEffect(() => {
    if (activeProductSuggestion >= 0) {
      const el = document.getElementById(`sales-product-suggestion-${activeProductSuggestion}`);
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [activeProductSuggestion]);

  const filteredProducts = (() => {
    const q = search.trim().toLowerCase().replace(/\s+/g, " ");
    if (!q) return [];
    const qWords = q.split(" ").filter(Boolean);
    const isSingleConcatenatedInitials = qWords.length === 1 && q.length <= 5;
    const qAsNumber = Number(q);

    const matches = products.filter((p) => {
      const barcode = p.barcode?.trim().toLowerCase();
      if (barcode && barcode.includes(q)) return true;
      const name = p.name.trim().toLowerCase();
      if (name.includes(q)) return true;
      if (qAsNumber > 0 && (p.mrp === qAsNumber || p.sale === qAsNumber)) return true;
      const words = name.split(/\s+/).filter(Boolean);
      const initials = words.map((w) => w[0]).join("");
      if (words.some((w) => w.startsWith(q))) return true;
      if (qWords.length > 1) {
        if (qWords.length > words.length) return false;
        return qWords.every((qw, i) => words[i]?.startsWith(qw));
      }
      if (isSingleConcatenatedInitials) {
        if (initials.startsWith(q)) return true;
        if (initials.includes(q)) return words.some((w) => w.startsWith(q));
      }
      return false;
    });

    return matches.sort((a, b) => {
      const aBarcode = a.barcode?.trim().toLowerCase() || "";
      const bBarcode = b.barcode?.trim().toLowerCase() || "";
      const aName = a.name.trim().toLowerCase();
      const bName = b.name.trim().toLowerCase();

      if (aBarcode === q && bBarcode !== q) return -1;
      if (bBarcode === q && aBarcode !== q) return 1;

      if (aName === q && bName !== q) return -1;
      if (bName === q && aName !== q) return 1;

      const aStarts = aName.startsWith(q);
      const bStarts = bName.startsWith(q);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;

      return 0;
    });
  })();

  const visibleProducts = filteredProducts.slice(0, 15);

  const chip = (name: string) => name.charAt(0).toUpperCase();
  const customerQuery = customerName.trim().toLocaleLowerCase();
  const customerPhoneQuery = customerQuery.replace(/\D/g, "");
  const matchingCustomers = customerQuery
    ? customers
        .filter((customer) =>
          customer.name.trim().toLocaleLowerCase().includes(customerQuery) ||
          (customerPhoneQuery.length > 0 && customer.phone.replace(/\D/g, "").includes(customerPhoneQuery))
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

  const makeCurrentPendingBill = (id: string | null = activeBillIdRef.current): PendingBill | null => {
    if (!id) return null;
    const currentTab = billTabs.find((b) => b.id === id);
    const isSaved = Boolean(currentTab?.isSaved);
    const name = isSaved
      ? (currentTab?.name || selectedCustomer?.name || customerName.trim())
      : customerName.trim();
    const mobile = isSaved
      ? (currentTab?.mobile || selectedCustomer?.phone || customerPhone.trim())
      : customerPhone.trim();
    const address = isSaved
      ? (currentTab?.address || selectedCustomer?.address || customerAddress.trim())
      : customerAddress.trim();
    const currentTitle = isSaved && name ? name : (currentTab?.title || "Bill 1");
    return {
      id,
      name,
      mobile,
      address,
      isSaved,
      title: currentTitle,
      customer: selectedCustomer,
      items: cart,
      invoiceNo,
      paymentMode,
      cgstAmount,
      received,
      receivedTouched,
      updatedAt: Date.now(),
      status: "PENDING",
    };
  };

  const storeCurrentBill = async () => {
    const id = activeBillIdRef.current;
    if (!id) return;
    const current = makeCurrentPendingBill(id);
    if (!current) return;
    saveLocalPendingBill(current);
    void savePendingBill(current).catch(() => {});
    setBillTabs((tabs) => tabs.map((b) => (b.id === id ? current : b)));
  };

  const switchToBillTab = async (targetId: string) => {
    setEditSaleTabActive(false);
    if (targetId === activeBillIdRef.current) return;
    await storeCurrentBill();
    const target = billTabs.find((b) => b.id === targetId);
    if (!target) return;

    setIsAddingBill(false);
    setEditingBillId(null);
    activeBillIdRef.current = target.id;
    setActiveBillId(target.id);
    setCart(target.items || []);
    const targetCustomer =
      target.customer?.name?.trim().toLowerCase() === "kherwal bazaar"
        ? null
        : target.customer || null;
    setSelectedCustomer(targetCustomer);
    setCustomerName(target.name || targetCustomer?.name || "");
    setCustomerPhone(target.mobile || targetCustomer?.phone || "");
    setCustomerAddress(target.address || targetCustomer?.address || "");
    setCustomerSaveError(null);
    setInvoiceNo(target.invoiceNo || null);
    setPaymentMode((PAYMENT_MODES.some((m) => m.label === target.paymentMode) ? target.paymentMode : "Cash") as PaymentMode);
    setCgstAmount(target.cgstAmount || 0);
    setReceived(target.received || 0);
    setReceivedTouched(Boolean(target.receivedTouched));
  };

  const handleAddNewBillTab = () => {
    handleStartAddBill();
  };

  const handleRemoveBillTab = async (billId: string) => {
    deleteLocalPendingBill(billId);
    void deletePendingBill(billId).catch(() => {});

    const remaining = billTabs.filter((b) => b.id !== billId);
    setBillTabs(remaining);

    if (remaining.length === 0) {
      activeBillIdRef.current = null;
      setActiveBillId(null);
      setCart([]);
      setSelectedCustomer(null);
      setCustomerName("");
      setCustomerPhone("");
      setCustomerAddress("");
      setCustomerSaveError(null);
      setInvoiceNo(null);
      setPaymentMode("Cash");
      setCgstAmount(0);
      setReceived(0);
      setReceivedTouched(false);
      writeDraft(null);
      setIsAddingBill(false);
      setEditingBillId(null);
      return;
    }

    if (billId === activeBillIdRef.current) {
      const nextBill = remaining[0];
      activeBillIdRef.current = nextBill.id;
      setActiveBillId(nextBill.id);
      setCart(nextBill.items || []);
      const nextCustomer =
        nextBill.customer?.name?.trim().toLowerCase() === "kherwal bazaar"
          ? null
          : nextBill.customer || null;
      setSelectedCustomer(nextCustomer);
      setCustomerName(nextBill.name || nextCustomer?.name || "");
      setCustomerPhone(nextBill.mobile || nextCustomer?.phone || "");
      setCustomerAddress(nextBill.address || nextCustomer?.address || "");
      setCustomerSaveError(null);
      setInvoiceNo(nextBill.invoiceNo || null);
      setPaymentMode((PAYMENT_MODES.some((m) => m.label === nextBill.paymentMode) ? nextBill.paymentMode : "Cash") as PaymentMode);
      setCgstAmount(nextBill.cgstAmount || 0);
      setReceived(nextBill.received || 0);
      setReceivedTouched(Boolean(nextBill.receivedTouched));
      setIsAddingBill(false);
      setEditingBillId(null);
    }
  };

  const saveAsPending = async () => {
    if (!cart.length) {
      showToast("warning", "Add at least one product before saving this bill.");
      return;
    }
    if (!activeBillIdRef.current && billTabs.length >= MAX_OPEN_BILLS) {
      showToast("warning", BILL_LIMIT_MESSAGE);
      return;
    }
    setPendingAction(true);
    try {
      const id = activeBillIdRef.current ?? makeBillId();
      if (!activeBillIdRef.current) {
        activeBillIdRef.current = id;
        setActiveBillId(id);
      }
      const currentTab = billTabs.find((b) => b.id === id);
      const isSaved = Boolean(currentTab?.isSaved);
      const name = isSaved
        ? (currentTab?.name || selectedCustomer?.name || customerName.trim())
        : customerName.trim();
      const mobile = isSaved
        ? (currentTab?.mobile || selectedCustomer?.phone || customerPhone.trim())
        : customerPhone.trim();
      const address = isSaved
        ? (currentTab?.address || selectedCustomer?.address || customerAddress.trim())
        : customerAddress.trim();
      const currentTitle = isSaved && name ? name : (currentTab?.title || "Bill 1");
      const bill: PendingBill = {
        id,
        name,
        mobile,
        address,
        isSaved,
        title: currentTitle,
        customer: selectedCustomer,
        items: cart,
        invoiceNo,
        paymentMode,
        cgstAmount,
        received,
        receivedTouched,
        updatedAt: Date.now(),
        status: "PENDING",
      };
      saveLocalPendingBill(bill);
      await savePendingBill(bill);
      setBillTabs((tabs) => [bill, ...tabs.filter((entry) => entry.id !== id)]);
      showToast("success", "Bill saved as pending.");
    } catch (saveError) {
      showToast("error", `Could not save pending bill: ${saveError instanceof Error ? saveError.message : "Database error"}`);
    } finally {
      setPendingAction(false);
    }
  };

  const cancelCurrentBill = async () => {
    if (!await confirmAction({ title: "Cancel this bill?", message: "This will permanently discard the products and customer details in this bill.", confirmLabel: "Cancel bill", cancelLabel: "Keep bill", tone: "danger" })) return;
    setPendingAction(true);
    try {
      const cancelledId = activeBillIdRef.current;
      if (cancelledId) {
        await deletePendingBill(cancelledId);
        deleteLocalPendingBill(cancelledId);
        const remaining = billTabs.filter((bill) => bill.id !== cancelledId);
        setBillTabs(remaining);
        discardUnusedLocalCustomer(selectedCustomer, remaining);
      }
      const id = makeBillId();
      sessionTouchedRef.current = true;
      activeBillIdRef.current = id;
      suppressPendingSaveRef.current = true;
      setActiveBillId(id);
      setCart([]);
      writeDraft(null);
      setSelectedCustomer(null);
      setInvoiceNo(null);
      setPaymentMode("Cash");
      setCgstAmount(0);
      setReceived(0);
      setReceivedTouched(false);
      setCustomerName("");
      setCustomerPhone("");
      setCustomerAddress("");
      setCustomerFormOpen(false);
      setError(null);
      window.setTimeout(() => { suppressPendingSaveRef.current = false; }, 0);
      showToast("success", "Bill cancelled.");
    } catch (cancelError) {
      showToast("error", `Could not cancel the bill: ${cancelError instanceof Error ? cancelError.message : "Database error"}`);
    } finally {
      setPendingAction(false);
    }
  };

  const billLimitReached = billTabs.length >= MAX_OPEN_BILLS;

  return (
    <AppShell title="" active="Sales">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex items-center gap-2">
          <PageBackButton />
          <ShoppingCart className="h-5 w-5 text-violet-700" aria-hidden="true" />
          <h1 className="text-xl font-bold text-slate-800">Sales</h1>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {[
            {
              label: "Total Customer",
              value: customersLoaded ? String(customers.length) : "—",
              Icon: Users,
              tone: "bg-amber-500 border-amber-700",
            },
            {
              label: "Items Sold",
              value: todayStats ? String(todayStats.items) : "—",
              Icon: Package,
              tone: "bg-blue-500 border-blue-700",
            },
            {
              label: "Sale Today",
              value: todayStats ? `₹${fmt(todayStats.amount)}` : "—",
              Icon: IndianRupee,
              tone: "bg-purple-500 border-purple-700",
            },
            {
              label: "Profit Today",
              value: todayStats ? `₹${fmt(Math.round(todayStats.profit))}` : "—",
              Icon: TrendingUp,
              tone: "bg-green-500 border-green-700",
            },
          ].map(({ label, value, Icon, tone }) => (
            <span
              key={label}
              className={`inline-flex items-center gap-2.5 rounded-xl border-b-4 px-5 py-3 text-xs font-semibold text-white shadow-sm ${tone}`}
            >
              <Icon className="h-5 w-5 flex-none text-white/80" aria-hidden="true" />
              <span>{label}</span>
              <span className="text-lg font-extrabold leading-none">{value}</span>
            </span>
          ))}
        </div>
      </div>

      {receiptDelivery && !isRunningCustomer && (
        <section
          role="status"
          aria-live="polite"
          className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 text-xs ${
            receiptDelivery.status === "Failed"
              ? "border-red-200 bg-red-50 text-red-800"
              : receiptDelivery.status === "Sent" || receiptDelivery.status === "Automatically Sent"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-amber-200 bg-amber-50 text-amber-900"
          }`}
        >
          <div className="min-w-0">
            <p className="font-bold">WhatsApp receipt · {receiptDelivery.status}</p>
            <p className="mt-0.5">{receiptDelivery.error || `PDF receipt for ${receiptDelivery.customerName} (${receiptDelivery.customerPhone}) is ready.`}</p>
            {receiptDelivery.status === "Manual Sending" && <p className="mt-0.5">WhatsApp chat opened and the PDF was downloaded. In WhatsApp, attach the PDF with <strong>Attach → Document</strong>, then tap the send icon. WhatsApp does not let this app attach a file to the chat automatically.</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {receiptDelivery.pdf && (
              <button
                type="button"
                onClick={() => downloadReceiptPdf(receiptDelivery.pdf!, receiptDelivery.fileName)}
                className="rounded-lg border border-current/20 bg-white px-3 py-2 font-semibold hover:bg-white/80"
              >
                Download PDF
              </button>
            )}
            {receiptDelivery.status === "Manual Sending" && (
              <button
                type="button"
                onClick={() => setReceiptDelivery((current) => current ? { ...current, status: "Sent" } : current)}
                className="rounded-lg border border-current/20 bg-white px-3 py-2 font-semibold hover:bg-white/80"
              >
                Mark as Sent
              </button>
            )}
          </div>
        </section>
      )}

      <div suppressHydrationWarning className="grid grid-cols-12 gap-4">
        {/* LEFT SECTION: FORM AND PRODUCT SELECTION */}
        <div className="col-span-12 space-y-2">
          {/* Customer Section */}
          <div suppressHydrationWarning className="bg-white rounded-none p-4 border border-slate-200">
            <div
              className={`flex flex-nowrap items-center gap-2 ${
                isAddingBill ? "border-b border-slate-100 pb-2 mb-3" : ""
              }`}
            >
              {/* Bill Tabs */}
              <div className="min-w-0 flex-1 flex items-center gap-1.5 overflow-x-auto" role="tablist" aria-label="Customer Bills">
                {billTabs.map((bill, index) => {
                  const isActive = bill.id === activeBillId;
                  const label = bill.name ? `Bill ${index + 1} (${bill.name})` : bill.title || `Bill ${index + 1}`;
                  return (
                    <div
                      key={bill.id}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                        isActive
                          ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
                          : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <button
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => void switchToBillTab(bill.id)}
                        className="flex items-center gap-1.5 text-left outline-none"
                      >
                        <span className="max-w-36 truncate">{label}</span>
                        {bill.items && bill.items.length > 0 && (
                          <span
                            className={`rounded-full px-1.5 py-0.2 text-[9px] font-bold ${
                              isActive ? "bg-emerald-700 text-white" : "bg-slate-200 text-slate-700"
                            }`}
                          >
                            {bill.items.length}
                          </span>
                        )}
                      </button>

                      {isActive && bill.customer?.id !== RUNNING_CUSTOMER_ID && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditCustomer(bill.id);
                          }}
                          title={`Edit customer details for ${label}`}
                          aria-label={`Edit ${label}`}
                          className="rounded p-0.5 text-emerald-100 hover:bg-emerald-700 hover:text-white transition"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleRemoveBillTab(bill.id);
                        }}
                        aria-label={`Close ${label}`}
                        className={`rounded p-0.5 transition ${
                          isActive
                            ? "text-emerald-100 hover:bg-emerald-700 hover:text-white"
                            : "text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        }`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={handleStartRunningCustomerBill}
                  title={
                    billLimitReached
                      ? `Maximum ${MAX_OPEN_BILLS} bills allowed. Close a bill to add another.`
                      : `Create a bill for ${RUNNING_CUSTOMER_NAME}`
                  }
                  aria-disabled={billLimitReached}
                  className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-bold transition active:scale-95 ${
                    billLimitReached
                      ? "cursor-not-allowed border-slate-300 bg-slate-100 text-slate-400"
                      : "border-emerald-500 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  }`}
                >
                  <Users className="h-3.5 w-3.5" />
                  <span>{RUNNING_CUSTOMER_NAME}</span>
                </button>

                <button
                  type="button"
                  onClick={handleStartAddBill}
                  title={
                    billLimitReached
                      ? `Maximum ${MAX_OPEN_BILLS} bills allowed. Close a bill to add another.`
                      : "Create new bill"
                  }
                  aria-disabled={billLimitReached}
                  className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-bold transition active:scale-95 ${
                    billLimitReached
                      ? "cursor-not-allowed border-slate-300 bg-slate-100 text-slate-400"
                      : "border-dashed border-blue-500 bg-blue-50 text-blue-700 hover:bg-blue-100"
                  }`}
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Bill</span>
                </button>
              </div>
              <div className="ml-auto flex flex-none items-center gap-3">
                {!isRunningCustomer && (
                  <label className={`inline-flex flex-none items-center gap-2 whitespace-nowrap text-xs font-medium ${
                    (selectedCustomer?.phone || customerPhone).trim() ? "text-slate-700" : "text-slate-400"
                  }`}>
                    <input
                      type="checkbox"
                      checked={autoSendWhatsapp}
                      onChange={(event) => setAutoSendWhatsapp(event.target.checked)}
                      disabled={submitting || !(selectedCustomer?.phone || customerPhone).trim()}
                      className="h-4 w-4 accent-green-600"
                    />
                    Send Bill via WhatsApp
                  </label>
                )}

                <button
                  type="button"
                  role="tab"
                  aria-selected={editSaleTabActive}
                  onClick={() => setEditSaleTabActive((active) => !active)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
                    editSaleTabActive
                      ? "border-teal-600 bg-teal-600 text-white shadow-sm"
                      : "border-teal-500 bg-teal-50 text-teal-700 hover:bg-teal-100"
                  }`}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  <span>Edit Sale</span>
                </button>
              </div>
            </div>

            {isAddingBill && (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-12 md:items-end">
                <div className="relative md:col-span-3">
                  <input
                    id="sales-customer-name"
                    type="text"
                    autoComplete="off"
                    aria-label="Name"
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
                          className={`flex w-full items-center justify-between border-b border-slate-100 px-3 py-2 text-left hover:bg-blue-100 ${
                            activeCustomerSuggestion === index ? "bg-blue-200 hover:bg-blue-200" : ""
                          }`}
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
                    inputMode="numeric"
                    maxLength={10}
                    pattern="[0-9]{10}"
                    aria-label="Mobile Number"
                    aria-description="Exactly 10 digits"
                    value={customerPhone}
                    onChange={(event) => {
                      setCustomerPhone(
                        event.target.value.replace(/\D/g, "").slice(0, 10)
                      );
                      setCustomerSaveError(null);
                    }}
                    placeholder="10-digit mobile number"
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

                <div className="flex gap-2 md:col-span-2">
                  <button
                    type="button"
                    onClick={saveNewCustomer}
                    disabled={!customerName.trim() || !customerPhone.trim()}
                    className="h-[34px] flex-1 bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelAddBill}
                    className="h-[34px] border border-slate-300 bg-slate-100 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-200"
                  >
                    Cancel
                  </button>
                </div>

                {customerSaveError && (
                  <p role="alert" className="text-xs font-medium text-red-600 md:col-span-12">
                    {customerSaveError}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Edit Sale Tab View or Product Details for Sales */}
          {editSaleTabActive ? (
            <DesktopEditSalePanel />
          ) : (
          <div suppressHydrationWarning className="bg-white rounded-xl p-4 border border-slate-200">
            <div className="mb-3 flex flex-wrap items-center gap-3">
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
              <div className="relative min-w-[240px] flex-1">
                <input
                  ref={searchInputRef}
                  id="sales-product-search"
                  type="text"
                  autoComplete="off"
                  role="combobox"
                  aria-autocomplete="list"
                  aria-expanded={Boolean(activeBillId && search.trim().length > 0 && visibleProducts.length > 0)}
                  aria-controls="sales-product-suggestions"
                  aria-activedescendant={
                    activeProductSuggestion >= 0 && visibleProducts[activeProductSuggestion]
                      ? `sales-product-suggestion-${activeProductSuggestion}`
                      : undefined
                  }
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setActiveProductSuggestion(-1);
                    setBarcodeNotice(null);
                    setMissingBarcode(null);
                  }}
                  onKeyDown={handleProductKeyDown}
                  placeholder={
                    activeBillId
                      ? "Search product name or scan barcode…"
                      : "Select Running Customer or create a bill first"
                  }
                  aria-label="Search product or scan barcode"
                  disabled={productsLoading || !activeBillId}
                  title={!activeBillId ? "Select Running Customer or create a bill before adding products." : undefined}
                  className="w-full border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                />

                {activeBillId && search.trim().length > 0 && (
                  <div
                    id="sales-product-suggestions"
                    role="listbox"
                    className="absolute left-0 right-0 top-full z-40 max-h-64 overflow-y-auto border border-slate-300 bg-white shadow-xl"
                  >
                    {productsLoading ? (
                      <p className="px-3 py-2 text-xs text-slate-500">Loading products…</p>
                    ) : visibleProducts.length > 0 ? (
                      visibleProducts.map((product, index) => {
                        const isSelected = activeProductSuggestion === index;
                        return (
                          <div
                            key={`${product.name}-${index}`}
                            id={`sales-product-suggestion-${index}`}
                            role="option"
                            aria-selected={isSelected}
                            onMouseEnter={() => setActiveProductSuggestion(index)}
                            onClick={() => {
                              addToCart(product);
                              setSearch("");
                              setActiveProductSuggestion(-1);
                              setBarcodeNotice(null);
                              setMissingBarcode(null);
                              requestAnimationFrame(() => searchInputRef.current?.focus());
                            }}
                            className={`flex cursor-pointer items-center justify-between gap-3 border-b border-slate-100 px-3 py-2 text-left transition-colors last:border-0 ${
                              isSelected ? "bg-blue-100" : "hover:bg-blue-50"
                            }`}
                          >
                            <div className="min-w-0">
                              <p className="truncate text-xs font-semibold text-slate-800">{product.name}</p>
                              <p className="text-[10px] text-slate-500">
                                Sale ₹{fmt(priceInputs[product.name] ?? product.sale)}
                                {product.mrp ? ` · MRP ₹${fmt(product.mrp)}` : ""}
                                {product.barcode ? ` · Barcode: ${product.barcode}` : ""}
                                {product.size ? ` · Size: ${product.size}` : ""}
                              </p>
                            </div>
                            <button
                              type="button"
                              tabIndex={-1}
                              onClick={(e) => {
                                e.stopPropagation();
                                addToCart(product);
                                setSearch("");
                                setActiveProductSuggestion(-1);
                                setBarcodeNotice(null);
                                setMissingBarcode(null);
                                requestAnimationFrame(() => searchInputRef.current?.focus());
                              }}
                              className={`flex-none rounded px-3 py-1 text-xs font-semibold text-white shadow-sm transition ${
                                isSelected ? "bg-blue-700" : "bg-blue-600 hover:bg-blue-700"
                              }`}
                            >
                              Add
                            </button>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-3 text-center">
                        <p className="text-xs text-slate-500">No matching products found.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setQaError(null);
                  if (!qaName && search.trim()) setQaName(search.trim());
                  setQuickAddOpen(true);
                }}
                className="inline-flex flex-none items-center gap-1 rounded-md border border-dashed border-emerald-500 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
              >
                <PackagePlus className="h-4 w-4" />
                New Product
              </button>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={() => void clearCart()}
                  className="inline-flex flex-none items-center gap-1 rounded-md border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Clear Bill
                </button>
              )}
              <span className="hidden flex-none items-center gap-1 text-[10px] font-medium text-slate-400 lg:inline-flex">
                <Keyboard className="h-3.5 w-3.5" aria-hidden="true" />
                F2 focus · F9 quick pay · Esc close
              </span>
            </div>

            {barcodeNotice && (
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                <p role="status" className={missingBarcode ? "text-amber-700 font-medium" : "text-slate-600"}>{barcodeNotice}</p>
                {missingBarcode && (
                  <Link
                    href={`/products?barcode=${encodeURIComponent(missingBarcode)}&from=sales`}
                    className="rounded bg-blue-600 px-3 py-1.5 font-semibold text-white hover:bg-blue-700"
                  >
                    Add Product
                  </Link>
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
                    <th className="border border-slate-300 bg-slate-100 px-2 py-2 font-semibold text-right text-slate-700">Amount (₹)</th>
                    <th className="border border-slate-300 bg-slate-100 px-2 py-2 font-semibold text-right text-slate-700">Profit (₹)</th>
                    <th className="border border-slate-300 bg-slate-100 px-2 py-2 font-semibold text-left text-slate-700">Size</th>
                    <th className="border border-slate-300 bg-slate-100 px-2 py-2 font-semibold text-center text-slate-700">Delete</th>
                  </tr>
                </thead>
                <tbody className="text-xs">
                  {cart.length === 0 ? (
                    <tr><td colSpan={10} className="h-24 border border-slate-300 text-center text-slate-400">Scan a barcode or search products to add to bill.</td></tr>
                  ) : cart.map((item) => (
                    <tr key={item.name} className="border-b border-slate-200">
                      <td className="border border-slate-300 px-2 py-2 font-medium text-slate-800">{item.name}</td>
                      <td className="border border-slate-300 px-2 py-2 text-right text-slate-600">{fmt(item.purchase)}</td>
                      <td className="border border-slate-300 px-2 py-2 text-slate-600">{item.barcode || "—"}</td>
                      <td className="border border-slate-300 px-2 py-2 text-right text-slate-600">{fmt(item.mrp)}</td>
                      <td className="border border-slate-300 px-2 py-2 text-right">
                        <input aria-label={`Sale price for ${item.name}`} type="number" min="0" step="10" value={item.sale} onChange={(event) => setItemSale(item.name, event.target.value)} className="w-20 border border-slate-200 px-1 py-1 text-right" />
                      </td>
                      <td className="border border-slate-300 px-2 py-2 text-center">
                        <input aria-label={`Quantity for ${item.name}`} type="number" min="1" value={item.qty} onChange={(event) => setItemQty(item.name, event.target.value)} className="w-14 border border-slate-200 px-1 py-1 text-center" />
                      </td>
                      <td className="border border-slate-300 px-2 py-2 text-right font-semibold text-slate-800">{fmt(item.sale * item.qty)}</td>
                      <td className={`border border-slate-300 px-2 py-2 text-right font-semibold ${(item.sale - item.purchase) * item.qty >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                        {fmt((item.sale - item.purchase) * item.qty)}
                      </td>
                      <td className="border border-slate-300 px-2 py-2 text-slate-600">{item.size || "—"}</td>
                      <td className="border border-slate-300 px-2 py-2 text-center"><button type="button" onClick={() => removeItem(item.name)} aria-label={`Delete ${item.name}`} className="text-red-600 hover:text-red-800"><Trash2 className="mx-auto h-4 w-4" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          )}
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
                onClick={() => void clearCart()}
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
                          min="0"
                          step="10"
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
              onClick={() => void saveAsPending()}
              disabled={pendingAction || submitting || cart.length === 0}
              className="w-full rounded-lg border border-amber-300 bg-amber-50 py-2.5 text-xs font-bold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
            >
              {pendingAction ? "Saving pending bill…" : "Save as Pending"}
            </button>

            <button type="button" onClick={() => void cancelCurrentBill()} disabled={pendingAction || submitting} className="w-full rounded-lg border border-slate-300 bg-white py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
              Cancel Bill
            </button>

            <button
              type="button"
              onClick={() => requestSubmit(false)}
              disabled={
                submitting || cart.length === 0 || !selectedCustomer
              }
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-xs py-2.5 rounded-lg flex items-center justify-center space-x-1.5 transition-colors"
            >
              <Check className="w-4 h-4" />
              <span>
                {submitting ? "Completing..." : "Complete Bill"}
              </span>
            </button>
          </div>
          )}
        </div>
      </div>

      {/* Leaves room for the fixed totals bar so the last cards stay clickable */}
      {!editSaleTabActive && (
      <>
      <div aria-hidden="true" className="h-24" />

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-2 shadow-[0_-4px_12px_rgba(15,23,42,0.08)] backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Bill No</p>
              <p className="text-sm font-bold text-slate-700">{invoiceNo ?? "New bill"}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Net Pay</p>
              <p className="text-xl font-bold text-green-700">₹{fmt(payable)}</p>
            </div>
          </div>

          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Payment</span>
            <div className="flex flex-wrap items-center justify-end gap-2" role="group" aria-label="Payment mode">
              {PAYMENT_MODES.map(({ label, icon: Icon }) => (
                <button
                  key={label}
                  type="button"
                  disabled={submitting || cart.length === 0}
                  onClick={() => {
                    sessionTouchedRef.current = true;
                    setPaymentMode(label);
                    setUpiDialogOpen(false);
                    if (label === "Cash" || label === "UPI") openReceivedDialog();
                    if (label === "Credit") {
                      setReceived(0);
                      setReceivedTouched(false);
                      setError(null);
                      setCheckoutOpen(true);
                    }
                  }}
                  aria-pressed={paymentMode === label}
                  className={`inline-flex h-11 min-w-16 items-center justify-center gap-1.5 rounded-lg border border-emerald-700 bg-emerald-600 px-3 text-xs font-bold text-white shadow-sm transition-all duration-200 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40 sm:h-12 sm:min-w-20 sm:gap-2 sm:px-4 sm:text-sm ${
                    paymentMode === label ? "ring-2 ring-emerald-300 ring-offset-2" : ""
                  }`}
                >
                  <Icon className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div aria-hidden="true" className="h-28" />
      </>
      )}

      {receivedDialogOpen && (
        <div
          className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setReceivedDialogOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="received-dialog-title"
            className="w-full max-w-xs overflow-hidden rounded-2xl border border-white/70 bg-white shadow-2xl ring-1 ring-black/10 animate-toast-in"
          >
            <div className="flex items-start justify-between gap-3 bg-gradient-to-br from-emerald-600 to-teal-700 px-5 py-4 text-white">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-100">
                  {paymentMode} payment
                </p>
                <h2 id="received-dialog-title" className="mt-1 text-lg font-extrabold">
                  Received
                </h2>
                <p className="mt-1 text-xs text-emerald-50">Net Pay ₹{fmt(payable)}</p>
              </div>
              <button
                type="button"
                onClick={() => setReceivedDialogOpen(false)}
                aria-label="Close received popup"
                className="rounded-xl p-2 text-white/80 transition hover:bg-white/15 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-5 py-4">
              <label htmlFor="cash-received-input" className="block text-[11px] font-semibold text-slate-600">
                {paymentMode === "UPI" ? "Final UPI amount" : "Amount received"}
              </label>
              <div className="mt-1 flex items-center rounded-xl border border-slate-300 bg-white px-3 focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500">
                <span className="text-lg font-bold text-slate-400">₹</span>
                <input
                  id="cash-received-input"
                  autoFocus
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={receivedInput}
                  onChange={(event) => setReceivedInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      confirmReceived();
                    }
                  }}
                  className="w-full bg-transparent px-2 py-2.5 text-xl font-bold text-slate-800 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              <p className="mt-2 text-[11px] font-medium text-slate-500">
                {paymentMode === "UPI"
                  ? "This amount will be encoded in the UPI QR code."
                  : `Change ₹${fmt(Math.max(0, (Number(receivedInput) || 0) - payable))}`}
              </p>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={confirmReceived}
                  className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700"
                >
                  {paymentMode === "UPI" ? "Continue to UPI" : "Received"}
                </button>
                <button
                  type="button"
                  onClick={() => setReceivedDialogOpen(false)}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {checkoutOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setCheckoutOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="checkout-dialog-title"
            className="w-full max-w-sm overflow-hidden rounded-2xl border border-white/70 bg-white shadow-2xl ring-1 ring-black/10 animate-toast-in"
          >
            <div className="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 px-5 pb-5 pt-5 text-white">
              <div className="absolute -right-10 -top-14 h-40 w-40 rounded-full bg-white/10" />
              <div className="relative flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-100">
                    Final confirmation
                  </p>
                  <h2 id="checkout-dialog-title" className="mt-1 text-xl font-extrabold tracking-wide">
                    CHECK OUT
                  </h2>
                  <p className="mt-1 text-xs text-emerald-50">
                    {paymentMode} payment · {invoiceNo ?? "New bill"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCheckoutOpen(false)}
                  aria-label="Close check out popup"
                  className="rounded-xl p-2 text-white/80 transition hover:bg-white/15 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="relative mt-4 text-3xl font-extrabold tracking-tight">₹{fmt(payable)}</p>
            </div>

            <div className="space-y-2 px-5 py-4 text-xs text-slate-600">
              <div className="flex justify-between gap-3">
                <span>Customer</span>
                <span className="truncate font-semibold text-slate-800">
                  {selectedCustomer?.name || customerName.trim() || "—"}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span>Mobile</span>
                <span className="font-semibold text-slate-800">
                  {selectedCustomer?.phone || customerPhone || "—"}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span>Items</span>
                <span className="font-semibold text-slate-800">
                  {cart.reduce((sum, item) => sum + item.qty, 0)}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span>Amount received</span>
                <span className="font-semibold text-slate-800">
                  ₹{fmt(received)}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span>Change</span>
                <span className="font-semibold text-emerald-600">
                  ₹{fmt(Math.max(0, received - payable))}
                </span>
              </div>
              {received < payable && (
                <div className="flex justify-between gap-3">
                  <span>Balance</span>
                  <span className="font-semibold text-amber-700">
                    ₹{fmt(payable - received)}
                  </span>
                </div>
              )}

              {!selectedCustomer && (
                <div className="space-y-2 rounded-md bg-amber-50 p-2">
                  <p className="font-semibold text-amber-800">Enter customer details to check out.</p>
                  <input aria-label="Customer name for checkout" autoComplete="name" value={customerName} onChange={(event) => { setCustomerName(event.target.value); setError(null); }} placeholder="Customer name" className="w-full rounded border border-amber-200 bg-white px-2 py-2 text-sm text-slate-800 outline-none focus:border-emerald-500" />
                  <input aria-label="Customer mobile number for checkout" type="tel" inputMode="numeric" maxLength={10} value={customerPhone} onChange={(event) => { setCustomerPhone(event.target.value.replace(/\D/g, "").slice(0, 10)); setError(null); }} placeholder="10-digit mobile number" className="w-full rounded border border-amber-200 bg-white px-2 py-2 text-sm text-slate-800 outline-none focus:border-emerald-500" />
                  {customerName.trim() && customerPhone.replace(/\D/g, "").length !== 10 && <p className="text-amber-800">Enter a valid 10-digit mobile number.</p>}
                </div>
              )}
              {cart.length === 0 && (
                <p className="rounded-md bg-amber-50 px-2 py-1.5 font-semibold text-amber-700">
                  Add at least one product before checking out.
                </p>
              )}
              {cart.length > 0 && payable <= 0 && (
                <p className="rounded-md bg-amber-50 px-2 py-1.5 font-semibold text-amber-700">
                  Final payable must be greater than zero.
                </p>
              )}
              {error && (
                <p className="flex items-start gap-1.5 rounded-md bg-red-50 px-2 py-1.5 font-semibold text-red-600">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{error}</span>
                </p>
              )}

              <button
                type="button"
                onClick={confirmCheckout}
                disabled={
                  submitting ||
                  cart.length === 0 ||
                  (!selectedCustomer && (!customerName.trim() || customerPhone.replace(/\D/g, "").length !== 10)) ||
                  payable <= 0
                }
                className="mt-2 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-extrabold tracking-wide text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {submitting ? "Saving bill…" : "CHECK OUT"}
              </button>
              <button
                type="button"
                onClick={() => setCheckoutOpen(false)}
                disabled={submitting}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Go back
              </button>
            </div>
          </section>
        </div>
      )}

      {upiDialogOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/55 p-2 backdrop-blur-sm sm:p-4"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setUpiDialogOpen(false); }}
        >
          <section role="dialog" aria-modal="true" aria-labelledby="upi-dialog-title" className="max-h-[calc(100dvh-1rem)] w-full max-w-md overflow-hidden rounded-3xl border border-white/70 bg-white shadow-2xl ring-1 ring-black/10 animate-toast-in sm:max-h-[calc(100dvh-2rem)]">
            <div className="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 px-4 py-3 text-white sm:px-6 sm:py-4">
              <div className="absolute -right-10 -top-16 h-44 w-44 rounded-full bg-white/10" />
              <div className="relative flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20"><QrCode className="h-5 w-5" /></span>
                  <div className="min-w-0">
                    <h2 id="upi-dialog-title" className="text-base font-bold sm:text-lg">Scan to pay with UPI</h2>
                    <p className="truncate text-xs text-emerald-50 sm:text-sm">Kherwal Bazaar · {invoiceNo ?? "New bill"}</p>
                  </div>
                </div>
                <div className="flex flex-none items-center gap-1">
                  <div className="text-right">
                    <p className="text-[9px] font-medium uppercase tracking-[0.12em] text-emerald-100 sm:text-xs">UPI amount</p>
                    <p className="text-2xl font-extrabold tracking-tight sm:text-3xl">₹{fmt(upiPaymentAmount)}</p>
                  </div>
                  <button type="button" onClick={() => setUpiDialogOpen(false)} aria-label="Close UPI payment popup" className="rounded-xl p-2 text-white/80 transition hover:bg-white/15 hover:text-white"><X className="h-5 w-5" /></button>
                </div>
              </div>
              {selectedCustomer && <p className="relative mt-1 truncate text-[10px] text-emerald-50">{selectedCustomer.name}</p>}
            </div>
            <div className="p-3 text-center sm:p-4">
              {upiQrCode ? (
                <div className="mx-auto w-fit rounded-3xl border border-slate-100 bg-white p-1.5 shadow-[0_12px_35px_rgba(15,23,42,0.12)] sm:p-2">
                  <img src={upiQrCode} alt={`UPI payment QR code for ₹${fmt(upiPaymentAmount)}`} className="h-[min(14rem,36dvh)] w-[min(14rem,36dvh)] sm:h-[min(15rem,40dvh)] sm:w-[min(15rem,40dvh)] lg:h-[min(16rem,40dvh)] lg:w-[min(16rem,40dvh)]" />
                </div>
              ) : upiQrError ? (
                <div role="status" className="mx-auto flex min-h-56 max-w-xs flex-col items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 px-5 py-6 text-amber-800">
                  <AlertCircle className="h-8 w-8" />
                  <p className="mt-3 text-sm font-semibold">QR code unavailable</p>
                  <p className="mt-1 text-xs leading-5">{upiQrError}</p>
                </div>
              ) : (
                <div className="mx-auto flex h-[min(14rem,36dvh)] w-[min(14rem,36dvh)] flex-col items-center justify-center rounded-2xl bg-slate-50 text-slate-500 sm:h-[min(15rem,40dvh)] sm:w-[min(15rem,40dvh)] lg:h-[min(16rem,40dvh)] lg:w-[min(16rem,40dvh)]">
                  <span className="h-9 w-9 animate-spin rounded-full border-4 border-emerald-100 border-t-emerald-600" />
                  <p className="mt-4 text-sm font-semibold">Preparing payment QR…</p>
                </div>
              )}
              <p className="mt-1 text-[10px] font-medium text-slate-500">{upiQrCode ? "Open a UPI app and scan this bill amount." : "The QR code will match this bill amount."}</p>
              {!selectedCustomer && <div className="mx-auto mt-2 max-w-sm space-y-1.5 text-left">
                <input aria-label="Customer name for checkout" autoComplete="name" value={customerName} onChange={(event) => { setCustomerName(event.target.value); setError(null); }} placeholder="Customer name" className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-emerald-500" />
                <input aria-label="Customer mobile number for checkout" type="tel" inputMode="numeric" maxLength={10} value={customerPhone} onChange={(event) => { setCustomerPhone(event.target.value.replace(/\D/g, "").slice(0, 10)); setError(null); }} placeholder="10-digit mobile number" className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-emerald-500" />
                {customerName.trim() && customerPhone.replace(/\D/g, "").length !== 10 && <p className="text-xs font-medium text-amber-700">Enter a valid 10-digit mobile number.</p>}
              </div>}
              {process.env.NEXT_PUBLIC_UPI_ID && <p className="mt-1 text-[10px] text-slate-400">UPI ID: {process.env.NEXT_PUBLIC_UPI_ID}</p>}
              {isRunningCustomer ? (
                <button
                  type="button"
                  disabled={!upiQrCode || submitting || cart.length === 0}
                  onClick={() => void handleSubmit(false, false)}
                  className="mt-2 w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {submitting ? "Submitting sale…" : "Done · Submit sale"}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!upiQrCode || submitting || (!selectedCustomer && (!customerName.trim() || customerPhone.replace(/\D/g, "").length !== 10)) || cart.length === 0}
                  onClick={() => {
                    const printWindow = window.open("", "_blank", "width=480,height=640");
                    void handleSubmit(false, true, printWindow);
                  }}
                  className="mt-2 w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {submitting ? "Submitting bill…" : "Done · Submit & print bill"}
                </button>
              )}
            </div>
          </section>
        </div>
      )}

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

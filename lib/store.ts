import { ref, push, set, update, runTransaction, remove } from "firebase/database";
import { db } from "./firebase";
import { supabase } from "./supabase";
import {
  getWithCache,
  CACHE_KEYS,
  readCache,
  triggerActionRefresh,
  triggerBackgroundRefresh,
  writeCache,
} from "./cache";

export const RUNNING_CUSTOMER_ID = "running-customer";
export const RUNNING_CUSTOMER_NAME = "Running Customer";

export type Product = {
  name: string;
  barcode?: string;
  purchase?: number;
  mrp: number;
  sale: number;
  size?: string;
  inCatalog?: boolean;
  createdAt?: number;
};

export type CustomerSummary = {
  id: string;
  name: string;
  phone: string;
  address?: string;
  totalAmount: number;
};

type SaleRecord = {
  productName?: string;
  mrp?: number;
  sale?: number;
  salePrice?: number;
  quantity?: number;
  createdAt?: number;
};

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function fetchProducts(): Promise<Product[]> {
  const snap = await getWithCache(ref(db, "products"), CACHE_KEYS.PRODUCTS);
  const raw = snap.val() as
    | Record<
        string,
        {
          name?: string;
          barcode?: string;
          cost?: number | string;
          mrp?: number;
          sale?: number;
          unit?: string;
          createdAt?: number;
        }
      >
    | null;

  const byName = new Map<string, Product>();
  if (raw) {
    for (const p of Object.values(raw)) {
      const name = String(p.name ?? "").trim();
      if (!name) continue;
      const mrp = Number(p.mrp ?? 0);
      const sale = Number(p.sale ?? 0);
      byName.set(name, {
        name,
        barcode: p.barcode ? String(p.barcode) : undefined,
        purchase: p.cost != null ? Number(p.cost) : undefined,
        mrp,
        sale: sale > 0 ? sale : mrp,
        size: p.unit ? String(p.unit) : undefined,
        inCatalog: true,
        createdAt: Number(p.createdAt ?? 0),
      });
    }
  }

  const salesSnap = await getWithCache(ref(db, "sales"), CACHE_KEYS.SALES);
  const salesRaw = salesSnap.val() as
    | Record<
        string,
        {
          productName?: string;
          mrp?: number;
          sale?: number;
          salePrice?: number;
          createdAt?: number;
        }
      >
    | null;
  if (salesRaw) {
    for (const r of Object.values(salesRaw)) {
      const name = String(r.productName ?? "").trim();
      if (!name) continue;
      const existing = byName.get(name);
      if (existing) {
        if (!existing.createdAt) {
          existing.createdAt = Number(r.createdAt ?? 0);
        }
        continue;
      }
      const mrp = Number(r.mrp ?? 0);
      const salePrice = Number(r.salePrice ?? r.sale ?? 0);
      byName.set(name, {
        name,
        mrp,
        sale: salePrice > 0 ? salePrice : mrp,
        inCatalog: false,
        createdAt: Number(r.createdAt ?? 0),
      });
    }
  }

  return Array.from(byName.values())
    .filter((p) => p.name)
    .sort(
      (a, b) =>
        (b.createdAt ?? 0) - (a.createdAt ?? 0) ||
        a.name.localeCompare(b.name)
    );
}

export async function fetchCustomers(): Promise<CustomerSummary[]> {
  const snap = await getWithCache(ref(db, "customers"), CACHE_KEYS.CUSTOMERS);
  const raw = snap.val() as
    | Record<
        string,
        {
          name?: string;
          phone?: string;
          address?: string;
          totalAmount?: number;
        }
      >
    | null;
  if (!raw) return [];

  return Object.entries(raw).map(([id, c]) => ({
    id,
    name: String(c.name ?? ""),
    phone: String(c.phone ?? ""),
    address: c.address ? String(c.address) : undefined,
    totalAmount: Number(c.totalAmount ?? 0),
  }));
}

export async function createCustomer(input: {
  name: string;
  phone: string;
  address: string;
}): Promise<CustomerSummary> {
  const name = input.name.trim();
  const phone = input.phone.trim();
  const address = input.address.trim();
  if (!name || !phone) {
    throw new Error("Name and mobile number are required.");
  }

  const customerRef = push(ref(db, "customers"));
  if (!customerRef.key) throw new Error("Could not create a customer record.");

  const customer: CustomerSummary = {
    id: customerRef.key,
    name,
    phone,
    address,
    totalAmount: 0,
  };

  await set(customerRef, { ...customer, createdAt: Date.now() });

  const cached = readCache<unknown>(CACHE_KEYS.CUSTOMERS);
  if (Array.isArray(cached)) {
    // Older cache versions may store a customer array. Convert it back to the
    // Firebase key/value shape used by fetchCustomers and the live listeners.
    const customerMap = Object.fromEntries(
      cached
        .filter(
          (item): item is CustomerSummary =>
            Boolean(item) &&
            typeof item === "object" &&
            typeof (item as CustomerSummary).id === "string"
        )
        .map((item) => [item.id, item])
    );
    customerMap[customer.id] = customer;
    writeCache(CACHE_KEYS.CUSTOMERS, customerMap);
  } else if (cached && typeof cached === "object") {
    const customerMap = { ...(cached as Record<string, unknown>) };
    customerMap[customer.id] = customer;
    writeCache(CACHE_KEYS.CUSTOMERS, customerMap);
  }
  triggerBackgroundRefresh();
  return customer;
}

export async function submitSale(params: {
  items: { name: string; mrp: number; sale: number; qty: number }[];
  saleType: "cash" | "credit";
  customer?: CustomerSummary | null;
  received?: number;
  note?: string;
  /** How the customer paid: Cash, UPI, Card, etc. Stored per sale row. */
  paymentMethod?: string;
  /** Human readable bill number, e.g. KB-20261117-004. Stored per sale row. */
  invoiceNo?: string;
  /** Unique persistent bill ID used to prevent repeat submission on completion. */
  idempotencyKey?: string;
}): Promise<void> {
  const { items, saleType, customer, received, note, paymentMethod, invoiceNo, idempotencyKey } =
    params;
  if (items.length === 0) return;

  if (idempotencyKey) {
    const claim = await runTransaction(ref(db, `completedBills/${idempotencyKey}`), (current) =>
      current == null ? { status: "PROCESSING", startedAt: Date.now() } : undefined
    );
    if (!claim.committed) throw new Error("This bill is already being completed or has already been recorded.");
  }

  const date = toDateKey(new Date());
  const createdAt = Date.now();
  const updates: Record<string, unknown> = {};

  for (const item of items) {
    const saleKey = idempotencyKey
      ? `${idempotencyKey}_${Object.keys(updates).length}`
      : push(ref(db, "sales")).key;
    const quantity = Math.max(1, item.qty || 1);
    updates[`sales/${saleKey}`] = {
      productName: item.name,
      mrp: item.mrp,
      salePrice: item.sale,
      quantity,
      sale: item.sale * quantity,
      date,
      createdAt,
      ...(note ? { note } : {}),
      ...(paymentMethod ? { paymentMethod } : {}),
      ...(invoiceNo ? { invoiceNo } : {}),
      ...(customer
        ? { customerId: customer.id, customerName: customer.name }
        : {}),
      saleType,
    };
  }

  if (customer?.id === RUNNING_CUSTOMER_ID) {
    updates[`customers/${customer.id}/name`] = RUNNING_CUSTOMER_NAME;
    updates[`customers/${customer.id}/phone`] = "";
    updates[`customers/${customer.id}/address`] = "";
  }

  if (saleType === "credit" && customer) {
    let creditTotal = 0;
    for (const item of items) {
      const amount = item.sale * item.qty;
      creditTotal += amount;
      const txnKey = push(ref(db, `customers/${customer.id}/transactions`)).key;
      updates[`customers/${customer.id}/transactions/${txnKey}`] = {
        amount,
        itemName: item.name,
        date,
        type: "gave",
        createdAt,
      };
    }
    let balanceDelta = creditTotal;
    const receivedAmount = Number(received) || 0;
    if (receivedAmount > 0) {
      const settleKey = push(ref(db, `customers/${customer.id}/transactions`)).key;
      updates[`customers/${customer.id}/transactions/${settleKey}`] = {
        amount: receivedAmount,
        itemName: "Settle",
        date,
        type: "got",
        createdAt,
      };
      balanceDelta -= receivedAmount;
    }
    if (customer.id !== RUNNING_CUSTOMER_ID) {
      updates[`customers/${customer.id}/totalAmount`] =
        (customer.totalAmount ?? 0) + balanceDelta;
    }
  }

  if (idempotencyKey) {
    updates[`completedBills/${idempotencyKey}`] = {
      status: "COMPLETED",
      completedAt: Date.now(),
      invoiceNo: invoiceNo ?? null,
    };
  }

  const receivedAmount = Math.max(0, Number(received) || 0);
  if (receivedAmount > 0) {
    const normalizedPaymentMode = String(paymentMethod ?? "cash").toLowerCase();
    const cashbookKey = idempotencyKey
      ? `${idempotencyKey}_receipt`
      : push(ref(db, "cashbook")).key;
    updates[`cashbook/${cashbookKey}`] = {
      amount: receivedAmount,
      category: "Sales",
      mode: normalizedPaymentMode === "card" ? "online" : normalizedPaymentMode,
      remark: invoiceNo ? `Sale ${invoiceNo}` : "Sale received",
      date,
      type: "in",
      createdAt,
      ...(idempotencyKey ? { billId: idempotencyKey } : {}),
    };
  }

  try {
    await update(ref(db), updates);
    const billTotal = items.reduce(
      (sum, item) => sum + Number(item.sale || 0) * Math.max(1, item.qty || 1),
      0
    );
    if (supabase && billTotal > 0) {
      Promise.resolve(supabase.from("amount_value").insert({ amount: billTotal }))
        .catch(() => {});
    }
  } catch (error) {
    if (idempotencyKey) await remove(ref(db, `completedBills/${idempotencyKey}`)).catch(() => {});
    throw error;
  }
  if (typeof window !== "undefined") triggerActionRefresh();
}

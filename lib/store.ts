import { get, ref, push, update } from "firebase/database";
import { db } from "./firebase";

export type Product = {
  name: string;
  mrp: number;
  sale: number;
  createdAt?: number;
};

export type CustomerSummary = {
  id: string;
  name: string;
  phone: string;
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
  const snap = await get(ref(db, "products"));
  const raw = snap.val() as
    | Record<
        string,
        { name?: string; mrp?: number; sale?: number; createdAt?: number }
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
        mrp,
        sale: sale > 0 ? sale : mrp,
        createdAt: Number(p.createdAt ?? 0),
      });
    }
  }

  const salesSnap = await get(ref(db, "sales"));
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
  const snap = await get(ref(db, "customers"));
  const raw = snap.val() as
    | Record<
        string,
        { name?: string; phone?: string; totalAmount?: number }
      >
    | null;
  if (!raw) return [];

  return Object.entries(raw).map(([id, c]) => ({
    id,
    name: String(c.name ?? ""),
    phone: String(c.phone ?? ""),
    totalAmount: Number(c.totalAmount ?? 0),
  }));
}

export async function submitSale(params: {
  items: { name: string; mrp: number; sale: number; qty: number }[];
  saleType: "cash" | "credit";
  customer?: CustomerSummary | null;
  note?: string;
}): Promise<void> {
  const { items, saleType, customer, note } = params;
  if (items.length === 0) return;

  const date = toDateKey(new Date());
  const createdAt = Date.now();
  const updates: Record<string, unknown> = {};

  for (const item of items) {
    const saleKey = push(ref(db, "sales")).key;
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
    };
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
    updates[`customers/${customer.id}/totalAmount`] =
      (customer.totalAmount ?? 0) + creditTotal;
  }

  await update(ref(db), updates);
}
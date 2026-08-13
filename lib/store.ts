import { get, ref, push, update } from "firebase/database";
import { db } from "./firebase";

export type Product = {
  name: string;
  mrp: number;
  sale: number;
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
  createdAt?: number;
};

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function fetchProducts(): Promise<Product[]> {
  const snap = await get(ref(db, "sales"));
  const raw = snap.val() as Record<string, SaleRecord> | null;
  if (!raw) return [];

  const latest = new Map<string, Product & { createdAt: number }>();
  for (const s of Object.values(raw)) {
    const name = (s.productName ?? "").trim();
    if (!name) continue;
    const createdAt = Number(s.createdAt ?? 0);
    const existing = latest.get(name);
    if (!existing || createdAt > existing.createdAt) {
      latest.set(name, {
        name,
        mrp: Number(s.mrp ?? 0),
        sale: Number(s.sale ?? 0),
        createdAt,
      });
    }
  }

  return [...latest.values()]
    .map(({ createdAt: _createdAt, ...p }) => p)
    .sort((a, b) => a.name.localeCompare(b.name));
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
    updates[`sales/${saleKey}`] = {
      productName: item.name,
      mrp: item.mrp,
      sale: item.sale,
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
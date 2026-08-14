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
    | Record<string, { name?: string; mrp?: number; sale?: number }>
    | null;
  if (!raw) return [];

  return Object.values(raw)
    .map((p) => {
      const mrp = Number(p.mrp ?? 0);
      const sale = Number(p.sale ?? 0);
      return {
        name: String(p.name ?? "").trim(),
        mrp,
        sale: sale > 0 ? sale : mrp,
      };
    })
    .filter((p) => p.name)
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
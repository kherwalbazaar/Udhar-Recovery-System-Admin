import { get, ref, set } from "firebase/database";
import { db } from "./firebase";

export type ProductRecord = {
  name: string;
  barcode?: string;
  category?: string;
  brand?: string;
  unit?: string;
  hsn?: string;
  mrp: number;
  cost?: number;
  sale: number;
  tax?: number;
  profitMargin?: number;
  discount?: number;
  stock?: number;
  reorderLevel?: number;
  stockLocation?: string;
  description?: string;
  supplier?: string;
  rack?: string;
  warranty?: string;
  active: boolean;
  trackStock: boolean;
  createdAt: number;
};

export type RecentProduct = {
  name: string;
  sku: string;
  mrp: number;
  createdAt: number;
};

export async function saveProduct(p: ProductRecord): Promise<void> {
  await set(ref(db, `products/${p.name}`), p);
}

export async function fetchRecentProducts(): Promise<RecentProduct[]> {
  const snap = await get(ref(db, "products"));
  const raw = snap.val() as
    | Record<string, Record<string, unknown>>
    | null;
  if (!raw) return [];
  return Object.values(raw)
    .map((r) => ({
      name: String(r.name ?? ""),
      sku: String(r.barcode ?? r.sku ?? ""),
      mrp: Number(r.mrp ?? 0),
      createdAt: Number(r.createdAt ?? 0),
    }))
    .filter((p) => p.name)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 5);
}
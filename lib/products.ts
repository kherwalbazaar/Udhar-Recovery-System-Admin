import { get, ref, set, update, remove } from "firebase/database";
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
  sale?: number;
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

export async function saveProduct(
  p: ProductRecord,
  checkDuplicate = true
): Promise<void> {
  if (checkDuplicate) {
    const snap = await get(ref(db, `products/${p.name}`));
    if (snap.exists()) {
      throw new Error(`Product "${p.name}" already exists.`);
    }
  }
  await set(ref(db, `products/${p.name}`), p);
}

export async function fetchAllProducts(): Promise<ProductRecord[]> {
  const snap = await get(ref(db, "products"));
  const raw = snap.val() as
    | Record<string, Record<string, unknown>>
    | null;
  if (!raw) return [];
  return Object.values(raw)
    .map((r) => ({
      name: String(r.name ?? ""),
      barcode: r.barcode ? String(r.barcode) : undefined,
      mrp: Number(r.mrp ?? 0),
      cost: r.cost != null ? Number(r.cost) : undefined,
      sale: r.sale != null ? Number(r.sale) : undefined,
      active: Boolean(r.active ?? true),
      trackStock: Boolean(r.trackStock ?? true),
      createdAt: Number(r.createdAt ?? 0),
    }))
    .filter((p) => p.name)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function fetchSoldProducts(): Promise<ProductWithSales[]> {
  const salesSnap = await get(ref(db, "sales"));
  const salesRaw = salesSnap.val() as
    | Record<
        string,
        {
          productName?: string | unknown;
          mrp?: number | unknown;
          sale?: number | unknown;
          salePrice?: number | unknown;
          quantity?: number | unknown;
        }
      >
    | null;

  const soldMap = new Map<
    string,
    { name: string; mrp: number; sale: number; qty: number }
  >();
  if (salesRaw) {
    for (const r of Object.values(salesRaw)) {
      const name = String(r.productName ?? "").trim();
      if (!name) continue;
      const existing = soldMap.get(name);
      const mrp = Number(r.mrp ?? 0);
      const salePrice = Number(r.salePrice ?? r.sale ?? 0);
      const qty = Number(r.quantity ?? 0);
      if (existing) {
        existing.mrp = mrp > 0 ? mrp : existing.mrp;
        existing.sale = salePrice > 0 ? salePrice : existing.sale;
        existing.qty += qty;
      } else {
        soldMap.set(name, { name, mrp, sale: salePrice, qty });
      }
    }
  }

  const productsSnap = await get(ref(db, "products"));
  const productsRaw = productsSnap.val() as
    | Record<string, Record<string, unknown>>
    | null;

  const records: ProductWithSales[] = [];
  soldMap.forEach((s) => {
    const p = productsRaw ? productsRaw[s.name] : undefined;
    const mrp = s.mrp > 0 ? s.mrp : Number(p?.mrp ?? 0);
    records.push({
      name: s.name,
      barcode: p?.barcode ? String(p.barcode) : undefined,
      mrp,
      cost: mrp > 0 ? mrp / 2 : undefined,
      sale:
        s.sale > 0
          ? s.sale
          : p?.sale != null
            ? Number(p.sale)
            : undefined,
      totalQty: s.qty,
      inCatalog: Boolean(p),
    });
  });

  const totalSoldByName = new Map(records.map((r) => [r.name, r.totalQty]));

  if (productsRaw) {
    for (const p of Object.values(productsRaw)) {
      const name = String(p.name ?? "").trim();
      if (!name) continue;
      if (totalSoldByName.has(name)) continue;
      records.push({
        name,
        barcode: p.barcode ? String(p.barcode) : undefined,
        mrp: Number(p.mrp ?? 0),
        cost: p.cost != null ? Number(p.cost) : undefined,
        sale: p.sale != null ? Number(p.sale) : undefined,
        totalQty: 0,
        inCatalog: true,
      });
    }
  }

  return records.sort((a, b) => a.name.localeCompare(b.name));
}

export type ProductWithSales = {
  name: string;
  barcode?: string;
  mrp: number;
  cost?: number;
  sale?: number;
  totalQty: number;
  inCatalog: boolean;
};

export async function updateProduct(
  oldName: string,
  p: ProductRecord
): Promise<void> {
  const updates: Record<string, ProductRecord | null> = {
    [`products/${oldName}`]: null,
  };
  updates[`products/${p.name}`] = p;
  await update(ref(db), updates);
}

export async function deleteProduct(name: string): Promise<void> {
  await remove(ref(db, `products/${name}`));
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
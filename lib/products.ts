import { ref, set, update, remove } from "firebase/database";
import { db } from "./firebase";
import {
  getWithCache,
  CACHE_KEYS,
  readCache,
  triggerActionRefresh,
  writeCache,
} from "./cache";
import { get as firebaseGet } from "firebase/database";

export type ProductRecord = {
  name: string;
  origin?: "catalog" | "sales";
  barcode?: string;
  qrCode?: string;
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
  cost?: number;
  sale?: number;
  createdAt: number;
};

function sanitizeRecord(p: ProductRecord): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(p)) {
    if (v !== undefined) clean[k] = v;
  }
  return clean;
}

export async function saveProduct(
  p: ProductRecord,
  checkDuplicate = true
): Promise<void> {
  if (checkDuplicate) {
    const snap = await firebaseGet(ref(db, `products/${p.name}`));
    if (snap.exists()) {
      throw new Error(`Product "${p.name}" already exists.`);
    }
  }
  await set(ref(db, `products/${p.name}`), sanitizeRecord(p));
  if (typeof window !== "undefined") triggerActionRefresh();
}

export async function fetchAllProducts(): Promise<ProductRecord[]> {
  const snap = await getWithCache(ref(db, "products"), CACHE_KEYS.PRODUCTS);
  const raw = snap.val() as
    | Record<string, Record<string, unknown>>
    | null;
  if (!raw) return [];
  return Object.values(raw)
    .map((r): ProductRecord => ({
      name: String(r.name ?? ""),
      origin: r.origin === "catalog" || r.origin === "sales" ? r.origin : undefined,
      barcode: r.barcode ? String(r.barcode) : undefined,
      qrCode: r.qrCode ? String(r.qrCode) : undefined,
      category: r.category ? String(r.category) : undefined,
      unit: r.unit ? String(r.unit) : undefined,
      mrp: Number(r.mrp ?? 0),
      cost: r.cost != null ? Number(r.cost) : undefined,
      sale: r.sale != null ? Number(r.sale) : undefined,
      tax: r.tax != null ? Number(r.tax) : undefined,
      discount: r.discount != null ? Number(r.discount) : undefined,
      stock: r.stock != null ? Number(r.stock) : undefined,
      active: Boolean(r.active ?? true),
      trackStock: Boolean(r.trackStock ?? true),
      createdAt: Number(r.createdAt ?? 0),
    }))
    .filter((p) => p.name && p.origin !== "sales")
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function fetchCatalogProducts(): Promise<ProductWithSales[]> {
  const [productsSnap, salesSnap] = await Promise.all([
    firebaseGet(ref(db, "products")),
    firebaseGet(ref(db, "sales")),
  ]);
  const raw = productsSnap.val() as Record<string, Record<string, unknown>> | null;
  const salesRaw = salesSnap.val() as Record<string, Record<string, unknown>> | null;
  if (!raw) return [];

  const soldProductNames = new Set(
    Object.values(salesRaw ?? {})
      .map((sale) => String(sale.productName ?? "").trim().toLocaleLowerCase())
      .filter(Boolean)
  );

  return Object.values(raw)
    .filter((product) => {
      const name = String(product.name ?? "").trim();
      if (!name) return false;
      if (product.origin === "catalog") return true;
      if (product.origin === "sales") return false;

      if (!soldProductNames.has(name.toLocaleLowerCase())) return true;

      const mrp = Number(product.mrp ?? 0);
      const cost = Number(product.cost);
      const isLegacyFallbackCost =
        product.cost != null &&
        mrp > 0 &&
        Number.isFinite(cost) &&
        Math.abs(cost - mrp / 2) < 0.01;
      const hasCatalogDetails =
        (product.cost != null && !isLegacyFallbackCost) ||
        product.unit != null ||
        product.stock != null;
      const isLegacyQrStub =
        Boolean(product.qrCode) &&
        product.category == null &&
        !hasCatalogDetails;
      const isLegacySalesQuickAdd =
        Boolean(product.category) &&
        !product.qrCode &&
        !hasCatalogDetails;

      return !isLegacyQrStub && !isLegacySalesQuickAdd;
    })
    .map((product) => ({
      name: String(product.name ?? "").trim(),
      origin: "catalog",
      barcode: product.barcode ? String(product.barcode) : undefined,
      qrCode: product.qrCode ? String(product.qrCode) : undefined,
      category: product.category ? String(product.category) : undefined,
      unit: product.unit ? String(product.unit) : undefined,
      mrp: Number(product.mrp ?? 0),
      cost: product.cost != null ? Number(product.cost) : undefined,
      sale: product.sale != null ? Number(product.sale) : undefined,
      stock: product.stock != null ? Number(product.stock) : undefined,
      totalQty: 0,
      inCatalog: true,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export type ProductWithSales = {
  name: string;
  barcode?: string;
  qrCode?: string;
  category?: string;
  unit?: string;
  mrp: number;
  cost?: number;
  sale?: number;
  stock?: number;
  totalQty: number;
  inCatalog: boolean;
};

export async function updateProduct(
  oldName: string,
  p: ProductRecord
): Promise<void> {
  const sanitized = sanitizeRecord(p);
  if (oldName === p.name) {
    // Updating a product in place should merge fields so stale or partial
    // product lists cannot trigger a duplicate create or erase existing data.
    await update(ref(db, `products/${p.name}`), sanitized);
  } else {
    const updates: Record<string, ProductRecord | null | Record<string, unknown>> = {
      [`products/${oldName}`]: null,
      [`products/${p.name}`]: sanitized,
    };
    await update(ref(db), updates);
  }

  const cached = readCache<unknown>(CACHE_KEYS.PRODUCTS);
  if (cached && typeof cached === "object" && !Array.isArray(cached)) {
    const productMap = { ...(cached as Record<string, Record<string, unknown>>) };
    if (oldName !== p.name) delete productMap[oldName];
    productMap[p.name] = {
      ...(productMap[p.name] ?? {}),
      ...sanitized,
    };
    writeCache(CACHE_KEYS.PRODUCTS, productMap);
  }
  if (typeof window !== "undefined") triggerActionRefresh();
}

export async function deleteProduct(name: string): Promise<void> {
  await remove(ref(db, `products/${name}`));
  if (typeof window !== "undefined") triggerActionRefresh();
}

export async function fetchRecentProducts(): Promise<RecentProduct[]> {
  const snap = await getWithCache(ref(db, "products"), CACHE_KEYS.PRODUCTS);
  const raw = snap.val() as
    | Record<string, Record<string, unknown>>
    | null;
  if (!raw) return [];
  return Object.values(raw)
    .map((r) => ({
      name: String(r.name ?? ""),
      sku: String(r.barcode ?? r.sku ?? ""),
      mrp: Number(r.mrp ?? 0),
      cost: r.cost != null ? Number(r.cost) : undefined,
      sale: r.sale != null ? Number(r.sale) : undefined,
      createdAt: Number(r.createdAt ?? 0),
    }))
    .filter((p) => p.name)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 3);
}

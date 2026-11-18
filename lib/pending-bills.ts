import { get, ref, remove, set, update } from "firebase/database";
import { db } from "./firebase";
import type { CustomerSummary } from "./store";

export type PendingBillItem = {
  name: string;
  chipBg: string;
  purchase: number;
  barcode: string;
  mrp: number;
  sale: number;
  size: string;
  qty: number;
};

export type PendingBillStatus = "PENDING" | "COMPLETED";

export type PendingBill = {
  id: string;
  name: string;
  mobile: string;
  address: string;
  isSaved: boolean;
  items: PendingBillItem[];
  title?: string;
  customer: CustomerSummary | null;
  invoiceNo: string | null;
  paymentMode: string;
  cgstAmount: number;
  received: number;
  receivedTouched: boolean;
  updatedAt: number;
  status: PendingBillStatus;
  completedAt?: number;
};

export const PENDING_BILL_MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes

export function isPendingBillExpired(bill: { updatedAt?: number }): boolean {
  if (!bill?.updatedAt) return true;
  return Date.now() - bill.updatedAt > PENDING_BILL_MAX_AGE_MS;
}

const localKey = (id: string) => `udhar_pending_bill_v1_${id}`;

/** Firebase rejects `undefined` values, so drop them before every write. */
function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry) => stripUndefined(entry)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const clean: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (entry !== undefined) clean[key] = stripUndefined(entry);
    }
    return clean as T;
  }
  return value;
}

export function normalizePendingBill(raw: Partial<PendingBill> & { id: string }): PendingBill {
  const customer = raw.customer || null;
  const isSaved = Boolean(
    raw.isSaved ??
      (customer && customer.name && customer.name.trim().toLowerCase() !== "kherwal bazaar")
  );
  const name = raw.name || (isSaved ? customer?.name || "" : "");
  const mobile = raw.mobile || (isSaved ? customer?.phone || "" : "");
  const address = raw.address || (isSaved ? customer?.address || "" : "");
  return {
    id: raw.id,
    name,
    mobile,
    address,
    isSaved,
    items: toItems(raw.items),
    title: raw.title || (isSaved && name ? name : "Bill 1"),
    customer,
    invoiceNo: raw.invoiceNo || null,
    paymentMode: raw.paymentMode || "Cash",
    cgstAmount: raw.cgstAmount || 0,
    received: raw.received || 0,
    receivedTouched: Boolean(raw.receivedTouched),
    updatedAt: raw.updatedAt || Date.now(),
    status: raw.status || "PENDING",
    completedAt: raw.completedAt,
  };
}

export function fetchLocalPendingBills(): PendingBill[] {
  if (typeof window === "undefined") return [];
  const bills: PendingBill[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key?.startsWith("udhar_pending_bill_v1_")) continue;
    try {
      const bill = JSON.parse(window.localStorage.getItem(key) ?? "null") as (Partial<PendingBill> & { id: string }) | null;
      if (bill?.id) {
        if (isPendingBillExpired(bill)) {
          window.localStorage.removeItem(key);
        } else if (bill.status !== "COMPLETED") {
          bills.push(normalizePendingBill(bill));
        }
      }
    } catch {
      // Ignore a damaged local recovery copy; Firebase remains authoritative.
    }
  }
  return bills;
}

export function saveLocalPendingBill(bill: PendingBill): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(localKey(bill.id), JSON.stringify(bill)); } catch { /* best effort recovery copy */ }
}

export function deleteLocalPendingBill(id: string): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.removeItem(localKey(id)); } catch { /* best effort cleanup */ }
}

/**
 * Keep the device copy on disk but flag it as finished. Used right after a sale
 * is recorded so a page reload cannot bring the completed bill back as pending,
 * even when the Firebase cleanup has not run yet.
 */
export function markLocalPendingBillCompleted(id: string): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(localKey(id));
    if (!raw) return;
    const bill = JSON.parse(raw) as PendingBill;
    window.localStorage.setItem(
      localKey(id),
      JSON.stringify({ ...bill, status: "COMPLETED", completedAt: Date.now() })
    );
  } catch {
    // Nothing to recover; the completedBills marker still hides it in the UI.
  }
}

export type PendingBillSnapshot = {
  bills: PendingBill[];
  /** Bills that were already turned into real sales and must never reopen. */
  completedIds: string[];
};

export async function fetchPendingBillSnapshot(): Promise<PendingBillSnapshot> {
  const [pendingSnapshot, completedSnapshot] = await Promise.all([
    get(ref(db, "pendingBills")),
    get(ref(db, "completedBills")),
  ]);
  const raw = pendingSnapshot.val() as Record<string, Omit<PendingBill, "id"> & { id?: string }> | null;
  const completed = completedSnapshot.val() as Record<string, { status?: string }> | null;
  const completedIds = Object.entries(completed ?? {})
    .filter(([, marker]) => marker?.status === "COMPLETED")
    .map(([id]) => id);
  const bills: PendingBill[] = [];
  if (raw) {
    for (const [id, bill] of Object.entries(raw)) {
      if (!bill || completed?.[id]?.status === "COMPLETED") continue;
      if (isPendingBillExpired(bill)) {
        void deletePendingBill(id).catch(() => {});
        deleteLocalPendingBill(id);
      } else if (bill.status === "PENDING") {
        bills.push(normalizePendingBill({ ...bill, id }));
      }
    }
  }
  bills.sort((a, b) => b.updatedAt - a.updatedAt);
  return { bills, completedIds };
}

/** Firebase stores arrays as numeric-key objects, so normalise them back. */
function toItems(raw: unknown): PendingBillItem[] {
  if (Array.isArray(raw)) return raw.filter(Boolean) as PendingBillItem[];
  if (raw && typeof raw === "object") return Object.values(raw).filter(Boolean) as PendingBillItem[];
  return [];
}

export async function fetchPendingBills(): Promise<PendingBill[]> {
  return (await fetchPendingBillSnapshot()).bills;
}

export async function savePendingBill(bill: PendingBill): Promise<void> {
  await set(ref(db, `pendingBills/${bill.id}`), stripUndefined(bill));
}

/** Close a pending bill after its sale record has been written. */
export async function completePendingBill(id: string): Promise<void> {
  await update(ref(db, `pendingBills/${id}`), {
    status: "COMPLETED" satisfies PendingBillStatus,
    completedAt: Date.now(),
  });
}

export async function deletePendingBill(id: string): Promise<void> {
  await remove(ref(db, `pendingBills/${id}`));
}

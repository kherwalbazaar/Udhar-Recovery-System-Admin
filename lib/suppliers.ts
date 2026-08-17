import { toEntries, type RawMap } from "./khata";

export type { RawMap } from "./khata";

export type SupplierTransaction = {
  id: string;
  itemName: string;
  amount: number;
  date: string;
  type: "purchase" | "payment";
  createdAt: number;
};

export type Supplier = {
  id: string;
  name: string;
  phone: string;
  collectionType: string;
  totalAmount: number;
  totalPurchase: number;
  totalPaid: number;
  balance: number;
  transactions: SupplierTransaction[];
};

export type SupplierMetrics = {
  totalSuppliers: number;
  totalPurchase: number;
  totalPaid: number;
  youWillGive: number;
  youWillGet: number;
  dueSuppliers: number;
  advanceSuppliers: number;
  settledSuppliers: number;
};

export type SupplierData = {
  suppliers: Supplier[];
  metrics: SupplierMetrics;
};

/**
 * Supplier Ledger Engine (Liability / Payables)
 *
 * Formula: Supplier Balance = Total Purchases - Total Payments Made
 *  - Balance > 0  -> you owe the supplier  -> "You will Give" (Due)
 *  - Balance == 0 -> fully settled
 *  - Balance < 0  -> you paid in advance   -> "Advance Paid"
 */
export function buildSuppliers(rawSuppliers: RawMap): SupplierData {
  const suppliers: Supplier[] = [];
  let totalPurchase = 0;
  let totalPaid = 0;
  let youWillGive = 0;
  let youWillGet = 0;
  let dueSuppliers = 0;
  let advanceSuppliers = 0;
  let settledSuppliers = 0;

  for (const s of toEntries(rawSuppliers)) {
    const transactions: SupplierTransaction[] = [];
    let purchase = 0;
    let paid = 0;

    for (const t of toEntries((s.transactions as RawMap) ?? null)) {
      const amount = Number(t.amount ?? 0);
      const isPayment = t.type === "payment" || t.type === "got";
      const type: "purchase" | "payment" = isPayment ? "payment" : "purchase";
      if (isPayment) paid += amount;
      else purchase += amount;

      transactions.push({
        id: String(t.id),
        itemName: String(t.itemName ?? ""),
        amount,
        date: String(t.date ?? ""),
        type,
        createdAt: Number(t.createdAt ?? 0),
      });
    }

    const balance = purchase - paid;
    totalPurchase += purchase;
    totalPaid += paid;
    if (balance > 0) {
      youWillGive += balance;
      dueSuppliers += 1;
    } else if (balance < 0) {
      youWillGet += -balance;
      advanceSuppliers += 1;
    } else {
      settledSuppliers += 1;
    }

    suppliers.push({
      id: String(s.id),
      name: String(s.name ?? "Unknown"),
      phone: String(s.phone ?? ""),
      collectionType: String(s.collectionType ?? ""),
      totalAmount: Number(s.totalAmount ?? 0),
      totalPurchase: purchase,
      totalPaid: paid,
      balance,
      transactions: transactions.sort((a, b) => b.createdAt - a.createdAt),
    });
  }

  suppliers.sort((a, b) => b.balance - a.balance);

  return {
    suppliers,
    metrics: {
      totalSuppliers: suppliers.length,
      totalPurchase,
      totalPaid,
      youWillGive,
      youWillGet,
      dueSuppliers,
      advanceSuppliers,
      settledSuppliers,
    },
  };
}

/**
 * Running balance per transaction for the ledger table rows.
 * Purchase increases liability (you give), Payment decreases it.
 */
export function supplierRunningBalances(
  transactions: SupplierTransaction[]
): Map<string, number> {
  const asc = [...transactions].sort((a, b) => a.createdAt - b.createdAt);
  const map = new Map<string, number>();
  let balance = 0;
  for (const t of asc) {
    balance += t.type === "purchase" ? t.amount : -t.amount;
    map.set(t.id, balance);
  }
  return map;
}

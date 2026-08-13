export type RawMap = Record<string, Record<string, unknown>> | null;

type SaleRecord = {
  id: string;
  productName: string;
  sale: number;
  date: string;
  createdAt: number;
};

type TransactionRecord = {
  id: string;
  customerId: string;
  customerName: string;
  itemName: string;
  amount: number;
  date: string;
  type: "gave" | "got";
};

export type RecentSaleRow = {
  billNo: string;
  customer: string;
  amount: number;
  type: "Cash" | "Credit";
  status: "Paid" | "Pending";
  time: string;
};

function toEntries(raw: RawMap): Record<string, unknown>[] {
  return raw ? Object.entries(raw).map(([id, value]) => ({ id, ...value })) : [];
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  let hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${hours}:${String(minutes).padStart(2, "0")} ${ampm}`;
}

export function buildRecentSales(
  rawSales: RawMap,
  rawCustomers: RawMap,
  limit = 5
): RecentSaleRow[] {
  const sales: SaleRecord[] = toEntries(rawSales).map((s) => ({
    id: String(s.id),
    productName: String(s.productName ?? ""),
    sale: Number(s.sale ?? 0),
    date: String(s.date ?? ""),
    createdAt: Number(s.createdAt ?? 0),
  }));

  const transactions: TransactionRecord[] = [];
  const customerBalance = new Map<string, number>();

  for (const c of toEntries(rawCustomers)) {
    const customerId = String(c.id);
    const customerName = String(c.name ?? "Unknown");
    let balance = 0;

    for (const t of toEntries((c.transactions as RawMap) ?? null)) {
      const amount = Number(t.amount ?? 0);
      const type: "gave" | "got" = t.type === "got" ? "got" : "gave";
      balance += type === "got" ? -amount : amount;
      transactions.push({
        id: String(t.id),
        customerId,
        customerName,
        itemName: String(t.itemName ?? ""),
        amount,
        date: String(t.date ?? ""),
        type,
      });
    }
    customerBalance.set(customerId, balance);
  }

  const byKey = new Map<string, TransactionRecord[]>();
  for (const t of transactions) {
    const key = `${t.date}|${t.amount}`;
    const arr = byKey.get(key) ?? [];
    arr.push(t);
    byKey.set(key, arr);
  }

  const used = new Set<string>();
  const total = sales.length;

  return sales
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit)
    .map((sale, index) => {
      const key = `${sale.date}|${sale.sale}`;
      const match = (byKey.get(key) ?? []).find(
        (t) => t.type === "gave" && !used.has(t.id)
      );

      let customer = "Walk-in Customer";
      let type: RecentSaleRow["type"] = "Cash";
      let status: RecentSaleRow["status"] = "Paid";

      if (match) {
        used.add(match.id);
        customer = match.customerName;
        type = "Credit";
        const balance = customerBalance.get(match.customerId) ?? 0;
        status = balance > 0 ? "Pending" : "Paid";
      }

      return {
        billNo: `BILL-${String(total - index).padStart(4, "0")}`,
        customer,
        amount: sale.sale,
        type,
        status,
        time: formatTime(sale.createdAt),
      };
    });
}
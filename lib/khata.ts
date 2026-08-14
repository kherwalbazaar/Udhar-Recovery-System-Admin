export type RawMap = Record<string, Record<string, unknown>> | null;

export type KhataTransaction = {
  id: string;
  itemName: string;
  amount: number;
  date: string;
  type: "gave" | "got";
  createdAt: number;
};

export type KhataCustomer = {
  id: string;
  name: string;
  phone: string;
  collectionType: string;
  totalAmount: number;
  gave: number;
  got: number;
  balance: number;
  transactions: KhataTransaction[];
};

export type KhataMetrics = {
  totalCustomers: number;
  totalGiven: number;
  totalRecovered: number;
  totalDue: number;
  dueCustomers: number;
  giveBack: number;
  giveBackCustomers: number;
  overdueCount: number;
  paidCount: number;
};

export type KhataData = {
  customers: KhataCustomer[];
  metrics: KhataMetrics;
};

function toEntries(raw: RawMap): Record<string, unknown>[] {
  return raw ? Object.entries(raw).map(([id, value]) => ({ id, ...value })) : [];
}

export function buildKhata(rawCustomers: RawMap): KhataData {
  const customers: KhataCustomer[] = [];
  let totalGiven = 0;
  let totalRecovered = 0;
  let totalDue = 0;
  let dueCustomers = 0;
  let giveBack = 0;
  let giveBackCustomers = 0;
  let overdueCount = 0;
  let paidCount = 0;

  for (const c of toEntries(rawCustomers)) {
    const transactions: KhataTransaction[] = [];
    let gave = 0;
    let got = 0;

    for (const t of toEntries((c.transactions as RawMap) ?? null)) {
      const amount = Number(t.amount ?? 0);
      const type: "gave" | "got" = t.type === "got" ? "got" : "gave";
      if (type === "gave") gave += amount;
      else got += amount;

      transactions.push({
        id: String(t.id),
        itemName: String(t.itemName ?? ""),
        amount,
        date: String(t.date ?? ""),
        type,
        createdAt: Number(t.createdAt ?? 0),
      });
    }

    const balance = gave - got;
    totalGiven += gave;
    totalRecovered += got;
    if (balance > 0) {
      overdueCount += 1;
      totalDue += balance;
      dueCustomers += 1;
    } else if (balance < 0) {
      giveBack += -balance;
      giveBackCustomers += 1;
      paidCount += 1;
    } else paidCount += 1;

    customers.push({
      id: String(c.id),
      name: String(c.name ?? "Unknown"),
      phone: String(c.phone ?? ""),
      collectionType: String(c.collectionType ?? ""),
      totalAmount: Number(c.totalAmount ?? 0),
      gave,
      got,
      balance,
      transactions: transactions.sort((a, b) => b.createdAt - a.createdAt),
    });
  }

  customers.sort((a, b) => b.balance - a.balance);

  return {
    customers,
    metrics: {
      totalCustomers: customers.length,
      totalGiven,
      totalRecovered,
      totalDue,
      dueCustomers,
      giveBack,
      giveBackCustomers,
      overdueCount,
      paidCount,
    },
  };
}

export function runningBalances(
  transactions: KhataTransaction[]
): Map<string, number> {
  const asc = [...transactions].sort((a, b) => a.createdAt - b.createdAt);
  const map = new Map<string, number>();
  let balance = 0;
  for (const t of asc) {
    balance += t.type === "gave" ? t.amount : -t.amount;
    map.set(t.id, balance);
  }
  return map;
}
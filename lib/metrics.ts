export type RawMap = Record<string, Record<string, unknown>> | null;

export type Metrics = {
  given: number;
  givenCustomers: number;
  recovered: number;
  recoveredPayments: number;
  totalDue: number;
  dueCustomers: number;
  giveBack: number;
  giveBackCustomers: number;
  saleToday: number;
  saleTodayCount: number;
  collectionToday: number;
  collectionTodayCount: number;
  profitToday: number;
  profitThisMonth: number;
  dateLabel: string;
};

function toEntries(raw: RawMap): Record<string, unknown>[] {
  return raw ? Object.entries(raw).map(([id, value]) => ({ id, ...value })) : [];
}

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toMonthPrefix(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatDateLabel(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
    weekday: "long",
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")} ${get("month")} ${get("year")}, ${get("weekday")}`;
}

export function buildMetrics(
  rawSales: RawMap,
  rawCustomers: RawMap,
  rawCashbook: RawMap,
  rawProducts: RawMap,
  now: Date
): Metrics {
  const todayKey = toDateKey(now);
  const monthPrefix = toMonthPrefix(now);

  const costByProduct = new Map<string, number>();
  for (const p of toEntries(rawProducts)) {
    const name = String(p.name ?? "").trim();
    if (name) costByProduct.set(name, Number(p.cost ?? 0));
  }
  const costOf = (product: string, mrp: number) =>
    costByProduct.get(product) && costByProduct.get(product)! > 0
      ? costByProduct.get(product)!
      : mrp / 2;

  let given = 0;
  let givenCustomers = 0;
  let recovered = 0;
  let recoveredPayments = 0;
  let totalDue = 0;
  let dueCustomers = 0;
  let giveBack = 0;
  let giveBackCustomers = 0;
  let collectionToday = 0;
  let collectionTodayCount = 0;

  const todayCreditKeys = new Set<string>();
  for (const c of toEntries(rawCustomers)) {
    for (const t of toEntries((c.transactions as RawMap) ?? null)) {
      const date = String(t.date ?? "");
      if (date === todayKey && t.type === "gave") {
        todayCreditKeys.add(`${date}|${Number(t.amount ?? 0)}`);
      }
    }
  }

  for (const c of toEntries(rawCustomers)) {
    let customerGiven = 0;
    let customerGot = 0;
    let hasGave = false;
    for (const t of toEntries((c.transactions as RawMap) ?? null)) {
      const amount = Number(t.amount ?? 0);
      const date = String(t.date ?? "");
      if (t.type === "got") {
        customerGot += amount;
        recovered += amount;
        recoveredPayments += 1;
        if (date === todayKey) {
          collectionToday += amount;
          collectionTodayCount += 1;
        }
      } else {
        customerGiven += amount;
        hasGave = true;
      }
    }
    if (hasGave) givenCustomers += 1;
    const due = customerGiven - customerGot;
    if (due > 0) {
      totalDue += due;
      dueCustomers += 1;
    } else if (due < 0) {
      giveBack += -due;
      giveBackCustomers += 1;
    }
  }

  let saleToday = 0;
  let saleTodayCount = 0;
  for (const s of toEntries(rawSales)) {
    if (String(s.date ?? "") === todayKey) {
      saleToday += Number(s.sale ?? 0);
      saleTodayCount += 1;
      const key = `${todayKey}|${Number(s.sale ?? 0)}`;
      if (!todayCreditKeys.has(key)) {
        collectionToday += Number(s.sale ?? 0);
        collectionTodayCount += 1;
      }
    }
  }

  let profitToday = 0;
  let profitThisMonth = 0;
  for (const s of toEntries(rawSales)) {
    const date = String(s.date ?? "");
    if (!date.startsWith(monthPrefix)) continue;
    const mrp = Number(s.mrp ?? 0);
    const sale = Number(s.sale ?? 0);
    const quantity = Number(s.quantity ?? 1);
    const p = sale - costOf(String(s.productName ?? ""), mrp) * quantity;
    profitThisMonth += p;
    if (date === todayKey) profitToday += p;
  }

  return {
    given,
    givenCustomers,
    recovered,
    recoveredPayments,
    totalDue,
    dueCustomers,
    giveBack,
    giveBackCustomers,
    saleToday,
    saleTodayCount,
    collectionToday,
    collectionTodayCount,
    profitToday,
    profitThisMonth,
    dateLabel: formatDateLabel(now),
  };
}
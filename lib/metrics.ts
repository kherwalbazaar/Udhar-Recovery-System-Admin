export type RawMap = Record<string, Record<string, unknown>> | null;

export type Metrics = {
  given: number;
  givenCustomers: number;
  recovered: number;
  recoveredPayments: number;
  saleToday: number;
  saleTodayCount: number;
  collectionToday: number;
  collectionTodayCount: number;
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
  now: Date
): Metrics {
  const todayKey = toDateKey(now);
  const monthPrefix = toMonthPrefix(now);

  let given = 0;
  let givenCustomers = 0;
  let recovered = 0;
  let recoveredPayments = 0;
  let collectionToday = 0;
  let collectionTodayCount = 0;

  for (const c of toEntries(rawCustomers)) {
    let hasGave = false;
    for (const t of toEntries((c.transactions as RawMap) ?? null)) {
      const amount = Number(t.amount ?? 0);
      const date = String(t.date ?? "");
      if (t.type === "got") {
        recovered += amount;
        recoveredPayments += 1;
        if (date === todayKey) {
          collectionToday += amount;
          collectionTodayCount += 1;
        }
      } else {
        given += amount;
        hasGave = true;
      }
    }
    if (hasGave) givenCustomers += 1;
  }

  let saleToday = 0;
  let saleTodayCount = 0;
  for (const s of toEntries(rawSales)) {
    if (String(s.date ?? "") === todayKey) {
      saleToday += Number(s.sale ?? 0);
      saleTodayCount += 1;
    }
  }

  let profitThisMonth = 0;
  for (const e of toEntries(rawCashbook)) {
    const date = String(e.date ?? "");
    if (!date.startsWith(monthPrefix)) continue;
    const amount = Number(e.amount ?? 0);
    profitThisMonth += e.type === "out" ? -amount : amount;
  }

  return {
    given,
    givenCustomers,
    recovered,
    recoveredPayments,
    saleToday,
    saleTodayCount,
    collectionToday,
    collectionTodayCount,
    profitThisMonth,
    dateLabel: formatDateLabel(now),
  };
}
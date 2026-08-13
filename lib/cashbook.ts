export type RawMap = Record<string, Record<string, unknown>> | null;

export type CashbookEntry = {
  id: string;
  amount: number;
  category: string;
  mode: string;
  remark: string;
  date: string;
  type: "in" | "out";
  createdAt: number;
};

export type CashbookMetrics = {
  opening: number;
  monthIn: number;
  monthOut: number;
  closing: number;
  monthKey: string;
};

export type TrendPoint = {
  label: string;
  value: number;
};

export type CashbookData = {
  entries: CashbookEntry[];
  metrics: CashbookMetrics;
  running: Map<string, number>;
  trend: TrendPoint[];
};

function toEntries(raw: RawMap): Record<string, unknown>[] {
  return raw ? Object.entries(raw).map(([id, value]) => ({ id, ...value })) : [];
}

function monthKeyOf(date: string): string {
  return date.slice(0, 7);
}

function toMonthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function buildCashbook(raw: RawMap, now: Date): CashbookData {
  const entries: CashbookEntry[] = toEntries(raw).map((e) => ({
    id: String(e.id),
    amount: Number(e.amount ?? 0),
    category: String(e.category ?? ""),
    mode: String(e.mode ?? ""),
    remark: String(e.remark ?? ""),
    date: String(e.date ?? ""),
    type: e.type === "out" ? "out" : "in",
    createdAt: Number(e.createdAt ?? 0),
  }));

  const monthKey = toMonthKey(now);

  let totalIn = 0;
  let totalOut = 0;
  let monthIn = 0;
  let monthOut = 0;

  for (const e of entries) {
    if (e.type === "in") {
      totalIn += e.amount;
      if (monthKeyOf(e.date) === monthKey) monthIn += e.amount;
    } else {
      totalOut += e.amount;
      if (monthKeyOf(e.date) === monthKey) monthOut += e.amount;
    }
  }

  const closing = totalIn - totalOut;
  const opening = closing - (monthIn - monthOut);

  const running = new Map<string, number>();
  let balance = 0;
  const asc = [...entries].sort((a, b) => a.createdAt - b.createdAt);
  const trend: TrendPoint[] = [];
  for (const e of asc) {
    balance += e.type === "in" ? e.amount : -e.amount;
    running.set(e.id, balance);
    trend.push({
      label: e.date.slice(5).replace("-", " "),
      value: balance,
    });
  }

  return {
    entries: entries.sort((a, b) => b.createdAt - a.createdAt),
    metrics: { opening, monthIn, monthOut, closing, monthKey },
    running,
    trend,
  };
}
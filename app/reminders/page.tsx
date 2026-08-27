"use client";

import { useEffect, useState } from "react";
import { ref, update, push } from "firebase/database";
import { onValueWithCache, CACHE_KEYS } from "@/lib/cache";
import {
  Bell,
  Users,
  Wallet,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Check,
  Search,
  Loader2,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import { db } from "@/lib/firebase";
import { buildKhata, type KhataCustomer, type RawMap } from "@/lib/khata";

const fmt = (n: number) => n.toLocaleString("en-IN");
const fmtMoney = (n: number) => `₹${fmt(n)}`;

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysDiff(dateStr: string): number {
  const [y, m, day] = dateStr.split("-").map(Number);
  const target = new Date(y, m - 1, day);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

const AVATAR_COLORS = [
  "bg-blue-600",
  "bg-purple-500",
  "bg-orange-400",
  "bg-teal-500",
  "bg-emerald-500",
  "bg-purple-600",
  "bg-amber-400",
  "bg-blue-400",
];

function colorFor(name: string) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function status(days: number): { label: string; cls: string } {
  if (days < 0)
    return { label: `Overdue by ${-days} day${days === -1 ? "" : "s"}`, cls: "bg-red-50 text-red-600" };
  if (days === 0) return { label: "Due Today", cls: "bg-amber-50 text-amber-600" };
  if (days === 1) return { label: "Tomorrow", cls: "bg-blue-50 text-blue-600" };
  return { label: `In ${days} days`, cls: "bg-slate-100 text-slate-600" };
}

type Metric = {
  label: string;
  value: string;
  icon: React.ElementType;
  bg: string;
  valueClass: string;
};

function MetricCard({ metric }: { metric: Metric }) {
  const Icon = metric.icon;
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center space-x-3">
      <div className={`p-2.5 ${metric.bg} rounded-lg`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-[11px] text-slate-400 font-medium">{metric.label}</p>
        <h3 className={`text-xl font-bold ${metric.valueClass}`}>
          {metric.value}
        </h3>
      </div>
    </div>
  );
}

export default function RemindersPage() {
  const [customers, setCustomers] = useState<KhataCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [dates, setDates] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);

  useEffect(() => {
    const customersRef = ref(db, "customers");
    const unsub = onValueWithCache(
      customersRef,
      CACHE_KEYS.CUSTOMERS,
      (snap) => {
        const raw = snap.val() as RawMap;
        const data = buildKhata(raw);
        const due = data.customers.filter((c) => c.balance > 0);
        setCustomers(due);
        const d: Record<string, string> = {};
        if (raw) {
          for (const id of Object.keys(raw)) {
            const r = raw[id] as Record<string, unknown>;
            if (r.reminderDate) d[id] = String(r.reminderDate);
          }
        }
        setDates(d);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const saveReminder = async (id: string) => {
    const date = dates[id];
    if (!date) return;
    setSavingId(id);
    setSavedId(null);
    setDateError(null);
    try {
      const customer = customers.find((c) => c.id === id);
      await update(ref(db, `customers/${id}`), { reminderDate: date });
      if (customer) {
        await push(ref(db, "reminders"), {
          customerId: customer.id,
          customerName: customer.name,
          phone: customer.phone,
          dueAmount: customer.balance,
          reminderDate: date,
          status: daysDiff(date) < 0 ? "overdue" : "pending",
          createdAt: Date.now(),
        });
      }
      setSavedId(id);
      setTimeout(() => setSavedId(null), 2000);
    } catch (e) {
      setDateError(e instanceof Error ? e.message : "Failed to save reminder.");
    } finally {
      setSavingId(null);
    }
  };

  const q = search.trim().toLowerCase();
  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q)
  );

  const dueTotal = customers.reduce((s, c) => s + c.balance, 0);
  const remindersSet = customers.filter((c) => dates[c.id]).length;
  const overdue = customers.filter(
    (c) => dates[c.id] && daysDiff(dates[c.id]) < 0
  ).length;

  const metrics: Metric[] = [
    {
      label: "Credit Customers",
      value: String(customers.length),
      icon: Users,
      bg: "bg-blue-500 text-white",
      valueClass: "text-slate-800",
    },
    {
      label: "Total Due",
      value: fmtMoney(dueTotal),
      icon: Wallet,
      bg: "bg-red-500 text-white",
      valueClass: "text-red-600",
    },
    {
      label: "Reminders Set",
      value: String(remindersSet),
      icon: Calendar,
      bg: "bg-emerald-500 text-white",
      valueClass: "text-emerald-600",
    },
    {
      label: "Overdue",
      value: String(overdue),
      icon: AlertCircle,
      bg: "bg-amber-500 text-white",
      valueClass: "text-amber-600",
    },
  ];

  return (
    <AppShell title="" active="Reminders">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">
          Payment Reminders
        </h1>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {metrics.map((m) => (
          <MetricCard key={m.label} metric={m} />
        ))}
      </div>

      {loading && (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-xs text-slate-400">
          Loading credit customers...
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center text-xs text-red-500">
          Failed to load: {error}
        </div>
      )}
      {dateError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs font-semibold text-red-600">
          {dateError}
        </div>
      )}

      {!loading && !error && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-1.5 text-sm font-bold text-slate-800">
              <Bell className="w-4 h-4 text-blue-600" />
              <span>Credit Customer Reminders</span>
            </div>
            <div className="relative w-56">
              <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-slate-400">
                <Search className="w-3.5 h-3.5" />
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search customer..."
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-pink-100 text-pink-800 text-[10px] font-semibold">
                  <th className="py-2 pl-3 pr-2 text-left rounded-l-lg">
                    Customer
                  </th>
                  <th className="py-2 px-2 text-right">Due Amount (₹)</th>
                  <th className="py-2 px-2 text-left">Reminder Date</th>
                  <th className="py-2 px-2 text-center">Status</th>
                  <th className="py-2 pl-2 pr-3 text-right rounded-r-lg">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-slate-100">
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-6 text-center text-slate-400"
                    >
                      No credit customers found.
                    </td>
                  </tr>
                )}
                {filtered.map((c) => {
                  const reminderDate = dates[c.id] as string | undefined;
                  const days = reminderDate ? daysDiff(reminderDate) : null;
                  const st = days !== null ? status(days) : null;
                  return (
                    <tr key={c.id}>
                      <td className="py-2.5 pl-3 pr-2">
                        <div className="flex items-center space-x-2">
                          <span
                            className={`w-7 h-7 rounded-full ${colorFor(
                              c.name
                            )} text-white text-[10px] flex items-center justify-center font-semibold`}
                          >
                            {c.name.charAt(0).toUpperCase()}
                          </span>
                          <div>
                            <p className="text-xs font-medium text-slate-800">
                              {c.name}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {c.phone || "—"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-right font-bold text-red-600">
                        {fmtMoney(c.balance)}
                      </td>
                      <td className="py-2.5 px-2">
                        <input
                          type="date"
                          value={dates[c.id] ?? ""}
                          min={toDateKey(new Date())}
                          onChange={(e) =>
                            setDates((prev) => ({
                              ...prev,
                              [c.id]: e.target.value,
                            }))
                          }
                          className="w-36 px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        {st ? (
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${st.cls}`}
                          >
                            {st.label}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">
                            Not set
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 pl-2 pr-3 text-right">
                        <button
                          type="button"
                          onClick={() => saveReminder(c.id)}
                          disabled={!dates[c.id] || savingId === c.id}
                          className="inline-flex items-center space-x-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[10px] font-medium px-2.5 py-1.5 rounded-md"
                        >
                          {savingId === c.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : savedId === c.id ? (
                            <Check className="w-3 h-3" />
                          ) : (
                            <CheckCircle2 className="w-3 h-3" />
                          )}
                          <span>
                            {savingId === c.id
                              ? "Saving..."
                              : savedId === c.id
                                ? "Saved"
                                : "Set Reminder"}
                          </span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AppShell>
  );
}
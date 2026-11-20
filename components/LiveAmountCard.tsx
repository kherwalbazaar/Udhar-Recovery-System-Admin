"use client";

import { useEffect, useState } from "react";
import { Radio } from "lucide-react";
import { ref as dbRef } from "firebase/database";
import { db } from "@/lib/firebase";
import { onValueWithCache, CACHE_KEYS } from "@/lib/cache";
import { supabase } from "@/lib/supabase";

type ConnectionStatus = "connecting" | "connected" | "unavailable";
type AmountStatus = "loading" | "loaded" | "empty" | "unavailable";

function formatRupee(amount: number): string {
  return `₹ ${amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Calculates the total amount of the latest bill from sales records.
 * Groups line items belonging to the same bill by invoiceNo, bill_<id>, or createdAt timestamp.
 */
export function calculateLatestBillAmount(rawSales: unknown): number | null {
  if (!rawSales || typeof rawSales !== "object") return null;

  const billsMap = new Map<
    string,
    {
      billKey: string;
      total: number;
      createdAt: number;
    }
  >();

  for (const [key, rawItem] of Object.entries(
    rawSales as Record<string, Record<string, unknown>>
  )) {
    if (!rawItem || typeof rawItem !== "object") continue;

    // Determine bill identifier
    const invoiceNo = rawItem.invoiceNo ? String(rawItem.invoiceNo).trim() : "";
    let billKey = invoiceNo;
    if (!billKey) {
      const match = key.match(/^(bill_[^_]+)_/);
      if (match) {
        billKey = match[1];
      } else if (rawItem.createdAt) {
        billKey = `ts_${rawItem.createdAt}`;
      } else {
        billKey = key;
      }
    }

    const saleVal = Number(rawItem.sale);
    const qty = Math.max(1, Number(rawItem.quantity ?? 1));
    const salePrice = Number(rawItem.salePrice ?? rawItem.mrp ?? 0);
    const itemAmount = Number.isFinite(saleVal) ? saleVal : salePrice * qty;
    const createdAt = Number(rawItem.createdAt ?? 0);

    const existing = billsMap.get(billKey);
    if (!existing) {
      billsMap.set(billKey, {
        billKey,
        total: itemAmount,
        createdAt,
      });
    } else {
      existing.total += itemAmount;
      if (createdAt > existing.createdAt) {
        existing.createdAt = createdAt;
      }
    }
  }

  const bills = Array.from(billsMap.values()).sort(
    (a, b) => b.createdAt - a.createdAt || b.billKey.localeCompare(a.billKey)
  );

  if (bills.length === 0) return null;
  return bills[0].total;
}

export default function LiveAmountCard({
  variant = "card",
}: {
  variant?: "card" | "tab";
}) {
  const [amount, setAmount] = useState<number | null>(null);
  const [amountStatus, setAmountStatus] = useState<AmountStatus>("loading");
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("connecting");
  const [queryError, setQueryError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    // Fallback to Supabase amount_value if Firebase has no sales
    const fallbackToSupabase = async () => {
      if (!supabase) {
        if (isMounted) {
          setAmount(null);
          setAmountStatus("empty");
        }
        return;
      }

      try {
        const { data, error } = await supabase
          .from("amount_value")
          .select("id, amount")
          .order("id", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!isMounted) return;

        if (error || !data) {
          setAmount(null);
          setAmountStatus("empty");
          return;
        }

        const fallbackAmount = Number(data.amount);
        if (Number.isFinite(fallbackAmount) && fallbackAmount > 0) {
          setAmount(fallbackAmount);
          setAmountStatus("loaded");
        } else {
          setAmount(null);
          setAmountStatus("empty");
        }
      } catch {
        if (isMounted) {
          setAmount(null);
          setAmountStatus("empty");
        }
      }
    };

    // Subscribe to Firebase sales with instant offline cache hydration
    const salesRef = dbRef(db, "sales");
    const unsubscribeFirebase = onValueWithCache(
      salesRef,
      CACHE_KEYS.SALES,
      (snap) => {
        if (!isMounted) return;
        const val = snap.val();
        const latestAmount = calculateLatestBillAmount(val);

        if (latestAmount !== null && Number.isFinite(latestAmount)) {
          setAmount(latestAmount);
          setAmountStatus("loaded");
          setConnectionStatus("connected");
          setQueryError(null);
        } else {
          // If no sales exist in Firebase, try Supabase fallback
          void fallbackToSupabase();
          setConnectionStatus("connected");
        }
      },
      (error) => {
        if (!isMounted) return;
        console.warn("Could not read sales from Firebase", error);
        setConnectionStatus("unavailable");
        setQueryError("Could not load latest bill amount.");
        void fallbackToSupabase();
      }
    );

    return () => {
      isMounted = false;
      unsubscribeFirebase();
    };
  }, []);

  const amountLabel =
    amount !== null
      ? formatRupee(amount)
      : amountStatus === "loading"
        ? "Loading..."
        : amountStatus === "empty"
          ? "No bills yet"
          : "Unavailable";

  if (variant === "tab") {
    return (
      <div
        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 shadow-sm"
        role="status"
        aria-busy={amountStatus === "loading"}
        aria-live="polite"
        title={queryError || "Latest bill amount"}
      >
        <span className="text-xs font-medium text-slate-600">Last Sale</span>
        <span className="text-xs font-bold text-slate-800">{amountLabel}</span>
        <span
          className={`h-2 w-2 rounded-full ${
            connectionStatus === "connected"
              ? "bg-emerald-500"
              : connectionStatus === "connecting"
                ? "bg-amber-500"
                : "bg-rose-500"
          }`}
          aria-hidden="true"
        />
        {queryError && (
          <span role="alert" className="sr-only">
            {queryError}
          </span>
        )}
      </div>
    );
  }

  return (
    <section
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      aria-busy={amountStatus === "loading"}
      aria-live="polite"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-sky-100 p-2 text-sky-700">
            <Radio className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-800">
              Live Last Sale Amount
            </h2>
            <p className="text-xs text-slate-500">
              Latest bill amount
            </p>
          </div>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            connectionStatus === "connected"
              ? "bg-emerald-100 text-emerald-700"
              : connectionStatus === "connecting"
                ? "bg-amber-100 text-amber-700"
                : "bg-rose-100 text-rose-700"
          }`}
        >
          Realtime{" "}
          {connectionStatus === "connected"
            ? "connected"
            : connectionStatus === "connecting"
              ? "connecting"
              : "unavailable"}
        </span>
      </div>
      <p className="mt-3 text-2xl font-bold text-slate-900">{amountLabel}</p>
      {queryError && (
        <p role="alert" className="mt-2 text-xs text-rose-700">
          {queryError}
        </p>
      )}
    </section>
  );
}

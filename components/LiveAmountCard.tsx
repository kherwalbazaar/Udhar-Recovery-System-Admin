"use client";

import { useEffect, useState } from "react";
import { Radio } from "lucide-react";
import { supabase } from "@/lib/supabase";

type ConnectionStatus = "connecting" | "connected" | "unavailable";
type AmountStatus = "loading" | "loaded" | "empty" | "unavailable";

function formatRupee(amount: number): string {
  return `₹ ${amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function LiveAmountCard() {
  const [amount, setAmount] = useState<number | null>(null);
  const [amountStatus, setAmountStatus] = useState<AmountStatus>("loading");
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("connecting");
  const [queryError, setQueryError] = useState<string | null>(null);
  const [realtimeError, setRealtimeError] = useState<string | null>(null);

  useEffect(() => {
    const client = supabase;
    if (!client) {
      setAmountStatus("unavailable");
      setConnectionStatus("unavailable");
      setQueryError(
        "Set NEXT_PUBLIC_SUPABASE_URL and either NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY to enable live amounts."
      );
      return;
    }

    let isMounted = true;
    let latestRequest = 0;

    const fetchLatestAmount = async () => {
      const request = ++latestRequest;

      try {
        const { data, error } = await client
          .from("amount_value")
          .select("id, amount")
          .order("id", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!isMounted || request !== latestRequest) return;

        if (error) {
          console.error("Failed to read the latest Supabase amount", error);
          setAmountStatus("unavailable");
          setQueryError(
            error.code === "42703" || error.code === "42P01"
              ? "Supabase setup is incomplete. Apply the amount_value migration."
              : "Could not read the latest amount. Check Supabase table access."
          );
          return;
        }

        if (!data) {
          setAmount(null);
          setAmountStatus("empty");
          setQueryError(null);
          return;
        }

        const latestAmount = Number(data.amount);
        if (!Number.isFinite(latestAmount) || latestAmount <= 0) {
          setAmount(null);
          setAmountStatus("unavailable");
          setQueryError("The latest Supabase amount is invalid.");
          return;
        }

        setAmount(latestAmount);
        setAmountStatus("loaded");
        setQueryError(null);
      } catch (error) {
        if (!isMounted || request !== latestRequest) return;
        console.error("Failed to read the latest Supabase amount", error);
        setAmountStatus("unavailable");
        setQueryError("Could not read the latest amount. Check your connection.");
      }
    };

    void fetchLatestAmount();

    const channel = client
      .channel("admin-amount-value-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "amount_value" },
        () => {
          void fetchLatestAmount();
        }
      )
      .subscribe((status, error) => {
        if (!isMounted) return;

        if (status === "SUBSCRIBED") {
          setConnectionStatus("connected");
          setRealtimeError(null);
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error("Supabase realtime subscription failed", error);
          setConnectionStatus("unavailable");
          setRealtimeError("Live Supabase updates are unavailable.");
        }
      });

    return () => {
      isMounted = false;
      latestRequest += 1;
      void client.removeChannel(channel);
    };
  }, []);

  const amountLabel =
    amount !== null
      ? formatRupee(amount)
      : amountStatus === "loading"
        ? "Loading..."
        : amountStatus === "empty"
          ? "No amount available"
          : "Unavailable";

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
              Live QR Payment Amount
            </h2>
            <p className="text-xs text-slate-500">
              Latest amount from Supabase
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
      {(queryError || realtimeError) && (
        <p role="alert" className="mt-2 text-xs text-rose-700">
          {queryError || realtimeError}
        </p>
      )}
    </section>
  );
}

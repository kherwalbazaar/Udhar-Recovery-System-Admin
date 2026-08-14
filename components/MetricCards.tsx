"use client";

import { useEffect, useState } from "react";
import { onValue, ref } from "firebase/database";
import { db } from "@/lib/firebase";
import {
  buildMetrics,
  type Metrics,
  type RawMap,
} from "@/lib/metrics";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ShoppingBag,
  Wallet,
  TrendingUp,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Metric = {
  title: string;
  value: string;
  subtitle: string;
  icon: LucideIcon;
  bg: string;
  hoverBg: string;
  border: string;
};

function formatRupee(n: number) {
  return `₹ ${n.toLocaleString("en-IN")}`;
}

function MetricCard({ metric }: { metric: Metric }) {
  const Icon = metric.icon;
  return (
    <div
      className={`${metric.bg} ${metric.border} border-b-4 rounded-xl p-3 flex flex-col justify-between text-white shadow-sm hover:shadow-md transition-all duration-100 active:translate-y-[2px] active:border-b-2`}
    >
      <div className="flex items-center justify-center space-x-2">
        <div className="p-2 bg-white/20 text-white rounded-lg">
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-xs text-white/90 font-medium">{metric.title}</span>
      </div>
      <div className="mt-2 text-center">
        <h3 className="text-xl font-bold">{metric.value}</h3>
        <p className="text-[11px] text-white/70 mt-0.5">{metric.subtitle}</p>
      </div>
    </div>
  );
}

export default function MetricCards() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const salesRef = ref(db, "sales");
    const customersRef = ref(db, "customers");
    const productsRef = ref(db, "products");

    let salesData: RawMap = null;
    let customersData: RawMap = null;
    let productsData: RawMap = null;

    const update = () => {
      if (salesData !== null && customersData !== null) {
        setMetrics(
          buildMetrics(salesData, customersData, null, productsData, new Date())
        );
      }
    };
    const onError = (err: Error) => setError(err.message);

    const unsubSales = onValue(
      salesRef,
      (snap) => {
        salesData = (snap.val() as RawMap) ?? null;
        update();
      },
      onError
    );
    const unsubCustomers = onValue(
      customersRef,
      (snap) => {
        customersData = (snap.val() as RawMap) ?? null;
        update();
      },
      onError
    );
    const unsubProducts = onValue(
      productsRef,
      (snap) => {
        productsData = (snap.val() as RawMap) ?? null;
        update();
      },
      onError
    );

    return () => {
      unsubSales();
      unsubCustomers();
      unsubProducts();
    };
  }, []);

  const dash = "—";
  const given = metrics ? formatRupee(metrics.giveBack) : dash;
  const recovered = metrics ? formatRupee(metrics.recovered) : dash;
  const totalDue = metrics ? formatRupee(metrics.totalDue) : dash;
  const saleToday = metrics ? formatRupee(metrics.saleToday) : dash;
  const collectionToday = metrics ? formatRupee(metrics.collectionToday) : dash;
  const profitToday = metrics ? formatRupee(metrics.profitToday) : dash;
  const profit = metrics ? formatRupee(metrics.profitThisMonth) : dash;

  const metricCards: Metric[] = [
    {
      title: "You will Give",
      value: given,
      subtitle: metrics ? `${metrics.giveBackCustomers} Customers` : "Loading...",
      icon: ArrowDownLeft,
      bg: "bg-emerald-500",
      hoverBg: "hover:bg-emerald-600",
      border: "border-emerald-700",
    },
    {
      title: "You will Get",
      value: totalDue,
      subtitle: metrics ? `${metrics.dueCustomers} Customers` : "Loading...",
      icon: ArrowUpRight,
      bg: "bg-red-500",
      hoverBg: "hover:bg-red-600",
      border: "border-red-700",
    },
    {
      title: "Sale Today",
      value: saleToday,
      subtitle: metrics ? `${metrics.saleTodayCount} Transactions` : "Loading...",
      icon: ShoppingBag,
      bg: "bg-blue-500",
      hoverBg: "hover:bg-blue-600",
      border: "border-blue-700",
    },
    {
      title: "Profit Today",
      value: profitToday,
      subtitle: metrics ? `${metrics.saleTodayCount} Transactions` : "Loading...",
      icon: Wallet,
      bg: "bg-purple-500",
      hoverBg: "hover:bg-purple-600",
      border: "border-purple-700",
    },
  ];

  return (
    <div className="grid grid-cols-5 gap-3">
      {metricCards.map((metric) => (
        <MetricCard key={metric.title} metric={metric} />
      ))}
      <div className="bg-amber-500 border-amber-700 border-b-4 rounded-xl p-3 flex flex-col justify-between text-white shadow-sm hover:shadow-md transition-all duration-100 active:translate-y-[2px] active:border-b-2">
        <div className="flex items-center justify-center space-x-2">
          <div className="p-2 bg-white/20 text-white rounded-lg">
            <TrendingUp className="w-4 h-4" />
          </div>
          <span className="text-xs text-white/90 font-medium">Total Profit</span>
        </div>
        <div className="mt-2 text-center">
          <h3 className="text-xl font-bold">{profit}</h3>
          <p className="text-[11px] text-white/70 mt-0.5">This Month</p>
        </div>
      </div>
    </div>
  );
}
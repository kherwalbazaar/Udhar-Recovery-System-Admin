"use client";

import { useEffect, useState } from "react";
import { ref } from "firebase/database";
import { db } from "@/lib/firebase";
import { onValueWithCache, CACHE_KEYS } from "@/lib/cache";
import {
  buildProductSalesReport,
  type ProductSaleRow,
  type RawMap,
} from "@/lib/sales";

function formatRupee(amount: number) {
  return `₹ ${amount.toLocaleString("en-IN")}`;
}

export default function RecentSales() {
  const [rows, setRows] = useState<ProductSaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const salesRef = ref(db, "sales");
    const productsRef = ref(db, "products");

    let salesData: RawMap = null;
    let productsData: RawMap = null;
    let salesReady = false;
    let productsReady = false;

    const update = () => {
      if (salesReady && productsReady) {
        setRows(buildProductSalesReport(salesData, productsData).slice(0, 5));
        setLoading(false);
      }
    };

    const onError = (err: Error) => {
      setError(err.message);
      setLoading(false);
    };

    const unsubSales = onValueWithCache(salesRef, CACHE_KEYS.SALES, (snap) => {
      salesData = (snap.val() as RawMap) ?? null;
      salesReady = true;
      update();
    }, onError);

    const unsubProducts = onValueWithCache(productsRef, CACHE_KEYS.PRODUCTS, (snap) => {
      productsData = (snap.val() as RawMap) ?? null;
      productsReady = true;
      update();
    }, onError);

    return () => {
      unsubSales();
      unsubProducts();
    };
  }, []);

  return (
    <div className="col-span-7 bg-white rounded-xl p-4 border border-slate-200">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-slate-800">Recent Sales</h3>
        <a href="/sales-report" className="text-xs text-blue-600 font-medium hover:underline">
          View All
        </a>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-[11px] text-slate-400 border-b border-slate-100">
              <th className="pb-2 font-normal">Product Name</th>
              <th className="pb-2 font-normal text-right">MRP (₹)</th>
              <th className="pb-2 font-normal text-center">Qty</th>
              <th className="pb-2 font-normal text-right">Sale (₹)</th>
              <th className="pb-2 font-normal text-right">Profit (₹)</th>
            </tr>
          </thead>
          <tbody className="text-xs divide-y divide-slate-100">
            {loading && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-slate-400">
                  Loading sales...
                </td>
              </tr>
            )}
            {error && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-red-500">
                  Failed to load: {error}
                </td>
              </tr>
            )}
            {!loading && !error && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-slate-400">
                  No sales found.
                </td>
              </tr>
            )}
            {!loading &&
              !error &&
              rows.map((row, index) => (
                <tr key={`${row.product}-${row.date}-${index}`}>
                  <td className="py-2.5 font-medium text-slate-700">
                    {row.product}
                  </td>
                  <td className="py-2.5 text-right text-slate-500">
                    {formatRupee(row.mrp)}
                  </td>
                  <td className="py-2.5 text-center text-slate-500">
                    {row.quantity}
                  </td>
                  <td className="py-2.5 text-right font-semibold text-slate-800">
                    {formatRupee(row.sale)}
                  </td>
                  <td
                    className={`py-2.5 text-right font-semibold ${
                      row.profit >= 0 ? "text-emerald-600" : "text-red-500"
                    }`}
                  >
                    {formatRupee(row.profit)}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
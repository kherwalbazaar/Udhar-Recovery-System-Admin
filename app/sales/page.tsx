"use client";

import { useEffect, useState } from "react";
import {
  Search,
  ScanLine,
  ShoppingCart,
  UserPlus,
  Trash2,
  PlusCircle,
  Info,
  Wallet,
  UserCheck,
  Check,
  Minus,
  Plus,
  X,
  AlertCircle,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import {
  fetchProducts,
  fetchCustomers,
  submitSale,
  type Product,
  type CustomerSummary,
} from "@/lib/store";

type CartItem = {
  name: string;
  chipBg: string;
  mrp: number;
  sale: number;
  qty: number;
};

const CHIP_COLORS = [
  "bg-emerald-100 text-emerald-700",
  "bg-blue-100 text-blue-700",
  "bg-amber-100 text-amber-700",
  "bg-purple-100 text-purple-700",
  "bg-teal-100 text-teal-700",
  "bg-rose-100 text-rose-700",
  "bg-indigo-100 text-indigo-700",
];

function chipColor(name: string) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return CHIP_COLORS[hash % CHIP_COLORS.length];
}

const fmt = (n: number) =>
  n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function AddSalePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] =
    useState<CustomerSummary | null>(null);
  const [priceInputs, setPriceInputs] = useState<Record<string, number>>({});
  const [saleType, setSaleType] = useState<"cash" | "credit">("cash");
  const [note, setNote] = useState("");
  const [discount, setDiscount] = useState(0);
  const [received, setReceived] = useState(0);
  const [receivedTouched, setReceivedTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchProducts()
      .then((p) => {
        if (!active) return;
        setProducts(p);
        setPriceInputs(Object.fromEntries(p.map((x) => [x.name, x.sale])));
        setProductsLoading(false);
      })
      .catch((e: Error) => {
        if (!active) return;
        setError(`Failed to load products: ${e.message}`);
        setProductsLoading(false);
      });
    fetchCustomers()
      .then((c) => {
        if (active) setCustomers(c);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const subtotal = cart.reduce((sum, item) => sum + item.sale * item.qty, 0);
  const payable = Math.max(0, subtotal - discount);

  useEffect(() => {
    if (!receivedTouched) setReceived(payable);
  }, [payable, receivedTouched]);

  const addToCart = (product: Product) => {
    const price = priceInputs[product.name] ?? product.sale;
    setCart((prev) => {
      const existing = prev.find((i) => i.name === product.name);
      if (existing) {
        return prev.map((i) =>
          i.name === product.name ? { ...i, qty: i.qty + 1, sale: price } : i
        );
      }
      return [
        ...prev,
        {
          name: product.name,
          chipBg: chipColor(product.name),
          mrp: product.mrp,
          sale: price,
          qty: 1,
        },
      ];
    });
  };

  const updateQty = (name: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => (i.name === name ? { ...i, qty: i.qty + delta } : i))
        .filter((i) => i.qty > 0)
    );
  };

  const removeItem = (name: string) => {
    setCart((prev) => prev.filter((i) => i.name !== name));
  };

  const clearCart = () => setCart([]);

  const handleSubmit = async () => {
    if (cart.length === 0) return;
    if (saleType === "credit" && !selectedCustomer) {
      setError("Please select a customer for a Credit sale.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await submitSale({
        items: cart.map((i) => ({
          name: i.name,
          mrp: i.mrp,
          sale: i.sale,
          qty: i.qty,
        })),
        saleType,
        customer: selectedCustomer,
        note: note.trim() || undefined,
      });
      setSubmitted(true);
      setCart([]);
      setDiscount(0);
      setNote("");
      setSelectedCustomer(null);
      setCustomerSearch("");
      setReceivedTouched(false);
      setTimeout(() => setSubmitted(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit sale.");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(search.trim().toLowerCase())
  );

  const visibleProducts = search.trim()
    ? filteredProducts
    : filteredProducts;

  const filteredCustomers = customers.filter((c) => {
    const q = customerSearch.trim().toLowerCase();
    return (
      !q ||
      c.name.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q)
    );
  });

  const chip = (name: string) => name.charAt(0).toUpperCase();

  return (
    <AppShell title="Add Sale" active="Sales">
      <div className="grid grid-cols-12 gap-4">
        {/* LEFT SECTION: FORM AND PRODUCT SELECTION */}
        <div className="col-span-5 space-y-4">
          {/* 1. Select Product & Add to Cart */}
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <h3 className="text-xs font-bold text-slate-800 mb-3">
              1. Select Product &amp; Add to Cart
            </h3>

            <div className="flex items-center space-x-2 mb-4">
              <div className="relative flex-1">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                  <Search className="w-3.5 h-3.5" />
                </span>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search product by name / barcode"
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <button
                type="button"
                className="flex items-center space-x-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-100"
              >
                <ScanLine className="w-3.5 h-3.5" />
                <span>Scan Barcode</span>
              </button>
            </div>

            {!productsLoading && !error && !search.trim() && (
              <p className="text-[10px] text-slate-400 mb-2">
                Showing all {visibleProducts.length} products — scroll the list
                below to browse.
              </p>
            )}

            <div className="max-h-56 overflow-y-auto overflow-x-auto pr-1 scroll-smooth">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-white z-10">
                  <tr className="text-[11px] text-slate-400 border-b border-slate-100">
                    <th className="pb-2 font-normal">Product Name</th>
                    <th className="pb-2 font-normal">MRP (₹)</th>
                    <th className="pb-2 font-normal">Sale Price (₹)</th>
                    <th className="pb-2 font-normal text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="text-xs divide-y divide-slate-100">
                  {productsLoading && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-400">
                        Loading products...
                      </td>
                    </tr>
                  )}
                  {!productsLoading && error && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-red-500">
                        {error}
                      </td>
                    </tr>
                  )}
                  {!productsLoading &&
                    !error &&
                    filteredProducts.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-slate-400">
                          No products found.
                        </td>
                      </tr>
                    )}
                  {!productsLoading &&
                    !error &&
                    visibleProducts.map((p) => (
                      <tr key={p.name}>
                        <td className="py-1.5 font-medium text-slate-800">
                          {p.name}
                        </td>
                        <td className="py-1.5 text-slate-600">{fmt(p.mrp)}</td>
                        <td className="py-1.5">
                          <input
                            type="number"
                            value={priceInputs[p.name] ?? p.sale}
                            onChange={(e) =>
                              setPriceInputs((prev) => ({
                                ...prev,
                                [p.name]: Number(e.target.value),
                              }))
                            }
                            className="w-16 px-1.5 py-0.5 border border-slate-200 rounded text-xs focus:outline-none focus:border-blue-500"
                          />
                        </td>
                        <td className="py-1.5 text-right">
                          <button
                            type="button"
                            onClick={() => addToCart(p)}
                            className="bg-blue-600 text-white px-3 py-1 rounded-md text-xs font-medium flex items-center space-x-1 ml-auto hover:bg-blue-700"
                          >
                            <ShoppingCart className="w-3 h-3" />
                            <span>Add</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 2. Customer Section */}
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <h3 className="text-xs font-bold text-slate-800 mb-2">
              2. Customer{" "}
              <span className="font-normal text-slate-400">
                (Required for Credit Sale)
              </span>
            </h3>

            {selectedCustomer ? (
              <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                <div className="flex items-center space-x-2">
                  <span className="w-7 h-7 rounded-full bg-emerald-500 text-white text-xs flex items-center justify-center font-medium">
                    {selectedCustomer.name.charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <p className="text-xs font-medium text-slate-800">
                      {selectedCustomer.name}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {selectedCustomer.phone}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCustomer(null)}
                  className="text-slate-400 hover:text-red-500"
                  aria-label="Clear customer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center space-x-2 mb-2">
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    placeholder="Search customer by name or mobile number"
                    className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    className="text-xs bg-blue-50 text-blue-600 font-medium px-3 py-2 rounded-lg border border-blue-100 flex items-center space-x-1 hover:bg-blue-100"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>+ Add New Customer</span>
                  </button>
                </div>

                {customerSearch && filteredCustomers.length > 0 && (
                  <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-48 overflow-y-auto">
                    {filteredCustomers.slice(0, 5).map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedCustomer(c)}
                        className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-50 text-left"
                      >
                        <div className="flex items-center space-x-2">
                          <span className="w-6 h-6 rounded-full bg-slate-300 text-slate-700 text-[10px] flex items-center justify-center font-semibold">
                            {c.name.charAt(0).toUpperCase()}
                          </span>
                          <span className="text-xs font-medium text-slate-700">
                            {c.name}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {c.phone}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {customerSearch && filteredCustomers.length === 0 && (
                  <p className="text-[11px] text-slate-400">
                    No customers found.
                  </p>
                )}
              </>
            )}
          </div>

          {/* 3. Sale Type */}
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <h3 className="text-xs font-bold text-slate-800 mb-3">3. Sale Type</h3>
            <div className="flex items-center space-x-6 text-xs">
              <label className="flex items-center space-x-2 cursor-pointer font-medium text-slate-700">
                <input
                  type="radio"
                  name="saleType"
                  checked={saleType === "cash"}
                  onChange={() => setSaleType("cash")}
                  className="text-emerald-600 focus:ring-emerald-500"
                />
                <span>Cash / UPI (Paid Now)</span>
              </label>
              <label
                className={`flex items-center space-x-2 cursor-pointer ${
                  saleType === "credit"
                    ? "font-medium text-slate-700"
                    : "text-slate-500"
                }`}
              >
                <input
                  type="radio"
                  name="saleType"
                  checked={saleType === "credit"}
                  onChange={() => setSaleType("credit")}
                  className="text-emerald-600 focus:ring-emerald-500"
                />
                <span>Credit (Add to Khata)</span>
              </label>
            </div>
          </div>

          {/* 4. Payment Note */}
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <h3 className="text-xs font-bold text-slate-800 mb-2">
              4. Payment Note{" "}
              <span className="font-normal text-slate-400">(Optional)</span>
            </h3>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add any note for this sale..."
              rows={2}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Tip Banner */}
          <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-2.5 flex items-center space-x-2 text-xs text-blue-600">
            <Info className="w-4 h-4 shrink-0" />
            <span>
              Tip: Add multiple products to cart, apply discount, then choose
              payment type and submit. Sales are saved to Firebase.
            </span>
          </div>
        </div>

        {/* RIGHT SECTION: YOUR CART & PAYMENT DETAILS */}
        <div className="col-span-7 space-y-4">
          {/* Your Cart */}
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-xs font-bold text-slate-800">
                Your Cart{" "}
                <span className="text-slate-400 font-normal">
                  ({cart.length} items)
                </span>
              </h3>
              <button
                type="button"
                onClick={clearCart}
                className="text-[11px] text-red-500 hover:underline flex items-center space-x-1"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear Cart</span>
              </button>
            </div>

            <table className="w-full text-left my-2 border-collapse">
              <thead>
                <tr className="text-[10px] text-slate-400 border-b border-slate-100">
                  <th className="py-2 font-normal">Product</th>
                  <th className="py-2 font-normal text-right">MRP (₹)</th>
                  <th className="py-2 font-normal text-right">Sale (₹)</th>
                  <th className="py-2 font-normal text-center">Qty</th>
                  <th className="py-2 font-normal text-right">Total (₹)</th>
                  <th className="py-2 font-normal"></th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-slate-100">
                {cart.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-400">
                      Your cart is empty. Add products from the left.
                    </td>
                  </tr>
                )}
                {cart.map((item) => (
                  <tr key={item.name}>
                    <td className="py-2.5">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`w-6 h-6 rounded ${item.chipBg} text-[10px] flex items-center justify-center font-bold`}
                        >
                          {chip(item.name)}
                        </span>
                        <span className="font-medium text-slate-700">
                          {item.name}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 text-right text-slate-400">
                      {fmt(item.mrp)}
                    </td>
                    <td className="py-2.5 text-right font-medium text-slate-700">
                      {fmt(item.sale)}
                    </td>
                    <td className="py-2.5 text-center">
                      <div className="inline-flex items-center border border-slate-200 rounded">
                        <button
                          type="button"
                          onClick={() => updateQty(item.name, -1)}
                          className="px-1.5 text-slate-400 hover:bg-slate-100"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-2 text-xs font-medium">
                          {item.qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQty(item.name, 1)}
                          className="px-1.5 text-slate-400 hover:bg-slate-100"
                          aria-label="Increase quantity"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                    <td className="py-2.5 text-right font-semibold text-slate-800">
                      {fmt(item.sale * item.qty)}
                    </td>
                    <td className="py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => removeItem(item.name)}
                        className="text-red-400 hover:text-red-600"
                        aria-label={`Remove ${item.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="text-center py-2 border-t border-slate-100">
              <button
                type="button"
                className="text-xs text-blue-600 font-medium hover:underline inline-flex items-center space-x-1"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Add More Items</span>
              </button>
            </div>

            <div className="space-y-2 pt-3 border-t border-slate-100 text-xs">
              <div className="flex justify-between text-slate-600 font-medium">
                <span>Subtotal ({cart.length} items)</span>
                <span className="text-slate-800 font-semibold">
                  ₹{fmt(subtotal)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1 text-slate-600 font-medium">
                  <span>Bill Discount</span>
                  <Info className="w-3 h-3 text-slate-400" />
                </div>
                <div className="flex items-center border border-slate-200 rounded bg-slate-50 overflow-hidden">
                  <span className="px-2 text-slate-400 bg-slate-100 border-r border-slate-200">
                    ₹
                  </span>
                  <input
                    type="number"
                    value={discount}
                    onChange={(e) =>
                      setDiscount(Math.max(0, Number(e.target.value)))
                    }
                    className="w-16 px-2 py-0.5 text-right text-xs bg-transparent focus:outline-none font-medium"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                <span className="text-sm font-bold text-emerald-600">
                  Final Payable
                </span>
                <span className="text-base font-bold text-emerald-600">
                  ₹{fmt(payable)}
                </span>
              </div>
            </div>
          </div>

          {/* Payment Details */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 space-y-3">
            <h3 className="text-xs font-bold text-slate-800">Payment Details</h3>

            <div>
              <p className="text-[11px] text-slate-500 font-medium mb-1.5">
                Payment Type
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSaleType("cash")}
                  className={`flex items-center justify-center space-x-1.5 rounded-lg py-2 text-xs font-semibold ${
                    saleType === "cash"
                      ? "border-2 border-emerald-500 bg-emerald-50/50 text-emerald-600"
                      : "border border-slate-200 text-slate-600 font-medium hover:bg-slate-50"
                  }`}
                >
                  <Wallet className="w-4 h-4" />
                  <span>Cash / UPI</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSaleType("credit")}
                  className={`flex items-center justify-center space-x-1.5 rounded-lg py-2 text-xs font-semibold ${
                    saleType === "credit"
                      ? "border-2 border-emerald-500 bg-emerald-50/50 text-emerald-600"
                      : "border border-slate-200 text-slate-600 font-medium hover:bg-slate-50"
                  }`}
                >
                  <UserCheck className="w-4 h-4 text-slate-400" />
                  <span>
                    Credit{" "}
                    <span className="font-normal text-[10px] text-slate-400">
                      (Add to Khata)
                    </span>
                  </span>
                </button>
              </div>
            </div>

            {saleType === "cash" && (
              <>
                <div>
                  <p className="text-[11px] text-slate-500 font-medium mb-1">
                    Amount Received
                  </p>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 text-xs">
                      ₹
                    </span>
                    <input
                      type="number"
                      value={received}
                      onChange={(e) => {
                        setReceived(Number(e.target.value));
                        setReceivedTouched(true);
                      }}
                      className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg pl-7 pr-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <p className="text-[11px] text-slate-500 font-medium mb-1">
                    Change
                  </p>
                  <div className="bg-emerald-50/60 border border-emerald-100 rounded-lg p-2 text-xs font-bold text-emerald-600">
                    ₹ {fmt(Math.max(0, received - payable))}
                  </div>
                </div>
              </>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs font-semibold text-red-600 flex items-center space-x-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {submitted && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-xs font-semibold text-emerald-600">
                Sale saved to Firebase successfully.
              </div>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || cart.length === 0}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-xs py-2.5 rounded-lg flex items-center justify-center space-x-1.5 transition-colors"
            >
              <Check className="w-4 h-4" />
              <span>
                {submitting
                  ? "Saving..."
                  : saleType === "credit"
                    ? "Submit Sale (Add to Khata)"
                    : "Submit Sale"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
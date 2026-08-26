"use client";

import { useEffect, useState } from "react";
import {
  Search,
  ShoppingCart,
  UserPlus,
  Trash2,
  Info,
  Wallet,
  Check,
  Minus,
  Plus,
  X,
  AlertCircle,
  ChevronDown,
  ArrowRight,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import {
  fetchProducts,
  fetchCustomers,
  submitSale,
  type Product,
  type CustomerSummary,
} from "@/lib/store";
import { saveProduct } from "@/lib/products";

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
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

export default function AddSalePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [customerListOpen, setCustomerListOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] =
    useState<CustomerSummary | null>(null);
  const [priceInputs, setPriceInputs] = useState<Record<string, number>>({});
  const [discount, setDiscount] = useState(0);
  const [received, setReceived] = useState(0);
  const [receivedTouched, setReceivedTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [qaName, setQaName] = useState("");
  const [qaMrp, setQaMrp] = useState("");
  const [qaSale, setQaSale] = useState("");
  const [qaCategory, setQaCategory] = useState("");
  const [qaBarcode, setQaBarcode] = useState("");
  const [qaError, setQaError] = useState<string | null>(null);
  const [qaSaving, setQaSaving] = useState(false);

  const genSku = () =>
    `KB${Date.now().toString().slice(-6)}${Math.floor(1000 + Math.random() * 9000)}`;

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
    if (!receivedTouched) setReceived(selectedCustomer ? 0 : payable);
  }, [payable, receivedTouched, selectedCustomer]);

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

  const handleQuickAdd = async () => {
    const name = qaName.trim();
    const mrp = Number(qaMrp);
    const sale = Number(qaSale);
    if (!name) {
      setQaError("Product Name is required.");
      return;
    }
    if (!(mrp > 0)) {
      setQaError("MRP must be greater than 0.");
      return;
    }
    if (!(sale > 0)) {
      setQaError("Sale Price must be greater than 0.");
      return;
    }
    if (!qaCategory) {
      setQaError("Category is required.");
      return;
    }
    setQaSaving(true);
    setQaError(null);
    try {
      const barcode = qaBarcode.trim() || genSku();
      await saveProduct({
        name,
        barcode,
        category: qaCategory,
        mrp,
        sale,
        active: true,
        trackStock: true,
        createdAt: Date.now(),
      });
      addToCart({ name, mrp, sale });
      setProducts((prev) => [
        { name, mrp, sale, createdAt: Date.now() },
        ...prev.filter((x) => x.name !== name),
      ]);
      setSearch("");
      setQuickAddOpen(false);
      setQaName("");
      setQaMrp("");
      setQaSale("");
      setQaCategory("");
      setQaBarcode("");
    } catch (e) {
      setQaError(e instanceof Error ? e.message : "Failed to save product.");
    } finally {
      setQaSaving(false);
    }
  };

  const updateQty = (name: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => (i.name === name ? { ...i, qty: i.qty + delta } : i))
        .filter((i) => i.qty > 0)
    );
  };

  const setItemSale = (name: string, value: string) => {
    setCart((prev) =>
      prev.map((i) =>
        i.name === name ? { ...i, sale: Math.max(0, Number(value) || 0) } : i
      )
    );
  };

  const stepSale = (name: string, delta: number) => {
    setCart((prev) =>
      prev.map((i) =>
        i.name === name ? { ...i, sale: Math.max(0, i.sale + delta) } : i
      )
    );
  };

  const setItemQty = (name: string, value: string) => {
    setCart((prev) =>
      prev.map((i) =>
        i.name === name
          ? { ...i, qty: Math.max(1, Math.floor(Number(value) || 1)) }
          : i
      )
    );
  };

  const removeItem = (name: string) => {
    setCart((prev) => prev.filter((i) => i.name !== name));
  };

  const clearCart = () => setCart([]);

  const handleSubmit = async () => {
    if (cart.length === 0) return;
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
        saleType: selectedCustomer ? "credit" : "cash",
        customer: selectedCustomer,
        received,
      });
      setSubmitted(true);
      setCart([]);
      setDiscount(0);
      setSelectedCustomer(null);
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
    : filteredProducts.slice(0, 10);

  const chip = (name: string) => name.charAt(0).toUpperCase();

  return (
    <AppShell title="" active="Sales">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">Sales</h1>

        <a
          href="/sales-report"
          className="text-xs text-slate-600 font-medium hover:text-slate-900 flex items-center space-x-1 border border-slate-200 rounded-lg px-3 py-1.5 bg-white shadow-sm"
        >
          <span>Sale Report</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </a>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* LEFT SECTION: FORM AND PRODUCT SELECTION */}
        <div className="col-span-5 space-y-2">
          {/* 1. Customer Section */}
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <h3 className="text-xs font-bold text-slate-800 mb-2">
              1. Customer{" "}
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
                <button
                  type="button"
                  onClick={() => setCustomerListOpen((o) => !o)}
                  className="w-full flex items-center justify-between text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 mb-2 text-slate-700 hover:bg-slate-100"
                >
                  <span>Select customer</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform ${
                      customerListOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {customerListOpen && customers.length > 0 && (
                  <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-48 overflow-y-auto mb-2">
                    {customers.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setSelectedCustomer(c);
                          setCustomerListOpen(false);
                        }}
                        className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-50 text-left"
                      >
                        <div className="flex items-center space-x-2">
                          <span className="w-6 h-6 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-semibold">
                            {c.name.charAt(0).toUpperCase()}
                          </span>
                          <span className="text-xs font-medium text-slate-700">
                            {c.name}
                          </span>
                        </div>
                        <span className="text-[10px] font-semibold text-red-600">
                          ₹{Math.round(c.totalAmount)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* 2. Select Product & Add to Cart */}
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <h3 className="text-xs font-bold text-slate-800 mb-3">
              2. Select Product &amp; Add to Cart
            </h3>

            <div className="flex items-center space-x-2 mb-4">
              <div className="relative flex-1">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                  <Search className="w-3.5 h-3.5" />
                </span>
                <div className="rounded-lg p-0.5 animate-multicolor">
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search product by name / barcode"
                    className="w-full text-xs bg-white rounded-[7px] pl-9 pr-3 py-2.5 focus:outline-none animate-search-blink"
                  />
                </div>
              </div>
            </div>

            <div className="max-h-[calc(100vh-260px)] overflow-y-auto overflow-x-auto pr-1 scroll-smooth">
              <table className="w-full text-left border-collapse table-fixed">
                <thead className="sticky top-0 bg-white z-10">
                  <tr className="text-[11px] text-slate-400 border-b border-slate-100">
                    <th className="pb-2 px-2 font-normal w-[50%]">Product Name</th>
                    <th className="pb-2 px-2 font-normal w-[25%] text-right">MRP (₹)</th>
                    <th className="pb-2 px-2 font-normal text-right w-[25%]">Sale (₹)</th>
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
                        <td colSpan={4} className="py-6 text-center">
                          <p className="text-slate-400 mb-3">
                            {search.trim()
                              ? `No products found for "${search.trim()}".`
                              : "No products found."}
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setQaName(search.trim());
                              setQaMrp("");
                              setQaSale("");
                              setQaCategory("");
                              setQaBarcode(genSku());
                              setQaError(null);
                              setQuickAddOpen(true);
                            }}
                            className="inline-flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-md text-xs font-medium"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>New Add</span>
                          </button>
                        </td>
                      </tr>
                    )}
                  {!productsLoading &&
                    !error &&
                    visibleProducts.map((p) => (
                      <tr
                        key={p.name}
                        onClick={() => addToCart(p)}
                        className="cursor-pointer hover:bg-blue-50 transition-colors"
                      >
                        <td className="py-2 px-2 font-medium text-slate-800 truncate">
                          {p.name}
                        </td>
                        <td className="py-2 px-2 text-slate-600 text-right">
                          {fmt(p.mrp)}
                        </td>
                        <td className="py-2 px-2 text-slate-700 font-semibold text-right">
                          {fmt(p.sale)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
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
                <tr className="bg-pink-100 text-pink-800 text-[10px] font-semibold">
                  <th className="py-2 pl-2 pr-2 text-left rounded-l-lg">Product</th>
                  <th className="py-2 px-2 text-right">MRP (₹)</th>
                  <th className="py-2 px-2 text-right">Sale (₹)</th>
                  <th className="py-2 px-2 text-center">Qty</th>
                  <th className="py-2 px-2 text-right">Total (₹)</th>
                  <th className="py-2 pl-2 pr-2 w-6 rounded-r-lg"></th>
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
                    <td className="py-2.5 pl-2 pr-2">
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
                    <td className="py-2.5 px-2 text-right text-slate-400">
                      {fmt(item.mrp)}
                    </td>
                    <td className="py-2.5 px-2 text-right">
                      <div className="inline-flex items-center border border-slate-200 rounded">
                        <button
                          type="button"
                          onClick={() => stepSale(item.name, -10)}
                          className="px-1.5 text-slate-400 hover:bg-slate-200 transition-colors self-stretch flex items-center"
                          aria-label="Decrease price by 10"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <input
                          type="number"
                          value={item.sale}
                          onChange={(e) =>
                            setItemSale(item.name, e.target.value)
                          }
                          className="w-14 px-1 py-0.5 text-right text-xs font-medium text-slate-700 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <button
                          type="button"
                          onClick={() => stepSale(item.name, 10)}
                          className="px-1.5 text-slate-400 hover:bg-slate-200 transition-colors self-stretch flex items-center"
                          aria-label="Increase price by 10"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <div className="inline-flex items-center border border-slate-200 rounded">
                        <button
                          type="button"
                          onClick={() => updateQty(item.name, -1)}
                          className="px-1.5 text-slate-400 hover:bg-slate-200 transition-colors self-stretch flex items-center"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <input
                          type="number"
                          value={item.qty}
                          onChange={(e) => setItemQty(item.name, e.target.value)}
                          className="w-9 px-1 py-0.5 text-center text-xs font-medium focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <button
                          type="button"
                          onClick={() => updateQty(item.name, 1)}
                          className="px-1.5 text-slate-400 hover:bg-slate-200 transition-colors self-stretch flex items-center"
                          aria-label="Increase quantity"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-right font-semibold text-slate-800">
                      {fmt(item.sale * item.qty)}
                    </td>
                    <td className="py-2.5 pl-2 pr-2 text-right">
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
                <div className="inline-flex items-center border border-slate-200 rounded bg-white">
                  <button
                    type="button"
                    onClick={() => setDiscount(Math.max(0, discount - 10))}
                    className="px-1.5 text-slate-400 hover:bg-slate-200 transition-colors self-stretch flex items-center"
                    aria-label="Decrease discount by 10"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <input
                    type="number"
                    value={discount}
                    onChange={(e) =>
                      setDiscount(Math.max(0, Number(e.target.value)))
                    }
                    className="w-14 py-0.5 text-right text-xs font-medium text-slate-700 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setDiscount(discount + 10)}
                    className="px-1.5 text-slate-400 hover:bg-slate-200 transition-colors self-stretch flex items-center"
                    aria-label="Increase discount by 10"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <div className="rounded-lg p-0.5 animate-multicolor mt-2">
                <div className="bg-white rounded-[7px] px-3 py-2.5 animate-search-blink flex justify-between items-center">
                  <span className="text-base font-bold text-emerald-600">
                    Final Payable
                  </span>
                  <span className="text-2xl font-extrabold text-emerald-600">
                    ₹{fmt(payable)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Details */}
          {cart.length > 0 && (
          <div className="bg-white rounded-xl p-4 border border-slate-200 space-y-3">
            <h3 className="text-xs font-bold text-slate-800">Payment Details</h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col">
                <p className="text-[11px] text-slate-500 font-medium mb-1">
                  Amount Received
                </p>
                <div className="relative flex-1">
                  <div className="inline-flex items-center w-full border border-slate-200 rounded-lg bg-slate-50 overflow-hidden focus-within:ring-1 focus-within:ring-blue-500">
                    <button
                      type="button"
                      onClick={() => {
                        setReceived(Math.max(0, received - 10));
                        setReceivedTouched(true);
                      }}
                      className="px-2 text-slate-400 hover:bg-slate-200 transition-colors self-stretch flex items-center shrink-0"
                      aria-label="Decrease amount by 10"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <div className="flex-1 flex items-center justify-center min-w-0">
                      <span className="text-lg font-bold text-slate-400 mr-0.5">
                        ₹
                      </span>
                      <input
                        type="number"
                        value={received}
                        onChange={(e) => {
                          setReceived(Number(e.target.value));
                          setReceivedTouched(true);
                        }}
                        className="w-24 text-lg font-bold bg-transparent text-center py-1.5 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setReceived(received + 10);
                        setReceivedTouched(true);
                      }}
                      className="px-2 text-slate-400 hover:bg-slate-200 transition-colors self-stretch flex items-center shrink-0"
                      aria-label="Increase amount by 10"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-col">
                <p className="text-[11px] text-slate-500 font-medium mb-1">
                  Change
                </p>
                <div className="flex-1 flex items-center bg-emerald-50/60 border border-emerald-100 rounded-lg pl-7 pr-3 py-1.5 text-lg font-bold text-emerald-600">
                  ₹ {fmt(Math.max(0, received - payable))}
                </div>
              </div>
            </div>

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
                {submitting ? "Saving..." : "Submit Sale"}
              </span>
            </button>
          </div>
          )}
        </div>
      </div>

      {quickAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-800">
                New Add Product
              </h3>
              <button
                type="button"
                onClick={() => setQuickAddOpen(false)}
                className="text-slate-400 hover:text-slate-600"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">
                  Product Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={qaName}
                  onChange={(e) => setQaName(e.target.value)}
                  placeholder="Enter product name"
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  value={qaCategory}
                  onChange={(e) => setQaCategory(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Select category</option>
                  <option>ESSA</option>
                  <option>GALAXY</option>
                  <option>KOLKATA</option>
                  <option>Stroberry</option>
                  <option>SK Dreams</option>
                  <option>Rupa Footline</option>
                  <option>UR Image</option>
                  <option>LUX</option>
                  <option>Lungi</option>
                  <option>Saree</option>
                  <option>Half Pants</option>
                  <option>Ganji</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">
                  SKU / Barcode <span className="text-slate-400 font-normal">(Auto-generated)</span>
                </label>
                <div className="flex space-x-1">
                  <input
                    type="text"
                    value={qaBarcode}
                    onChange={(e) => setQaBarcode(e.target.value)}
                    placeholder="Auto SKU"
                    className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setQaBarcode(genSku())}
                    className="px-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-[11px] font-medium text-slate-600 shrink-0"
                  >
                    Regenerate
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">
                    MRP (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={qaMrp}
                    onChange={(e) => setQaMrp(e.target.value)}
                    placeholder="MRP"
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">
                    Sale Price (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={qaSale}
                    onChange={(e) => setQaSale(e.target.value)}
                    placeholder="Sale"
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {qaError && (
              <p className="text-xs text-red-500 mt-3">{qaError}</p>
            )}

            <button
              type="button"
              onClick={handleQuickAdd}
              disabled={qaSaving}
              className="mt-4 w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold py-2 rounded-lg"
            >
              {qaSaving ? "Adding..." : "Add"}
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { ref, push, update } from 'firebase/database';
import { db } from '@/lib/firebase';
import { Minus, Plus, Trash2, CheckCircle2 } from 'lucide-react';

const RUNNING_CUSTOMER_ID = 'running-customer';
const RUNNING_CUSTOMER_NAME = 'Running Customer';
const INVOICE_SEQ_KEY = 'udhar_sales_invoice_seq_v1';

type PosCustomer = {
  id: string;
  name: string;
  phone: string;
  address?: string;
  totalAmount?: number;
};

type ProductHint = { name: string; mrp: number; sale: number };
type CartItem = { name: string; mrp: number; sale: number; qty: number };
type PaymentMode = 'Cash' | 'UPI' | 'Credit';

const RUNNING_CUSTOMER: PosCustomer = {
  id: RUNNING_CUSTOMER_ID,
  name: RUNNING_CUSTOMER_NAME,
  phone: '',
  address: '',
  totalAmount: 0,
};

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function makeInvoiceNo(): string {
  const day = toDateKey(new Date()).replace(/-/g, '');
  let seq = 1;
  try {
    const raw = JSON.parse(localStorage.getItem(INVOICE_SEQ_KEY) ?? 'null') as { day?: string; seq?: number } | null;
    if (raw && raw.day === day) seq = Math.max(1, Number(raw.seq ?? 0) + 1);
    localStorage.setItem(INVOICE_SEQ_KEY, JSON.stringify({ day, seq }));
  } catch {
    // storage blocked - bill number still usable
  }
  return `KB-${day}-${String(seq).padStart(3, '0')}`;
}

// Writes identical sale / transaction / cashbook records to Firebase as lib/store.ts.
async function submitPosSale(params: {
  items: CartItem[];
  saleType: 'cash' | 'credit';
  customer: PosCustomer;
  received: number;
  paymentMethod: PaymentMode;
  invoiceNo?: string;
}): Promise<void> {
  const { items, saleType, customer, received, paymentMethod, invoiceNo } = params;
  const date = toDateKey(new Date());
  const createdAt = Date.now();
  const updates: Record<string, unknown> = {};

  for (const item of items) {
    const saleKey = push(ref(db, 'sales')).key;
    const quantity = Math.max(1, item.qty || 1);
    updates[`sales/${saleKey}`] = {
      productName: item.name,
      mrp: item.mrp,
      salePrice: item.sale,
      quantity,
      sale: item.sale * quantity,
      date,
      createdAt,
      paymentMethod,
      ...(invoiceNo ? { invoiceNo } : {}),
      customerId: customer.id,
      customerName: customer.name,
      saleType,
    };
  }

  if (customer.id === RUNNING_CUSTOMER_ID) {
    updates[`customers/${customer.id}/name`] = RUNNING_CUSTOMER_NAME;
    updates[`customers/${customer.id}/phone`] = '';
    updates[`customers/${customer.id}/address`] = '';
  }

  if (saleType === 'credit' && customer) {
    let creditTotal = 0;
    for (const item of items) {
      const amount = item.sale * Math.max(1, item.qty || 1);
      creditTotal += amount;
      const txnKey = push(ref(db, `customers/${customer.id}/transactions`)).key;
      updates[`customers/${customer.id}/transactions/${txnKey}`] = {
        amount,
        itemName: item.name,
        date,
        type: 'gave',
        createdAt,
      };
    }
    let balanceDelta = creditTotal;
    const receivedAmount = Number(received) || 0;
    if (receivedAmount > 0) {
      const settleKey = push(ref(db, `customers/${customer.id}/transactions`)).key;
      updates[`customers/${customer.id}/transactions/${settleKey}`] = {
        amount: receivedAmount,
        itemName: 'Settle',
        date,
        type: 'got',
        createdAt,
      };
      balanceDelta -= receivedAmount;
    }
    if (customer.id !== RUNNING_CUSTOMER_ID) {
      updates[`customers/${customer.id}/totalAmount`] = (customer.totalAmount ?? 0) + balanceDelta;
    }
  }

  const receivedAmount = Math.max(0, Number(received) || 0);
  if (receivedAmount > 0) {
    const cashbookKey = push(ref(db, 'cashbook')).key;
    updates[`cashbook/${cashbookKey}`] = {
      amount: receivedAmount,
      category: 'Sales',
      mode: paymentMethod.toLowerCase(),
      remark: invoiceNo ? `Sale ${invoiceNo}` : 'Sale received',
      date,
      type: 'in',
      createdAt,
    };
  }

  await update(ref(db), updates);
}

export default function MobileSalePOS({
  productNames,
}: {
  productNames: ProductHint[];
}) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [nameInput, setNameInput] = useState('');
  const [mrpInput, setMrpInput] = useState('');
  const [saleInput, setSaleInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [itemQty, setItemQty] = useState(1);
  const [showQtyPopup, setShowQtyPopup] = useState(false);
  const [showCheckoutPopup, setShowCheckoutPopup] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [qrLoading, setQrLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [invoiceNo, setInvoiceNo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const subtotal = cart.reduce((sum, i) => sum + i.sale * i.qty, 0);
  const receivedAmount = subtotal;

  useEffect(() => {
    const trimmed = nameInput.trim().toLowerCase();
    if (!trimmed) return;
    const match = productNames.find(
      (p) => p.name.toLowerCase() === trimmed || (trimmed.length >= 2 && p.name.toLowerCase().replace(/[\s\-_]/g, '') === trimmed.replace(/[\s\-_]/g, ''))
    );
    if (match) {
      setMrpInput(String(match.mrp || ''));
      setSaleInput(String(match.sale || ''));
    }
  }, [nameInput, productNames]);

  const suggestions = nameInput.trim()
    ? productNames
        .filter((p) => {
          const q = nameInput.trim().toLowerCase();
          const cleanQ = q.replace(/[\s\-_]/g, '');
          const pName = p.name.toLowerCase();
          const cleanPName = pName.replace(/[\s\-_]/g, '');
          return pName.includes(q) || (cleanQ.length > 0 && cleanPName.includes(cleanQ));
        })
        .slice(0, 15)
    : productNames.slice(0, 15);

  const addItem = () => {
    const name = nameInput.trim();
    const mrp = Number(mrpInput);
    const sale = Number(saleInput);
    if (!name || !(sale > 0)) {
      setError('Enter product name and a valid sale price.');
      return;
    }
    setCart((prev) => {
      const existing = prev.find((i) => i.name === name);
      if (existing) {
        return prev.map((i) => (i.name === name ? { ...i, qty: i.qty + itemQty } : i));
      }
      return [...prev, { name, mrp: mrp > 0 ? mrp : sale, sale, qty: itemQty }];
    });
    setNameInput('');
    setMrpInput('');
    setSaleInput('');
    setItemQty(1);
    setError(null);
  };

  const updateQty = (name: string, delta: number) => {
    setCart((prev) =>
      prev.map((i) => (i.name === name ? { ...i, qty: i.qty + delta } : i)).filter((i) => i.qty > 0)
    );
  };

  const setItemSale = (name: string, value: string) => {
    setCart((prev) => prev.map((i) => (i.name === name ? { ...i, sale: Math.max(0, Number(value) || 0) } : i)));
  };

  const removeItem = (name: string) => {
    setCart((prev) => prev.filter((i) => i.name !== name));
  };

  const openCheckoutPopup = async () => {
    if (cart.length === 0 || subtotal <= 0) {
      setError(cart.length === 0 ? 'Add at least one item to the bill.' : 'Bill total must be greater than zero.');
      return;
    }

    setShowCheckoutPopup(true);
    setQrLoading(true);
    setQrDataUrl('');
    setCheckoutError(null);
    try {
      const { default: QRCode } = await import('qrcode');
      const params = new URLSearchParams({
        pa: '9583252256-3@axl',
        pn: 'KHERWAL BAZAAR',
        am: subtotal.toFixed(2),
        cu: 'INR',
      });
      const dataUrl = await QRCode.toDataURL(`upi://pay?${params.toString()}`, {
        width: 240,
        margin: 1,
        color: { dark: '#1e293b', light: '#FFFFFF' },
      });
      setQrDataUrl(dataUrl);
    } catch (e) {
      setCheckoutError(e instanceof Error ? e.message : 'Failed to generate payment QR code.');
    } finally {
      setQrLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (submitting) return;
    if (cart.length === 0) {
      setError('Add at least one item to the bill.');
      return;
    }
    if (subtotal <= 0) {
      setError('Bill total must be greater than zero.');
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const saleCustomer = RUNNING_CUSTOMER;
      const inv = invoiceNo ?? makeInvoiceNo();
      if (!invoiceNo) setInvoiceNo(inv);
      await submitPosSale({
        items: cart,
        saleType: 'credit',
        customer: saleCustomer,
        received: receivedAmount,
        paymentMethod: 'UPI',
        invoiceNo: inv,
      });
      setSuccessMsg(`Sale saved • ${inv} • ₹${subtotal.toLocaleString()}`);
      setCart([]);
      setInvoiceNo(null);
      setShowCheckoutPopup(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save sale.');
    } finally {
      setSubmitting(false);
    }
  };

  const fmt = (n: number) => `₹${n.toLocaleString()}`;

  return (
    <div className="bg-white border-b border-gray-200 px-3 py-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-gray-800">New Sale (POS)</p>
        {invoiceNo && <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{invoiceNo}</span>}
      </div>

      {/* Add item */}
      <div className="space-y-2">
        <div className="relative">
          <input
            type="text"
            placeholder="Product Name"
            value={nameInput}
            onFocus={() => setShowSuggestions(true)}
            onChange={(e) => {
              setNameInput(e.target.value);
              setShowSuggestions(true);
            }}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 300)}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 z-20 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-44 overflow-y-auto">
              {suggestions.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    setNameInput(p.name);
                    setMrpInput(String(p.mrp || ''));
                    setSaleInput(String(p.sale || ''));
                    setShowSuggestions(false);
                  }}
                  onClick={() => {
                    setNameInput(p.name);
                    setMrpInput(String(p.mrp || ''));
                    setSaleInput(String(p.sale || ''));
                    setShowSuggestions(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-800 hover:bg-blue-50 flex items-center justify-between gap-2"
                >
                  <span className="truncate">{p.name}</span>
                  <span className="text-[10px] text-gray-500 shrink-0 whitespace-nowrap">MRP ₹{p.mrp} · Sale ₹{p.sale}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
          <input type="number" placeholder="MRP" value={mrpInput} onChange={(e) => setMrpInput(e.target.value)} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input type="number" step={10} placeholder="Sale Price" value={saleInput} onChange={(e) => setSaleInput(e.target.value)} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <button
            type="button"
            onClick={() => setShowQtyPopup(true)}
            className="px-2.5 py-2.5 bg-blue-50 border border-blue-200 rounded-lg text-[11px] font-extrabold text-blue-700 whitespace-nowrap"
          >
            +Qty.{itemQty > 1 ? ` ${itemQty}` : ''}
          </button>
        </div>
        <button
          onClick={addItem}
          disabled={!(nameInput.trim() && Number(saleInput) > 0)}
          className="w-full bg-slate-700 text-white py-2 rounded-lg font-bold text-sm hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {nameInput.trim() && Number(saleInput) > 0 && (
            <span className="text-[10px] font-semibold text-slate-300">
              {Number(saleInput)}×{itemQty}=₹{(Number(saleInput) * itemQty).toLocaleString()}
            </span>
          )}
          + Add to Bill
        </button>
      </div>

      {/* Bill items */}
      {cart.length > 0 && (
        <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
          {cart.map((item) => (
            <div key={item.name} className="px-3 py-2 flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-gray-800 truncate">{item.name}</p>
                <p className="text-[10px] text-gray-400">MRP {fmt(item.mrp)} · {fmt(item.sale)}/pc</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => updateQty(item.name, -1)} className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center text-gray-600"><Minus className="w-3 h-3" /></button>
                <span className="w-6 text-center text-xs font-bold">{item.qty}</span>
                <button onClick={() => updateQty(item.name, 1)} className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center text-gray-600"><Plus className="w-3 h-3" /></button>
              </div>
              <input
                type="number"
                step={10}
                value={item.sale}
                onChange={(e) => setItemSale(item.name, e.target.value)}
                className="w-16 px-1 py-1 text-xs border border-gray-200 rounded text-center"
              />
              <span className="w-14 text-right text-xs font-extrabold text-gray-800">{fmt(item.sale * item.qty)}</span>
              <button onClick={() => removeItem(item.name)} className="text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-[11px] text-red-600 font-semibold">{error}</p>}
      {successMsg && (
        <p className="text-[11px] text-green-700 font-bold flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> {successMsg}</p>
      )}

      {cart.length > 0 && (
        <button
          onClick={openCheckoutPopup}
          className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-bold text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {`Proceed to Bill — ${fmt(subtotal)}`}
        </button>
      )}

      {showQtyPopup && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowQtyPopup(false)}>
          <div className="bg-white rounded-2xl w-full max-w-[240px] p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-bold text-center text-slate-800 mb-1">Select Quantity</p>
            <p className="text-[11px] text-center text-slate-400 mb-3">{nameInput.trim() || 'Item'}</p>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => { setItemQty(n); setShowQtyPopup(false); }}
                  className={`py-3 rounded-xl text-lg font-extrabold transition cursor-pointer ${
                    itemQty === n ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showCheckoutPopup && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowCheckoutPopup(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-2xl text-center" onClick={(e) => e.stopPropagation()}>
            <p className="text-lg font-extrabold text-slate-800">Pay Bill</p>
            <p className="mt-1 text-2xl font-extrabold text-blue-700">{fmt(subtotal)}</p>
            <p className="mt-1 text-xs text-slate-500">Scan with any UPI app to pay</p>
            <p className="mt-2 text-xs font-semibold text-slate-700">UPI ID: 9583252256-3@axl</p>
            {qrLoading ? (
              <div className="mx-auto my-5 flex h-60 w-60 items-center justify-center rounded-xl bg-slate-50 text-sm text-slate-500">
                Preparing QR code…
              </div>
            ) : qrDataUrl ? (
              <Image src={qrDataUrl} alt="UPI payment QR code" width={240} height={240} unoptimized className="mx-auto my-4 rounded-xl border border-slate-100" />
            ) : (
              <p className="my-5 text-sm font-semibold text-red-600">{checkoutError || 'Payment QR code is unavailable.'}</p>
            )}
            {checkoutError && qrDataUrl && <p className="mb-3 text-xs text-red-600">{checkoutError}</p>}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={qrLoading || !qrDataUrl || submitting}
              className="w-full rounded-lg bg-green-600 py-3 text-sm font-bold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Checking out…' : 'Checkout'}
            </button>
            <button
              type="button"
              onClick={() => setShowCheckoutPopup(false)}
              disabled={submitting}
              className="mt-2 w-full rounded-lg py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

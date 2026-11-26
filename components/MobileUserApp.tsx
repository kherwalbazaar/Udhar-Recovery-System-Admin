'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ref, push, set, onValue } from 'firebase/database';
import { db } from '@/lib/firebase';
import { signOut } from '@/lib/auth';
import {
  Bell, Users, CheckCircle2,
  Calendar, User2, UserPlus, ArrowLeft, Phone, User,
  FileText, Zap, Plus, Trash2, Edit2, Check, ShoppingCart,
  Wallet, ArrowDownLeft, ArrowUpRight, Search, Minus,
  ChevronDown, ChevronUp, ChevronRight, MapPin, Save,
  Package, PackagePlus, Truck, LogOut,
} from 'lucide-react';
import MobileNavbar from '@/components/MobileNavbar';
import MobileSalePOS from '@/components/MobileSalePOS';
import MobileAddProduct from '@/components/MobileAddProduct';

export const MOBILE_ROUTE_TO_TAB: Record<string, string> = {
  '/': 'home',
  '/sales': 'collections',
  '/customers': 'khata',
  '/cashbook': 'cashbook',
  '/reminders': 'upcoming',
  '/sales-report': 'edtSale',
};

const TAB_TO_ROUTE: Record<string, string> = {
  home: '/',
  collections: '/sales',
  khata: '/customers',
  cashbook: '/cashbook',
  upcoming: '/reminders',
  edtSale: '/sales-report',
};

interface Item {
  name: string;
  mrp?: number;
  price: number;
  qty: number;
  createdAt?: number;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  address?: string;
  totalAmount: number;
  items: Item[];
  collectionType: string;
  startDate: string;
  frequency?: string | null;
  numInstallments?: string | null;
  paymentMethod?: string;
  penaltyOption?: string;
  createdAt: number;
}

interface SavedData {
  name: string;
  phone: string;
  address?: string;
  items: Item[];
  totalAmount: number;
  collectionType: string;
  startDate: string;
  frequency: string | null;
  numInstallments: string | null;
  paymentMethod: string;
  penaltyOption: string;
  createdAt: number;
}

interface SaleRecord {
  id: string;
  productName: string;
  mrp: number;
  sale: number;
  salePrice?: number;
  quantity?: number;
  date: string;
  createdAt: number;
  isKhata?: boolean;
  customerName?: string;
}

interface CashEntry {
  id: string;
  type: 'in' | 'out';
  amount: number;
  category: string;
  remark: string;
  date: string;
  mode: 'cash' | 'online';
  createdAt: number;
  isSaleRecord?: boolean;
}

interface Transaction {
  id: string;
  type: 'gave' | 'got';
  amount: number;
  itemName: string;
  date: string;
  createdAt: number;
}

function getCostPrice(productName: string, mrp: number): number {
  const name = (productName || '').toLowerCase();
  if (name.includes('galaxy') || name.includes('essa')) {
    return mrp * 0.6;
  }
  if (name.replace(/[^a-z0-9]/g, '').includes('saree100')) {
    return 75;
  }
  return isNaN(mrp) ? 0 : mrp / 2;
}

function calculateBalance(
  customer: Pick<Customer, 'items' | 'createdAt'>,
  transactions: { type: string; amount: number; createdAt: number }[],
): number {
  const itemEntries = (customer.items || []).map((item: Item, idx) => ({
    amount: item.price * item.qty,
    type: 'gave' as const,
    createdAt: item.createdAt || (customer.createdAt || Date.now()) + idx,
  }));
  const sorted = [...itemEntries, ...transactions].sort((a, b) => a.createdAt - b.createdAt);
  let due = 0;
  for (const e of sorted) {
    if (e.type === 'gave') due += e.amount;
    else if (e.type === 'got') due -= e.amount;
  }
  return isNaN(due) ? 0 : due;
}

function getNextPaymentDate(customer: Customer): string | null {
  if (!customer.startDate) return null;
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);
  const start = new Date(customer.startDate);
  if (isNaN(start.getTime())) return null;
  start.setHours(0, 0, 0, 0);
  if (customer.collectionType === 'onetime') return customer.startDate;
  const freq = customer.frequency || 'monthly';
  const diffDays = Math.floor((todayDate.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return customer.startDate;
  let periodsPassed: number;
  let nextDate: Date;
  if (freq === 'weekly') {
    periodsPassed = Math.floor(diffDays / 7);
    nextDate = new Date(start.getTime() + (periodsPassed + 1) * 7 * 24 * 60 * 60 * 1000);
  } else {
    periodsPassed = Math.floor(diffDays / 30);
    nextDate = new Date(start);
    nextDate.setMonth(nextDate.getMonth() + periodsPassed + 1);
  }
  if (nextDate < todayDate) {
    if (freq === 'weekly') nextDate = new Date(todayDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    else {
      nextDate = new Date(todayDate);
      nextDate.setMonth(nextDate.getMonth() + 1);
    }
  }
  return nextDate.toISOString().split('T')[0];
}

function daysLeft(dateStr: string): { text: string; cls: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  const diff = Math.floor((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return { text: 'Overdue', cls: 'bg-red-100' };
  if (diff === 0) return { text: 'Today', cls: 'bg-red-50' };
  if (diff === 1) return { text: 'Tomorrow', cls: 'bg-orange-50' };
  if (diff <= 3) return { text: `${diff} Days Left`, cls: 'bg-yellow-50' };
  return { text: `${diff} Days Left`, cls: 'bg-white' };
}

function timeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (weeks < 4) return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
  if (months < 12) return `${months} month${months > 1 ? 's' : ''} ago`;
  return `${years} year${years > 1 ? 's' : ''} ago`;
}

export default function MobileUserApp({ currentPath }: { currentPath: string }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<string>(() =>
    currentPath === '/' ? 'collections' : (MOBILE_ROUTE_TO_TAB[currentPath] ?? 'collections'),
  );
  const prevPathRef = useRef(currentPath);
  const [showSuccess, setShowSuccess] = useState(false);
  const [savedData, setSavedData] = useState<SavedData | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [activeReminderCustomer, setActiveReminderCustomer] = useState<(Customer & { balance?: number }) | null>(null);
  const [showCustomerDetailsPage, setShowCustomerDetailsPage] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isEditingCustomerProfile, setIsEditingCustomerProfile] = useState(false);
  const [editCustomerForm, setEditCustomerForm] = useState({ name: '', phone: '', address: '' });

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerBalances, setCustomerBalances] = useState<Record<string, number>>({});
  const [customerLastTrans, setCustomerLastTrans] = useState<Record<string, number>>({});

  const [items, setItems] = useState<Item[]>([]);
  const [newItem, setNewItem] = useState<Item>(() => ({ name: '', price: 0, qty: 1, createdAt: Date.now() }));
  const totalAmount = items.reduce((sum, item) => sum + item.price * item.qty, 0);

  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [showNavbar, setShowNavbar] = useState(true);
  const lastKhataScrollRef = useRef(0);
  const [editingSale, setEditingSale] = useState<SaleRecord | null>(null);
  const [editSaleForm, setEditSaleForm] = useState({ productName: '', mrp: '', sale: '' });
  const [transactionType, setTransactionType] = useState<'gave' | 'got'>('got');
  const today = () => new Date().toISOString().split('T')[0];
  const isToday = (ts: number) => {
    if (ts == null) return false;
    const d = new Date(ts);
    const n = new Date();
    return d.getDate() === n.getDate() && d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
  };
  const fmtDate = (ts: number) => {
    const d = new Date(ts);
    return `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })} ${d.getFullYear()}`;
  };
  const [transData, setTransData] = useState({ amount: '', itemName: '', date: today() });
  const [customerTransactions, setCustomerTransactions] = useState<Transaction[]>([]);
  const transListenerRef = useRef<(() => void) | null>(null);
  const [editingTrans, setEditingTrans] = useState<{
    id: string;
    type: 'gave' | 'got';
    amount: number;
    name: string;
    date: string;
    isLegacyItem: boolean;
  } | null>(null);
  const [editTransForm, setEditTransForm] = useState({ itemName: '', amount: '', date: '' });
  const reminderCardRef = useRef<HTMLDivElement>(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<{ name: string; mrp: number; sale: number }[]>([]);
  const [selectedSales, setSelectedSales] = useState<Set<string>>(new Set());

  const [formData, setFormData] = useState({
    customerPhone: '',
    customerName: '',
    collectionType: 'installments',
    frequency: 'monthly',
    numInstallments: '6',
    startDate: '',
    paymentMethod: 'upi',
    penaltyOption: 'charge-auto',
  });

  const [upcomingFilter, setUpcomingFilter] = useState<string>('all');
  const [upcomingSearch, setUpcomingSearch] = useState<string>('');

  const [cashEntries, setCashEntries] = useState<CashEntry[]>([]);
  const [showCashModal, setShowCashModal] = useState<boolean>(false);
  const [cashType, setCashType] = useState<'in' | 'out'>('in');
  const [cashForm, setCashForm] = useState({
    amount: '',
    category: 'Sales',
    remark: '',
    date: today(),
    mode: 'cash' as 'cash' | 'online',
  });
  const [cashFilter, setCashFilter] = useState<'all' | 'in' | 'out'>('all');
  const [cashSearch, setCashSearch] = useState<string>('');
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  // Sync active tab when URL changes via browser Back/Forward or external link.
  useEffect(() => {
    if (prevPathRef.current === currentPath) return;
    prevPathRef.current = currentPath;
    const mapped = MOBILE_ROUTE_TO_TAB[currentPath];
    if (mapped) {
      setActiveTab(mapped);
      setSelectedCustomer(null);
      setShowTransactionForm(false);
      setShowCustomerDetailsPage(false);
      setShowDeleteConfirm(false);
      setIsEditingCustomerProfile(false);
      setShowNavbar(true);
    }
  }, [currentPath]);

  // Clear mobile body background tint when leaving MobileUserApp (e.g. resizing to desktop or opening /products).
  useEffect(() => {
    return () => {
      document.body.style.backgroundColor = '';
    };
  }, []);

  const navigateToTab = (tab: string) => {
    setActiveTab(tab);
    setShowNavbar(true);
    if (tab !== 'detail') {
      setSelectedCustomer(null);
      setShowTransactionForm(false);
      setShowCustomerDetailsPage(false);
      setShowDeleteConfirm(false);
      setIsEditingCustomerProfile(false);
    }
    const targetRoute = TAB_TO_ROUTE[tab];
    if (targetRoute && currentPath !== targetRoute) {
      router.push(targetRoute);
    }
  };

  const handleLogout = () => {
    signOut();
    router.replace('/login');
  };

  const combinedSales = useMemo(() => {
    const khataSales: (SaleRecord & { isKhata?: boolean; customerName?: string })[] = [];

    customers.forEach((c) => {
      if (c.items && Array.isArray(c.items) && c.items.length > 0) {
        c.items.forEach((item: Item, idx: number) => {
          const itemAmt = (item.price || 0) * (item.qty || 1);
          if (itemAmt > 0) {
            const itemTs = item.createdAt || (c.createdAt || Date.now()) + idx;
            const d = new Date(itemTs);
            const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            khataSales.push({
              id: `khata_${c.id}_item_${idx}`,
              productName: `${c.name} - ${item.name || 'Item'}`,
              mrp: itemAmt,
              sale: itemAmt,
              date: dateStr,
              createdAt: itemTs,
              isKhata: true,
              customerName: c.name,
            });
          }
        });
      } else if (c.totalAmount && c.totalAmount > 0) {
        const cTs = c.createdAt || Date.now();
        const d = new Date(cTs);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        khataSales.push({
          id: `khata_${c.id}_total`,
          productName: `${c.name} (Khata Sale)`,
          mrp: c.totalAmount,
          sale: c.totalAmount,
          date: dateStr,
          createdAt: cTs,
          isKhata: true,
          customerName: c.name,
        });
      }
    });

    return [...sales, ...khataSales].sort((a, b) => b.createdAt - a.createdAt);
  }, [sales, customers]);

  const productNames = useMemo(() => {
    const map = new Map<string, { name: string; mrp: number; sale: number }>();

    const addName = (raw: string, mrp: number, sale: number, isCatalog = false) => {
      const name = (raw || '').trim();
      if (!name) return;
      const key = name.toLowerCase();
      const existing = map.get(key);
      if (!existing) {
        map.set(key, { name, mrp: Number(mrp || 0), sale: Number(sale || 0) });
      } else {
        if (isCatalog || (mrp > 0 && existing.mrp === 0)) existing.mrp = Number(mrp || 0);
        if (isCatalog || (sale > 0 && existing.sale === 0)) existing.sale = Number(sale || 0);
      }
    };

    catalogProducts.forEach((product) => addName(product.name, product.mrp, product.sale, true));
    sales.forEach((s) => addName(s.productName.replace(/^.+?\s-\s/, ''), s.mrp, s.sale));
    customers.forEach((c) => {
      if (c.items && Array.isArray(c.items)) {
        c.items.forEach((item) => addName(item.name, item.price, item.price));
      }
    });

    return Array.from(map.values());
  }, [catalogProducts, sales, customers]);

  useEffect(() => {
    const cashRef = ref(db, 'cashbook');
    const unsubCash = onValue(cashRef, (snap) => {
      const data: Record<string, Omit<CashEntry, 'id'>> | null = snap.val();
      if (data) {
        const list = Object.entries(data)
          .filter(([id]) => id !== '_persist')
          .map(([id, val]) => ({ id, ...val }))
          .sort((a, b) => b.createdAt - a.createdAt);
        setCashEntries(list);
      } else {
        setCashEntries([]);
      }
    });
    return () => unsubCash();
  }, []);

  const saveCashEntry = async () => {
    const amt = Number(cashForm.amount);
    if (isNaN(amt) || amt <= 0) return;
    const cashRef = push(ref(db, 'cashbook'));
    await set(cashRef, {
      type: cashType,
      amount: amt,
      category: cashForm.category || (cashType === 'in' ? 'Cash Received' : 'Expense'),
      remark: cashForm.remark.trim(),
      date: cashForm.date || today(),
      mode: cashForm.mode,
      createdAt: Date.now(),
    });
    setShowCashModal(false);
    setCashForm({
      amount: '',
      category: 'Sales',
      remark: '',
      date: today(),
      mode: 'cash',
    });
  };

  const deleteCashEntry = async (id: string) => {
    const { remove: removeDb } = await import('firebase/database');
    await removeDb(ref(db, `cashbook/${id}`));
  };

  const deleteCustomer = async (id: string) => {
    const { remove: removeDb } = await import('firebase/database');
    await removeDb(ref(db, `customers/${id}`));
    setShowDeleteConfirm(false);
    setShowCustomerDetailsPage(false);
    setIsEditingCustomerProfile(false);
    setSelectedCustomer(null);
    navigateToTab('khata');
  };

  const startEditingProfile = () => {
    if (!selectedCustomer) return;
    setEditCustomerForm({
      name: selectedCustomer.name || '',
      phone: selectedCustomer.phone || '',
      address: selectedCustomer.address || '',
    });
    setIsEditingCustomerProfile(true);
  };

  const saveCustomerProfile = async () => {
    if (!selectedCustomer || !editCustomerForm.name.trim() || !editCustomerForm.phone.trim()) return;
    const { ref: dbRef, update } = await import('firebase/database');
    const updatedData = {
      name: editCustomerForm.name.trim(),
      phone: editCustomerForm.phone.trim(),
      address: editCustomerForm.address.trim(),
    };
    await update(dbRef(db, `customers/${selectedCustomer.id}`), updatedData);
    setSelectedCustomer((prev) => (prev ? { ...prev, ...updatedData } : null));
    setIsEditingCustomerProfile(false);
  };

  const handleCashBackdropClick = () => {
    const hasInput =
      (cashForm.amount && String(cashForm.amount).trim() !== '') ||
      (cashForm.remark && cashForm.remark.trim() !== '');
    if (!hasInput) {
      setShowCashModal(false);
    }
  };

  // Back button handling for local overlays / sub-views (`detail`, `add`, modals).
  useEffect(() => {
    const hasOverlay =
      selectedCustomer !== null ||
      activeTab === 'detail' ||
      activeTab === 'add' ||
      activeTab === 'addProduct' ||
      showCustomerDetailsPage ||
      showTransactionForm ||
      editingTrans !== null ||
      editingSale !== null ||
      showSuccess ||
      isEditingCustomerProfile ||
      showCashModal;

    if (!hasOverlay) return;

    let backGuard = false;
    const handlePopState = () => {
      if (backGuard) return;
      backGuard = true;
      if (isEditingCustomerProfile) {
        setIsEditingCustomerProfile(false);
      } else if (showCustomerDetailsPage) {
        setShowCustomerDetailsPage(false);
        setShowDeleteConfirm(false);
      } else if (showCashModal) {
        setShowCashModal(false);
      } else if (showTransactionForm) {
        setShowTransactionForm(false);
      } else if (editingTrans) {
        setEditingTrans(null);
      } else if (editingSale) {
        setEditingSale(null);
        setEditSaleForm({ productName: '', mrp: '', sale: '' });
      } else if (showSuccess) {
        setShowSuccess(false);
      } else if (selectedCustomer || activeTab === 'detail') {
        setSelectedCustomer(null);
        setActiveTab(MOBILE_ROUTE_TO_TAB[currentPath] ?? 'khata');
      } else if (activeTab === 'add') {
        setActiveTab('khata');
      } else if (activeTab === 'addProduct') {
        setActiveTab(MOBILE_ROUTE_TO_TAB[currentPath] ?? 'home');
      }
      setTimeout(() => {
        backGuard = false;
      }, 300);
    };

    window.history.pushState({ mobileOverlay: true }, '', window.location.href);
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [
    showCustomerDetailsPage,
    showTransactionForm,
    editingTrans,
    editingSale,
    showSuccess,
    selectedCustomer,
    activeTab,
    isEditingCustomerProfile,
    showCashModal,
    currentPath,
  ]);

  useEffect(() => {
    if (!selectedCustomer) return;
    const bal = customerBalances[selectedCustomer.id] ?? calculateBalance(selectedCustomer, customerTransactions);
    const upi = `upi://pay?pa=9583252256-3@axl&pn=KHERWAL%20BAZAAR&am=${Math.abs(bal)}&cu=INR`;
    import('qrcode').then(({ default: QRCode }) => {
      QRCode.toDataURL(upi, { width: 200, margin: 1, color: { dark: '#1e293b', light: '#FFFFFF' } }).then(setQrDataUrl);
    });
  }, [selectedCustomer, customerBalances, customerTransactions]);

  const todaySalesAmt = combinedSales.filter((s) => isToday(s.createdAt)).reduce((s, r) => s + (r.sale || 0), 0);
  const todaySalesCount = combinedSales.filter((s) => isToday(s.createdAt)).length;

  const addItem = () => {
    if (newItem.name.trim() && (newItem.price > 0 || (newItem.mrp && newItem.mrp > 0))) {
      const mrpVal = newItem.mrp ? Number(newItem.mrp) : newItem.price ? Number(newItem.price) : 0;
      const priceVal = newItem.price ? Number(newItem.price) : mrpVal;
      setItems([
        ...items,
        {
          name: newItem.name.trim(),
          mrp: mrpVal,
          price: priceVal,
          qty: 1,
          createdAt: Date.now(),
        },
      ]);
      setNewItem({ name: '', mrp: 0, price: 0, qty: 1, createdAt: Date.now() });
    }
  };

  const editItem = (index: number) => {
    setNewItem({ ...items[index] });
    setItems(items.filter((_, i) => i !== index));
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const saveCustomer = async () => {
    if (!formData.customerName || !formData.customerPhone || items.length === 0) return;
    if (formData.collectionType === 'installments' && !formData.startDate) return;
    if (formData.collectionType === 'onetime' && !formData.startDate) return;
    const now = Date.now();
    const customerRef = push(ref(db, 'customers'));
    const data = {
      name: formData.customerName,
      phone: formData.customerPhone,
      items: [],
      totalAmount,
      collectionType: formData.collectionType,
      frequency: formData.collectionType === 'installments' ? formData.frequency : null,
      numInstallments: formData.collectionType === 'installments' ? formData.numInstallments : null,
      startDate: formData.startDate,
      paymentMethod: formData.paymentMethod,
      penaltyOption: formData.penaltyOption,
      createdAt: now,
    };
    await set(customerRef, data);
    const transPromises = items.map((item, idx) => {
      const transRef = push(ref(db, `customers/${customerRef.key}/transactions`));
      return set(transRef, {
        type: 'gave',
        amount: item.price * (item.qty || 1),
        itemName: item.name,
        date: new Date(now).toISOString().split('T')[0],
        createdAt: now + idx,
      });
    });
    const salePromises = items.map((item, idx) => {
      const saleRef = push(ref(db, 'sales'));
      return set(saleRef, {
        productName: item.name,
        mrp: item.mrp || item.price,
        sale: item.price,
        date: new Date(now).toISOString().split('T')[0],
        createdAt: now + idx,
      });
    });
    await Promise.all([...transPromises, ...salePromises]);
    setSavedData(data);
    setShowSuccess(true);
  };

  const recalculateDue = async (customerId: string) => {
    const { ref: dbRef, get } = await import('firebase/database');
    const tRef = dbRef(db, `customers/${customerId}/transactions`);
    const cRef = dbRef(db, `customers/${customerId}`);
    const [tSnap, cSnap] = await Promise.all([get(tRef), get(cRef)]);
    const tData: Record<string, Omit<Transaction, 'id'>> | null = tSnap.val();
    const cData: Record<string, unknown> | null = cSnap.val();
    if (!cData) return 0;
    const allTrans: { amount: number; type: string; createdAt: number }[] = tData ? Object.values(tData) : [];
    const itemsArr: Item[] = (cData?.items as Item[]) || [];
    const baseCreatedAt = (cData?.createdAt as number) || Date.now();
    const itemEntries = itemsArr.map((item: Item, idx) => ({
      amount: item.price * item.qty,
      type: 'gave' as const,
      createdAt: item.createdAt || baseCreatedAt + idx,
    }));
    const combined = [...itemEntries, ...allTrans].sort((a, b) => a.createdAt - b.createdAt);
    let due = 0;
    for (const entry of combined) {
      if (entry.type === 'gave') due += entry.amount;
      else if (entry.type === 'got') due -= entry.amount;
    }
    if (isNaN(due)) due = 0;
    await set(cRef, { ...cData, totalAmount: due });
    return due;
  };

  const saveTransaction = async () => {
    if (!transData.amount || !transData.itemName || !transData.date || !selectedCustomer) return;
    const amt = Number(transData.amount);
    if (isNaN(amt) || amt <= 0) return;
    const transRef = push(ref(db, `customers/${selectedCustomer.id}/transactions`));
    await set(transRef, {
      type: transactionType,
      amount: amt,
      itemName: transData.itemName,
      date: transData.date,
      createdAt: Date.now(),
    });
    await recalculateDue(selectedCustomer.id);
    const { ref: dbRef, get } = await import('firebase/database');
    const freshSnap = await get(dbRef(db, `customers/${selectedCustomer.id}/transactions`));
    const freshData: Record<string, Omit<Transaction, 'id'>> | null = freshSnap.val();
    const tList = freshData ? Object.entries(freshData).map(([id, v]) => ({ id, ...v } as Transaction)) : [];
    setCustomerTransactions(tList);
    const newBal = calculateBalance(selectedCustomer, tList);
    setCustomerBalances((prev) => ({ ...prev, [selectedCustomer.id]: newBal }));
    setShowTransactionForm(false);
    setTransData({ amount: '', itemName: '', date: today() });
  };

  const closeSuccess = () => {
    setShowSuccess(false);
    setSavedData(null);
    setFormData({
      customerPhone: '',
      customerName: '',
      collectionType: 'installments',
      frequency: 'monthly',
      numInstallments: '6',
      startDate: '',
      paymentMethod: 'upi',
      penaltyOption: 'charge-auto',
    });
    setItems([]);
    navigateToTab('khata');
  };

  useEffect(() => {
    const salesRef = ref(db, 'sales');
    const unsubSales = onValue(salesRef, (snap) => {
      const data: Record<string, Omit<SaleRecord, 'id'>> | null = snap.val();
      setSales(
        data
          ? Object.entries(data)
              .filter(([id]) => id !== '_persist')
              .map(([id, v]) => ({ id, ...v }))
              .sort((a, b) => b.createdAt - a.createdAt)
          : [],
      );
    });
    return () => unsubSales();
  }, []);

  useEffect(() => {
    const productsRef = ref(db, 'products');
    const unsubProducts = onValue(productsRef, (snap) => {
      const data = snap.val() as Record<string, Record<string, unknown>> | null;
      if (!data) {
        setCatalogProducts([]);
        return;
      }
      const products: { name: string; mrp: number; sale: number }[] = Object.values(data)
        .map((r): { name: string; mrp: number; sale: number } | null => {
          if (!r || typeof r !== 'object') return null;
          const name = String(r.name ?? r.productName ?? r.product ?? r.itemName ?? '').trim();
          if (!name) return null;
          const sale = Number(r.sale ?? r.salePrice ?? r.sellingPrice ?? r.price ?? 0);
          const mrp = Number(r.mrp ?? r.MRP ?? sale);
          return { name, mrp, sale };
        })
        .filter((p): p is { name: string; mrp: number; sale: number } => Boolean(p && p.name));

      setCatalogProducts(products);
    });
    return () => unsubProducts();
  }, []);

  useEffect(() => {
    const customersRef = ref(db, 'customers');
    const unsubCustomers = onValue(customersRef, (snapshot) => {
      const data: Record<string, Omit<Customer, 'id'>> | null = snapshot.val();
      if (data) {
        const list = Object.entries(data)
          .filter(([id]) => id !== '_persist')
          .map(([id, val]) => ({ id, ...val }));
        setCustomers(list);
      } else {
        setCustomers([]);
      }
    });
    return () => {
      unsubCustomers();
    };
  }, []);

  useEffect(() => {
    const unsubs: (() => void)[] = [];
    customers.forEach((customer) => {
      const tRef = ref(db, `customers/${customer.id}/transactions`);
      const unsub = onValue(tRef, (snap) => {
        const tData: Record<string, Omit<Transaction, 'id'>> | null = snap.val();
        const trans = tData ? Object.values(tData) : [];
        const balance = calculateBalance(customer, trans);
        setCustomerBalances((prev) => ({ ...prev, [customer.id]: balance }));
        const lastTrans = trans.reduce((max, t) => (t.createdAt > max ? t.createdAt : max), 0);
        setCustomerLastTrans((prev) => ({ ...prev, [customer.id]: lastTrans || customer.createdAt }));
      });
      unsubs.push(unsub);
    });
    return () => {
      unsubs.forEach((fn) => fn());
    };
  }, [customers]);

  const upcomingCustomers = useMemo(() => {
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    const threeDays = new Date(todayDate);
    threeDays.setDate(threeDays.getDate() + 3);
    return customers
      .map((c) => ({
        ...c,
        balance: customerBalances[c.id] ?? 0,
        nextPaymentDate: getNextPaymentDate(c),
        lastTransDate: customerLastTrans[c.id] || c.createdAt,
      }))
      .filter((c) => {
        if (c.balance <= 0 || !c.nextPaymentDate) return false;
        const d = new Date(c.nextPaymentDate);
        d.setHours(0, 0, 0, 0);
        return d >= todayDate && d <= threeDays;
      })
      .sort((a, b) => {
        const dateCmp = a.nextPaymentDate!.localeCompare(b.nextPaymentDate!);
        if (dateCmp !== 0) return dateCmp;
        return b.balance - a.balance;
      });
  }, [customers, customerBalances, customerLastTrans]);

  const getResponsiveValueTextSize = (val: number) => {
    const formattedStr = `₹ ${Math.abs(val).toLocaleString()}`;
    const len = formattedStr.length;
    if (len <= 6) {
      return 'text-lg xs:text-xl sm:text-2xl md:text-3xl font-extrabold';
    } else if (len <= 8) {
      return 'text-base xs:text-lg sm:text-xl md:text-2xl font-bold';
    } else if (len <= 11) {
      return 'text-sm xs:text-base sm:text-lg md:text-xl font-bold';
    } else if (len <= 14) {
      return 'text-xs xs:text-sm sm:text-base md:text-lg font-bold';
    } else {
      return 'text-[10px] xs:text-xs sm:text-sm md:text-base font-bold';
    }
  };

  const renderDashboard = () => {
    const balances = Object.values(customerBalances);
    const positiveSum = balances.reduce((s, b) => (b > 0 ? s + b : s), 0);
    const positiveCount = balances.filter((b) => b > 0).length;
    const negativeSum = balances.reduce((s, b) => (b < 0 ? s + Math.abs(b) : s), 0);
    const negativeCount = balances.filter((b) => b < 0).length;
    return (
      <div className="flex-1 min-h-0 overflow-y-auto pb-20">
        {/* Summary Card */}
        <div className="px-1 pt-1 pb-6">
          <div className="bg-gradient-to-br from-slate-900 to-blue-900 text-white rounded-2xl p-3 shadow-lg">
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center border-r border-blue-700">
                <p className="text-sm text-gray-300 mb-2">You will give</p>
                <h3 className={`text-3xl font-bold mb-2 ${positiveSum > 0 ? 'text-red-400' : 'text-white'}`}>
                  ₹ {positiveSum.toLocaleString()}
                </h3>
                <div className="flex items-center justify-center gap-2 text-sm">
                  <Users className="w-4 h-4" />
                  <span>{positiveCount} Customers</span>
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-300 mb-2">You will get</p>
                <h3 className={`text-3xl font-bold mb-2 ${negativeSum > 0 ? 'text-green-400' : 'text-white'}`}>
                  ₹ {negativeSum.toLocaleString()}
                </h3>
                <div className="flex items-center justify-center gap-2 text-sm">
                  <Users className="w-4 h-4" />
                  <span>{negativeCount} Customers</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="px-6 pb-6">
          <h3 className="text-sm font-bold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-3 gap-4">
            <button onClick={() => navigateToTab('addProduct')} className="flex flex-col items-center gap-1 cursor-pointer">
              <div className="w-11 h-11 bg-green-500 rounded-lg flex items-center justify-center shadow hover:shadow-md transition border-b-4 border-green-700">
                <PackagePlus className="w-6 h-6 text-white" />
              </div>
              <p className="text-[11px] font-bold text-center text-green-700">Add New</p>
            </button>
            <button onClick={() => navigateToTab('cashbook')} className="flex flex-col items-center gap-1 cursor-pointer">
              <div className="w-11 h-11 bg-purple-500 rounded-lg flex items-center justify-center shadow hover:shadow-md transition border-b-4 border-purple-700">
                <Wallet className="w-6 h-6 text-white" />
              </div>
              <p className="text-[11px] font-bold text-center text-purple-700">Cash Book</p>
            </button>
            <button onClick={() => navigateToTab('collections')} className="flex flex-col items-center gap-1 cursor-pointer">
              <div className="w-11 h-11 bg-orange-500 rounded-lg flex items-center justify-center shadow hover:shadow-md transition border-b-4 border-orange-700">
                <ShoppingCart className="w-6 h-6 text-white" />
              </div>
              <p className="text-[11px] font-bold text-center text-orange-700">Sales</p>
            </button>
            <button onClick={() => navigateToTab('khata')} className="flex flex-col items-center gap-1 cursor-pointer">
              <div className="w-11 h-11 bg-blue-500 rounded-lg flex items-center justify-center shadow hover:shadow-md transition border-b-4 border-blue-700">
                <Users className="w-6 h-6 text-white" />
              </div>
              <p className="text-[11px] font-bold text-center text-blue-700">Khata</p>
            </button>
            <button onClick={() => navigateToTab('edtSale')} className="flex flex-col items-center gap-1 cursor-pointer">
              <div className="w-11 h-11 bg-teal-500 rounded-lg flex items-center justify-center shadow hover:shadow-md transition border-b-4 border-teal-700">
                <Edit2 className="w-6 h-6 text-white" />
              </div>
              <p className="text-[11px] font-bold text-center text-teal-700">Edt Sale</p>
            </button>
            <button onClick={() => navigateToTab('upcoming')} className="flex flex-col items-center gap-1 cursor-pointer">
              <div className="w-11 h-11 bg-red-500 rounded-lg flex items-center justify-center shadow hover:shadow-md transition border-b-4 border-red-700">
                <Bell className="w-6 h-6 text-white" />
              </div>
              <p className="text-[11px] font-bold text-center text-red-700">Reminder</p>
            </button>
          </div>
        </div>

        {/* Auto Collection Banner */}
        <div className="px-1 pb-6">
          <div className="bg-green-50 border-l-4 border-green-500 rounded-lg p-2 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
            <p className="text-[11px] text-green-800 flex-1">
              Auto Collection Active — Payments will be collected automatically.
            </p>
            <button
              onClick={() => navigateToTab('upcoming')}
              className="bg-green-600 text-white px-2 py-1 rounded text-[10px] font-semibold whitespace-nowrap hover:bg-green-700"
            >
              View ›
            </button>
          </div>
        </div>

        {/* Today's Summary */}
        <div className="px-6 pb-4 mb-2">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-gray-900">Today&apos;s Summary</h3>
          </div>
          <div className="grid grid-cols-3 gap-1 mb-2">
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-3 text-center">
              <div className="text-xl mb-1">📥</div>
              <p className="text-base font-bold text-gray-900">₹{todaySalesAmt.toLocaleString()}</p>
              <p className="text-[10px] text-gray-600 mt-1">Sale Today</p>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 text-center">
              <div className="text-xl mb-1">📦</div>
              <p className="text-base font-bold text-gray-900">{todaySalesCount}</p>
              <p className="text-[10px] text-gray-600 mt-1">Items Sold Today</p>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-3 text-center">
              <div className="text-xl mb-1">📅</div>
              <p className="text-base font-bold text-gray-900">
                {(() => {
                  const todayD = new Date();
                  todayD.setHours(0, 0, 0, 0);
                  return upcomingCustomers.filter((c) => {
                    const d = new Date(c.nextPaymentDate!);
                    d.setHours(0, 0, 0, 0);
                    return d.getTime() === todayD.getTime();
                  }).length;
                })()}
              </p>
              <p className="text-[10px] text-gray-600 mt-1">Due Today</p>
            </div>
          </div>
        </div>

        {/* Admin Quick Links (Products / Suppliers / Logout) */}
        <div className="px-6 pb-6">
          <div className="grid grid-cols-3 gap-2">
            <Link
              href="/products"
              className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-[11px] font-bold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <Package className="w-3.5 h-3.5 text-red-600" />
              <span>Products</span>
            </Link>
            <Link
              href="/suppliers"
              className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-[11px] font-bold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <Truck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Suppliers</span>
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-2 text-[11px] font-bold text-rose-600 shadow-sm hover:bg-rose-100"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderKhata = () => {
    const balances = Object.values(customerBalances);
    const pSum = balances.reduce((s, b) => (b > 0 ? s + b : s), 0);
    const pCount = balances.filter((b) => b > 0).length;
    const nSum = balances.reduce((s, b) => (b < 0 ? s + Math.abs(b) : s), 0);
    const nCount = balances.filter((b) => b < 0).length;
    return (
      <div
        className="flex-1 min-h-0 overflow-y-auto pb-20"
        onScroll={(e) => {
          const st = (e.target as HTMLElement).scrollTop;
          if (st > lastKhataScrollRef.current && st > 20) setShowNavbar(false);
          else if (st < lastKhataScrollRef.current || st < 10) setShowNavbar(true);
          lastKhataScrollRef.current = st;
        }}
      >
        <div className="pb-3">
          <div className="bg-gradient-to-br from-slate-900 to-blue-900 text-white p-3 shadow-lg">
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center border-r border-blue-700">
                <p className="text-sm text-gray-300 mb-2">You will give</p>
                <h3 className={`text-3xl font-bold mb-2 ${pSum > 0 ? 'text-red-400' : 'text-white'}`}>
                  ₹ {pSum.toLocaleString()}
                </h3>
                <p className="text-sm text-gray-400">{pCount} Customers</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-300 mb-2">You will get</p>
                <h3 className={`text-3xl font-bold mb-2 ${nSum > 0 ? 'text-green-400' : 'text-white'}`}>
                  ₹ {nSum.toLocaleString()}
                </h3>
                <p className="text-sm text-gray-400">{nCount} Customers</p>
              </div>
            </div>
          </div>
        </div>

        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-y border-gray-200 px-3 py-2 flex items-center justify-between mb-1">
          <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
            Customers ({customers.length})
          </span>
          <button
            type="button"
            onClick={() => navigateToTab('add')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add Customer</span>
          </button>
        </div>

        <div className="px-2 pt-1 space-y-1">
          {customers.map((customer) => {
            const openDetail = () => {
              setSelectedCustomer(customer);
              setActiveTab('detail');
              if (transListenerRef.current) transListenerRef.current();
              import('firebase/database').then(({ ref: dbRef, onValue: dbOnValue }) => {
                const tRef = dbRef(db, `customers/${customer.id}/transactions`);
                transListenerRef.current = dbOnValue(tRef, (snap) => {
                  const d: Record<string, Omit<Transaction, 'id'>> | null = snap.val();
                  setCustomerTransactions(
                    d ? Object.entries(d).map(([id, v]) => ({ id, ...v } as Transaction)) : [],
                  );
                });
              });
            };
            return (
              <div
                key={customer.id}
                onClick={openDetail}
                className="bg-white border border-gray-200 border-l-4 border-l-green-500 rounded-lg px-2 py-2 hover:shadow-md transition cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0">
                    {customer.name
                      .split(' ')
                      .map((w) => w[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-gray-900 text-sm truncate">{customer.name}</span>
                      <span className="text-xs text-gray-500">Remaining</span>
                      <span className="bg-blue-100 text-blue-800 text-[10px] font-semibold px-2 py-0.5 rounded capitalize">
                        {customer.collectionType}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <div className="flex flex-col">
                        <span className="text-xs text-gray-600">{customer.phone}</span>
                        <span className="text-[10px] text-gray-400">
                          {timeAgo(customerLastTrans[customer.id] || customer.createdAt)}
                        </span>
                      </div>
                      {(() => {
                        const bal = customerBalances[customer.id] ?? calculateBalance(customer, []);
                        return (
                          <span
                            className={`font-extrabold text-base ${bal > 0 ? 'text-red-600' : bal < 0 ? 'text-green-600' : 'text-gray-400'}`}
                          >
                            ₹{Math.abs(bal)}
                          </span>
                        );
                      })()}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openDetail();
                        }}
                        className="bg-blue-600 text-white px-3 py-1 rounded text-xs font-semibold hover:bg-blue-700"
                      >
                        View
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const generatePDF = async () => {
    if (!selectedCustomer) return;
    const c = selectedCustomer;
    const { jsPDF } = await import('jspdf');
    const itemEntries = (c.items || []).map((item, idx) => ({
      createdAt: item.createdAt || c.createdAt + idx,
      name: item.name,
      amount: item.price * item.qty,
      type: 'gave' as const,
    }));
    const transEntries = (customerTransactions || []).map((t) => ({
      createdAt: t.createdAt,
      name: t.itemName,
      amount: t.amount,
      type: t.type as 'gave' | 'got',
    }));
    const sorted = [...itemEntries, ...transEntries].sort((a, b) => a.createdAt - b.createdAt);
    let running = 0;
    const withBalance = sorted.map((e) => {
      if (e.type === 'gave') running += e.amount;
      else running -= e.amount;
      return { ...e, balance: running };
    });
    const grandDebit = withBalance.filter((e) => e.type === 'gave').reduce((s, e) => s + e.amount, 0);
    const grandCredit = withBalance.filter((e) => e.type === 'got').reduce((s, e) => s + e.amount, 0);

    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pw = 210,
      m = 12,
      cw = pw - 2 * m;
    const blue = [30, 58, 95] as const;
    const g = (y: number) => (y > 280 ? (doc.addPage(), m) : y);

    doc.setFillColor(...blue);
    doc.rect(0, 0, pw, 38, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text('KHERWAL BAZAAR', pw / 2, 17, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('UDHAR RECOVERY SYSTEM', pw / 2, 25, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(147, 197, 253);
    doc.text('CUSTOMER LEDGER REPORT', pw / 2, 35, { align: 'center' });

    let y = 46;
    doc.setFillColor(243, 244, 246);
    doc.roundedRect(m, y, cw, 24, 2, 2, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...blue);
    doc.text(`Customer Name : ${c.name}`, m + 4, y + 8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(55, 65, 81);
    doc.text(`Phone Number  : ${c.phone}`, m + 4, y + 18);
    y = 78;

    const half = cw / 2 - 3;
    doc.setFillColor(243, 244, 246);
    doc.roundedRect(m, y, half, 20, 2, 2, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(107, 114, 128);
    doc.text('Summary Period', m + 4, y + 7);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(55, 65, 81);
    const fd = sorted.length ? new Date(sorted[0].createdAt) : new Date();
    const ld = sorted.length ? new Date(sorted[sorted.length - 1].createdAt) : new Date();
    doc.text(
      `${fd.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}  →  ${ld.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`,
      m + 4,
      y + 15,
    );
    doc.roundedRect(m + half + 6, y, half, 20, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(107, 114, 128);
    doc.text('No. of Entries', m + half + 10, y + 7);
    doc.setFontSize(12);
    doc.setTextColor(...blue);
    doc.text(`${sorted.length}`, m + half + 10, y + 16);
    y = 106;

    const cx = [m, m + 26, m + 72, m + 114, m + 156];
    doc.setFillColor(...blue);
    doc.rect(m, y, cw, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    doc.text('Date', cx[0] + 2, y + 5);
    doc.text('Details', cx[1] + 2, y + 5);
    doc.text('Debit (-)', cx[2] + 2, y + 5);
    doc.text('Credit (+)', cx[3] + 2, y + 5);
    doc.text('Balance', cx[4] + 2, y + 5);
    y += 7;

    for (let i = 0; i < withBalance.length; i++) {
      y = g(y);
      const e = withBalance[i];
      const d = new Date(e.createdAt);
      const ds = `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}`;
      const isGave = e.type === 'gave';
      const bal = e.balance;
      if (i % 2 === 0) {
        doc.setFillColor(249, 250, 251);
        doc.rect(m, y, cw, 6, 'F');
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(55, 65, 81);
      doc.text(ds, cx[0] + 2, y + 4);
      doc.text(e.name.length > 22 ? e.name.substring(0, 20) + '..' : e.name, cx[1] + 2, y + 4);
      if (isGave) {
        doc.setTextColor(220, 38, 38);
        doc.text(`₹${e.amount}`, cx[2] + 2, y + 4);
      } else {
        doc.setTextColor(22, 163, 74);
        doc.text(`₹${e.amount}`, cx[3] + 2, y + 4);
      }
      if (bal > 0) doc.setTextColor(220, 38, 38);
      else if (bal < 0) doc.setTextColor(22, 163, 74);
      else doc.setTextColor(107, 114, 128);
      doc.setFont('helvetica', 'bold');
      doc.text(`₹${Math.abs(bal)}`, cx[4] + 2, y + 4);
      y += 6;
    }

    y = g(y + 3);
    doc.setFillColor(...blue);
    doc.rect(m, y, cw, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text('GRAND TOTAL', cx[0] + 2, y + 5.5);
    doc.text(`₹${grandDebit}`, cx[2] + 2, y + 5.5);
    doc.text(`₹${grandCredit}`, cx[3] + 2, y + 5.5);
    const fb = grandDebit - grandCredit;
    const fbCol = fb > 0 ? [255, 100, 100] : fb < 0 ? [134, 239, 128] : [200, 200, 200];
    doc.setTextColor(fbCol[0], fbCol[1], fbCol[2]);
    doc.text(`₹${Math.abs(fb)}`, cx[4] + 2, y + 5.5);
    y += 14;

    const now = new Date();
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(107, 114, 128);
    doc.setDrawColor(...blue);
    doc.setLineWidth(0.5);
    doc.line(m, y - 4, pw - m, y - 4);
    doc.text(
      `Report Generated: ${now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} | ${now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`,
      m,
      y,
    );
    doc.text('Generated by: KHERWAL BAZAAR - Udhar Recovery System', m, y + 4);

    const blob = doc.output('blob');
    const file = new File([blob], `${c.name.replace(/\s+/g, '_')}_Ledger.pdf`, { type: 'application/pdf' });
    try {
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `${c.name} - Ledger` });
        return;
      }
    } catch {}
    doc.save(`${c.name.replace(/\s+/g, '_')}_Ledger.pdf`);
  };

  const sendCustomerReminder = async (cust: Customer & { balance?: number }) => {
    setActiveReminderCustomer(cust);
    const bal = Math.abs(cust.balance ?? customerBalances[cust.id] ?? calculateBalance(cust, customerTransactions));
    const upi = `upi://pay?pa=9583252256-3@axl&pn=KHERWAL%20BAZAAR&am=${bal}&cu=INR`;
    try {
      const { default: QRCode } = await import('qrcode');
      const url = await QRCode.toDataURL(upi, { width: 200, margin: 1, color: { dark: '#1e293b', light: '#FFFFFF' } });
      setQrDataUrl(url);
    } catch {}

    setTimeout(async () => {
      if (!reminderCardRef.current) return;
      const { default: html2canvas } = await import('html2canvas');
      const qrImg = reminderCardRef.current.querySelector('img[alt="UPI QR"]') as HTMLImageElement | null;
      if (qrImg && !qrImg.complete) {
        await new Promise<void>((resolve) => {
          qrImg.onload = () => resolve();
          qrImg.onerror = () => resolve();
        });
      }
      const canvas = await html2canvas(reminderCardRef.current, {
        scale: 3,
        useCORS: true,
        backgroundColor: '#ffffff',
      });

      const phone = cust.phone.replace(/\s/g, '');
      const fullPhone = phone.startsWith('+')
        ? phone.substring(1)
        : phone.startsWith('91') && phone.length === 12
          ? phone
          : `91${phone}`;
      const payLink = `upi://pay?pa=9583252256-3@axl&pn=KHERWAL%20BAZAAR&am=${bal}&cu=INR`;
      const shareText = `🔔 *Payment Reminder*\n\nDear ${cust.name},\n\nPending Amount: *₹${bal}*\n\n📱 *Pay via UPI:* ${payLink}\n\n- KHERWAL BAZAAR`;

      const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));
      const file = new File([blob], `${cust.name.replace(/\s+/g, '_')}_Reminder.png`, { type: 'image/png' });
      try {
        if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
          await navigator.share({ files: [file], text: shareText, title: 'Payment Reminder' });
          return;
        }
      } catch {}
      window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(shareText)}`, '_blank');
    }, 600);
  };

  const sendReminder = async () => {
    if (!selectedCustomer) return;
    await sendCustomerReminder(selectedCustomer);
  };

  const sendSMSCustomer = (cust: Customer & { balance?: number }) => {
    const phone = cust.phone.replace(/\s/g, '');
    const bal = Math.abs(cust.balance ?? customerBalances[cust.id] ?? calculateBalance(cust, customerTransactions));
    const msg = `Dear ${cust.name},\nThis is a friendly reminder that your garments purchase of ₹${bal} from KHERWAL BAZAAR is still pending. Kindly pay the amount at your earliest convenience. Thank you for your support.\n\n– KHERWAL BAZAAR\n📞 9583252256`;
    const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
    const delimiter = isIOS ? ';' : '?';
    const smsUrl = `sms:${phone}${delimiter}body=${encodeURIComponent(msg)}`;
    window.open(smsUrl, '_blank');
  };

  const renderCustomerDetail = () => {
    if (!selectedCustomer) return null;
    const c = selectedCustomer;
    return (
      <div className="flex-1 min-h-0 overflow-y-auto pb-20">
        <div className="bg-gradient-to-b from-slate-900 to-blue-900 text-white px-6 pt-6 pb-2">
          <div className="flex items-center">
            <div
              className="flex-1 cursor-pointer group"
              onClick={() => {
                setShowDeleteConfirm(false);
                setShowCustomerDetailsPage(true);
              }}
            >
              <h2 className="text-2xl font-bold flex items-center gap-1 group-hover:text-blue-200 transition">
                {c.name}{' '}
                <ChevronRight className="w-5 h-5 text-blue-300 group-hover:translate-x-0.5 transition-transform" />
              </h2>
              <p className="text-sm text-gray-300">{c.phone}</p>
            </div>
            {(() => {
              const due = customerBalances[c.id] ?? calculateBalance(c, customerTransactions);
              return (
                <div className="text-right">
                  <span
                    className={`font-extrabold text-2xl ${due > 0 ? 'text-red-400' : due < 0 ? 'text-green-400' : 'text-gray-400'}`}
                  >
                    ₹{Math.abs(due)}
                  </span>
                  <p className="text-xs text-gray-300 capitalize">{c.collectionType}</p>
                </div>
              );
            })()}
          </div>
        </div>

        <div className="flex px-0 pt-0 pb-1">
          <button
            onClick={generatePDF}
            className="flex-1 flex flex-col items-center bg-white px-1 py-2 text-[10px] font-semibold text-gray-700 hover:bg-slate-50 transition cursor-pointer"
          >
            <FileText className="w-4 h-4 mb-0.5" /> Report
          </button>
          <button
            onClick={sendReminder}
            className="flex-1 flex flex-col items-center bg-white px-1 py-2 text-[10px] font-semibold text-gray-700 hover:bg-slate-50 transition cursor-pointer"
          >
            <Image src="/whatsapp.png" alt="WhatsApp" width={20} height={20} className="mb-0.5" /> Reminder
          </button>
          <button
            onClick={() => selectedCustomer && sendSMSCustomer(selectedCustomer)}
            className="flex-1 flex flex-col items-center bg-white px-1 py-2 text-[10px] font-semibold text-gray-700 hover:bg-slate-50 transition cursor-pointer"
          >
            <Image src="/SMS.png" alt="SMS" width={20} height={20} className="mb-0.5" /> SMS
          </button>
          <button
            onClick={() => {
              const p = selectedCustomer?.phone.replace(/\s/g, '');
              if (p) window.open(`tel:${p}`, '_self');
            }}
            className="flex-1 flex flex-col items-center bg-white px-1 py-2 text-[10px] font-semibold text-gray-700"
          >
            <Image src="/call.png" alt="Call" width={20} height={20} className="mb-0.5" /> Call
          </button>
        </div>

        <div className="px-3 pt-4 pb-24 space-y-1 bg-white">
          {(() => {
            const itemEntries: { id: string; createdAt: number; name: string; amount: number; type: 'gave' }[] = (
              c.items || []
            ).map((item: Item, idx) => ({
              id: `item-${idx}`,
              createdAt: item.createdAt || c.createdAt + idx,
              name: item.name,
              amount: item.price * item.qty,
              type: 'gave' as const,
            }));
            const transEntries: { id: string; createdAt: number; name: string; amount: number; type: 'gave' | 'got' }[] = (
              customerTransactions || []
            ).map((t: Transaction) => ({
              id: t.id,
              createdAt: t.createdAt,
              name: t.itemName,
              amount: t.amount,
              type: t.type,
            }));
            const sorted = [...itemEntries, ...transEntries].sort((a, b) => a.createdAt - b.createdAt);
            let due = 0;
            const withBalance = sorted.map((entry) => {
              if (entry.type === 'gave') due += entry.amount;
              else if (entry.type === 'got') due -= entry.amount;
              return { ...entry, balance: due };
            });
            const reversed = withBalance.reverse();
            const grouped: Record<string, typeof reversed> = {};
            reversed.forEach((entry) => {
              const d = new Date(entry.createdAt);
              const key = `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })} ${d.getFullYear()}`;
              if (!grouped[key]) grouped[key] = [];
              grouped[key].push(entry);
            });
            return Object.entries(grouped).map(([dateLabel, entries]) => (
              <div key={dateLabel}>
                <p className="text-[11px] font-bold text-gray-500 mb-1 mt-3 first:mt-0 text-center">{dateLabel}</p>
                {entries.map((entry) => {
                  const date = new Date(entry.createdAt);
                  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  const isGave = entry.type === 'gave';
                  return (
                    <div
                      key={entry.id}
                      onClick={() => {
                        const isLegacy = entry.id.startsWith('item-');
                        setEditingTrans({
                          id: entry.id,
                          type: entry.type,
                          amount: entry.amount,
                          name: entry.name,
                          date: new Date(entry.createdAt).toISOString().split('T')[0],
                          isLegacyItem: isLegacy,
                        });
                        if (!isLegacy)
                          setEditTransForm({
                            itemName: entry.name,
                            amount: String(entry.amount),
                            date: new Date(entry.createdAt).toISOString().split('T')[0],
                          });
                      }}
                      className={`border rounded-md p-2.5 mb-1.5 cursor-pointer hover:border-blue-300 ${isGave ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}
                    >
                      <div className="text-[10px] text-gray-400">{timeStr}</div>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-xs text-gray-600">
                          Bal.{' '}
                          <span
                            className={`font-semibold ${entry.balance > 0 ? 'text-red-600' : entry.balance < 0 ? 'text-green-600' : 'text-gray-500'}`}
                          >
                            ₹{Math.abs(entry.balance)}
                          </span>
                        </span>
                        <div className="text-right">
                          <span className="text-[10px] text-gray-500 block">
                            {isGave ? 'You Gave' : 'You Got'}
                          </span>
                          <span className={`font-bold text-sm ${isGave ? 'text-red-600' : 'text-green-600'}`}>
                            ₹{entry.amount}
                          </span>
                        </div>
                      </div>
                      <div className="text-[11px] text-gray-700 font-semibold">{entry.name}</div>
                    </div>
                  );
                })}
              </div>
            ));
          })()}
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 z-30">
          <div className="flex gap-3 max-w-lg mx-auto">
            <button
              onClick={() => {
                setTransactionType('gave');
                setShowTransactionForm(true);
              }}
              className="flex-1 bg-red-500 text-white rounded-lg border-b-4 border-red-700 py-4 text-center shadow hover:opacity-90"
            >
              <p className="text-sm font-bold">You Gave</p>
            </button>
            <button
              onClick={() => {
                setTransactionType('got');
                setShowTransactionForm(true);
              }}
              className="flex-1 bg-green-500 text-white rounded-lg border-b-4 border-green-700 py-4 text-center shadow hover:opacity-90"
            >
              <p className="text-sm font-bold">You Got</p>
            </button>
          </div>
        </div>
      </div>
    );
  };

  const updateTrans = async () => {
    if (!editingTrans || !selectedCustomer) return;
    const amt = Number(editTransForm.amount);
    if (!editTransForm.itemName || isNaN(amt) || amt <= 0 || !editTransForm.date) return;
    const { ref: dbRef, update } = await import('firebase/database');
    await update(dbRef(db, `customers/${selectedCustomer.id}/transactions/${editingTrans.id}`), {
      itemName: editTransForm.itemName,
      amount: amt,
      date: editTransForm.date,
    });
    setEditingTrans(null);
  };

  const deleteTrans = async () => {
    if (!editingTrans || !selectedCustomer || editingTrans.isLegacyItem) return;
    const { ref: dbRef, remove } = await import('firebase/database');
    await remove(dbRef(db, `customers/${selectedCustomer.id}/transactions/${editingTrans.id}`));
    setEditingTrans(null);
  };

  const renderEditTransaction = () => {
    if (!editingTrans) return null;
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
        onClick={() => setEditingTrans(null)}
      >
        <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">Edit Transaction</h3>
            <span
              className={`text-xs font-semibold px-2 py-1 rounded ${editingTrans.type === 'gave' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}
            >
              {editingTrans.type === 'gave' ? 'You Gave' : 'You Got'}
            </span>
          </div>
          {editingTrans.isLegacyItem ? (
            <div className="text-center py-6">
              <p className="text-sm text-gray-500">Legacy items cannot be edited here.</p>
              <p className="text-xs text-gray-400 mt-1">Contact admin for changes.</p>
              <button
                onClick={() => setEditingTrans(null)}
                className="mt-4 px-6 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold"
              >
                OK
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Item name"
                value={editTransForm.itemName}
                onChange={(e) => setEditTransForm({ ...editTransForm, itemName: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="number"
                placeholder="Amount"
                value={editTransForm.amount}
                onChange={(e) => setEditTransForm({ ...editTransForm, amount: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="date"
                max={new Date().toISOString().split('T')[0]}
                value={editTransForm.date}
                onChange={(e) => setEditTransForm({ ...editTransForm, date: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-2 pt-2">
                <button
                  onClick={deleteTrans}
                  className="flex-1 bg-red-500 text-white py-2.5 rounded-lg text-sm font-bold hover:bg-red-600"
                >
                  Delete
                </button>
                <button
                  onClick={updateTrans}
                  className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-bold hover:bg-blue-700"
                >
                  Update
                </button>
              </div>
              <button
                onClick={() => setEditingTrans(null)}
                className="w-full py-2 text-gray-500 text-sm font-semibold hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderTransactionForm = () => {
    const isRed = transactionType === 'gave';
    const themeBg = isRed ? 'from-red-600 to-red-700' : 'from-green-600 to-green-700';
    return (
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pb-10">
        <div className={`bg-gradient-to-b ${themeBg} text-white px-6 py-6`}>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowTransactionForm(false)}
              className="hover:bg-white/20 rounded-full p-1.5 transition flex items-center justify-center"
              aria-label="Back"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="flex-1">
              <h2 className="text-2xl font-bold">
                {isRed ? `You Gave to ${selectedCustomer?.name}` : `You Got From ${selectedCustomer?.name}`}
              </h2>
            </div>
          </div>
        </div>
        <div className="p-6 space-y-5">
          <div>
            <label className={`text-xs font-semibold ${isRed ? 'text-red-600' : 'text-green-600'}`}>Amount</label>
            <input
              type="number"
              placeholder="₹ 0"
              value={transData.amount}
              onChange={(e) => setTransData({ ...transData, amount: e.target.value })}
              className="w-full mt-2 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg font-bold"
            />
          </div>
          <div>
            <label className={`text-xs font-semibold ${isRed ? 'text-red-600' : 'text-green-600'}`}>
              Item / Details Name
            </label>
            <input
              type="text"
              placeholder="Enter item or details"
              value={transData.itemName}
              onChange={(e) => setTransData({ ...transData, itemName: e.target.value })}
              className="w-full mt-2 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className={`text-xs font-semibold ${isRed ? 'text-red-600' : 'text-green-600'}`}>Date</label>
            <input
              type="date"
              max={new Date().toISOString().split('T')[0]}
              value={transData.date}
              onChange={(e) => setTransData({ ...transData, date: e.target.value })}
              className="w-full mt-2 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={saveTransaction}
            className={`w-full ${isRed ? 'bg-red-500 border-red-700' : 'bg-green-500 border-green-700'} text-white rounded-lg border-b-4 py-4 text-center shadow hover:opacity-90 font-bold text-lg`}
          >
            Save
          </button>
        </div>
      </div>
    );
  };

  const renderAddCustomer = () => (
    <div className="flex-1 min-h-0 overflow-y-auto pb-10">
      <div className="bg-gradient-to-b from-blue-600 to-blue-700 text-white px-6 py-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigateToTab('khata')}
            className="hover:bg-blue-500 rounded-full p-1.5 transition flex items-center justify-center"
            aria-label="Back to Khata"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="flex-1">
            {formData.customerName ? (
              <>
                <h2 className="text-xl font-bold">{formData.customerName}</h2>
                <p className="text-sm text-blue-100">
                  {items.length > 0 ? items.map((i) => i.name).join(', ') : formData.customerPhone || 'New Customer'}
                </p>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-bold">Add Customer</h2>
                <p className="text-sm text-blue-100">Create New Mandate</p>
              </>
            )}
          </div>
        </div>
        {formData.customerName && (
          <div className="mt-3 flex items-center gap-4 text-sm">
            <span className="text-blue-200">Amount: ₹{totalAmount}</span>
            {formData.collectionType === 'installments' && (
              <span className="text-blue-200">{formData.numInstallments} installments</span>
            )}
          </div>
        )}
      </div>

      <div className="px-4 pb-6 space-y-6 max-w-full">
        <div>
          <h3 className="text-lg font-bold text-blue-600 mb-4">1. Customer Details</h3>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                <Phone className="w-4 h-4 text-blue-600" /> Customer Mobile Number{' '}
                <span className="text-red-500">*</span>
              </label>
              <input
                required
                type="number"
                placeholder="Mobile Number"
                value={formData.customerPhone}
                onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value.slice(0, 10) })}
                className="w-full mt-2 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                <User className="w-4 h-4 text-blue-600" /> Customer Name <span className="text-red-500">*</span>
              </label>
              <input
                required
                type="text"
                placeholder="Name"
                value={formData.customerName}
                onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                className="w-full mt-2 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                <FileText className="w-4 h-4 text-blue-600" /> Collection For (Item / Bill Details){' '}
                <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-1.5 mt-2">
                <input
                  type="text"
                  placeholder="Items Name"
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  className="flex-1 min-w-0 px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <input
                  type="number"
                  placeholder="MRP"
                  value={newItem.mrp || ''}
                  onChange={(e) => setNewItem({ ...newItem, mrp: e.target.value ? Number(e.target.value) : 0 })}
                  className="w-20 px-2.5 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-center"
                />
                <input
                  type="number"
                  placeholder="Sale"
                  value={newItem.price || ''}
                  onChange={(e) => setNewItem({ ...newItem, price: e.target.value ? Number(e.target.value) : 0 })}
                  className="w-20 px-2.5 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-center"
                />
                <button
                  type="button"
                  onClick={addItem}
                  className="bg-blue-600 text-white px-3 py-3 rounded-lg hover:bg-blue-700 flex items-center justify-center shrink-0"
                >
                  {newItem.name.trim() && (newItem.price > 0 || (newItem.mrp && newItem.mrp > 0)) ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <Plus className="w-5 h-5" />
                  )}
                </button>
              </div>
              {items.length > 0 && (
                <div className="mt-3 border border-gray-200 rounded-lg overflow-hidden">
                  {items.map((item, index) => (
                    <div
                      key={index}
                      className={`flex items-center justify-between px-3 py-2 ${index !== items.length - 1 ? 'border-b border-gray-200' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-900">{item.name}</span>
                        {item.mrp && item.mrp > 0 ? (
                          <span className="text-xs text-gray-400 line-through">MRP: ₹{item.mrp}</span>
                        ) : null}
                        <span className="text-sm font-semibold text-green-600">Sale: ₹{item.price}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => editItem(index)}
                          className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center shadow border-b-2 border-blue-700 hover:opacity-90"
                        >
                          <Edit2 className="w-4 h-4 text-white" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center shadow border-b-2 border-red-700 hover:opacity-90"
                        >
                          <Trash2 className="w-4 h-4 text-white" />
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="text-right text-lg font-bold text-gray-900 pt-2 pb-1 px-3 border-t border-gray-200 bg-gray-50">
                    Total: ₹{totalAmount}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-bold text-blue-600 mb-4">2. Collection Type</h3>
          <div className="space-y-3">
            <label
              className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition ${formData.collectionType === 'installments' ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}
            >
              <input
                type="radio"
                name="collectionType"
                value="installments"
                checked={formData.collectionType === 'installments'}
                onChange={(e) => setFormData({ ...formData, collectionType: e.target.value })}
                className="w-5 h-5"
              />
              <div>
                <div className="font-semibold text-gray-900 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-600" /> Collect in Installments
                </div>
                <p className="text-xs text-gray-600 mt-1">Collect amount in parts</p>
              </div>
            </label>
            <label
              className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition ${formData.collectionType === 'onetime' ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}
            >
              <input
                type="radio"
                name="collectionType"
                value="onetime"
                checked={formData.collectionType === 'onetime'}
                onChange={(e) => setFormData({ ...formData, collectionType: e.target.value })}
                className="w-5 h-5"
              />
              <div>
                <div className="font-semibold text-gray-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-gray-600" /> One Time Payment
                </div>
                <p className="text-xs text-gray-600 mt-1">Collect full amount once</p>
              </div>
            </label>
          </div>
        </div>

        {formData.collectionType === 'onetime' && (
          <div className="mt-4">
            <label className="text-xs font-semibold text-gray-700">
              Due Payment Date <span className="text-red-500">*</span>
            </label>
            <input
              required
              type="date"
              value={formData.startDate}
              min={new Date().toISOString().split('T')[0]}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              className="w-full mt-2 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {formData.collectionType === 'installments' && (
          <div>
            <h3 className="text-lg font-bold text-blue-600 mb-4">3. Installment Settings</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-700">
                    Frequency <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.frequency}
                    onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                    className="w-full mt-2 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="weekly">Weekly</option>
                    <option value="daily">Daily</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700">
                    Number of Installments <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.numInstallments}
                    onChange={(e) => setFormData({ ...formData, numInstallments: e.target.value })}
                    className="w-full mt-2 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="3">3 Installments</option>
                    <option value="6">6 Installments</option>
                    <option value="12">12 Installments</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700">
                  Start Date <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  type="date"
                  value={formData.startDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full mt-2 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
                <div className="bg-green-600 rounded-full p-2 text-white">📊</div>
                <div>
                  <h4 className="font-semibold text-green-900">Installment Summary</h4>
                  <p className="text-sm text-green-800 mt-1">
                    ₹{(totalAmount / Number(formData.numInstallments)).toFixed(2)} x {formData.numInstallments} Months = ₹
                    {totalAmount}
                  </p>
                  <p className="text-xs text-green-700 mt-2">
                    Collection will start from {formData.startDate || '28/04/26'} and repeat every month.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div>
          <h3 className="text-lg font-bold text-blue-600 mb-4">4. Payment Method</h3>
          <div className="space-y-3">
            <label
              className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition ${formData.paymentMethod === 'upi' ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}
            >
              <input
                type="radio"
                name="paymentMethod"
                value="upi"
                checked={formData.paymentMethod === 'upi'}
                onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                className="w-5 h-5"
              />
              <div className="flex-1">
                <div className="font-semibold text-gray-900 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-blue-600" /> UPI AutoPay{' '}
                  <span className="bg-green-600 text-white text-xs px-2 py-1 rounded ml-2">Recommended</span>
                </div>
                <p className="text-xs text-gray-600 mt-1">Automatic monthly collection via UPI</p>
              </div>
            </label>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-bold text-blue-600 mb-4">5. Charge Penalty (Optional)</h3>
          <div className="grid grid-cols-1 gap-3">
            <label
              className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition ${formData.penaltyOption === 'charge-auto' ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}
            >
              <input
                type="radio"
                name="penaltyOption"
                value="charge-auto"
                checked={formData.penaltyOption === 'charge-auto'}
                onChange={(e) => setFormData({ ...formData, penaltyOption: e.target.value })}
                className="w-5 h-5"
              />
              <div>
                <div className="font-semibold text-gray-900 text-sm">Charge Automatically</div>
                <p className="text-xs text-gray-600">5% penalty charged automatically on late payments</p>
              </div>
            </label>
          </div>
        </div>

        {(() => {
          const due = totalAmount;
          const charge = Math.round(due * 0.05);
          const netReturn = due + charge;
          return (
            <div className="grid grid-cols-3 gap-4 bg-gray-50 rounded-lg p-4">
              <div className="text-center">
                <p className="text-xs text-gray-600">Total Due</p>
                <p className="text-xl font-bold text-gray-900 mt-2">₹{due}</p>
              </div>
              <div className="text-center border-l border-r border-gray-300">
                <p className="text-xs text-gray-600">Merchant Charge (5%)</p>
                <p className="text-xl font-bold text-gray-900 mt-2">₹{charge}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-600">Net Return (Due+5%)</p>
                <p className="text-xl font-bold text-green-600 mt-2">₹{netReturn}</p>
              </div>
            </div>
          );
        })()}

        <button
          onClick={saveCustomer}
          className="w-full bg-blue-600 text-white py-4 rounded-lg font-bold hover:bg-blue-700 flex items-center justify-center gap-2"
        >
          <User2 className="w-5 h-5" /> Add Customer
        </button>
      </div>
    </div>
  );

  const renderCollections = () => {
    const todaySales = combinedSales.filter((s) => isToday(s.createdAt));
    const saleMRP = todaySales.reduce((s, r) => s + r.mrp, 0);
    const saleCollected = todaySales.reduce((s, r) => s + r.sale, 0);
    const checkedTotal = todaySales.filter((r) => selectedSales.has(r.id)).reduce((s, r) => s + r.sale, 0);
    const costPrice = todaySales.reduce((s, r) => s + getCostPrice(r.productName, r.mrp) * (r.quantity ?? 1), 0);
    const profit = saleCollected - costPrice;
    return (
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pb-20 w-full max-w-full">
        <div className="bg-gradient-to-br from-slate-900 to-blue-900 pt-3">
          <div className="text-white p-3">
            <div className="grid grid-cols-3 gap-2 items-center text-center">
              <div className="border-r border-blue-700/60 px-1 min-w-0">
                <p className="text-[11px] xs:text-xs text-gray-300 mb-1 font-medium truncate uppercase tracking-wider">
                  Today&apos;s Sale
                </p>
                <p className={`${getResponsiveValueTextSize(saleMRP)} truncate text-white`}>
                  ₹ {saleMRP.toLocaleString()}
                </p>
              </div>
              <div className="border-r border-blue-700/60 px-1 min-w-0">
                <p className="text-[11px] xs:text-xs text-gray-300 mb-1 font-medium truncate uppercase tracking-wider">
                  Collection
                </p>
                <p className={`${getResponsiveValueTextSize(saleCollected)} truncate text-white`}>
                  ₹ {saleCollected.toLocaleString()}
                </p>
              </div>
              <div className="px-1 min-w-0">
                <p className="text-[11px] xs:text-xs text-gray-300 mb-1 font-medium truncate uppercase tracking-wider">
                  Profit
                </p>
                <p className={`${getResponsiveValueTextSize(profit)} truncate ${profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  ₹ {profit.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>

        <MobileSalePOS productNames={productNames} />

        <div className="px-3 pt-1.5 w-full max-w-full">
          <div className="grid grid-cols-3 items-center bg-gray-100 py-2 px-1 border-b border-gray-200 rounded-t-md">
            <p className="text-xs font-bold text-gray-700 uppercase tracking-wider truncate">Sale History</p>
            <p className="text-[10px] font-semibold text-gray-500 text-center truncate">Qty. {selectedSales.size}</p>
            <span className="text-xs font-extrabold text-green-700 bg-green-100 px-2 py-0.5 rounded-full justify-self-end truncate">
              ₹{checkedTotal.toLocaleString()}
            </span>
          </div>
          {(() => {
            const todaySalesList = combinedSales.filter((s) => isToday(s.createdAt));
            if (todaySalesList.length === 0)
              return <p className="text-xs text-gray-400 text-center py-4">No sales recorded today</p>;
            return todaySalesList.map((s, i) => {
              const d = new Date(s.createdAt);
              const ds = `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}`;
              const ts = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              const itemProfit = s.sale - getCostPrice(s.productName, s.mrp) * (s.quantity ?? 1);
              const checked = selectedSales.has(s.id);
              return (
                <div
                  key={s.id}
                  onClick={() =>
                    setSelectedSales((prev) => {
                      const n = new Set(prev);
                      if (checked) n.delete(s.id);
                      else n.add(s.id);
                      return n;
                    })
                  }
                  className={`border-b px-3 py-2.5 cursor-pointer ${checked ? 'bg-green-100 border-l-4 border-l-green-500 border-green-200' : 'bg-white border-gray-200'} ${i === 0 ? 'border-t' : ''}`}
                >
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <span className="text-[10px] text-gray-400 shrink-0">
                        {ds} • {ts}
                      </span>
                      {s.isKhata && (
                        <span className="bg-blue-100 text-blue-800 text-[9px] font-bold px-1.5 py-0.2 rounded shrink-0">
                          Khata Sale
                        </span>
                      )}
                    </div>
                    <span className={`text-[10px] font-semibold shrink-0 ${itemProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      Profit: ₹{itemProfit}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1 gap-2 min-w-0">
                    <span className="text-xs font-bold text-gray-800 truncate flex-1 min-w-0">{s.productName}</span>
                    <span className="text-[10px] text-gray-500 whitespace-nowrap shrink-0">
                      Qty: <span className="font-semibold text-gray-700">{s.quantity ?? 1}</span>
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-gray-500 whitespace-nowrap">
                        MRP: <span className="font-semibold text-gray-700">₹{s.mrp}</span>
                      </span>
                      <span className="text-[10px] text-gray-500 whitespace-nowrap">
                        Sale: <span className="font-semibold text-green-600">₹{s.sale}</span>
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={checked}
                      readOnly
                      className="w-3.5 h-3.5 accent-green-600 pointer-events-none shrink-0"
                    />
                  </div>
                </div>
              );
            });
          })()}
        </div>
      </div>
    );
  };

  const updateSale = async () => {
    if (!editingSale || !editSaleForm.productName || !editSaleForm.mrp || !editSaleForm.sale) return;
    const { ref: dbRef, update } = await import('firebase/database');
    await update(dbRef(db, `sales/${editingSale.id}`), {
      productName: editSaleForm.productName,
      mrp: Number(editSaleForm.mrp),
      sale: Number(editSaleForm.sale),
    });
    setEditingSale(null);
    setEditSaleForm({ productName: '', mrp: '', sale: '' });
  };

  const deleteSale = async () => {
    if (!editingSale) return;
    const { ref: dbRef, remove } = await import('firebase/database');
    await remove(dbRef(db, `sales/${editingSale.id}`));
    setEditingSale(null);
    setEditSaleForm({ productName: '', mrp: '', sale: '' });
  };

  const renderEdtSale = () => {
    const allSaleMRP = sales.reduce((s, r) => s + (r.mrp || 0), 0);
    const allSaleCollected = sales.reduce((s, r) => s + (r.sale || 0), 0);
    const allProfit = sales.reduce(
      (s, r) => s + ((r.sale || 0) - getCostPrice(r.productName, r.mrp || 0) * (r.quantity ?? 1)),
      0,
    );
    const groups: Record<string, SaleRecord[]> = {};
    sales.forEach((s) => {
      const k = fmtDate(s.createdAt);
      if (!groups[k]) groups[k] = [];
      groups[k].push(s);
    });
    return (
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pb-20 w-full max-w-full">
        <div>
          <div className="bg-gradient-to-br from-slate-900 to-blue-900 text-white p-3 sm:p-4 shadow-lg">
            <div className="grid grid-cols-3 gap-2 sm:gap-3 items-center">
              <div className="text-center border-r border-blue-700/60 px-1 min-w-0">
                <p className="text-[11px] xs:text-xs sm:text-sm text-gray-300 mb-1 font-medium truncate uppercase tracking-wider">
                  Total Sale
                </p>
                <div className="flex items-center justify-center min-w-0">
                  <p className={`${getResponsiveValueTextSize(allSaleMRP)} truncate text-white`}>
                    ₹ {allSaleMRP.toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="text-center border-r border-blue-700/60 px-1 min-w-0">
                <p className="text-[11px] xs:text-xs sm:text-sm text-gray-300 mb-1 font-medium truncate uppercase tracking-wider">
                  Total Collection
                </p>
                <div className="flex items-center justify-center min-w-0">
                  <p className={`${getResponsiveValueTextSize(allSaleCollected)} truncate text-white`}>
                    ₹ {allSaleCollected.toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="text-center px-1 min-w-0">
                <p className="text-[11px] xs:text-xs sm:text-sm text-gray-300 mb-1 font-medium truncate uppercase tracking-wider">
                  Total Profit
                </p>
                <div className="flex items-center justify-center min-w-0">
                  <p
                    className={`${getResponsiveValueTextSize(allProfit)} truncate ${allProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
                  >
                    ₹ {allProfit.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {editingSale && (
          <div className="bg-white border border-blue-300 rounded-xl p-4 space-y-3 shadow mx-3 mt-3">
            <p className="text-sm font-bold text-blue-700">Editing: {editingSale.productName}</p>
            <input
              type="text"
              placeholder="Product Name"
              value={editSaleForm.productName}
              onChange={(e) => setEditSaleForm({ ...editSaleForm, productName: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                placeholder="MRP"
                value={editSaleForm.mrp}
                onChange={(e) => setEditSaleForm({ ...editSaleForm, mrp: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="number"
                placeholder="Sale"
                value={editSaleForm.sale}
                onChange={(e) => setEditSaleForm({ ...editSaleForm, sale: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={updateSale}
                className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-bold text-sm hover:bg-blue-700"
              >
                Update
              </button>
              <button
                onClick={deleteSale}
                className="px-4 bg-red-600 text-white py-2.5 rounded-lg font-bold text-sm hover:bg-red-700"
              >
                Delete
              </button>
              <button
                onClick={() => {
                  setEditingSale(null);
                  setEditSaleForm({ productName: '', mrp: '', sale: '' });
                }}
                className="px-4 bg-gray-200 text-gray-700 py-2.5 rounded-lg font-bold text-sm hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="px-3 pt-1.5 w-full max-w-full">
          {Object.keys(groups).length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">No sales recorded yet</p>
          ) : (
            <>
              <div className="grid grid-cols-[1.1fr_0.6fr_1fr_1fr] bg-slate-800 text-white text-[11px] font-bold uppercase tracking-wide px-2 py-2 rounded-t-md gap-2">
                <span>Date</span>
                <span className="text-center">Qty</span>
                <span className="text-right">Sale</span>
                <span className="text-right">Profit</span>
              </div>
              <div className="divide-y divide-gray-200 border border-t-0 border-gray-200 rounded-b-lg overflow-hidden">
                {Object.entries(groups).map(([dateStr, groupItems]) => {
                  const qty = groupItems.length;
                  const totalSale = groupItems.reduce((s, r) => s + r.sale, 0);
                  const totalProfit = groupItems.reduce(
                    (s, r) => s + r.sale - getCostPrice(r.productName, r.mrp) * (r.quantity ?? 1),
                    0,
                  );
                  const isTodayGroup = isToday(groupItems[0].createdAt);
                  return (
                    <div key={dateStr}>
                      <div className="grid grid-cols-[1.1fr_0.6fr_1fr_1fr] items-center bg-gray-50 px-2 py-3 gap-1 text-[12px] font-semibold text-gray-700">
                        <span className="flex items-center gap-1 min-w-0">
                          <span className="truncate">{dateStr}</span>
                          {isTodayGroup && (
                            <span className="bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0">
                              Today
                            </span>
                          )}
                        </span>
                        <span className="text-center">{qty}</span>
                        <span className="text-right">₹{totalSale.toLocaleString()}</span>
                        <span className={`text-right ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          ₹{totalProfit.toLocaleString()}
                        </span>
                      </div>
                      {isTodayGroup &&
                        groupItems.map((s, idx) => {
                          const canEdit = isToday(s.createdAt);
                          return (
                            <div
                              key={s.id}
                              className={`flex items-center justify-between px-3 gap-2 min-w-0 bg-white border-b border-green-200 ${idx === groupItems.length - 1 ? 'pb-2' : 'py-3'}`}
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-gray-800 truncate">{s.productName}</p>
                                <div className="flex gap-2 text-[10px] text-gray-500 mt-1">
                                  <span>
                                    MRP: <span className="font-semibold text-gray-700">₹{s.mrp}</span>
                                  </span>
                                  <span>
                                    Sale: <span className="font-semibold text-green-600">₹{s.sale}</span>
                                  </span>
                                </div>
                              </div>
                              {canEdit && (
                                <button
                                  onClick={() => {
                                    setEditingSale(s);
                                    setEditSaleForm({
                                      productName: s.productName,
                                      mrp: String(s.mrp),
                                      sale: String(s.sale),
                                    });
                                  }}
                                  className="text-blue-600 hover:text-blue-800 shrink-0"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  const renderReports = () => (
    <div className="flex-1 min-h-0 overflow-y-auto pb-20">
      <div className="bg-gradient-to-b from-slate-900 to-blue-900 text-white px-6 py-6">
        <h2 className="text-2xl font-bold">Reports & Analytics</h2>
        <p className="text-sm text-gray-300 mt-1">View your business insights</p>
      </div>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4">
            <p className="text-xs text-gray-600">Total Collected</p>
            <p className="text-2xl font-bold text-green-600 mt-2">₹ 45,280</p>
            <p className="text-xs text-gray-600 mt-2">+12% from last month</p>
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4">
            <p className="text-xs text-gray-600">Total Due</p>
            <p className="text-2xl font-bold text-blue-600 mt-2">₹ 1,42,220</p>
            <p className="text-xs text-gray-600 mt-2">From 1,250 customers</p>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4">
            <p className="text-xs text-gray-600">Success Rate</p>
            <p className="text-2xl font-bold text-purple-600 mt-2">94.5%</p>
            <p className="text-xs text-gray-600 mt-2">Payment validation</p>
          </div>
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-4">
            <p className="text-xs text-gray-600">Active Mandates</p>
            <p className="text-2xl font-bold text-orange-600 mt-2">2,847</p>
            <p className="text-xs text-gray-600 mt-2">Currently running</p>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-bold text-gray-900 mb-4">Top Performing Customers</h3>
          <div className="space-y-3">
            {[
              { name: 'Balakram Tudu', amount: '₹ 12,500', status: '100% Payment' },
              { name: 'Rajesh Kumar', amount: '₹ 10,250', status: '95% Payment' },
              { name: 'Priya Singh', amount: '₹ 8,900', status: '85% Payment' },
            ].map((customer, idx) => (
              <div
                key={idx}
                className="bg-white border border-gray-200 rounded-lg p-4 flex justify-between items-center"
              >
                <div>
                  <h4 className="font-semibold text-gray-900">{customer.name}</h4>
                  <p className="text-xs text-gray-600 mt-1">{customer.status}</p>
                </div>
                <p className="font-bold text-green-600">{customer.amount}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderUpcoming = () => {
    const filtered = upcomingCustomers
      .filter((c) => {
        const d = new Date(c.nextPaymentDate!);
        d.setHours(0, 0, 0, 0);
        const todayD = new Date();
        todayD.setHours(0, 0, 0, 0);
        const diff = Math.floor((d.getTime() - todayD.getTime()) / (1000 * 60 * 60 * 24));
        if (upcomingFilter === 'today') return diff === 0;
        if (upcomingFilter === 'tomorrow') return diff === 1;
        if (upcomingFilter === 'next3') return diff >= 0 && diff <= 3;
        return true;
      })
      .filter((c) => {
        const q = upcomingSearch.toLowerCase();
        return c.name.toLowerCase().includes(q) || c.phone.includes(q);
      });
    return (
      <div className="flex-1 min-h-0 overflow-y-auto pb-20">
        <div className="bg-gradient-to-b from-slate-900 to-blue-900 text-white px-6 py-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold">Upcoming Collections</h2>
            <p className="text-sm text-gray-300 mt-1">
              {upcomingCustomers.length} customer{upcomingCustomers.length !== 1 ? 's' : ''} due soon
            </p>
          </div>
          <div className="relative mt-3">
            <input
              type="text"
              placeholder="Search by name or phone..."
              value={upcomingSearch}
              onChange={(e) => setUpcomingSearch(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg text-sm text-gray-900 bg-white bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
            />
            <svg
              className="absolute right-3 top-2.5 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <div className="flex gap-2 mt-3">
            {['all', 'today', 'tomorrow', 'next3'].map((tab) => (
              <button
                key={tab}
                onClick={() => setUpcomingFilter(tab)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${upcomingFilter === tab ? 'bg-white text-blue-900' : 'bg-blue-800 text-white'}`}
              >
                {tab === 'all' ? 'All' : tab === 'today' ? 'Today' : tab === 'tomorrow' ? 'Tomorrow' : 'Next 3 Days'}
              </button>
            ))}
          </div>
        </div>
        <div className="px-3 pt-3 space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-5xl mb-4">🔔</div>
              <p className="text-gray-500 font-semibold">
                No upcoming collections
                <br />
                in the next 3 days.
              </p>
            </div>
          ) : (
            filtered.map((c) => {
              const dl = daysLeft(c.nextPaymentDate!);
              const freqLabel =
                c.collectionType === 'onetime'
                  ? 'One Time'
                  : c.frequency
                    ? c.frequency.charAt(0).toUpperCase() + c.frequency.slice(1)
                    : 'Monthly';
              return (
                <div key={c.id} className={`${dl.cls} border border-gray-200 rounded-lg p-3`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-gray-900 text-sm truncate">{c.name}</h4>
                      <p className="text-xs text-gray-600">{c.phone}</p>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        <span className="bg-blue-100 text-blue-800 text-[10px] font-semibold px-2 py-0.5 rounded capitalize">
                          {freqLabel}
                        </span>
                        <span className="bg-gray-100 text-gray-700 text-[10px] font-semibold px-2 py-0.5 rounded">
                          {c.nextPaymentDate}
                        </span>
                        <span className="bg-white text-gray-600 text-[10px] font-semibold px-2 py-0.5 rounded">
                          {timeAgo(c.lastTransDate)}
                        </span>
                      </div>
                    </div>
                    <div className="text-right ml-3">
                      <p className="text-sm font-extrabold text-red-600">₹{c.balance}</p>
                      <p className="text-[10px] font-semibold text-gray-500 mt-0.5">{dl.text}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-2 pt-2 border-t border-gray-100">
                    <a
                      href={`tel:${c.phone}`}
                      className="flex-1 bg-green-50 text-green-700 text-xs font-semibold py-2 rounded-lg text-center border border-green-200"
                    >
                      Call
                    </a>
                    <button
                      onClick={() => sendCustomerReminder(c)}
                      className="flex-1 bg-green-50 hover:bg-green-100 text-green-700 text-xs font-semibold py-2 rounded-lg text-center border border-green-200 cursor-pointer flex items-center justify-center gap-1"
                    >
                      <Image src="/whatsapp.png" alt="WhatsApp" width={16} height={16} /> WhatsApp
                    </button>
                    <button
                      onClick={() => sendSMSCustomer(c)}
                      className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold py-2 rounded-lg text-center border border-blue-200 cursor-pointer flex items-center justify-center gap-1"
                    >
                      <Image src="/SMS.png" alt="SMS" width={16} height={16} /> SMS
                    </button>
                    <button
                      onClick={() => {
                        setSelectedCustomer(c);
                        setActiveTab('detail');
                        import('firebase/database').then(({ ref: dbRef, onValue: dbOnValue }) => {
                          const tRef = dbRef(db, `customers/${c.id}/transactions`);
                          if (transListenerRef.current) transListenerRef.current();
                          transListenerRef.current = dbOnValue(tRef, (snap) => {
                            const d: Record<string, Omit<Transaction, 'id'>> | null = snap.val();
                            setCustomerTransactions(
                              d ? Object.entries(d).map(([id, v]) => ({ id, ...v } as Transaction)) : [],
                            );
                          });
                        });
                      }}
                      className="flex-1 bg-blue-600 text-white text-xs font-semibold py-2 rounded-lg text-center"
                    >
                      View
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  const renderCashBook = () => {
    const salesCashEntries = combinedSales.map((s) => {
      const d = new Date(s.createdAt);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return {
        id: `sale_${s.id}`,
        type: 'in' as const,
        amount: s.sale,
        category: s.isKhata ? 'Khata Sale' : 'Sales Collection',
        remark: s.productName ? `Sale: ${s.productName}` : 'Product Sale',
        date: dateStr,
        mode: 'cash' as const,
        createdAt: s.createdAt,
        isSaleRecord: true,
      };
    });

    const allCombinedEntries = [...cashEntries, ...salesCashEntries].sort((a, b) => b.createdAt - a.createdAt);

    const directCashIn = cashEntries.filter((e) => e.type === 'in').reduce((sum, e) => sum + (e.amount || 0), 0);
    const saleCollectionTotal = combinedSales.reduce((sum, s) => sum + (s.sale || 0), 0);
    const totalIn = directCashIn + saleCollectionTotal;

    const totalOut = cashEntries.filter((e) => e.type === 'out').reduce((sum, e) => sum + (e.amount || 0), 0);
    const netBalance = totalIn - totalOut;

    const filteredEntries = allCombinedEntries.filter((e) => {
      if (cashFilter === 'in' && e.type !== 'in') return false;
      if (cashFilter === 'out' && e.type !== 'out') return false;
      if (cashSearch.trim()) {
        const q = cashSearch.toLowerCase();
        const catMatch = (e.category || '').toLowerCase().includes(q);
        const remarkMatch = (e.remark || '').toLowerCase().includes(q);
        const amtMatch = String(e.amount).includes(q);
        if (!catMatch && !remarkMatch && !amtMatch) return false;
      }
      return true;
    });

    return (
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-slate-50">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-900 via-slate-900 to-indigo-900 text-white px-4 py-3 shadow-md text-center flex flex-col items-center justify-center">
          <div>
            <h2 className="text-base font-extrabold flex items-center justify-center gap-2">
              <Wallet className="w-5 h-5 text-purple-400" /> Cash Book
            </h2>
            <p className="text-[10px] text-purple-200">Daily Cash In & Expense Ledger</p>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3 pb-24">
          {/* Summary Card */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
            <div className="text-center pb-3 border-b border-slate-100">
              <p className="text-xs font-semibold text-slate-500 mb-1">Net Cash in Hand</p>
              <h3 className={`text-3xl font-extrabold ${netBalance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                ₹ {netBalance.toLocaleString()}
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-3">
              <div className="bg-emerald-50 rounded-xl p-2.5 border border-emerald-100 flex items-center gap-2.5">
                <div className="w-8 h-8 bg-emerald-500 text-white rounded-full flex items-center justify-center shrink-0">
                  <ArrowDownLeft className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-emerald-800 uppercase">Cash In</p>
                  <p className="text-sm font-extrabold text-emerald-700">₹ {totalIn.toLocaleString()}</p>
                </div>
              </div>
              <div className="bg-rose-50 rounded-xl p-2.5 border border-rose-100 flex items-center gap-2.5">
                <div className="w-8 h-8 bg-rose-500 text-white rounded-full flex items-center justify-center shrink-0">
                  <ArrowUpRight className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-rose-800 uppercase">Cash Out</p>
                  <p className="text-sm font-extrabold text-rose-700">₹ {totalOut.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => {
                setCashType('in');
                setShowCashModal(true);
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl shadow border-b-4 border-emerald-800 flex items-center justify-center gap-2 text-sm cursor-pointer transition"
            >
              <Plus className="w-5 h-5" /> Cash In
            </button>
            <button
              onClick={() => {
                setCashType('out');
                setShowCashModal(true);
              }}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 rounded-xl shadow border-b-4 border-rose-800 flex items-center justify-center gap-2 text-sm cursor-pointer transition"
            >
              <Minus className="w-5 h-5" /> Cash Out
            </button>
          </div>

          {/* Search & Filter */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search category, remark or amount..."
                value={cashSearch}
                onChange={(e) => setCashSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-purple-500 shadow-sm"
              />
            </div>
            <div className="flex gap-1">
              {(['all', 'in', 'out'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setCashFilter(f)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition cursor-pointer ${
                    cashFilter === f
                      ? 'bg-purple-900 text-white shadow'
                      : 'bg-white text-slate-600 border border-slate-200'
                  }`}
                >
                  {f === 'all' ? 'All' : f === 'in' ? 'Cash In' : 'Cash Out'}
                </button>
              ))}
            </div>
          </div>

          {/* Transactions List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-600 px-1">
              <span>Entries ({filteredEntries.length})</span>
              <span>
                Total: ₹ {filteredEntries.reduce((s, e) => s + (e.type === 'in' ? e.amount : -e.amount), 0).toLocaleString()}
              </span>
            </div>

            {filteredEntries.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 shadow-sm">
                <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Wallet className="w-6 h-6" />
                </div>
                <p className="text-sm font-bold text-slate-800">No Cash Book Entries</p>
                <p className="text-xs text-slate-500 mt-1">Record daily sales, cash payments, or shop expenses.</p>
              </div>
            ) : (
              (() => {
                const dateGroupsMap = new Map<
                  string,
                  {
                    dateLabel: string;
                    isToday: boolean;
                    items: typeof filteredEntries;
                    totalSale: number;
                    totalProfit: number;
                    totalCashIn: number;
                    totalCashOut: number;
                    netTotal: number;
                  }
                >();

                filteredEntries.forEach((e) => {
                  const d = new Date(e.createdAt || Date.now());
                  const dateLabel = `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}`;
                  const isTodayItem = isToday(e.createdAt || Date.now());

                  if (!dateGroupsMap.has(dateLabel)) {
                    dateGroupsMap.set(dateLabel, {
                      dateLabel,
                      isToday: isTodayItem,
                      items: [],
                      totalSale: 0,
                      totalProfit: 0,
                      totalCashIn: 0,
                      totalCashOut: 0,
                      netTotal: 0,
                    });
                  }

                  const grp = dateGroupsMap.get(dateLabel)!;
                  grp.items.push(e);

                  if (e.type === 'in') {
                    grp.totalCashIn += e.amount;
                    if (e.isSaleRecord) {
                      grp.totalSale += e.amount;
                      const origSale = sales.find((s) => `sale_${s.id}` === e.id);
                      if (origSale) {
                        grp.totalProfit += origSale.sale - getCostPrice(origSale.productName, origSale.mrp || 0);
                      }
                    }
                  } else {
                    grp.totalCashOut += e.amount;
                  }
                  grp.netTotal = grp.totalCashIn - grp.totalCashOut;
                });

                const dateGroups = Array.from(dateGroupsMap.values());

                return dateGroups.map((group) => {
                  if (group.isToday) {
                    return (
                      <div key={group.dateLabel} className="space-y-2">
                        <div className="text-[11px] font-bold text-purple-900 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-100 flex items-center justify-between">
                          <span>Today • {group.dateLabel}</span>
                          <span>
                            Sale: ₹{group.totalSale.toLocaleString()} • Profit: ₹{group.totalProfit.toLocaleString()}
                          </span>
                        </div>
                        {group.items.map((e) => (
                          <div
                            key={e.id}
                            className="bg-white rounded-xl p-3 border border-slate-200 shadow-sm flex items-center justify-between hover:border-purple-200 transition"
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div
                                className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${e.type === 'in' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}
                              >
                                {e.type === 'in' ? (
                                  <ArrowDownLeft className="w-5 h-5" />
                                ) : (
                                  <ArrowUpRight className="w-5 h-5" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-bold text-slate-900 text-xs truncate">
                                    {e.category || (e.type === 'in' ? 'Cash Received' : 'Expense')}
                                  </h4>
                                  <span
                                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${e.mode === 'online' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-amber-50 text-amber-800 border border-amber-200'}`}
                                  >
                                    {e.mode || 'cash'}
                                  </span>
                                </div>
                                {e.remark && <p className="text-xs text-slate-600 truncate mt-0.5">{e.remark}</p>}
                                <p className="text-[10px] text-slate-400 mt-0.5">
                                  {e.date} • {timeAgo(e.createdAt)}
                                </p>
                              </div>
                            </div>
                            <div className="text-right flex items-center gap-3 ml-2">
                              <div>
                                <p
                                  className={`text-sm font-extrabold ${e.type === 'in' ? 'text-emerald-600' : 'text-rose-600'}`}
                                >
                                  ₹{(e.amount || 0).toLocaleString()}
                                </p>
                              </div>
                              {!e.isSaleRecord ? (
                                <button
                                  onClick={() => deleteCashEntry(e.id)}
                                  className="text-slate-400 hover:text-rose-600 p-1 transition cursor-pointer"
                                  title="Delete Entry"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              ) : (
                                <span className="text-[9px] font-bold bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded">
                                  Sale
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  }

                  const isExpanded = expandedDates.has(group.dateLabel);

                  return (
                    <div
                      key={group.dateLabel}
                      className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-2"
                    >
                      <div
                        onClick={() =>
                          setExpandedDates((prev) => {
                            const n = new Set(prev);
                            if (n.has(group.dateLabel)) n.delete(group.dateLabel);
                            else n.add(group.dateLabel);
                            return n;
                          })
                        }
                        className="p-3 bg-slate-50 flex items-center justify-between cursor-pointer hover:bg-purple-50/50 transition border-l-4 border-l-purple-600"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                          <span className="font-extrabold text-slate-900 text-xs bg-slate-200 text-slate-800 px-2 py-0.5 rounded-md inline-block shrink-0">
                            {group.dateLabel}
                          </span>
                          <div className="flex items-center gap-2 text-xs font-semibold">
                            <span className="text-slate-700">
                              Sale <strong className="text-emerald-600">₹{group.totalSale.toLocaleString()}</strong>
                            </span>
                            <span className="text-slate-700">
                              Profit <strong className="text-emerald-600">₹{group.totalProfit.toLocaleString()}</strong>
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-extrabold text-slate-900">
                            Net ₹{group.netTotal.toLocaleString()}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-purple-600" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="p-2 space-y-2 border-t border-slate-100 bg-slate-50/30">
                          {group.items.map((e) => (
                            <div
                              key={e.id}
                              className="bg-white rounded-xl p-2.5 border border-slate-200 flex items-center justify-between"
                            >
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <div
                                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${e.type === 'in' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}
                                >
                                  {e.type === 'in' ? (
                                    <ArrowDownLeft className="w-4 h-4" />
                                  ) : (
                                    <ArrowUpRight className="w-4 h-4" />
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <h4 className="font-bold text-slate-900 text-xs truncate">
                                      {e.category || (e.type === 'in' ? 'Cash Received' : 'Expense')}
                                    </h4>
                                    <span className="text-[9px] font-bold px-1.5 py-0.2 bg-slate-100 text-slate-700 rounded">
                                      {e.mode || 'cash'}
                                    </span>
                                  </div>
                                  {e.remark && <p className="text-[11px] text-slate-600 truncate">{e.remark}</p>}
                                </div>
                              </div>
                              <div className="text-right flex items-center gap-2 ml-2">
                                <p
                                  className={`text-xs font-extrabold ${e.type === 'in' ? 'text-emerald-600' : 'text-rose-600'}`}
                                >
                                  ₹{(e.amount || 0).toLocaleString()}
                                </p>
                                {!e.isSaleRecord ? (
                                  <button
                                    onClick={() => deleteCashEntry(e.id)}
                                    className="text-slate-400 hover:text-rose-600 p-1 transition cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                ) : (
                                  <span className="text-[9px] font-bold bg-purple-50 text-purple-700 border border-purple-200 px-1 py-0.2 rounded">
                                    Sale
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                });
              })()
            )}
          </div>
        </div>

        {/* Modal for Adding Cash Entry */}
        {showCashModal && (
          <div
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in"
            onClick={handleCashBackdropClick}
          >
            <div
              className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
              onClick={(evt) => evt.stopPropagation()}
            >
              <div
                className={`p-4 text-white flex items-center justify-between ${cashType === 'in' ? 'bg-emerald-600' : 'bg-rose-600'}`}
              >
                <h3 className="font-extrabold text-base flex items-center gap-2">
                  {cashType === 'in' ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                  {cashType === 'in' ? 'Add Cash In' : 'Add Cash Out'}
                </h3>
                <button
                  onClick={() => setShowCashModal(false)}
                  className="text-white/80 hover:text-white font-bold text-lg cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="p-4 space-y-3">
                {/* Type Toggle Tabs */}
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                  <button
                    onClick={() => setCashType('in')}
                    className={`py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${cashType === 'in' ? 'bg-emerald-600 text-white shadow' : 'text-slate-600'}`}
                  >
                    Cash In
                  </button>
                  <button
                    onClick={() => setCashType('out')}
                    className={`py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${cashType === 'out' ? 'bg-rose-600 text-white shadow' : 'text-slate-600'}`}
                  >
                    Cash Out
                  </button>
                </div>

                {/* Amount Input */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Amount (₹)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-base">₹</span>
                    <input
                      type="number"
                      placeholder="0"
                      value={cashForm.amount}
                      onChange={(e) => setCashForm({ ...cashForm, amount: e.target.value })}
                      className="w-full pl-8 pr-3 py-2 text-lg font-extrabold border border-slate-300 rounded-xl focus:outline-none focus:border-purple-600"
                      autoFocus
                    />
                  </div>
                </div>

                {/* Category Selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                  <select
                    value={cashForm.category}
                    onChange={(e) => setCashForm({ ...cashForm, category: e.target.value })}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-purple-600 bg-white"
                  >
                    {cashType === 'in' ? (
                      <>
                        <option value="Sales">Sales Income</option>
                        <option value="Customer Udhar Paid">Customer Udhar Received</option>
                        <option value="Online / UPI Received">Online / UPI Received</option>
                        <option value="Bank Withdrawal">Bank Withdrawal</option>
                        <option value="Investment / Loan">Investment / Capital</option>
                        <option value="Other Income">Other Income</option>
                      </>
                    ) : (
                      <>
                        <option value="Shop Expense">Shop Expense</option>
                        <option value="Tea & Snacks">Tea & Snacks</option>
                        <option value="Vendor Payment">Vendor Payment</option>
                        <option value="Electricity / Bills">Electricity / Rent / Bills</option>
                        <option value="Salary / Labour">Salary / Wages</option>
                        <option value="Transport / Petrol">Transport / Freight</option>
                        <option value="Personal Expense">Personal Expense</option>
                        <option value="Other Expense">Other Expense</option>
                      </>
                    )}
                  </select>
                </div>

                {/* Payment Mode */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Payment Mode</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCashForm({ ...cashForm, mode: 'cash' })}
                      className={`py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                        cashForm.mode === 'cash'
                          ? 'bg-amber-500 text-white border-amber-600 shadow'
                          : 'bg-white text-slate-700 border-slate-200'
                      }`}
                    >
                      💵 Cash
                    </button>
                    <button
                      type="button"
                      onClick={() => setCashForm({ ...cashForm, mode: 'online' })}
                      className={`py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                        cashForm.mode === 'online'
                          ? 'bg-blue-600 text-white border-blue-700 shadow'
                          : 'bg-white text-slate-700 border-slate-200'
                      }`}
                    >
                      📱 Online / UPI
                    </button>
                  </div>
                </div>

                {/* Remark / Notes */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Remark / Note (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Paid to Ramesh for tea, or Customer bill"
                    value={cashForm.remark}
                    onChange={(e) => setCashForm({ ...cashForm, remark: e.target.value })}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-purple-600"
                  />
                </div>

                {/* Date */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={cashForm.date}
                    onChange={(e) => setCashForm({ ...cashForm, date: e.target.value })}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-purple-600"
                  />
                </div>

                {/* Submit Button */}
                <button
                  onClick={saveCashEntry}
                  disabled={!cashForm.amount || Number(cashForm.amount) <= 0}
                  className={`w-full py-3 rounded-xl font-bold text-sm text-white shadow-lg transition cursor-pointer mt-2 ${
                    cashType === 'in'
                      ? 'bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50'
                      : 'bg-rose-600 hover:bg-rose-700 disabled:opacity-50'
                  }`}
                >
                  Save {cashType === 'in' ? 'Cash In' : 'Cash Out'} Entry
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderCustomerDetailsPage = () => {
    if (!selectedCustomer) return null;
    const c = selectedCustomer;
    const due = customerBalances[c.id] ?? calculateBalance(c, customerTransactions);

    return (
      <div className="flex-1 min-h-0 flex flex-col overflow-y-auto bg-slate-50 pb-20">
        {/* Full Page Header */}
        <div className="bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 text-white px-5 py-4 shadow-md flex items-center justify-between">
          <div className="flex-1 text-center">
            <h2 className="text-lg font-bold">Customer Profile</h2>
            <p className="text-xs text-blue-200">{c.name}</p>
          </div>
          {!isEditingCustomerProfile && (
            <button
              onClick={startEditingProfile}
              className="bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5" /> Edit Profile
            </button>
          )}
        </div>

        {/* Page Content */}
        <div className="p-4 space-y-4 max-w-xl mx-auto w-full">
          {isEditingCustomerProfile ? (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 space-y-4 animate-fade-in">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <Edit2 className="w-4 h-4 text-blue-600" /> Edit Profile Information
                </h3>
                <span className="text-[10px] text-slate-400 font-semibold">ID: {c.id}</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Full Name *</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={editCustomerForm.name}
                    onChange={(e) => setEditCustomerForm({ ...editCustomerForm, name: e.target.value })}
                    placeholder="Customer Name"
                    className="w-full pl-9 pr-3 py-2.5 text-sm font-semibold border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mobile / Phone Number *</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="tel"
                    value={editCustomerForm.phone}
                    onChange={(e) => setEditCustomerForm({ ...editCustomerForm, phone: e.target.value })}
                    placeholder="10-digit Mobile Number"
                    className="w-full pl-9 pr-3 py-2.5 text-sm font-semibold border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Address (Optional)</label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <textarea
                    rows={2}
                    value={editCustomerForm.address}
                    onChange={(e) => setEditCustomerForm({ ...editCustomerForm, address: e.target.value })}
                    placeholder="Village, Post, City, Landmark, Pincode"
                    className="w-full pl-9 pr-3 py-2.5 text-xs font-medium border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={saveCustomerProfile}
                  disabled={!editCustomerForm.name.trim() || !editCustomerForm.phone.trim()}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow"
                >
                  <Save className="w-4 h-4" /> Save Changes
                </button>
                <button
                  onClick={() => setIsEditingCustomerProfile(false)}
                  className="px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl font-bold text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="bg-white rounded-2xl p-5 text-center shadow-sm border border-slate-200/80">
                <div className="w-20 h-20 bg-blue-100 text-blue-800 font-extrabold text-3xl rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner">
                  {c.name ? c.name.charAt(0).toUpperCase() : 'C'}
                </div>
                <h3 className="text-2xl font-extrabold text-slate-900">{c.name}</h3>
                <p className="text-sm font-semibold text-slate-500 mt-0.5 flex items-center justify-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-slate-400" /> {c.phone}
                </p>
                {c.address ? (
                  <p className="text-xs text-slate-600 mt-2 bg-slate-50 py-1.5 px-3 rounded-lg inline-flex items-center justify-center gap-1.5 max-w-full border border-slate-100">
                    <MapPin className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />{' '}
                    <span className="truncate">{c.address}</span>
                  </p>
                ) : (
                  <button
                    onClick={startEditingProfile}
                    className="text-[11px] text-blue-500 hover:underline mt-2 inline-flex items-center gap-1"
                  >
                    <MapPin className="w-3 h-3" /> Add Address
                  </button>
                )}
              </div>

              <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 space-y-3">
                <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                  Account & Collection Info
                </h4>

                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Pending Balance</span>
                    <span
                      className={`font-extrabold text-base ${due > 0 ? 'text-red-600' : due < 0 ? 'text-green-600' : 'text-slate-500'}`}
                    >
                      ₹{Math.abs(due)} {due > 0 ? '(Due)' : due < 0 ? '(Advance)' : '(Clear)'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Collection Type</span>
                    <span className="font-bold text-slate-900 capitalize">{c.collectionType || 'Installments'}</span>
                  </div>

                  {c.collectionType !== 'onetime' && (
                    <>
                      <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                        <span className="text-slate-500 font-medium">Frequency</span>
                        <span className="font-semibold text-slate-800 capitalize">{c.frequency || 'Monthly'}</span>
                      </div>
                      <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                        <span className="text-slate-500 font-medium">Total Installments</span>
                        <span className="font-semibold text-slate-800">{c.numInstallments || 'N/A'}</span>
                      </div>
                    </>
                  )}

                  <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Start Date</span>
                    <span className="font-semibold text-slate-800">{c.startDate || 'N/A'}</span>
                  </div>

                  <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Payment Method</span>
                    <span className="font-semibold text-slate-800 uppercase">{c.paymentMethod || 'UPI'}</span>
                  </div>

                  <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Penalty Rule</span>
                    <span className="font-semibold text-slate-800 capitalize">{c.penaltyOption || 'Charge Auto'}</span>
                  </div>

                  <div className="flex justify-between items-center py-1.5">
                    <span className="text-slate-500 font-medium">Customer Since</span>
                    <span className="font-semibold text-slate-800">{c.createdAt ? fmtDate(c.createdAt) : 'N/A'}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80">
                {!showDeleteConfirm ? (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full py-3.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <Trash2 className="w-5 h-5 text-red-600" /> Delete Customer
                  </button>
                ) : (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center space-y-3 animate-fade-in">
                    <p className="text-sm font-bold text-red-800">
                      Are you sure you want to delete &quot;{c.name}&quot;?
                    </p>
                    <p className="text-xs text-red-600">
                      All transactions and credit records for this customer will be permanently deleted from the
                      database.
                    </p>
                    <div className="flex gap-3 pt-1">
                      <button
                        onClick={() => deleteCustomer(c.id)}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl text-xs font-bold transition cursor-pointer shadow"
                      >
                        Yes, Delete
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        className="flex-1 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 py-3 rounded-xl text-xs font-bold transition cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      className="flex-1 min-h-0 flex flex-col overflow-x-hidden overflow-y-hidden w-full max-w-full transition-colors duration-700"
      suppressHydrationWarning
    >
      {/* Header */}
      {activeTab === 'home' && (
        <div className="bg-gradient-to-b from-slate-900 to-blue-900 text-white px-6 py-4 relative z-0 flex justify-between items-center shrink-0">
          <div className="text-center flex-1">
            <div className="text-xl font-bold">👑 KHERWAL BAZAAR</div>
            <div className="text-yellow-400 text-xs tracking-wider">UDHAR RECOVERY SYSTEM</div>
          </div>
          <div className="relative">
            <Bell
              onClick={() => navigateToTab('upcoming')}
              className="w-6 h-6 hover:opacity-80 transition cursor-pointer"
            />
            {upcomingCustomers.length > 0 && (
              <div className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                {upcomingCustomers.length}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Content Rendering Toggles */}
      {activeTab === 'home' && renderDashboard()}
      {activeTab === 'khata' && renderKhata()}
      {activeTab === 'add' && renderAddCustomer()}
      {activeTab === 'addProduct' && <MobileAddProduct onBack={() => navigateToTab('home')} />}
      {activeTab === 'detail' && !showTransactionForm && !showCustomerDetailsPage && renderCustomerDetail()}
      {activeTab === 'detail' && !showTransactionForm && showCustomerDetailsPage && renderCustomerDetailsPage()}
      {activeTab === 'detail' && showTransactionForm && renderTransactionForm()}
      {activeTab === 'collections' && renderCollections()}
      {activeTab === 'edtSale' && renderEdtSale()}
      {activeTab === 'reports' && renderReports()}
      {activeTab === 'upcoming' && renderUpcoming()}
      {activeTab === 'cashbook' && renderCashBook()}

      {/* Bottom Navigation Element */}
      {activeTab !== 'add' &&
        activeTab !== 'addProduct' &&
        activeTab !== 'detail' &&
        activeTab !== 'upcoming' &&
        activeTab !== 'edtSale' &&
        activeTab !== 'cashbook' && (
          <div
            className={`fixed bottom-0 left-0 right-0 z-40 transition-transform duration-300 ${activeTab === 'khata' && !showNavbar ? 'translate-y-full' : ''}`}
          >
            <MobileNavbar activeTab={activeTab} onTabChange={navigateToTab} />
          </div>
        )}

      {/* Success & Edit Modals */}
      {editingTrans && renderEditTransaction()}
      {showSuccess && savedData && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-6"
          onClick={closeSuccess}
        >
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-center mb-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Customer Added!</h3>
              <p className="text-sm text-gray-600 mt-1">Data saved successfully</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm mb-4">
              <div className="flex justify-between">
                <span className="text-gray-600">Name</span>
                <span className="font-semibold text-gray-900">{savedData.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Phone</span>
                <span className="font-semibold text-gray-900">{savedData.phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Items</span>
                <span className="font-semibold text-gray-900">
                  {savedData.items.map((i: Item) => i.name).join(', ')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total Amount</span>
                <span className="font-semibold text-gray-900">₹{savedData.totalAmount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Collection</span>
                <span className="font-semibold text-gray-900 capitalize">{savedData.collectionType}</span>
              </div>
            </div>
            <button
              onClick={closeSuccess}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* Global Hidden Reminder Card for Image Capture */}
      {(() => {
        const targetCust = activeReminderCustomer || selectedCustomer;
        if (!targetCust) return null;
        const custBal = 'balance' in targetCust ? (targetCust as { balance?: number }).balance : undefined;
        const targetBal = Math.abs(
          custBal ?? customerBalances[targetCust.id] ?? calculateBalance(targetCust, customerTransactions),
        );
        return (
          <div
            ref={reminderCardRef}
            className="fixed"
            style={{ left: '-9999px', top: 0, width: '400px', zIndex: -100 }}
          >
            <div className="bg-gradient-to-b from-slate-900 to-blue-900 text-white p-6 text-center">
              <p className="text-lg font-bold">KHERWAL BAZAAR</p>
              <p className="text-[10px] text-blue-200">UDHAR RECOVERY SYSTEM</p>
            </div>
            <div className="bg-white p-6 text-center space-y-3">
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">🔔 Payment Reminder</p>
              <p className="text-xl font-bold text-gray-800">{targetCust.name}</p>
              <div className="bg-red-50 rounded-lg py-3 px-4">
                <p className="text-[10px] text-gray-500">Pending Amount</p>
                <p className="text-3xl font-extrabold text-red-600">₹{targetBal}</p>
              </div>
              <div className="flex justify-center gap-6 text-sm text-gray-600">
                <div>
                  <p className="text-[10px] text-gray-400">Collection</p>
                  <p className="font-semibold capitalize">{targetCust.collectionType || 'Installments'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400">Phone</p>
                  <p className="font-semibold">{targetCust.phone}</p>
                </div>
              </div>
              {qrDataUrl && (
                <div className="flex justify-center mt-3">
                  <Image src={qrDataUrl} alt="UPI QR" width={128} height={128} unoptimized />
                </div>
              )}
              <div className="border-t border-gray-200 pt-3 mt-3">
                <p className="text-xs text-gray-500">Scan to pay via UPI</p>
                <p className="text-[10px] text-gray-400 mt-2">Thank you for your business!</p>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

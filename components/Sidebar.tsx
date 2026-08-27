import {
  Home,
  ShoppingCart,
  Users,
  BookOpen,
  Wallet,
  Receipt,
  TrendingUp,
  BarChart2,
  Package,
  Boxes,
  Bell,
  Settings,
  CheckCircle,
  Truck,
} from "lucide-react";

const navItems = [
  { label: "Dashboard", icon: Home, href: "/" },
  { label: "Product", icon: Package, href: "/products" },
  { label: "Sales", icon: ShoppingCart, href: "/sales" },
  { label: "Sale Report", icon: BarChart2, href: "/sales-report" },
  { label: "Khata (Customers)", icon: Users, href: "/customers" },
  { label: "Suppliers", icon: Truck, href: "/suppliers" },
  { label: "Cash Book", icon: BookOpen, href: "/cashbook" },
  { label: "Collection", icon: Wallet, href: "#" },
  { label: "Expenses", icon: Receipt, href: "#" },
  { label: "Profit & Loss", icon: TrendingUp, href: "#" },
  { label: "Reports", icon: BarChart2, href: "#" },
  { label: "Reminders", icon: Bell, href: "/reminders" },
  { label: "Settings", icon: Settings, href: "#" },
];

export default function Sidebar({ active = "Dashboard" }: { active?: string }) {
  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col justify-between shrink-0 overflow-y-auto">
      <nav className="p-3 space-y-1 text-sm font-medium">
        {navItems.map(({ label, icon: Icon, href }) => (
          <a
            key={label}
            href={href}
            className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg ${
              active === label
                ? "bg-[#0b1e59] text-white"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Icon className="w-4 h-4" />
            <span>{label}</span>
          </a>
        ))}
      </nav>

      <div className="p-3">
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
          <div className="flex items-center space-x-2 text-emerald-600 text-xs font-semibold mb-1">
            <CheckCircle className="w-4 h-4" />
            <span>Auto Collection</span>
          </div>
          <p className="text-[11px] font-semibold text-emerald-600 mb-1">
            Active
          </p>
          <p className="text-[10px] text-slate-500 mb-3">
            Payments will be collected automatically.
          </p>
          <button
            type="button"
            className="w-full text-xs font-medium text-blue-600 bg-white border border-blue-200 rounded-md py-1.5 hover:bg-blue-50"
          >
            View Details
          </button>
        </div>
      </div>
    </aside>
  );
}
const navItems = [
  { label: "Dashboard", activeLabel: "Dashboard", href: "/", color: "bg-emerald-500 border-emerald-700", activeColor: "bg-emerald-600" },
  { label: "Products", activeLabel: "Product", href: "/products", color: "bg-red-500 border-red-700", activeColor: "bg-red-600" },
  { label: "Sales", activeLabel: "Sales", href: "/sales", color: "bg-blue-500 border-blue-700", activeColor: "bg-blue-600" },
  { label: "Reports", activeLabel: "Sale Report", href: "/sales-report", color: "bg-purple-500 border-purple-700", activeColor: "bg-purple-600" },
  { label: "Khata", activeLabel: "Khata (Customers)", href: "/customers", color: "bg-amber-500 border-amber-700", activeColor: "bg-amber-600" },
  { label: "Suppliers", activeLabel: "Suppliers", href: "/suppliers", color: "bg-emerald-500 border-emerald-700", activeColor: "bg-emerald-600" },
  { label: "Cash Book", activeLabel: "Cash Book", href: "/cashbook", color: "bg-red-500 border-red-700", activeColor: "bg-red-600" },
  { label: "Payments", activeLabel: "Collection", href: "#", color: "bg-blue-500 border-blue-700", activeColor: "bg-blue-600" },
  { label: "Expenses", activeLabel: "Expenses", href: "#", color: "bg-purple-500 border-purple-700", activeColor: "bg-purple-600" },
  { label: "Profit & Loss", activeLabel: "Profit & Loss", href: "#", color: "bg-amber-500 border-amber-700", activeColor: "bg-amber-600" },
  { label: "Analytics", activeLabel: "Analytics", href: "#", color: "bg-emerald-500 border-emerald-700", activeColor: "bg-emerald-600" },
  { label: "Reminders", activeLabel: "Reminders", href: "/reminders", color: "bg-red-500 border-red-700", activeColor: "bg-red-600" },
  { label: "Settings", activeLabel: "Settings", href: "#", color: "bg-blue-500 border-blue-700", activeColor: "bg-blue-600" },
];

export default function HeaderNavigation({
  active = "Dashboard",
}: {
  active?: string;
}) {
  return (
    <nav
      aria-label="Main navigation"
      className="w-full border-t border-white/10 bg-[#0b1e59] px-2 py-1"
    >
      <div className="grid w-full grid-cols-4 gap-1.5 sm:grid-cols-7 2xl:grid-cols-[repeat(13,minmax(0,1fr))]">
        {navItems.map(({ label, activeLabel, href, color, activeColor }) => (
          <a
            key={label}
            href={href}
            title={label}
            aria-current={active === activeLabel ? "page" : undefined}
            className={`flex h-8 min-w-0 items-center justify-center whitespace-nowrap rounded-md border border-b-[3px] px-1 text-center text-[9px] font-semibold leading-tight text-white shadow-[0_2px_0_rgba(0,0,0,0.22)] transition hover:-translate-y-0.5 hover:shadow-[0_4px_0_rgba(0,0,0,0.25)] sm:text-[10px] ${
              color
            } ${
              active === activeLabel
                ? `${activeColor} ring-2 ring-white/80`
                : "hover:brightness-125"
            }`}
          >
            {label}
          </a>
        ))}
      </div>
    </nav>
  );
}

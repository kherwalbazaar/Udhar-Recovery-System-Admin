const navItems = [
  { label: "Dashboard", activeLabel: "Dashboard", href: "/", color: "bg-sky-100 border-sky-300 border-b-sky-500", activeColor: "bg-sky-300" },
  { label: "Products", activeLabel: "Product", href: "/products", color: "bg-emerald-100 border-emerald-300 border-b-emerald-500", activeColor: "bg-emerald-300" },
  { label: "Sales", activeLabel: "Sales", href: "/sales", color: "bg-violet-100 border-violet-300 border-b-violet-500", activeColor: "bg-violet-300" },
  { label: "Reports", activeLabel: "Sale Report", href: "/sales-report", color: "bg-amber-100 border-amber-300 border-b-amber-500", activeColor: "bg-amber-300" },
  { label: "Khata", activeLabel: "Khata (Customers)", href: "/customers", color: "bg-rose-100 border-rose-300 border-b-rose-500", activeColor: "bg-rose-300" },
  { label: "Suppliers", activeLabel: "Suppliers", href: "/suppliers", color: "bg-cyan-100 border-cyan-300 border-b-cyan-500", activeColor: "bg-cyan-300" },
  { label: "Cash Book", activeLabel: "Cash Book", href: "/cashbook", color: "bg-lime-100 border-lime-300 border-b-lime-500", activeColor: "bg-lime-300" },
  { label: "Payments", activeLabel: "Collection", href: "#", color: "bg-indigo-100 border-indigo-300 border-b-indigo-500", activeColor: "bg-indigo-300" },
  { label: "Expenses", activeLabel: "Expenses", href: "#", color: "bg-orange-100 border-orange-300 border-b-orange-500", activeColor: "bg-orange-300" },
  { label: "Profit & Loss", activeLabel: "Profit & Loss", href: "#", color: "bg-teal-100 border-teal-300 border-b-teal-500", activeColor: "bg-teal-300" },
  { label: "Analytics", activeLabel: "Analytics", href: "#", color: "bg-fuchsia-100 border-fuchsia-300 border-b-fuchsia-500", activeColor: "bg-fuchsia-300" },
  { label: "Reminders", activeLabel: "Reminders", href: "/reminders", color: "bg-yellow-100 border-yellow-300 border-b-yellow-500", activeColor: "bg-yellow-300" },
  { label: "Settings", activeLabel: "Settings", href: "#", color: "bg-slate-200 border-slate-300 border-b-slate-500", activeColor: "bg-slate-400" },
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
            className={`flex h-8 min-w-0 items-center justify-center whitespace-nowrap rounded-md border border-b-[3px] px-1 text-center text-[9px] font-semibold leading-tight text-slate-800 shadow-[0_2px_0_rgba(0,0,0,0.22)] transition hover:-translate-y-0.5 hover:shadow-[0_4px_0_rgba(0,0,0,0.25)] sm:text-[10px] ${
              color
            } ${
              active === activeLabel
                ? `${activeColor} ring-2 ring-white/80`
                : "hover:brightness-95"
            }`}
          >
            {label}
          </a>
        ))}
      </div>
    </nav>
  );
}

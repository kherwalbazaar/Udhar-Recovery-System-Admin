const navItems = [
  { label: "Dashboard", activeLabel: "Dashboard", href: "/", color: "bg-sky-100 border-sky-300 border-b-sky-500" },
  { label: "Products", activeLabel: "Product", href: "/products", color: "bg-emerald-100 border-emerald-300 border-b-emerald-500" },
  { label: "Sales", activeLabel: "Sales", href: "/sales", color: "bg-violet-100 border-violet-300 border-b-violet-500" },
  { label: "Reports", activeLabel: "Sale Report", href: "/sales-report", color: "bg-amber-100 border-amber-300 border-b-amber-500" },
  { label: "Khata", activeLabel: "Khata (Customers)", href: "/customers", color: "bg-rose-100 border-rose-300 border-b-rose-500" },
  { label: "Suppliers", activeLabel: "Suppliers", href: "/suppliers", color: "bg-cyan-100 border-cyan-300 border-b-cyan-500" },
  { label: "Cash Book", activeLabel: "Cash Book", href: "/cashbook", color: "bg-lime-100 border-lime-300 border-b-lime-500" },
  { label: "Payments", activeLabel: "Collection", href: "#", color: "bg-indigo-100 border-indigo-300 border-b-indigo-500" },
  { label: "Expenses", activeLabel: "Expenses", href: "#", color: "bg-orange-100 border-orange-300 border-b-orange-500" },
  { label: "Profit & Loss", activeLabel: "Profit & Loss", href: "#", color: "bg-teal-100 border-teal-300 border-b-teal-500" },
  { label: "Analytics", activeLabel: "Analytics", href: "#", color: "bg-fuchsia-100 border-fuchsia-300 border-b-fuchsia-500" },
  { label: "Reminders", activeLabel: "Reminders", href: "/reminders", color: "bg-yellow-100 border-yellow-300 border-b-yellow-500" },
  { label: "Settings", activeLabel: "Settings", href: "#", color: "bg-slate-200 border-slate-300 border-b-slate-500" },
];

export default function HeaderNavigation({
  active = "Dashboard",
}: {
  active?: string;
}) {
  return (
    <nav
      aria-label="Main navigation"
      className="w-full border-t border-white/10 bg-[#0b1e59] px-1 py-1"
    >
      <div className="grid w-full grid-cols-[repeat(13,minmax(0,1fr))] gap-1">
        {navItems.map(({ label, activeLabel, href, color }) => (
          <a
            key={label}
            href={href}
            title={label}
            aria-current={active === activeLabel ? "page" : undefined}
            className={`flex h-8 min-w-0 items-center justify-center overflow-hidden text-ellipsis whitespace-nowrap rounded-md border border-b-[3px] px-0.5 text-center text-[7px] font-semibold leading-tight text-slate-800 shadow-[0_2px_0_rgba(0,0,0,0.22)] transition hover:-translate-y-0.5 hover:shadow-[0_4px_0_rgba(0,0,0,0.25)] sm:px-1 sm:text-[10px] ${
              color
            } ${
              active === activeLabel
                ? "ring-2 ring-white/80 brightness-95"
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

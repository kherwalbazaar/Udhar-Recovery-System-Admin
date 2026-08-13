import { ShoppingBag, Wallet, Package, Calendar } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Summary = {
  label: string;
  value: string;
  icon: LucideIcon;
  iconBg: string;
  cardBg: string;
};

const summaries: Summary[] = [
  {
    label: "Sale Today",
    value: "₹ 2,750",
    icon: ShoppingBag,
    iconBg: "bg-emerald-500",
    cardBg: "bg-emerald-50/60",
  },
  {
    label: "Collection Today",
    value: "₹ 1,450",
    icon: Wallet,
    iconBg: "bg-blue-500",
    cardBg: "bg-blue-50/60",
  },
  {
    label: "Items Sold",
    value: "5",
    icon: Package,
    iconBg: "bg-amber-500",
    cardBg: "bg-amber-50/60",
  },
  {
    label: "Due Today",
    value: "2",
    icon: Calendar,
    iconBg: "bg-red-400",
    cardBg: "bg-red-50/60",
  },
];

export default function TodaysSummary() {
  return (
    <div className="col-span-4 bg-white rounded-xl p-4 border border-slate-200 flex flex-col justify-between">
      <h3 className="text-xs font-semibold text-slate-800 mb-2">
        Today's Summary
      </h3>
      <div className="grid grid-cols-4 gap-2">
        {summaries.map(({ label, value, icon: Icon, iconBg, cardBg }) => (
          <div key={label} className={`${cardBg} rounded-lg p-2 text-center`}>
            <div
              className={`w-6 h-6 ${iconBg} text-white rounded-md mx-auto flex items-center justify-center mb-2`}
            >
              <Icon className="w-3.5 h-3.5" />
            </div>
            <h4 className="text-xs font-bold text-slate-800">{value}</h4>
            <p className="text-[9px] text-slate-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
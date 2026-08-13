import {
  ShoppingCart,
  UserPlus,
  BookOpen,
  Users,
  CreditCard,
  Bell,
  MoreHorizontal,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Action = {
  label: string;
  icon: LucideIcon;
  bg: string;
  hoverBg: string;
  border: string;
};

const actions: Action[] = [
  {
    label: "Add Sale",
    icon: ShoppingCart,
    bg: "bg-emerald-500",
    hoverBg: "hover:bg-emerald-600",
    border: "border-emerald-700",
  },
  {
    label: "Add Customer",
    icon: UserPlus,
    bg: "bg-blue-500",
    hoverBg: "hover:bg-blue-600",
    border: "border-blue-700",
  },
  {
    label: "Cash Book",
    icon: BookOpen,
    bg: "bg-amber-500",
    hoverBg: "hover:bg-amber-600",
    border: "border-amber-700",
  },
  {
    label: "Khata Book",
    icon: Users,
    bg: "bg-purple-500",
    hoverBg: "hover:bg-purple-600",
    border: "border-purple-700",
  },
  {
    label: "Add Payment",
    icon: CreditCard,
    bg: "bg-teal-500",
    hoverBg: "hover:bg-teal-600",
    border: "border-teal-700",
  },
  {
    label: "Reminder",
    icon: Bell,
    bg: "bg-red-500",
    hoverBg: "hover:bg-red-600",
    border: "border-red-700",
  },
  {
    label: "More",
    icon: MoreHorizontal,
    bg: "bg-slate-500",
    hoverBg: "hover:bg-slate-600",
    border: "border-slate-700",
  },
];

export default function QuickActions() {
  return (
    <div className="bg-white rounded-xl p-4 border border-slate-200">
      <h3 className="text-xs font-semibold text-slate-700 mb-3">
        Quick Actions
      </h3>
      <div className="grid grid-cols-7 gap-3">
        {actions.map(({ label, icon: Icon, bg, hoverBg, border }) => (
          <button
            key={label}
            type="button"
            className={`flex items-center justify-center space-x-2 ${bg} ${hoverBg} ${border} text-white font-medium rounded-lg p-2.5 border-b-4 shadow-sm hover:shadow-md transition-all duration-100 active:translate-y-[2px] active:border-b-2`}
          >
            <Icon className="w-4 h-4" />
            <span className="text-xs font-medium">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
import { Crown, Search, Bell, ChevronDown } from "lucide-react";

export default function Header({ title = "Dashboard" }: { title?: string }) {
  return (
    <header className="bg-[#0b1e59] text-white h-16 flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center space-x-3 w-64">
        <div className="p-1 bg-amber-500 rounded-lg">
          <Crown className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="font-bold text-sm tracking-wide leading-tight">
            KHERWAL BAZAAR
          </h1>
          <p className="text-[10px] text-slate-300 tracking-wider">
            UDHAR RECOVERY SYSTEM
          </p>
        </div>
      </div>

      <div className="flex items-center flex-1 max-w-4xl px-4">
        <h2 className="text-lg font-semibold mr-8">{title}</h2>

        <div className="relative flex-1 max-w-md">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            placeholder="Search customers, transactions..."
            className="w-full bg-[#13286b] text-sm text-white placeholder-slate-400 rounded-md pl-9 pr-4 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 border border-slate-700/50"
          />
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <div className="relative">
          <button
            type="button"
            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-300 relative"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>
        </div>
        <div className="flex items-center space-x-2 border-l border-slate-700 pl-4">
          <div className="w-8 h-8 rounded-full bg-slate-300 flex items-center justify-center text-slate-700 font-semibold text-xs">
            KA
          </div>
          <div className="text-xs">
            <p className="font-medium">Kherwal</p>
            <p className="text-[10px] text-slate-400">Admin</p>
          </div>
          <ChevronDown className="w-4 h-4 text-slate-400" />
        </div>
      </div>
    </header>
  );
}
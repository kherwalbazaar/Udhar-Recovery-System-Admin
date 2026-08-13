import { User } from "lucide-react";

type Reminder = {
  text: string;
  detail: string;
  iconBg: string;
  iconColor: string;
  when: string;
};

const reminders: Reminder[] = [
  {
    text: "Collect payment from Jitu Pagla",
    detail: "₹ 1,460 is due",
    iconBg: "bg-red-100",
    iconColor: "text-red-500",
    when: "Today",
  },
  {
    text: "Payment reminder to Hopon BT",
    detail: "₹ 1,150 is due",
    iconBg: "bg-amber-100",
    iconColor: "text-amber-500",
    when: "Tomorrow",
  },
  {
    text: "Payment reminder to Thakur Murmu",
    detail: "₹ 210 is due",
    iconBg: "bg-blue-100",
    iconColor: "text-blue-500",
    when: "19 Jul 2025",
  },
];

export default function RecentReminders() {
  return (
    <div className="col-span-4 bg-white rounded-xl p-4 border border-slate-200">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-slate-800">
          Recent Reminders
        </h3>
        <a href="#" className="text-xs text-blue-600 font-medium hover:underline">
          View All
        </a>
      </div>
      <div className="space-y-3">
        {reminders.map((reminder) => (
          <div key={reminder.text} className="flex items-start justify-between">
            <div className="flex items-start space-x-2">
              <div
                className={`w-6 h-6 rounded-full ${reminder.iconBg} ${reminder.iconColor} flex items-center justify-center mt-0.5 shrink-0`}
              >
                <User className="w-3 h-3" />
              </div>
              <div>
                <p className="text-xs text-slate-700 font-medium leading-tight">
                  {reminder.text}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {reminder.detail}
                </p>
              </div>
            </div>
            <span className="text-[10px] text-slate-400 shrink-0">
              {reminder.when}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
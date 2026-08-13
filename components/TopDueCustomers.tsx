type Customer = {
  name: string;
  phone: string;
  initials: string;
  avatarBg: string;
  due: string;
};

const customers: Customer[] = [
  {
    name: "Jitu Pagla Irilkola",
    phone: "7205132518",
    initials: "JP",
    avatarBg: "bg-blue-500",
    due: "₹ 1,460",
  },
  {
    name: "Hopon BT",
    phone: "6371495249",
    initials: "HB",
    avatarBg: "bg-orange-400",
    due: "₹ 1,150",
  },
  {
    name: "Thakur Murmu",
    phone: "7205867772",
    initials: "TM",
    avatarBg: "bg-emerald-500",
    due: "₹ 210",
  },
];

export default function TopDueCustomers() {
  return (
    <div className="col-span-4 bg-white rounded-xl p-4 border border-slate-200">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-slate-800">
          Top Due Customers
        </h3>
        <a href="/customers" className="text-xs text-blue-600 font-medium hover:underline">
          View All
        </a>
      </div>
      <div className="space-y-3">
        {customers.map((customer) => (
          <div key={customer.phone} className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <span
                className={`w-7 h-7 rounded-full ${customer.avatarBg} text-white text-xs flex items-center justify-center font-medium`}
              >
                {customer.initials}
              </span>
              <div>
                <p className="text-xs font-medium text-slate-800">
                  {customer.name}
                </p>
                <p className="text-[10px] text-slate-400">{customer.phone}</p>
              </div>
            </div>
            <span className="text-xs font-bold text-red-500">
              {customer.due}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
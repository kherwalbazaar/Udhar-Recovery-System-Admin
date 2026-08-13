"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

const options = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false,
    },
  },
  scales: {
    x: {
      grid: {
        display: false,
      },
      ticks: {
        font: { size: 10 },
        color: "#94a3b8",
      },
    },
    y: {
      grid: {
        color: "#f1f5f9",
      },
      ticks: {
        font: { size: 10 },
        color: "#94a3b8",
        callback: (value: string | number) =>
          value === 0 ? "0" : `${Number(value) / 1000}K`,
      },
      min: 0,
      max: 10000,
    },
  },
};

const data = {
  labels: ["1 Jul", "5 Jul", "10 Jul", "15 Jul", "17 Jul"],
  datasets: [
    {
      label: "Sale",
      data: [5500, 5500, 9000, 8000, 7000],
      backgroundColor: "#2563eb",
      borderRadius: 3,
      barPercentage: 0.6,
      categoryPercentage: 0.6,
    },
    {
      label: "Collection",
      data: [3800, 3800, 6000, 4800, 4200],
      backgroundColor: "#10b981",
      borderRadius: 3,
      barPercentage: 0.6,
      categoryPercentage: 0.6,
    },
    {
      label: "Profit",
      data: [1800, 1800, 3800, 2500, 2100],
      backgroundColor: "#a855f7",
      borderRadius: 3,
      barPercentage: 0.6,
      categoryPercentage: 0.6,
    },
  ],
};

export default function OverviewChart() {
  return (
    <div className="col-span-5 bg-white rounded-xl p-4 border border-slate-200 flex flex-col justify-between">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-slate-800">
          Overview{" "}
          <span className="text-slate-400 font-normal">(This Month)</span>
        </h3>
        <select className="text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 text-slate-600 focus:outline-none">
          <option>This Month</option>
        </select>
      </div>

      <div className="flex items-center justify-end space-x-3 text-[10px] text-slate-500 mb-2">
        <div className="flex items-center space-x-1">
          <span className="w-2.5 h-2.5 bg-blue-600 rounded-sm"></span>
          <span>Sale</span>
        </div>
        <div className="flex items-center space-x-1">
          <span className="w-2.5 h-2.5 bg-emerald-500 rounded-sm"></span>
          <span>Collection</span>
        </div>
        <div className="flex items-center space-x-1">
          <span className="w-2.5 h-2.5 bg-purple-500 rounded-sm"></span>
          <span>Profit</span>
        </div>
      </div>

      <div className="relative w-full h-48">
        <Bar data={data} options={options} />
      </div>
    </div>
  );
}
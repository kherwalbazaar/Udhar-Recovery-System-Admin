import AppShell from "@/components/AppShell";
import MetricCards from "@/components/MetricCards";
import LiveAmountCard from "@/components/LiveAmountCard";
import QuickActions from "@/components/QuickActions";
import RecentSales from "@/components/RecentSales";
import OverviewChart from "@/components/OverviewChart";
import TopDueCustomers from "@/components/TopDueCustomers";
import TodaysSummary from "@/components/TodaysSummary";
import RecentReminders from "@/components/RecentReminders";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <AppShell title="" active="Dashboard">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">Dashboard</h1>
      </div>

      <MetricCards />
      <LiveAmountCard />
      <QuickActions />

      <div className="grid grid-cols-12 gap-4">
        <RecentSales />
        <OverviewChart />
      </div>

      <div className="grid grid-cols-12 gap-4">
        <TopDueCustomers />
        <TodaysSummary />
        <RecentReminders />
      </div>

      <Footer />
    </AppShell>
  );
}
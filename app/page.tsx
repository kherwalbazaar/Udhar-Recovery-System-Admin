import AppShell from "@/components/AppShell";
import MetricCards from "@/components/MetricCards";
import QuickActions from "@/components/QuickActions";
import RecentSales from "@/components/RecentSales";
import OverviewChart from "@/components/OverviewChart";
import TopDueCustomers from "@/components/TopDueCustomers";
import TodaysSummary from "@/components/TodaysSummary";
import RecentReminders from "@/components/RecentReminders";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <AppShell title="Dashboard" active="Dashboard">
      <MetricCards />
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
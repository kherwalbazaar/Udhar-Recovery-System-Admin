import Header from "./Header";
import Sidebar from "./Sidebar";

type AppShellProps = {
  title?: string;
  active?: string;
  children: React.ReactNode;
};

export default function AppShell({
  title = "Dashboard",
  active = "Dashboard",
  children,
}: AppShellProps) {
  return (
    <>
      <Header title={title} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar active={active} />
        <main className="flex-1 overflow-y-auto p-4 space-y-4">{children}</main>
      </div>
    </>
  );
}
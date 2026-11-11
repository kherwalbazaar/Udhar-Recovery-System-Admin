import Header from "./Header";

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
      <Header active={active} />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <main className="min-w-0 flex-1 overflow-y-auto p-4 space-y-4">
          {children}
        </main>
      </div>
    </>
  );
}
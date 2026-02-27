import { AppShell } from "@/components/layout/app-shell";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div data-testid="dashboard-layout">
      <AppShell>{children}</AppShell>
    </div>
  );
}

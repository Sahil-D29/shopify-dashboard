import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dashboard | dorza.io',
  description: 'Main dashboard for your store',
};

export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}

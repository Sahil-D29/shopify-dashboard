import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dashboard | Shopify Dashboard',
  description: 'Main dashboard for your store',
};

export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}

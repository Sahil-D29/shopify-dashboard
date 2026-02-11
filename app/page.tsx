import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import DashboardPageClient from '@/components/dashboard/DashboardPageClient';

/**
 * Root page: / (base URL)
 * - Unauthenticated → redirect to /auth/signin
 * - Authenticated → render dashboard
 * Auth guard is also enforced by proxy.ts (Next.js 16).
 */
export default async function HomePage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/auth/signin?callbackUrl=/settings?setup=true');
  }
  return <DashboardPageClient />;
}

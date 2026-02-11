import { redirect } from 'next/navigation';

/**
 * Dashboard route - main app dashboard is at / (root).
 * Redirect /dashboard to / for a single entry point.
 */
export default function DashboardPage() {
  redirect('/');
}

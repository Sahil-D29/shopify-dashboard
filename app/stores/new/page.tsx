import { redirect } from 'next/navigation';

/**
 * Store creation is super-admin only — merchants are assigned stores from the
 * admin panel. This self-serve page is retired; redirect to the dashboard.
 */
export default function NewStorePage() {
  redirect('/');
}

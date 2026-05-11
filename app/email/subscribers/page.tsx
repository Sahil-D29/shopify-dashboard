import { UserPlus } from 'lucide-react';
import { ComingSoon } from '@/components/email/ComingSoon';

export default function EmailSubscribersPage() {
  return (
    <ComingSoon
      title="Email Subscribers"
      icon={UserPlus}
      description="Manage your email subscriber list, sync from Shopify, and handle opt-outs."
      features={[
        'Auto-sync from Shopify customers',
        'Manual subscriber import via CSV',
        'Suppression list (bounces, complaints, unsubscribes)',
        'Subscriber detail view: campaigns received, engagement history',
        'GDPR-compliant unsubscribe and data export',
      ]}
    />
  );
}

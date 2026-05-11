import { BellRing } from 'lucide-react';
import { ComingSoon } from '@/components/email/ComingSoon';

export default function EmailBackInStockPage() {
  return (
    <ComingSoon
      title="Back-in-Stock Alerts"
      icon={BellRing}
      description="Email customers automatically when products they're interested in come back in stock."
      features={[
        'Per-product back-in-stock subscription forms',
        'Automatic trigger when Shopify inventory > 0',
        'Per-variant alerts (sizes, colors)',
        'Pending subscriber count per product',
        'Conversion tracking on triggered alerts',
      ]}
    />
  );
}

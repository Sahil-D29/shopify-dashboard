import { PieChart } from 'lucide-react';
import { ComingSoon } from '@/components/email/ComingSoon';

export default function EmailAnalyticsPage() {
  return (
    <ComingSoon
      title="Email Analytics"
      icon={PieChart}
      description="Track how your email campaigns perform across opens, clicks, and conversions."
      features={[
        'Per-campaign open and click rates',
        'Conversion attribution to Shopify orders',
        'Trend charts over time',
        'Top performing templates and subject lines',
        'Bounce, unsubscribe, and spam complaint rates',
      ]}
    />
  );
}

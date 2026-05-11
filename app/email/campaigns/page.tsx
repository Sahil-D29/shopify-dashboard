import { Send } from 'lucide-react';
import { ComingSoon } from '@/components/email/ComingSoon';

export default function EmailCampaignsPage() {
  return (
    <ComingSoon
      title="Email Campaigns"
      icon={Send}
      description="Create, schedule, and send one-time email campaigns to your audience segments."
      features={[
        'Build campaigns from saved Email Templates',
        'Target specific customer segments',
        'Schedule for immediate or future send',
        'A/B test subject lines and send times',
        'Per-campaign opens, clicks, and revenue tracking',
      ]}
    />
  );
}

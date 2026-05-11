import { FlaskConical } from 'lucide-react';
import { ComingSoon } from '@/components/email/ComingSoon';

export default function EmailABTestsPage() {
  return (
    <ComingSoon
      title="A/B Tests"
      icon={FlaskConical}
      description="Test subject lines, content, and send times to find what your audience opens."
      features={[
        'Subject line A/B testing with automatic winner selection',
        'Content variation tests (HTML body, CTA, layout)',
        'Send time optimization',
        'Statistical significance reporting',
        'Auto-roll-out of winning variant to remaining audience',
      ]}
    />
  );
}

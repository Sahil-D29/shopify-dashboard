import { Globe } from 'lucide-react';
import { ComingSoon } from '@/components/email/ComingSoon';

export default function EmailDomainsPage() {
  return (
    <ComingSoon
      title="Sending Domains"
      icon={Globe}
      description="Authenticate and verify the domains you send email from."
      features={[
        'Add custom sending domains',
        'SPF, DKIM, and DMARC record setup with copy-paste instructions',
        'Domain verification status with auto-recheck',
        'Reputation score and deliverability tips',
        'Default-from-address selection per store',
      ]}
    />
  );
}

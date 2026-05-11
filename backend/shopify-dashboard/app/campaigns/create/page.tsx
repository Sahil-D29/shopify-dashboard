'use client';

import { useRouter } from 'next/navigation';
import CampaignWizard from '@/components/campaigns/CampaignWizard';

export default function CreateCampaignPage() {
  const router = useRouter();

  const handleComplete = () => {
    router.push('/campaigns');
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <CampaignWizard onComplete={handleComplete} />
    </div>
  );
}


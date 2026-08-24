'use client';

import { useRouter } from 'next/navigation';
import CampaignWizard from '@/components/campaigns/CampaignWizard';

export default function CreateCampaignPage() {
  const router = useRouter();

  const handleComplete = () => {
    router.push('/campaigns');
  };

  return (
    <div className="mx-auto max-w-6xl py-4 sm:py-8">
      <CampaignWizard onComplete={handleComplete} />
    </div>
  );
}


'use client';

import { useParams, useRouter } from 'next/navigation';
import CampaignWizard from '@/components/campaigns/CampaignWizard';

export default function EditCampaignPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params?.id as string;

  const handleComplete = () => {
    router.push(`/campaigns/${campaignId}`);
  };

  return (
    <div className="mx-auto max-w-6xl py-4 sm:py-8">
      <CampaignWizard campaignId={campaignId} onComplete={handleComplete} />
    </div>
  );
}


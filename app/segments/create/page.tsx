'use client';

import { useRouter } from 'next/navigation';
import SegmentBuilder from '@/components/segments/SegmentBuilder';

export default function CreateSegmentPage() {
  const router = useRouter();

  return (
    <div className="space-y-6 pb-20 lg:pb-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Create Segment</h1>
        <p className="text-muted-foreground mt-1">
          Define conditions to group customers for targeted WhatsApp campaigns
        </p>
      </div>
      <SegmentBuilder
        onSaved={(res) => {
          const id = res?.id;
          if (id) router.push(`/segments/${id}`);
          else router.push('/segments');
        }}
      />
    </div>
  );
}



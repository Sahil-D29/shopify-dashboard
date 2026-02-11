'use client';

import { useRouter } from 'next/navigation';
import SegmentBuilder from '@/components/segments/SegmentBuilder';

export default function CreateSegmentPage() {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Create Segment</h1>
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



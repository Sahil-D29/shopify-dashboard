'use client';

import { useParams } from 'next/navigation';
import { Suspense } from 'react';
import { FlowBuilder } from '@/components/flows/FlowBuilder';
import { Loader2 } from 'lucide-react';

export default function FlowBuilderPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  if (!id) return null;

  return (
    <div className="h-screen w-full overflow-hidden bg-[#FAF9F6]">
      <Suspense fallback={
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      }>
        <FlowBuilder flowId={id} />
      </Suspense>
    </div>
  );
}

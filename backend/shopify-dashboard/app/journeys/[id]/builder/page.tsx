"use client";

import '@xyflow/react/dist/style.css';

import { notFound, useParams } from 'next/navigation';
import { Suspense } from 'react';

import { JourneyBuilder } from '@/components/journeys/builder/JourneyBuilder';

export default function JourneyBuilderPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  if (!id || id.includes('<') || id.includes('>')) {
    return notFound();
  }

  return (
    <div className="h-screen w-full overflow-hidden bg-[#FAF9F6] text-[#4A4139]">
      <Suspense fallback={<div className="flex flex-1 items-center justify-center">Loading builder…</div>}>
        <JourneyBuilder journeyId={id} />
      </Suspense>
    </div>
  );
}



"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function JourneyCreatePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/journeys');
  }, [router]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-[#FAF9F6] text-[#4A4139]">
      <div className="rounded-2xl border border-[#E8E4DE] bg-white px-6 py-4 text-sm shadow-sm">
        Redirecting to journeys…
      </div>
    </div>
  );
}



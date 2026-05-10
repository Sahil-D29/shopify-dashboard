'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { SegmentComparison } from '@/components/segments/SegmentComparison';

export default function CompareSegmentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialIds = searchParams.get('ids')?.split(',').filter(Boolean) || [];
  const [segmentIds, setSegmentIds] = useState<string[]>(initialIds);

  const handleSegmentChange = (newIds: string[]) => {
    setSegmentIds(newIds);
    // Update URL
    const params = new URLSearchParams();
    if (newIds.length > 0) {
      params.set('ids', newIds.join(','));
    }
    router.push(`/segments/compare?${params.toString()}`);
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push('/segments')}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Segments
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Compare Segments</h1>
          <p className="text-muted-foreground">
            Analyze and compare up to 3 segments side by side
          </p>
        </div>
      </div>

      <SegmentComparison
        segmentIds={segmentIds}
        onSegmentChange={handleSegmentChange}
      />
    </div>
  );
}


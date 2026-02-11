'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import SegmentBuilder from '@/components/segments/SegmentBuilder';
import type { CustomerSegment } from '@/lib/types/segment';

interface SegmentResponse {
  segment?: CustomerSegment;
  error?: string;
}

export default function EditSegmentPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const segmentId = params?.id ?? '';
  const [loading, setLoading] = useState(true);
  const [segment, setSegment] = useState<CustomerSegment | null>(null);

  useEffect(() => {
    if (!segmentId) return;
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(`/api/segments/${segmentId}`, { cache: 'no-store' });
        const data = (await res.json().catch(() => ({}))) as SegmentResponse;

        if (!res.ok) {
          throw new Error(data.error ?? 'Failed to load segment');
        }

        if (!cancelled) {
          setSegment(data.segment ?? null);
        }
      } catch (error) {
        console.error('Failed to load segment', error);
        if (!cancelled) {
          setSegment(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [segmentId]);

  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (!segment) return <div className="text-sm text-muted-foreground">Not found</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Edit Segment</h1>
      <SegmentBuilder
        initialName={segment.name}
        initialDescription={segment.description}
        initialGroups={segment.conditionGroups}
        segmentId={segmentId}
        onSaved={() => router.push(`/segments/${segmentId}`)}
      />
    </div>
  );
}


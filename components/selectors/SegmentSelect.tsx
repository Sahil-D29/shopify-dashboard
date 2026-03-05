'use client';

import { useCallback } from 'react';
import { EntitySearchSelect, type EntityOption } from './EntitySearchSelect';

interface SegmentSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

export function SegmentSelect({ value, onValueChange, disabled, className }: SegmentSelectProps) {
  const parseResponse = useCallback((data: any): EntityOption[] => {
    const segments = data?.segments ?? [];
    return segments.map((s: any) => ({
      value: s.id,
      label: s.name ?? 'Untitled Segment',
      subtitle: `${s.customerCount ?? 0} customers`,
    }));
  }, []);

  return (
    <EntitySearchSelect
      value={value}
      onValueChange={(val) => onValueChange(val)}
      placeholder="Select a segment..."
      searchPlaceholder="Search segments..."
      emptyMessage="No segments found. Create a segment first."
      fetchUrl="/api/segments?limit=100"
      parseResponse={parseResponse}
      disabled={disabled}
      className={className}
    />
  );
}

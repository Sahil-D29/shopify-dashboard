'use client';

import { useCallback } from 'react';
import { EntitySearchSelect, type EntityOption } from './EntitySearchSelect';

interface JourneySelectProps {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

export function JourneySelect({ value, onValueChange, disabled, className }: JourneySelectProps) {
  const parseResponse = useCallback((data: any): EntityOption[] => {
    const journeys = data?.journeys ?? [];
    return journeys.map((j: any) => ({
      value: j.id,
      label: j.name ?? 'Untitled Journey',
      subtitle: j.status ?? undefined,
    }));
  }, []);

  return (
    <EntitySearchSelect
      value={value}
      onValueChange={(val) => onValueChange(val)}
      placeholder="Select a journey..."
      searchPlaceholder="Search journeys..."
      emptyMessage="No journeys found. Create a journey first."
      fetchUrl="/api/journeys"
      parseResponse={parseResponse}
      disabled={disabled}
      className={className}
    />
  );
}

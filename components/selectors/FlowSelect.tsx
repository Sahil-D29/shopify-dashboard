'use client';

import { useCallback } from 'react';
import { EntitySearchSelect, type EntityOption } from './EntitySearchSelect';

interface FlowSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

export function FlowSelect({ value, onValueChange, disabled, className }: FlowSelectProps) {
  const parseResponse = useCallback((data: any): EntityOption[] => {
    const flows = data?.flows ?? [];
    return flows.map((f: any) => ({
      value: f.id ?? f.name,
      label: f.name ?? 'Untitled Flow',
      subtitle: f.status ?? undefined,
    }));
  }, []);

  return (
    <EntitySearchSelect
      value={value}
      onValueChange={(val) => onValueChange(val)}
      placeholder="Select a flow..."
      searchPlaceholder="Search flows..."
      emptyMessage="No flows found."
      fetchUrl="/api/flows"
      parseResponse={parseResponse}
      disabled={disabled}
      className={className}
    />
  );
}

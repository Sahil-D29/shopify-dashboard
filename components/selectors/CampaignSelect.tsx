'use client';

import { useCallback } from 'react';
import { EntitySearchSelect, type EntityOption } from './EntitySearchSelect';

interface CampaignSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

export function CampaignSelect({ value, onValueChange, disabled, className }: CampaignSelectProps) {
  const parseResponse = useCallback((data: any): EntityOption[] => {
    const campaigns = data?.campaigns ?? [];
    return campaigns.map((c: any) => ({
      value: c.id ?? c.name,
      label: c.name ?? 'Untitled Campaign',
      subtitle: c.status ?? undefined,
    }));
  }, []);

  return (
    <EntitySearchSelect
      value={value}
      onValueChange={(val) => onValueChange(val)}
      placeholder="Select a campaign..."
      searchPlaceholder="Search campaigns..."
      emptyMessage="No campaigns found. Create a campaign first."
      fetchUrl="/api/campaigns"
      parseResponse={parseResponse}
      disabled={disabled}
      className={className}
    />
  );
}

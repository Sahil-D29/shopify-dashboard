'use client';

import { useCallback } from 'react';
import { EntitySearchSelect, type EntityOption } from './EntitySearchSelect';

interface AgentSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

export function AgentSelect({ value, onValueChange, disabled, className }: AgentSelectProps) {
  const parseResponse = useCallback((data: any): EntityOption[] => {
    const members = data?.members ?? data?.users ?? [];
    return members.map((m: any) => ({
      value: m.id ?? m.userId,
      label: m.name ?? m.email ?? 'Unknown',
      subtitle: m.role ?? undefined,
    }));
  }, []);

  return (
    <EntitySearchSelect
      value={value}
      onValueChange={(val) => onValueChange(val)}
      placeholder="Select an agent..."
      searchPlaceholder="Search agents..."
      emptyMessage="No team members found."
      fetchUrl="/api/teams/members"
      parseResponse={parseResponse}
      disabled={disabled}
      className={className}
    />
  );
}

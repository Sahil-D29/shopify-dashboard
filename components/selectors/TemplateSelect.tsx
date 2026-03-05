'use client';

import { useCallback } from 'react';
import { EntitySearchSelect, type EntityOption } from './EntitySearchSelect';

interface TemplateSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

export function TemplateSelect({ value, onValueChange, disabled, className }: TemplateSelectProps) {
  const parseResponse = useCallback((data: any): EntityOption[] => {
    const templates = data?.templates ?? [];
    return templates.map((t: any) => ({
      value: t.name ?? t.id,
      label: t.name ?? 'Untitled Template',
      subtitle: [t.category, t.language].filter(Boolean).join(' \u00B7 '),
    }));
  }, []);

  return (
    <EntitySearchSelect
      value={value}
      onValueChange={(val) => onValueChange(val)}
      placeholder="Select a template..."
      searchPlaceholder="Search templates..."
      emptyMessage="No templates found. Sync WhatsApp templates."
      fetchUrl="/api/whatsapp/templates?status=APPROVED"
      parseResponse={parseResponse}
      disabled={disabled}
      className={className}
    />
  );
}

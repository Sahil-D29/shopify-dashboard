'use client';

import { useCallback } from 'react';
import { EntitySearchSelect, type EntityOption } from './EntitySearchSelect';

interface CollectionSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

export function CollectionSelect({ value, onValueChange, disabled, className }: CollectionSelectProps) {
  const parseResponse = useCallback((data: any): EntityOption[] => {
    const collections = data?.collections ?? data?.smart_collections ?? data?.custom_collections ?? [];
    return collections.map((c: any) => ({
      value: String(c.id ?? c.handle),
      label: c.title ?? c.name ?? 'Untitled Collection',
      subtitle: c.products_count ? `${c.products_count} products` : undefined,
    }));
  }, []);

  return (
    <EntitySearchSelect
      value={value}
      onValueChange={(val) => onValueChange(val)}
      placeholder="Select a collection..."
      searchPlaceholder="Search collections..."
      emptyMessage="No collections found."
      fetchUrl="/api/shopify/collections"
      parseResponse={parseResponse}
      disabled={disabled}
      className={className}
    />
  );
}

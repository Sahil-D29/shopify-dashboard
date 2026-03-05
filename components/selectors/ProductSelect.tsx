'use client';

import { useCallback } from 'react';
import { EntitySearchSelect, type EntityOption } from './EntitySearchSelect';

interface ProductSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

export function ProductSelect({ value, onValueChange, disabled, className }: ProductSelectProps) {
  const parseResponse = useCallback((data: any): EntityOption[] => {
    const products = data?.products ?? [];
    return products.map((p: any) => ({
      value: p.title ?? p.handle ?? String(p.id),
      label: p.title ?? 'Untitled Product',
      subtitle: p.variants?.[0]?.price ? `\u20B9${p.variants[0].price}` : undefined,
    }));
  }, []);

  return (
    <EntitySearchSelect
      value={value}
      onValueChange={(val) => onValueChange(val)}
      placeholder="Select a product..."
      searchPlaceholder="Search products..."
      emptyMessage="No products found. Sync your Shopify store."
      fetchUrl="/api/products?limit=250"
      parseResponse={parseResponse}
      disabled={disabled}
      className={className}
    />
  );
}

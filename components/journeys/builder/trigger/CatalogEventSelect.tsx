'use client';

import { useEffect, useMemo, useState } from 'react';

import { ENHANCED_SHOPIFY_EVENTS, type EnhancedShopifyEvent } from '@/constants/shopifyEvents';
import { useTenant } from '@/lib/tenant/tenant-context';

interface CatalogEventSelectProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  className?: string;
}

/** Friendly section headings for the grouped event dropdown. */
const CATEGORY_LABELS: Record<string, string> = {
  product: 'Product (storefront)',
  cart: 'Cart & Checkout',
  order: 'Orders',
  payment: 'Payments',
  customer: 'Customers',
  fulfillment: 'Shipping & Fulfillment',
  engagement: 'WhatsApp & Engagement',
  marketing: 'Marketing',
  custom: 'Custom Events',
};

const CATEGORY_ORDER = [
  'order',
  'cart',
  'product',
  'payment',
  'fulfillment',
  'customer',
  'engagement',
  'marketing',
];

interface CustomEventDef {
  eventName: string;
  displayName: string;
  isActive?: boolean;
}

/**
 * Catalog-driven event picker for journey triggers. Lists every event source
 * (Shopify, storefront, WhatsApp, marketing) grouped by category, plus the
 * store's custom events. Stores the canonical catalog id (e.g. `order_placed`,
 * `whatsapp_reply_received`, `custom:my_event`) — see lib/journeys/event-catalog.ts.
 */
export function CatalogEventSelect({ value, onChange, id, className }: CatalogEventSelectProps) {
  const { currentStore } = useTenant();
  const [customEvents, setCustomEvents] = useState<EnhancedShopifyEvent[]>([]);

  useEffect(() => {
    if (!currentStore?.id) return;
    let cancelled = false;
    fetch('/api/settings/custom-events', { headers: { 'x-store-id': currentStore.id } })
      .then(res => res.json())
      .then((data: { success?: boolean; events?: CustomEventDef[] }) => {
        if (cancelled || !data?.success || !Array.isArray(data.events)) return;
        setCustomEvents(
          data.events
            .filter(e => e.isActive !== false)
            .map(e => ({
              id: `custom:${e.eventName}`,
              label: e.displayName || e.eventName,
              description: '',
              category: 'custom' as EnhancedShopifyEvent['category'],
            })),
        );
      })
      .catch(() => {
        /* custom events are optional */
      });
    return () => {
      cancelled = true;
    };
  }, [currentStore?.id]);

  const groups = useMemo(() => {
    const built: Array<{ key: string; label: string; events: EnhancedShopifyEvent[] }> = [];
    for (const key of CATEGORY_ORDER) {
      const events = (ENHANCED_SHOPIFY_EVENTS as Record<string, EnhancedShopifyEvent[]>)[key] ?? [];
      if (events.length) built.push({ key, label: CATEGORY_LABELS[key] ?? key, events });
    }
    if (customEvents.length) {
      built.push({ key: 'custom', label: CATEGORY_LABELS.custom, events: customEvents });
    }
    return built;
  }, [customEvents]);

  return (
    <select
      id={id}
      className={
        className ??
        'w-full rounded-lg border border-[#E8E4DE] bg-white px-3 py-2 text-sm text-[#4A4139] focus:border-[#D4A574] focus:outline-none focus:ring-2 focus:ring-[#D4A574]/20'
      }
      value={value}
      onChange={event => onChange(event.target.value)}
    >
      <option value="">Select an event…</option>
      {groups.map(group => (
        <optgroup key={group.key} label={group.label}>
          {group.events.map(event => (
            <option key={event.id} value={event.id}>
              {event.label}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

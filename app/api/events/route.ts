export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';

interface EventDefinition {
  name: string;
  category: 'shopify' | 'whatsapp' | 'custom';
  label: string;
  description?: string;
  properties?: Array<{ key: string; type: 'string' | 'number' | 'boolean' }>;
}

const BUILT_IN_EVENTS: EventDefinition[] = [
  {
    name: 'order_placed',
    category: 'shopify',
    label: 'Order Placed',
    description: 'Customer completes an order.',
    properties: [
      { key: 'order_value', type: 'number' },
      { key: 'order_status', type: 'string' },
      { key: 'currency', type: 'string' },
    ],
  },
  {
    name: 'cart_abandoned',
    category: 'shopify',
    label: 'Cart Abandoned',
    description: 'Customer leaves checkout without purchasing.',
    properties: [
      { key: 'cart_total', type: 'number' },
      { key: 'cart_items', type: 'number' },
    ],
  },
  {
    name: 'whatsapp_replied',
    category: 'whatsapp',
    label: 'WhatsApp Reply Received',
    description: 'Customer replies to a WhatsApp campaign message.',
    properties: [],
  },
  {
    name: 'product_viewed',
    category: 'shopify',
    label: 'Product Viewed',
    description: 'Customer views a product detail page.',
    properties: [
      { key: 'product_id', type: 'string' },
      { key: 'collection', type: 'string' },
    ],
  },
  {
    name: 'custom_event',
    category: 'custom',
    label: 'Custom Event',
    description: 'Track a bespoke event from your storefront or integrations.',
    properties: [],
  },
];

export async function GET(request: NextRequest) {
  try {
    const storeId = await getCurrentStoreId(request);

    let customEvents: EventDefinition[] = [];

    if (storeId) {
      const definitions = await prisma.customEventDefinition.findMany({
        where: { storeId, isActive: true },
        orderBy: { displayName: 'asc' },
      });

      customEvents = definitions.map((def) => ({
        name: `custom:${def.eventName}`,
        category: 'custom' as const,
        label: def.displayName,
        description: def.description || `Custom event: ${def.displayName}`,
        properties: Array.isArray(def.properties)
          ? (def.properties as Array<{ name: string; type: string }>).map((p) => ({
              key: p.name,
              type: (p.type === 'number' ? 'number' : p.type === 'boolean' ? 'boolean' : 'string') as 'string' | 'number' | 'boolean',
            }))
          : [],
      }));
    }

    return NextResponse.json({
      events: [...BUILT_IN_EVENTS, ...customEvents],
      syncedAt: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({
      events: BUILT_IN_EVENTS,
      syncedAt: new Date().toISOString(),
    });
  }
}


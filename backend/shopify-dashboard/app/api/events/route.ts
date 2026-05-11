import { NextResponse } from 'next/server';

interface EventDefinition {
  name: string;
  category: 'shopify' | 'whatsapp' | 'custom';
  label: string;
  description?: string;
  properties?: Array<{ key: string; type: 'string' | 'number' | 'boolean' }>;
}

const EVENTS: EventDefinition[] = [
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

export async function GET() {
  return NextResponse.json({
    events: EVENTS,
    syncedAt: new Date().toISOString(),
  });
}


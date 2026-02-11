export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

import type { PropertyDefinition } from '@/lib/types/condition-config';

interface PropertyCategory {
  label: string;
  properties: PropertyDefinition[];
}

const DEFAULT_EVENT_PROPERTIES: Record<string, PropertyCategory[]> = {
  order_placed: [
    {
      label: 'Order Event Properties',
      properties: [
        {
          id: 'event.total_price',
          label: 'Order Total Price',
          type: 'number',
          category: 'event',
          path: 'event.total_price',
          availableOperators: ['equals', 'greater_than', 'less_than', 'between'],
          description: 'Total price included with the order_placed event',
        },
        {
          id: 'event.currency',
          label: 'Currency',
          type: 'string',
          category: 'event',
          path: 'event.currency',
          availableOperators: ['equals', 'not_equals', 'in_list'],
          description: 'Currency in which the order was placed',
        },
        {
          id: 'event.discount_code',
          label: 'Discount Code',
          type: 'string',
          category: 'event',
          path: 'event.discount_code',
          availableOperators: ['equals', 'contains', 'is_set', 'is_not_set'],
          description: 'Discount code applied on the order',
        },
      ],
    },
  ],
  cart_abandoned: [
    {
      label: 'Cart Event Properties',
      properties: [
        {
          id: 'event.cart_value',
          label: 'Cart Value',
          type: 'number',
          category: 'event',
          path: 'event.cart_value',
          availableOperators: ['equals', 'greater_than', 'less_than', 'between'],
        },
        {
          id: 'event.items_count',
          label: 'Items Count',
          type: 'number',
          category: 'event',
          path: 'event.items_count',
          availableOperators: ['equals', 'greater_than', 'less_than', 'between'],
        },
      ],
    },
  ],
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventName: string }> },
) {
  const resolved = await params;
  const categories =
    DEFAULT_EVENT_PROPERTIES[resolved.eventName] ??
    [
      {
        label: 'Event Properties',
        properties: [
          {
            id: `event.${resolved.eventName}.property`,
            label: 'Event Property',
            type: 'string',
            category: 'event',
            path: `event.${resolved.eventName}.property`,
            availableOperators: ['equals', 'not_equals', 'contains', 'is_set', 'is_not_set'],
            description: 'Example event property',
          },
        ],
      },
    ];

  return NextResponse.json({ categories, syncedAt: new Date().toISOString() });
}




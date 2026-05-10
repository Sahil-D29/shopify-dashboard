import { NextResponse } from 'next/server';

import type { PropertyDefinition } from '@/lib/types/condition-config';

interface PropertyCategory {
  label: string;
  properties: PropertyDefinition[];
}

const propertyCategories: PropertyCategory[] = [
  {
    label: 'Customer Properties',
    properties: [
      {
        id: 'customer.first_name',
        label: 'First Name',
        type: 'string',
        category: 'customer',
        path: 'customer.first_name',
        availableOperators: ['equals', 'not_equals', 'contains', 'starts_with', 'is_set'],
        description: "Customer's first name",
      },
      {
        id: 'customer.last_name',
        label: 'Last Name',
        type: 'string',
        category: 'customer',
        path: 'customer.last_name',
        availableOperators: ['equals', 'not_equals', 'contains', 'starts_with', 'is_set'],
        description: "Customer's last name",
      },
      {
        id: 'customer.lifetime_value',
        label: 'Lifetime Value',
        type: 'number',
        category: 'customer',
        path: 'customer.lifetime_value',
        availableOperators: ['equals', 'greater_than', 'less_than', 'between'],
        description: 'Total monetary value of all orders placed by the customer',
      },
      {
        id: 'customer.order_count',
        label: 'Order Count',
        type: 'number',
        category: 'customer',
        path: 'customer.order_count',
        availableOperators: ['equals', 'greater_than', 'less_than', 'between'],
        description: 'Total number of orders the customer has placed',
      },
      {
        id: 'customer.tags',
        label: 'Tags',
        type: 'array',
        category: 'customer',
        path: 'customer.tags',
        availableOperators: ['contains', 'not_contains', 'in_list', 'not_in_list', 'is_set', 'is_not_set'],
        description: 'Tags applied to the customer profile',
      },
      {
        id: 'customer.created_at',
        label: 'Created Date',
        type: 'date',
        category: 'customer',
        path: 'customer.created_at',
        availableOperators: ['equals', 'greater_than', 'less_than', 'between', 'is_set', 'is_not_set'],
        description: 'Date the customer record was created',
      },
    ],
  },
  {
    label: 'Order Properties',
    properties: [
      {
        id: 'order.total_price',
        label: 'Total Price',
        type: 'number',
        category: 'order',
        path: 'order.total_price',
        availableOperators: ['equals', 'greater_than', 'less_than', 'between'],
        description: 'Total value of the order including taxes and shipping',
      },
      {
        id: 'order.status',
        label: 'Order Status',
        type: 'string',
        category: 'order',
        path: 'order.status',
        availableOperators: ['equals', 'not_equals', 'in_list', 'not_in_list', 'is_set', 'is_not_set'],
        description: 'Current fulfillment/payment status of the order',
      },
      {
        id: 'order.discount_codes',
        label: 'Discount Codes',
        type: 'array',
        category: 'order',
        path: 'order.discount_codes',
        availableOperators: ['contains', 'not_contains', 'is_set', 'is_not_set'],
        description: 'Discount codes applied to the order',
      },
      {
        id: 'order.currency',
        label: 'Currency',
        type: 'string',
        category: 'order',
        path: 'order.currency',
        availableOperators: ['equals', 'not_equals', 'in_list', 'not_in_list'],
        description: 'Currency in which the order was placed',
      },
    ],
  },
  {
    label: 'Product Properties',
    properties: [
      {
        id: 'product.product_type',
        label: 'Product Type',
        type: 'string',
        category: 'product',
        path: 'product.product_type',
        availableOperators: ['equals', 'not_equals', 'contains', 'not_contains', 'is_set', 'is_not_set'],
        description: 'Product type categorisation from Shopify',
      },
      {
        id: 'product.vendor',
        label: 'Vendor',
        type: 'string',
        category: 'product',
        path: 'product.vendor',
        availableOperators: ['equals', 'not_equals', 'contains', 'not_contains', 'in_list'],
        description: 'Product vendor or brand',
      },
      {
        id: 'product.price',
        label: 'Price',
        type: 'number',
        category: 'product',
        path: 'product.price',
        availableOperators: ['equals', 'greater_than', 'less_than', 'between'],
        description: 'Current product price',
      },
      {
        id: 'product.tags',
        label: 'Product Tags',
        type: 'array',
        category: 'product',
        path: 'product.tags',
        availableOperators: ['contains', 'not_contains', 'is_set', 'is_not_set'],
        description: 'Tags applied to the product',
      },
    ],
  },
  {
    label: 'Event Properties',
    properties: [
      {
        id: 'event.name',
        label: 'Event Name',
        type: 'string',
        category: 'event',
        path: 'event.name',
        availableOperators: ['equals', 'not_equals', 'in_list', 'not_in_list'],
        description: 'Name of the tracked event',
      },
      {
        id: 'event.count',
        label: 'Event Count',
        type: 'number',
        category: 'event',
        path: 'event.count',
        availableOperators: ['equals', 'greater_than', 'less_than', 'between'],
        description: 'Number of times the event has occurred',
      },
      {
        id: 'event.last_occurrence',
        label: 'Last Event Time',
        type: 'date',
        category: 'event',
        path: 'event.last_occurrence',
        availableOperators: ['equals', 'greater_than', 'less_than', 'between', 'is_set', 'is_not_set'],
        description: 'Timestamp for the most recent event occurrence',
      },
      {
        id: 'event.properties',
        label: 'Event Properties',
        type: 'object',
        category: 'event',
        path: 'event.properties',
        availableOperators: ['is_set', 'is_not_set'],
        description: 'Nested event payload properties',
      },
    ],
  },
  {
    label: 'Computed Attributes',
    properties: [
      {
        id: 'computed.predicted_ltv',
        label: 'Predicted Lifetime Value',
        type: 'number',
        category: 'computed',
        path: 'computed.predicted_ltv',
        availableOperators: ['equals', 'greater_than', 'less_than', 'between'],
        description: 'AI predicted customer lifetime value',
      },
      {
        id: 'computed.churn_risk',
        label: 'Churn Risk',
        type: 'string',
        category: 'computed',
        path: 'computed.churn_risk',
        availableOperators: ['equals', 'in_list', 'not_in_list'],
        description: 'Risk classification derived from behavioural models',
      },
    ],
  },
];

export async function GET() {
  return NextResponse.json({
    categories: propertyCategories,
    syncedAt: new Date().toISOString(),
  });
}




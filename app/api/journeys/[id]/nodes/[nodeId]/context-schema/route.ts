export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

import type { JourneyDefinition } from '@/lib/types/journey';
import { readJsonFile } from '@/lib/utils/json-storage';

type Params = { id: string; nodeId: string };

interface PropertyOption {
  value: string;
  label: string;
  sample?: string;
  description?: string;
}

interface DataSourceGroup {
  label: string;
  options: PropertyOption[];
}

interface DataSourceSchema {
  id: string;
  label: string;
  description: string;
  groups: DataSourceGroup[];
}

interface ContextSchemaResponse {
  dataSources: DataSourceSchema[];
  triggerContext?: 'generic' | 'order' | 'product';
}

// Default customer properties
const CUSTOMER_PROPERTIES: DataSourceSchema = {
  id: 'customer',
  label: 'Customer Properties',
  description: 'Profile fields from Shopify customers.',
  groups: [
    {
      label: 'Profile',
      options: [
        { value: 'first_name', label: 'First Name', sample: 'Ava' },
        { value: 'last_name', label: 'Last Name', sample: 'Sharma' },
        { value: 'full_name', label: 'Full Name', sample: 'Ava Sharma' },
        { value: 'email', label: 'Email', sample: 'ava@example.com' },
        { value: 'phone', label: 'Phone', sample: '+91 98765 43210' },
        { value: 'city', label: 'City', sample: 'Mumbai' },
        { value: 'country', label: 'Country', sample: 'India' },
        { value: 'tags', label: 'Tags', sample: 'VIP, Repeat' },
      ],
    },
  ],
};

// Default order properties
const ORDER_PROPERTIES: DataSourceSchema = {
  id: 'order',
  label: 'Order Properties',
  description: 'Latest order or triggering order details.',
  groups: [
    {
      label: 'Order Summary',
      options: [
        { value: 'order_number', label: 'Order Number', sample: '#1254' },
        { value: 'total_price', label: 'Total Price', sample: '$129.00' },
        { value: 'subtotal_price', label: 'Subtotal Price', sample: '$119.00' },
        { value: 'currency', label: 'Currency', sample: 'USD' },
        { value: 'items_count', label: 'Items Count', sample: '3' },
        { value: 'processed_at', label: 'Processed At', sample: 'Jan 5, 10:30 AM' },
        { value: 'discount_codes', label: 'Discount Codes', sample: 'WELCOME10' },
      ],
    },
  ],
};

// Default product properties
const PRODUCT_PROPERTIES: DataSourceSchema = {
  id: 'product',
  label: 'Product Properties',
  description: 'Product details associated with this journey.',
  groups: [
    {
      label: 'Product Details',
      options: [
        { value: 'title', label: 'Product Title', sample: 'Organic Cotton Tee' },
        { value: 'price', label: 'Price', sample: '$49.00' },
        { value: 'vendor', label: 'Vendor', sample: 'Cotton & Co.' },
        { value: 'variant_title', label: 'Variant Title', sample: 'Large / Navy' },
        { value: 'image_url', label: 'Image URL', sample: 'https://cdn.shopify.com/products/tee.png' },
      ],
    },
  ],
};

// Custom/metafield properties
const CUSTOM_PROPERTIES: DataSourceSchema = {
  id: 'custom',
  label: 'Custom Properties',
  description: 'Shopify metafields or computed attributes.',
  groups: [
    {
      label: 'Metafields',
      options: [
        { value: 'metafield.customer.loyalty_tier', label: 'Loyalty Tier', sample: 'Gold' },
        { value: 'metafield.customer.points_balance', label: 'Points Balance', sample: '1450' },
        { value: 'metafield.order.shipping_eta', label: 'Shipping ETA', sample: '2-3 business days' },
      ],
    },
  ],
};

// Static data source
const STATIC_PROPERTIES: DataSourceSchema = {
  id: 'static',
  label: 'Static Text',
  description: 'Use a fixed value when dynamic data is not needed.',
  groups: [
    {
      label: 'Static Value',
      options: [],
    },
  ],
};

export async function GET(_request: NextRequest, { params }: { params: Promise<Params> }) {
  try {
    const { id, nodeId } = await params;
    const journeyId = id;

    // Load journey to determine trigger context
    const journeys = readJsonFile<JourneyDefinition>('journeys.json');
    const journey = journeys.find(j => j.id === journeyId);

    if (!journey) {
      return NextResponse.json({ error: 'Journey not found.' }, { status: 404 });
    }

    // Determine trigger context from journey's first trigger node
    let triggerContext: 'generic' | 'order' | 'product' = 'generic';
    const triggerNode = journey.nodes.find(node => node.type === 'trigger');
    const trigger = triggerNode && 'trigger' in triggerNode ? triggerNode.trigger : undefined;
    if (trigger?.type === 'order_placed' || trigger?.type === 'abandoned_cart') {
      triggerContext = 'order';
    } else if (trigger?.type === 'product_viewed') {
      triggerContext = 'product';
    }

    // Build data sources based on context
    const dataSources: DataSourceSchema[] = [CUSTOMER_PROPERTIES];

    if (triggerContext === 'order' || triggerContext === 'generic') {
      dataSources.push(ORDER_PROPERTIES);
    }

    if (triggerContext === 'product' || triggerContext === 'generic') {
      dataSources.push(PRODUCT_PROPERTIES);
    }

    dataSources.push(CUSTOM_PROPERTIES);
    dataSources.push(STATIC_PROPERTIES);

    const response: ContextSchemaResponse = {
      dataSources,
      triggerContext,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[context-schema]', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch context schema.',
      },
      { status: 500 },
    );
  }
}


export type JourneyEventFieldType = 'text' | 'number' | 'currency' | 'url' | 'date' | 'image';

export interface JourneyEventField {
  path: string;
  label: string;
  type: JourneyEventFieldType;
  sample: string;
  source: string;
  mappingCompatibility: Array<'text' | 'url' | 'media' | 'filter'>;
  description?: string;
}

export interface JourneyEventSchema {
  id: string;
  label: string;
  source: string;
  fields: JourneyEventField[];
}

const field = (
  value: Omit<JourneyEventField, 'source' | 'mappingCompatibility'> &
    Partial<Pick<JourneyEventField, 'mappingCompatibility'>>,
): JourneyEventField => ({
  ...value,
  source: 'Shiprocket',
  mappingCompatibility: value.mappingCompatibility ?? [
    'text',
    ...(value.type === 'url' ? ['url' as const] : []),
    ...(value.type === 'image' ? ['media' as const] : []),
    'filter',
  ],
});

const ABANDONED_CART_FIELDS: JourneyEventField[] = [
  field({ path: 'checkout_url', label: 'Checkout recovery URL', type: 'url', sample: 'https://mymaatram.com/?cart-resume-id=sample&type=report', description: 'The customer-specific Shiprocket checkout resume link.' }),
  field({ path: 'cart_token', label: 'Cart token', type: 'text', sample: 'cart-token' }),
  field({ path: 'checkout_token', label: 'Checkout token', type: 'text', sample: 'checkout-token' }),
  field({ path: 'cart_id', label: 'Cart ID', type: 'text', sample: 'cart-id' }),
  field({ path: 'first_name', label: 'First name', type: 'text', sample: 'Sahil' }),
  field({ path: 'last_name', label: 'Last name', type: 'text', sample: 'Gupta' }),
  field({ path: 'email', label: 'Email', type: 'text', sample: 'customer@example.com' }),
  field({ path: 'phone_number', label: 'Phone number', type: 'text', sample: '+91 98765 43210' }),
  field({ path: 'total_price', label: 'Cart total', type: 'currency', sample: '5800' }),
  field({ path: 'currency', label: 'Currency', type: 'text', sample: 'INR' }),
  field({ path: 'item_count', label: 'Item count', type: 'number', sample: '1' }),
  field({ path: 'item_name_list.0', label: 'First product name', type: 'text', sample: 'Featured product' }),
  field({ path: 'img_url', label: 'Product image', type: 'image', sample: 'https://cdn.shopify.com/product.jpg' }),
  field({ path: 'created_at', label: 'Checkout created time', type: 'date', sample: '2026-11-11T12:36:51.899Z' }),
  field({ path: 'custom_attributes.landing_page_url', label: 'Original landing page', type: 'url', sample: 'https://mymaatram.com/products/example' }),
];

const EVENT_SCHEMAS: Record<string, JourneyEventSchema> = {
  'custom:abandoned_cart': {
    id: 'custom:abandoned_cart',
    label: 'Abandoned checkout',
    source: 'Shiprocket',
    fields: ABANDONED_CART_FIELDS,
  },
};

export function getJourneyEventSchema(eventName?: string | null): JourneyEventSchema | undefined {
  return eventName ? EVENT_SCHEMAS[eventName] : undefined;
}

export function getJourneyEventFields(eventName?: string | null, types?: JourneyEventFieldType[]): JourneyEventField[] {
  const fields = getJourneyEventSchema(eventName)?.fields ?? [];
  return types?.length ? fields.filter(field => types.includes(field.type)) : fields;
}

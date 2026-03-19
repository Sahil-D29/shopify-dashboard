export type PropertyValueType =
  | 'shopify_product'
  | 'shopify_collection'
  | 'shopify_vendor'
  | 'shopify_product_type'
  | 'shopify_tag'
  | 'shopify_customer'
  | 'shopify_discount_code'
  | 'order_status'
  | 'fulfillment_status'
  | 'payment_status'
  | 'currency'
  | 'country'
  | 'text'
  | 'number'
  | 'date'
  | 'boolean'
  | 'static';

export interface PropertyMetadata {
  id: string;
  label: string;
  category: 'product' | 'order' | 'customer' | 'cart' | 'custom';
  valueType: PropertyValueType;
  operators: string[];
  apiEndpoint?: string; // For fetching dropdown data
  valueField?: string; // Which field to use as value
  labelField?: string; // Which field to display
  searchable?: boolean;
  multiSelect?: boolean;
  /** Static predefined options (no API call needed) */
  staticOptions?: { value: string; label: string }[];
}

export const TRIGGER_PROPERTY_METADATA: PropertyMetadata[] = [
  // ─── Product Properties ───
  {
    id: 'product.title',
    label: 'Product title',
    category: 'product',
    valueType: 'shopify_product',
    operators: ['equals', 'not_equals', 'contains', 'in', 'not_in'],
    apiEndpoint: '/api/shopify/products',
    valueField: 'title',
    labelField: 'title',
    searchable: true,
    multiSelect: false
  },
  {
    id: 'product.id',
    label: 'Product ID',
    category: 'product',
    valueType: 'shopify_product',
    operators: ['equals', 'not_equals', 'in', 'not_in'],
    apiEndpoint: '/api/shopify/products',
    valueField: 'id',
    labelField: 'title',
    searchable: true,
    multiSelect: true
  },
  {
    id: 'product_id',
    label: 'Product ID',
    category: 'product',
    valueType: 'shopify_product',
    operators: ['equals', 'not_equals', 'in', 'not_in'],
    apiEndpoint: '/api/shopify/products',
    valueField: 'id',
    labelField: 'title',
    searchable: true,
    multiSelect: false
  },
  {
    id: 'product.vendor',
    label: 'Product vendor',
    category: 'product',
    valueType: 'shopify_vendor',
    operators: ['equals', 'not_equals', 'in', 'not_in'],
    apiEndpoint: '/api/shopify/vendors',
    valueField: 'name',
    labelField: 'name',
    searchable: true,
    multiSelect: true
  },
  {
    id: 'product.type',
    label: 'Product type',
    category: 'product',
    valueType: 'shopify_product_type',
    operators: ['equals', 'not_equals', 'in', 'not_in'],
    apiEndpoint: '/api/shopify/product-types',
    valueField: 'type',
    labelField: 'type',
    searchable: true,
    multiSelect: true
  },
  {
    id: 'product.collection',
    label: 'Product collection',
    category: 'product',
    valueType: 'shopify_collection',
    operators: ['equals', 'not_equals', 'in', 'not_in'],
    apiEndpoint: '/api/shopify/collections',
    valueField: 'id',
    labelField: 'title',
    searchable: true,
    multiSelect: true
  },
  {
    id: 'product.price',
    label: 'Product price',
    category: 'product',
    valueType: 'number',
    operators: ['equals', 'not_equals', 'greater_than', 'less_than', 'between'],
    searchable: false
  },
  {
    id: 'product.sku',
    label: 'Product SKU',
    category: 'product',
    valueType: 'text',
    operators: ['equals', 'contains', 'starts_with'],
    searchable: false
  },
  {
    id: 'product.tags',
    label: 'Product tags',
    category: 'product',
    valueType: 'shopify_tag',
    operators: ['contains', 'not_contains', 'in', 'not_in'],
    apiEndpoint: '/api/shopify/tags',
    valueField: 'tag',
    labelField: 'tag',
    searchable: true,
    multiSelect: true
  },

  // ─── Order Properties ───
  {
    id: 'order.status',
    label: 'Order status',
    category: 'order',
    valueType: 'order_status',
    operators: ['equals', 'not_equals', 'in', 'not_in'],
    apiEndpoint: '/api/shopify/order-statuses',
    valueField: 'value',
    labelField: 'label',
    searchable: false,
    multiSelect: true
  },
  {
    id: 'order.fulfillment_status',
    label: 'Fulfillment status',
    category: 'order',
    valueType: 'fulfillment_status',
    operators: ['equals', 'not_equals', 'in', 'not_in'],
    apiEndpoint: '/api/shopify/fulfillment-statuses',
    valueField: 'value',
    labelField: 'label',
    searchable: false,
    multiSelect: true
  },
  {
    id: 'order.discount_code',
    label: 'Discount code',
    category: 'order',
    valueType: 'shopify_discount_code',
    operators: ['equals', 'not_equals', 'contains', 'in', 'not_in'],
    apiEndpoint: '/api/shopify/discount-codes',
    valueField: 'code',
    labelField: 'code',
    searchable: true,
    multiSelect: true
  },
  {
    id: 'order.total_price',
    label: 'Order total price',
    category: 'order',
    valueType: 'number',
    operators: ['equals', 'not_equals', 'greater_than', 'less_than', 'between'],
    searchable: false
  },

  // ─── Customer Properties ───
  {
    id: 'customer.tags',
    label: 'Customer tags',
    category: 'customer',
    valueType: 'shopify_tag',
    operators: ['contains', 'not_contains', 'in', 'not_in'],
    apiEndpoint: '/api/shopify/customer-tags',
    valueField: 'tag',
    labelField: 'tag',
    searchable: true,
    multiSelect: true
  },
  {
    id: 'customer.country',
    label: 'Customer country',
    category: 'customer',
    valueType: 'country',
    operators: ['equals', 'not_equals', 'in', 'not_in'],
    apiEndpoint: '/api/shopify/countries',
    valueField: 'value',
    labelField: 'label',
    searchable: true,
    multiSelect: true
  },

  // ─── Cart Properties ───
  {
    id: 'cart.total_value',
    label: 'Cart value',
    category: 'cart',
    valueType: 'number',
    operators: ['equals', 'not_equals', 'greater_than', 'less_than', 'between'],
    searchable: false
  },

  // ─── Event property entries (flat names used by shopifyEvents.ts) ───
  // These map event property names to smart inputs

  // Product name (used in product_viewed, product_added_to_cart, etc.)
  {
    id: 'product_name',
    label: 'Product name',
    category: 'product',
    valueType: 'shopify_product',
    operators: ['equals', 'not_equals', 'contains'],
    apiEndpoint: '/api/shopify/products',
    valueField: 'title',
    labelField: 'title',
    searchable: true,
    multiSelect: false
  },
  // Product vendor (flat name)
  {
    id: 'product_vendor',
    label: 'Product vendor',
    category: 'product',
    valueType: 'shopify_vendor',
    operators: ['equals', 'not_equals'],
    apiEndpoint: '/api/shopify/vendors',
    valueField: 'name',
    labelField: 'name',
    searchable: true,
  },
  // Product category (maps to product type in Shopify)
  {
    id: 'product_category',
    label: 'Product category',
    category: 'product',
    valueType: 'shopify_product_type',
    operators: ['equals', 'not_equals'],
    apiEndpoint: '/api/shopify/product-types',
    valueField: 'type',
    labelField: 'type',
    searchable: true,
  },
  // Product SKU (flat name)
  {
    id: 'product_sku',
    label: 'Product SKU',
    category: 'product',
    valueType: 'text',
    operators: ['equals', 'contains'],
  },
  // Product price (flat name, number input)
  {
    id: 'product_price',
    label: 'Product price',
    category: 'product',
    valueType: 'number',
    operators: ['equals', 'not_equals', 'greater_than', 'less_than', 'between'],
  },
  // Order total (flat name)
  {
    id: 'order_total',
    label: 'Order total',
    category: 'order',
    valueType: 'number',
    operators: ['equals', 'not_equals', 'greater_than', 'less_than', 'between'],
  },
  // Discount amount (flat name)
  {
    id: 'discount_amount',
    label: 'Discount amount',
    category: 'order',
    valueType: 'number',
    operators: ['equals', 'greater_than', 'less_than'],
  },
  // Amount (used by payment_completed, subscription)
  {
    id: 'amount',
    label: 'Amount',
    category: 'order',
    valueType: 'number',
    operators: ['equals', 'not_equals', 'greater_than', 'less_than'],
  },
  // Refund amount
  {
    id: 'refund_amount',
    label: 'Refund amount',
    category: 'order',
    valueType: 'number',
    operators: ['equals', 'greater_than', 'less_than'],
  },
  // Cart value (flat name)
  {
    id: 'cart_value',
    label: 'Cart value',
    category: 'cart',
    valueType: 'number',
    operators: ['equals', 'not_equals', 'greater_than', 'less_than', 'between'],
  },
  // Items count (used in multiple events)
  {
    id: 'items_count',
    label: 'Items count',
    category: 'order',
    valueType: 'number',
    operators: ['equals', 'greater_than', 'less_than'],
  },
  // Quantity
  {
    id: 'quantity',
    label: 'Quantity',
    category: 'product',
    valueType: 'number',
    operators: ['equals', 'greater_than', 'less_than'],
  },
  // Price (flat)
  {
    id: 'price',
    label: 'Price',
    category: 'product',
    valueType: 'number',
    operators: ['equals', 'greater_than', 'less_than', 'between'],
  },

  // ─── Static option properties (used by event filters) ───

  // Fulfillment status (flat name used in events)
  {
    id: 'fulfillment_status',
    label: 'Fulfillment status',
    category: 'order',
    valueType: 'static',
    operators: ['equals', 'not_equals'],
    staticOptions: [
      { value: 'unfulfilled', label: 'Unfulfilled' },
      { value: 'partial', label: 'Partially Fulfilled' },
      { value: 'fulfilled', label: 'Fulfilled' },
      { value: 'restocked', label: 'Restocked' },
    ],
  },
  // Status (generic, used in fulfillment events)
  {
    id: 'status',
    label: 'Status',
    category: 'order',
    valueType: 'static',
    operators: ['equals', 'not_equals'],
    staticOptions: [
      { value: 'pending', label: 'Pending' },
      { value: 'open', label: 'Open' },
      { value: 'success', label: 'Success' },
      { value: 'cancelled', label: 'Cancelled' },
      { value: 'error', label: 'Error' },
      { value: 'failure', label: 'Failure' },
    ],
  },
  // Payment method
  {
    id: 'payment_method',
    label: 'Payment method',
    category: 'order',
    valueType: 'static',
    operators: ['equals', 'not_equals'],
    staticOptions: [
      { value: 'cod', label: 'Cash on Delivery' },
      { value: 'upi', label: 'UPI' },
      { value: 'card', label: 'Credit/Debit Card' },
      { value: 'netbanking', label: 'Net Banking' },
      { value: 'wallet', label: 'Digital Wallet' },
      { value: 'emi', label: 'EMI' },
      { value: 'bank_transfer', label: 'Bank Transfer' },
    ],
  },
  // Currency
  {
    id: 'currency',
    label: 'Currency',
    category: 'order',
    valueType: 'static',
    operators: ['equals', 'not_equals'],
    staticOptions: [
      { value: 'INR', label: 'INR - Indian Rupee' },
      { value: 'USD', label: 'USD - US Dollar' },
      { value: 'EUR', label: 'EUR - Euro' },
      { value: 'GBP', label: 'GBP - British Pound' },
      { value: 'AED', label: 'AED - UAE Dirham' },
      { value: 'SGD', label: 'SGD - Singapore Dollar' },
      { value: 'AUD', label: 'AUD - Australian Dollar' },
      { value: 'CAD', label: 'CAD - Canadian Dollar' },
    ],
  },
  // Shipping method
  {
    id: 'shipping_method',
    label: 'Shipping method',
    category: 'order',
    valueType: 'static',
    operators: ['equals', 'not_equals'],
    staticOptions: [
      { value: 'standard', label: 'Standard Shipping' },
      { value: 'express', label: 'Express Shipping' },
      { value: 'free', label: 'Free Shipping' },
      { value: 'same_day', label: 'Same Day Delivery' },
      { value: 'pickup', label: 'Store Pickup' },
    ],
  },
  // Cancel reason
  {
    id: 'cancel_reason',
    label: 'Cancel reason',
    category: 'order',
    valueType: 'static',
    operators: ['equals', 'not_equals'],
    staticOptions: [
      { value: 'customer', label: 'Customer request' },
      { value: 'fraud', label: 'Fraud' },
      { value: 'inventory', label: 'Out of stock' },
      { value: 'declined', label: 'Payment declined' },
      { value: 'other', label: 'Other' },
    ],
  },
  // Refund reason
  {
    id: 'refund_reason',
    label: 'Refund reason',
    category: 'order',
    valueType: 'static',
    operators: ['equals', 'not_equals', 'contains'],
    staticOptions: [
      { value: 'customer', label: 'Customer request' },
      { value: 'damaged', label: 'Damaged product' },
      { value: 'wrong_item', label: 'Wrong item sent' },
      { value: 'quality', label: 'Quality issue' },
      { value: 'other', label: 'Other' },
    ],
  },
  // Channel (whatsapp, sms, email)
  {
    id: 'channel',
    label: 'Channel',
    category: 'custom',
    valueType: 'static',
    operators: ['equals', 'not_equals'],
    staticOptions: [
      { value: 'whatsapp', label: 'WhatsApp' },
      { value: 'sms', label: 'SMS' },
      { value: 'email', label: 'Email' },
    ],
  },
  // Subscription interval
  {
    id: 'interval',
    label: 'Billing interval',
    category: 'order',
    valueType: 'static',
    operators: ['equals', 'not_equals'],
    staticOptions: [
      { value: 'weekly', label: 'Weekly' },
      { value: 'monthly', label: 'Monthly' },
      { value: 'yearly', label: 'Yearly' },
    ],
  },
  // Template name (used by engagement events)
  {
    id: 'template_name',
    label: 'Template name',
    category: 'custom',
    valueType: 'text',
    operators: ['equals', 'not_equals', 'contains'],
    apiEndpoint: '/api/whatsapp/templates',
    valueField: 'name',
    labelField: 'name',
    searchable: true,
  },
  // Campaign name (used by marketing events)
  {
    id: 'campaign_name',
    label: 'Campaign name',
    category: 'custom',
    valueType: 'text',
    operators: ['equals', 'not_equals', 'contains'],
  },
];

/**
 * Map flat event property names to existing metadata IDs.
 * Used when an event property name doesn't directly match a metadata entry.
 */
export const EVENT_PROPERTY_TO_METADATA: Record<string, string> = {
  // These event property names map to existing namespaced metadata entries
  'product_vendor': 'product_vendor',
  'product_category': 'product_category',
  'product_sku': 'product_sku',
  'product_name': 'product_name',
  'product_price': 'product_price',
  'product_id': 'product_id',
  'order_total': 'order_total',
  'cart_value': 'cart_value',
  'fulfillment_status': 'fulfillment_status',
  'payment_method': 'payment_method',
  'currency': 'currency',
  'shipping_method': 'shipping_method',
  'cancel_reason': 'cancel_reason',
  'refund_reason': 'refund_reason',
  'refund_amount': 'refund_amount',
  'discount_amount': 'discount_amount',
  'template_name': 'template_name',
  'campaign_name': 'campaign_name',
  'channel': 'channel',
  'interval': 'interval',
  'amount': 'amount',
  'items_count': 'items_count',
  'quantity': 'quantity',
  'price': 'price',
  'status': 'status',
};

/**
 * Get metadata for a property by ID.
 * First tries direct lookup, then checks the event property mapping.
 */
export function getPropertyMetadata(propertyId: string): PropertyMetadata | undefined {
  // Direct lookup
  const direct = TRIGGER_PROPERTY_METADATA.find(p => p.id === propertyId);
  if (direct) return direct;

  // Check event property mapping
  const mappedId = EVENT_PROPERTY_TO_METADATA[propertyId];
  if (mappedId && mappedId !== propertyId) {
    return TRIGGER_PROPERTY_METADATA.find(p => p.id === mappedId);
  }

  return undefined;
}

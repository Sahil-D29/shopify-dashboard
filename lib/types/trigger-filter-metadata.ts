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
  | 'boolean';

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
}

export const TRIGGER_PROPERTY_METADATA: PropertyMetadata[] = [
  // Product Properties
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
  
  // Order Properties
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
  
  // Customer Properties
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
  
  // Cart Properties
  {
    id: 'cart.total_value',
    label: 'Cart value',
    category: 'cart',
    valueType: 'number',
    operators: ['equals', 'not_equals', 'greater_than', 'less_than', 'between'],
    searchable: false
  }
];

// Helper function to get metadata for a property
export function getPropertyMetadata(propertyId: string): PropertyMetadata | undefined {
  return TRIGGER_PROPERTY_METADATA.find(p => p.id === propertyId);
}


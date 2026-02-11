/**
 * Data Source Configuration
 * Defines available data sources and their properties for variable mapping
 */

export interface DataSourceProperty {
  value: string; // Property key in data model
  label: string; // Display name
  example: string; // Sample value for preview
  description?: string; // Help text
}

export interface DataSource {
  key: string;
  label: string;
  icon: string;
  description: string;
  properties: DataSourceProperty[];
}

export const DATA_SOURCES: Record<string, DataSource> = {
  customer: {
    key: 'customer',
    label: 'Customer Properties',
    icon: '👤',
    description: 'Profile fields from Shopify customers',
    properties: [
      {
        value: 'firstName',
        label: 'First Name',
        example: 'John',
        description: 'Customer first name from Shopify',
      },
      {
        value: 'lastName',
        label: 'Last Name',
        example: 'Doe',
        description: 'Customer last name',
      },
      {
        value: 'email',
        label: 'Email',
        example: 'john@example.com',
        description: 'Customer email address',
      },
      {
        value: 'phone',
        label: 'Phone',
        example: '+1234567890',
        description: 'Customer phone number',
      },
      {
        value: 'city',
        label: 'City',
        example: 'New York',
        description: 'Customer city',
      },
      {
        value: 'country',
        label: 'Country',
        example: 'United States',
        description: 'Customer country',
      },
      {
        value: 'totalOrders',
        label: 'Total Orders',
        example: '5',
        description: 'Number of orders placed',
      },
      {
        value: 'totalSpent',
        label: 'Total Spent',
        example: '$499.99',
        description: 'Total amount spent',
      },
    ],
  },

  order: {
    key: 'order',
    label: 'Order Properties',
    icon: '📦',
    description: 'Current order/trigger event data',
    properties: [
      {
        value: 'id',
        label: 'Order ID',
        example: '12345',
        description: 'Shopify order ID',
      },
      {
        value: 'orderNumber',
        label: 'Order Number',
        example: '#1001',
        description: 'Human-readable order number',
      },
      {
        value: 'totalAmount',
        label: 'Total Amount',
        example: '$99.99',
        description: 'Order total amount',
      },
      {
        value: 'subtotal',
        label: 'Subtotal',
        example: '$89.99',
        description: 'Order subtotal',
      },
      {
        value: 'tax',
        label: 'Tax',
        example: '$10.00',
        description: 'Tax amount',
      },
      {
        value: 'status',
        label: 'Status',
        example: 'fulfilled',
        description: 'Order status',
      },
      {
        value: 'fulfillmentStatus',
        label: 'Fulfillment Status',
        example: 'shipped',
        description: 'Fulfillment status',
      },
      {
        value: 'trackingNumber',
        label: 'Tracking Number',
        example: '1Z999AA10123456784',
        description: 'Shipping tracking number',
      },
      {
        value: 'trackingUrl',
        label: 'Tracking URL',
        example: 'https://track.example.com/...',
        description: 'Tracking URL',
      },
      {
        value: 'estimatedDelivery',
        label: 'Estimated Delivery',
        example: 'Jan 20, 2024',
        description: 'Estimated delivery date',
      },
      {
        value: 'createdAt',
        label: 'Order Date',
        example: 'Jan 15, 2024',
        description: 'Order creation date',
      },
    ],
  },

  product: {
    key: 'product',
    label: 'Product Properties',
    icon: '🛍️',
    description: 'Product that triggered this journey',
    properties: [
      {
        value: 'title',
        label: 'Product Name',
        example: 'Blue Widget',
        description: 'Product title',
      },
      {
        value: 'price',
        label: 'Price',
        example: '$29.99',
        description: 'Product price',
      },
      {
        value: 'compareAtPrice',
        label: 'Compare At Price',
        example: '$39.99',
        description: 'Original price',
      },
      {
        value: 'sku',
        label: 'SKU',
        example: 'WIDGET-001',
        description: 'Product SKU',
      },
      {
        value: 'vendor',
        label: 'Vendor',
        example: 'ACME Corp',
        description: 'Product vendor',
      },
      {
        value: 'productType',
        label: 'Product Type',
        example: 'Widgets',
        description: 'Product type',
      },
      {
        value: 'imageUrl',
        label: 'Image URL',
        example: 'https://cdn.shopify.com/...',
        description: 'Product image URL',
      },
    ],
  },

  event: {
    key: 'event',
    label: 'Event Properties',
    icon: '⚡',
    description: 'Custom properties from trigger event',
    properties: [
      {
        value: 'custom',
        label: 'Custom Property',
        example: 'Value',
        description: 'Enter property name manually',
      },
    ],
  },

  static: {
    key: 'static',
    label: 'Static Value',
    icon: '📝',
    description: 'Fixed text for all recipients',
    properties: [],
  },
};

/**
 * Get available data sources based on journey trigger context
 */
export function getAvailableDataSources(journeyTrigger?: string): DataSource[] {
  const sources: DataSource[] = [DATA_SOURCES.customer];

  // Add context-specific sources
  if (
    journeyTrigger === 'order_created' ||
    journeyTrigger === 'order_fulfilled' ||
    journeyTrigger === 'order_updated' ||
    journeyTrigger === 'order'
  ) {
    sources.push(DATA_SOURCES.order);
  }

  if (
    journeyTrigger === 'product_viewed' ||
    journeyTrigger === 'product_added_to_cart' ||
    journeyTrigger === 'product_purchased' ||
    journeyTrigger === 'product'
  ) {
    sources.push(DATA_SOURCES.product);
  }

  // Always available
  sources.push(DATA_SOURCES.event, DATA_SOURCES.static);

  return sources;
}

/**
 * Get preview value for a mapping
 */
export function getPreviewValue(
  source: string,
  property: string,
  fallback: string,
): string {
  if (source === 'static') return fallback;

  const dataSource = DATA_SOURCES[source];
  if (!dataSource) return fallback;

  const prop = dataSource.properties.find((p) => p.value === property);
  return prop?.example || fallback;
}



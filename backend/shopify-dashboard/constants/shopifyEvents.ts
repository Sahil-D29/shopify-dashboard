export interface ShopifyEventProperty {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date';
  description: string;
}

export interface EnhancedShopifyEvent {
  id: string;
  label: string;
  description: string;
  category: 'product' | 'order' | 'cart' | 'customer' | 'payment' | 'fulfillment';
  properties?: ShopifyEventProperty[];
}

export const ENHANCED_SHOPIFY_EVENTS: Record<string, EnhancedShopifyEvent[]> = {
  product: [
    {
      id: 'product_viewed',
      label: 'Product Viewed',
      description: 'Customer viewed a product page',
      category: 'product',
      properties: [
        { name: 'product_id', type: 'string', description: 'Product ID' },
        { name: 'product_name', type: 'string', description: 'Product name' },
        { name: 'product_price', type: 'number', description: 'Product price' },
        { name: 'product_category', type: 'string', description: 'Product category' },
        { name: 'product_vendor', type: 'string', description: 'Product vendor' },
        { name: 'product_sku', type: 'string', description: 'Product SKU' },
        { name: 'product_url', type: 'string', description: 'Product URL' },
      ],
    },
    {
      id: 'product_added_to_cart',
      label: 'Product Added to Cart',
      description: 'Customer added product to cart',
      category: 'product',
      properties: [
        { name: 'product_id', type: 'string', description: 'Product ID' },
        { name: 'product_name', type: 'string', description: 'Product name' },
        { name: 'variant_id', type: 'string', description: 'Variant ID' },
        { name: 'variant_title', type: 'string', description: 'Variant title' },
        { name: 'quantity', type: 'number', description: 'Quantity added' },
        { name: 'price', type: 'number', description: 'Product price' },
        { name: 'cart_token', type: 'string', description: 'Cart token associated with the add-to-cart' },
      ],
    },
    {
      id: 'product_removed_from_cart',
      label: 'Product Removed from Cart',
      description: 'Customer removed product from cart',
      category: 'product',
      properties: [
        { name: 'product_id', type: 'string', description: 'Product ID' },
        { name: 'product_name', type: 'string', description: 'Product name' },
        { name: 'variant_id', type: 'string', description: 'Variant ID' },
        { name: 'quantity', type: 'number', description: 'Quantity removed' },
        { name: 'cart_token', type: 'string', description: 'Cart token' },
      ],
    },
    {
      id: 'searched_product',
      label: 'Searched Product',
      description: 'Customer searched for a product',
      category: 'product',
      properties: [
        { name: 'search_query', type: 'string', description: 'Search term entered' },
        { name: 'results_count', type: 'number', description: 'Number of results found' },
        { name: 'filters_applied', type: 'string', description: 'Filters applied during search' },
      ],
    },
  ],
  cart: [
    {
      id: 'cart_abandoned',
      label: 'Cart Abandoned',
      description: 'Customer abandoned their cart',
      category: 'cart',
      properties: [
        { name: 'cart_value', type: 'number', description: 'Total cart value' },
        { name: 'items_count', type: 'number', description: 'Number of items in cart' },
        { name: 'cart_token', type: 'string', description: 'Cart token' },
        { name: 'cart_url', type: 'string', description: 'Cart recovery URL' },
        { name: 'currency', type: 'string', description: 'Cart currency' },
      ],
    },
    {
      id: 'checkout_started',
      label: 'Checkout Started',
      description: 'Customer started checkout process',
      category: 'cart',
      properties: [
        { name: 'cart_value', type: 'number', description: 'Total cart value' },
        { name: 'items_count', type: 'number', description: 'Number of items' },
        { name: 'checkout_token', type: 'string', description: 'Checkout token' },
        { name: 'email', type: 'string', description: 'Customer email' },
        { name: 'checkout_url', type: 'string', description: 'Checkout URL' },
      ],
    },
    {
      id: 'checkout_completed',
      label: 'Checkout Completed',
      description: 'Customer completed checkout',
      category: 'cart',
      properties: [
        { name: 'order_id', type: 'string', description: 'Order ID created from checkout' },
        { name: 'order_total', type: 'number', description: 'Total order value' },
        { name: 'items_count', type: 'number', description: 'Number of items in order' },
        { name: 'discount_amount', type: 'number', description: 'Discount applied during checkout' },
      ],
    },
  ],
  order: [
    {
      id: 'order_placed',
      label: 'Order Placed',
      description: 'Customer placed an order',
      category: 'order',
      properties: [
        { name: 'order_id', type: 'string', description: 'Order ID' },
        { name: 'order_number', type: 'string', description: 'Order number' },
        { name: 'order_total', type: 'number', description: 'Total order value' },
        { name: 'items_count', type: 'number', description: 'Number of items' },
        { name: 'discount_amount', type: 'number', description: 'Discount applied' },
        { name: 'shipping_method', type: 'string', description: 'Shipping method selected' },
        { name: 'payment_method', type: 'string', description: 'Payment method used' },
      ],
    },
    {
      id: 'order_fulfilled',
      label: 'Order Fulfilled',
      description: 'Order was fulfilled',
      category: 'order',
      properties: [
        { name: 'order_id', type: 'string', description: 'Order ID' },
        { name: 'fulfillment_status', type: 'string', description: 'Fulfillment status' },
        { name: 'tracking_number', type: 'string', description: 'Tracking number' },
        { name: 'tracking_url', type: 'string', description: 'Tracking URL' },
        { name: 'carrier', type: 'string', description: 'Carrier service' },
      ],
    },
    {
      id: 'order_cancelled',
      label: 'Order Cancelled',
      description: 'Order was cancelled',
      category: 'order',
      properties: [
        { name: 'order_id', type: 'string', description: 'Order ID' },
        { name: 'cancel_reason', type: 'string', description: 'Cancellation reason' },
        { name: 'cancelled_at', type: 'date', description: 'Cancellation timestamp' },
        { name: 'restock', type: 'boolean', description: 'Items restocked indicator' },
      ],
    },
  ],
  payment: [
    {
      id: 'payment_completed',
      label: 'Payment Completed',
      description: 'Payment was successful',
      category: 'payment',
      properties: [
        { name: 'order_id', type: 'string', description: 'Order ID' },
        { name: 'amount', type: 'number', description: 'Payment amount' },
        { name: 'payment_method', type: 'string', description: 'Payment method' },
        { name: 'currency', type: 'string', description: 'Payment currency' },
        { name: 'transaction_id', type: 'string', description: 'Payment transaction ID' },
      ],
    },
    {
      id: 'refund_issued',
      label: 'Refund Issued',
      description: 'Refund was issued to customer',
      category: 'payment',
      properties: [
        { name: 'order_id', type: 'string', description: 'Order ID associated with the refund' },
        { name: 'refund_amount', type: 'number', description: 'Refund amount' },
        { name: 'refund_reason', type: 'string', description: 'Refund reason' },
        { name: 'refund_id', type: 'string', description: 'Refund transaction ID' },
      ],
    },
  ],
  customer: [
    {
      id: 'customer_created',
      label: 'Customer Created',
      description: 'New customer account created',
      category: 'customer',
      properties: [
        { name: 'customer_id', type: 'string', description: 'Customer ID' },
        { name: 'email', type: 'string', description: 'Customer email' },
        { name: 'first_name', type: 'string', description: 'First name' },
        { name: 'last_name', type: 'string', description: 'Last name' },
        { name: 'accepts_marketing', type: 'boolean', description: 'Marketing consent flag' },
        { name: 'created_at', type: 'date', description: 'Creation timestamp' },
      ],
    },
    {
      id: 'customer_updated',
      label: 'Customer Updated',
      description: 'Customer profile updated',
      category: 'customer',
      properties: [
        { name: 'customer_id', type: 'string', description: 'Customer ID' },
        { name: 'updated_field', type: 'string', description: 'Field updated' },
        { name: 'previous_value', type: 'string', description: 'Previous field value' },
        { name: 'new_value', type: 'string', description: 'New field value' },
        { name: 'updated_at', type: 'date', description: 'Update timestamp' },
      ],
    },
  ],
  fulfillment: [
    {
      id: 'fulfillment_created',
      label: 'Fulfillment Created',
      description: 'New fulfillment created for an order',
      category: 'fulfillment',
      properties: [
        { name: 'fulfillment_id', type: 'string', description: 'Fulfillment ID' },
        { name: 'order_id', type: 'string', description: 'Order ID' },
        { name: 'status', type: 'string', description: 'Fulfillment status' },
        { name: 'line_items', type: 'string', description: 'Fulfilled line items' },
      ],
    },
    {
      id: 'fulfillment_shipped',
      label: 'Fulfillment Shipped',
      description: 'Fulfillment marked as shipped',
      category: 'fulfillment',
      properties: [
        { name: 'fulfillment_id', type: 'string', description: 'Fulfillment ID' },
        { name: 'order_id', type: 'string', description: 'Order ID' },
        { name: 'tracking_number', type: 'string', description: 'Tracking number' },
        { name: 'tracking_url', type: 'string', description: 'Tracking URL' },
        { name: 'carrier', type: 'string', description: 'Shipping carrier' },
      ],
    },
    {
      id: 'fulfillment_delivered',
      label: 'Fulfillment Delivered',
      description: 'Shipment delivered to customer',
      category: 'fulfillment',
      properties: [
        { name: 'fulfillment_id', type: 'string', description: 'Fulfillment ID' },
        { name: 'order_id', type: 'string', description: 'Order ID' },
        { name: 'delivered_at', type: 'date', description: 'Delivery timestamp' },
        { name: 'signature_collected', type: 'boolean', description: 'Was a signature collected?' },
      ],
    },
  ],
};

export const SHOPIFY_EVENTS = ENHANCED_SHOPIFY_EVENTS;

export type ShopifyEventCategory = keyof typeof ENHANCED_SHOPIFY_EVENTS;

export type ShopifyEventDefinition = EnhancedShopifyEvent;

export const getAllEnhancedShopifyEvents = (): EnhancedShopifyEvent[] => {
  return Object.values(ENHANCED_SHOPIFY_EVENTS).flat();
};

export const searchEnhancedEvents = (query: string): EnhancedShopifyEvent[] => {
  const lowerQuery = query.toLowerCase();
  return getAllEnhancedShopifyEvents().filter(
    event =>
      event.label.toLowerCase().includes(lowerQuery) ||
      event.description.toLowerCase().includes(lowerQuery) ||
      event.id.toLowerCase().includes(lowerQuery)
  );
};

export const getEnhancedEventById = (id: string): EnhancedShopifyEvent | undefined => {
  return getAllEnhancedShopifyEvents().find(event => event.id === id);
};



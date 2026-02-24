export interface ShopifyEventProperty {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date';
  description: string;
}

export interface EnhancedShopifyEvent {
  id: string;
  label: string;
  description: string;
  category: 'product' | 'order' | 'cart' | 'customer' | 'payment' | 'fulfillment' | 'engagement' | 'marketing';
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
    {
      id: 'price_drop',
      label: 'Price Drop',
      description: 'Product price decreased from previous value',
      category: 'product',
      properties: [
        { name: 'product_id', type: 'string', description: 'Product ID' },
        { name: 'product_name', type: 'string', description: 'Product name' },
        { name: 'previous_price', type: 'number', description: 'Previous price' },
        { name: 'new_price', type: 'number', description: 'New price' },
        { name: 'drop_percentage', type: 'number', description: 'Price drop percentage' },
        { name: 'product_url', type: 'string', description: 'Product URL' },
      ],
    },
    {
      id: 'back_in_stock',
      label: 'Back in Stock',
      description: 'Previously out-of-stock product is available again',
      category: 'product',
      properties: [
        { name: 'product_id', type: 'string', description: 'Product ID' },
        { name: 'product_name', type: 'string', description: 'Product name' },
        { name: 'variant_id', type: 'string', description: 'Variant ID' },
        { name: 'variant_title', type: 'string', description: 'Variant title' },
        { name: 'inventory_quantity', type: 'number', description: 'Current inventory quantity' },
        { name: 'product_url', type: 'string', description: 'Product URL' },
      ],
    },
    {
      id: 'browse_abandonment',
      label: 'Browse Abandonment',
      description: 'Customer viewed products but did not add to cart',
      category: 'product',
      properties: [
        { name: 'customer_id', type: 'string', description: 'Customer ID' },
        { name: 'products_viewed', type: 'string', description: 'Product IDs viewed (comma-separated)' },
        { name: 'view_count', type: 'number', description: 'Number of products viewed' },
        { name: 'session_duration', type: 'number', description: 'Browsing session duration in seconds' },
        { name: 'last_viewed_product', type: 'string', description: 'Last product viewed' },
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
    {
      id: 'cod_order_placed',
      label: 'COD Order Placed',
      description: 'Customer placed a cash-on-delivery order',
      category: 'order',
      properties: [
        { name: 'order_id', type: 'string', description: 'Order ID' },
        { name: 'order_number', type: 'string', description: 'Order number' },
        { name: 'order_total', type: 'number', description: 'Order total amount' },
        { name: 'customer_phone', type: 'string', description: 'Customer phone number' },
        { name: 'delivery_address', type: 'string', description: 'Delivery address' },
        { name: 'items_count', type: 'number', description: 'Number of items ordered' },
      ],
    },
    {
      id: 'repeat_purchase',
      label: 'Repeat Purchase',
      description: 'Customer purchased a product they have bought before',
      category: 'order',
      properties: [
        { name: 'order_id', type: 'string', description: 'Order ID' },
        { name: 'product_id', type: 'string', description: 'Repeated product ID' },
        { name: 'product_name', type: 'string', description: 'Repeated product name' },
        { name: 'purchase_count', type: 'number', description: 'Total times purchased' },
        { name: 'previous_order_date', type: 'date', description: 'Previous purchase date' },
      ],
    },
    {
      id: 'review_requested',
      label: 'Review Requested',
      description: 'Post-delivery review solicitation trigger',
      category: 'order',
      properties: [
        { name: 'order_id', type: 'string', description: 'Order ID' },
        { name: 'delivered_at', type: 'date', description: 'Delivery date' },
        { name: 'days_since_delivery', type: 'number', description: 'Days since delivered' },
        { name: 'product_names', type: 'string', description: 'Products to review (comma-separated)' },
      ],
    },
    {
      id: 'subscription_created',
      label: 'Subscription Created',
      description: 'Customer created a recurring subscription order',
      category: 'order',
      properties: [
        { name: 'subscription_id', type: 'string', description: 'Subscription ID' },
        { name: 'product_name', type: 'string', description: 'Subscribed product name' },
        { name: 'interval', type: 'string', description: 'Billing interval (weekly, monthly, yearly)' },
        { name: 'next_billing_date', type: 'date', description: 'Next billing date' },
        { name: 'amount', type: 'number', description: 'Subscription amount' },
      ],
    },
    {
      id: 'subscription_cancelled',
      label: 'Subscription Cancelled',
      description: 'Customer cancelled a recurring subscription',
      category: 'order',
      properties: [
        { name: 'subscription_id', type: 'string', description: 'Subscription ID' },
        { name: 'product_name', type: 'string', description: 'Subscribed product name' },
        { name: 'cancel_reason', type: 'string', description: 'Cancellation reason' },
        { name: 'cancelled_at', type: 'date', description: 'Cancellation timestamp' },
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
    {
      id: 'date_property_trigger',
      label: 'Date / Birthday Trigger',
      description: 'Trigger based on customer date attribute (birthday, anniversary)',
      category: 'customer',
      properties: [
        { name: 'customer_id', type: 'string', description: 'Customer ID' },
        { name: 'date_field', type: 'string', description: 'Date attribute name (e.g. birthday)' },
        { name: 'date_value', type: 'date', description: 'The actual date value' },
        { name: 'days_before', type: 'number', description: 'Days before the date to trigger' },
        { name: 'customer_name', type: 'string', description: 'Customer name' },
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
  engagement: [
    {
      id: 'whatsapp_reply_received',
      label: 'WhatsApp Reply Received',
      description: 'Customer replied to a WhatsApp message',
      category: 'engagement',
      properties: [
        { name: 'message_id', type: 'string', description: 'Original message ID' },
        { name: 'reply_text', type: 'string', description: 'Reply content' },
        { name: 'customer_phone', type: 'string', description: 'Customer phone number' },
        { name: 'template_name', type: 'string', description: 'Original template name' },
        { name: 'replied_at', type: 'date', description: 'Reply timestamp' },
      ],
    },
    {
      id: 'whatsapp_button_clicked',
      label: 'WhatsApp Button Clicked',
      description: 'Customer clicked a button in a WhatsApp message',
      category: 'engagement',
      properties: [
        { name: 'message_id', type: 'string', description: 'Message ID' },
        { name: 'button_id', type: 'string', description: 'Button identifier' },
        { name: 'button_text', type: 'string', description: 'Button label text' },
        { name: 'customer_phone', type: 'string', description: 'Customer phone number' },
        { name: 'template_name', type: 'string', description: 'Template name' },
      ],
    },
  ],
  marketing: [
    {
      id: 'utm_link_clicked',
      label: 'UTM Link Clicked',
      description: 'Customer clicked a tracked UTM link in a WhatsApp message',
      category: 'marketing',
      properties: [
        { name: 'utm_source', type: 'string', description: 'UTM source parameter' },
        { name: 'utm_medium', type: 'string', description: 'UTM medium parameter' },
        { name: 'utm_campaign', type: 'string', description: 'UTM campaign parameter' },
        { name: 'utm_content', type: 'string', description: 'UTM content parameter' },
        { name: 'utm_term', type: 'string', description: 'UTM term parameter' },
        { name: 'destination_url', type: 'string', description: 'Destination URL clicked' },
        { name: 'customer_phone', type: 'string', description: 'Customer phone number' },
        { name: 'clicked_at', type: 'date', description: 'Click timestamp' },
      ],
    },
    {
      id: 'campaign_opened',
      label: 'Campaign Opened',
      description: 'Customer opened a WhatsApp campaign message',
      category: 'marketing',
      properties: [
        { name: 'campaign_id', type: 'string', description: 'Campaign ID' },
        { name: 'campaign_name', type: 'string', description: 'Campaign name' },
        { name: 'customer_phone', type: 'string', description: 'Customer phone number' },
        { name: 'opened_at', type: 'date', description: 'Open timestamp' },
        { name: 'channel', type: 'string', description: 'Channel (whatsapp, sms, email)' },
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



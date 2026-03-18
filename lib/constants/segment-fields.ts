export type SegmentFieldType = 'text' | 'number' | 'date' | 'tags' | 'boolean';

export type EntityType = 'product' | 'campaign' | 'template' | 'segment' | 'journey' | 'collection' | 'country' | 'state' | 'flow' | 'agent' | 'custom_field';

export type FieldStatus = 'available' | 'coming_soon' | 'requires_app';

export interface SegmentFieldOption {
  value: string;
  label: string;
  type: SegmentFieldType;
  group: string;
  entityType?: EntityType;
  status?: FieldStatus;
  supportsSubFilters?: boolean;
  supportsTimeWindow?: boolean;
  supportsFrequency?: boolean;
}

export const SEGMENT_FIELD_OPTIONS: SegmentFieldOption[] = [
  // ─── Customer Attributes ───
  { value: 'customer_name', label: 'Customer Name', type: 'text', group: 'Customer Attributes' },
  { value: 'customer_email', label: 'Email', type: 'text', group: 'Customer Attributes' },
  { value: 'customer_phone', label: 'Phone', type: 'text', group: 'Customer Attributes' },
  { value: 'customer_tags', label: 'Tags', type: 'tags', group: 'Customer Attributes' },
  { value: 'location_country', label: 'Country', type: 'text', group: 'Customer Attributes', entityType: 'country' },
  { value: 'location_city', label: 'City', type: 'text', group: 'Customer Attributes' },
  { value: 'location_state', label: 'State', type: 'text', group: 'Customer Attributes', entityType: 'state' },
  { value: 'location_postal_code', label: 'Postal Code', type: 'text', group: 'Customer Attributes' },
  { value: 'customer_since', label: 'Customer Since', type: 'date', group: 'Customer Attributes', supportsTimeWindow: true },
  { value: 'marketing_opt_in', label: 'Marketing Opt-in', type: 'boolean', group: 'Customer Attributes' },
  { value: 'sms_opt_in', label: 'SMS Opt-in', type: 'boolean', group: 'Customer Attributes' },
  { value: 'email_opt_in', label: 'Email Opt-in', type: 'boolean', group: 'Customer Attributes' },

  // ─── Order History ───
  { value: 'total_orders', label: 'Total Orders', type: 'number', group: 'Order History', supportsTimeWindow: true },
  { value: 'total_spent', label: 'Total Spent', type: 'number', group: 'Order History', supportsTimeWindow: true },
  { value: 'average_order_value', label: 'Average Order Value', type: 'number', group: 'Order History' },
  { value: 'first_order_date', label: 'First Order Date', type: 'date', group: 'Order History', supportsTimeWindow: true },
  { value: 'last_order_date', label: 'Last Order Date', type: 'date', group: 'Order History', supportsTimeWindow: true },
  { value: 'days_since_last_order', label: 'Days Since Last Order', type: 'number', group: 'Order History' },
  { value: 'orders_in_last_x_days', label: 'Orders in Last X Days', type: 'number', group: 'Order History' },
  { value: 'total_items_purchased', label: 'Total Items Purchased', type: 'number', group: 'Order History' },
  { value: 'never_ordered', label: 'Never Ordered', type: 'boolean', group: 'Order History' },
  { value: 'ordered_specific_product', label: 'Ordered Specific Product', type: 'text', group: 'Order History', entityType: 'product', supportsSubFilters: true, supportsTimeWindow: true, supportsFrequency: true },
  { value: 'ordered_from_collection', label: 'Ordered from Collection', type: 'text', group: 'Order History', entityType: 'collection', supportsSubFilters: true, supportsTimeWindow: true, supportsFrequency: true },

  // ─── Advanced Order Filters ───
  { value: 'ordered_product_vendor', label: 'Ordered from Vendor', type: 'text', group: 'Advanced Orders', supportsTimeWindow: true, supportsFrequency: true },
  { value: 'ordered_product_type', label: 'Ordered Product Type', type: 'text', group: 'Advanced Orders', supportsTimeWindow: true, supportsFrequency: true },
  { value: 'order_discount_code', label: 'Discount Code Used', type: 'text', group: 'Advanced Orders', supportsTimeWindow: true, supportsFrequency: true },
  { value: 'order_shipping_method', label: 'Shipping Method', type: 'text', group: 'Advanced Orders' },
  { value: 'order_payment_method', label: 'Payment Method', type: 'text', group: 'Advanced Orders' },
  { value: 'order_fulfillment_status', label: 'Fulfillment Status', type: 'text', group: 'Advanced Orders' },
  { value: 'order_financial_status', label: 'Financial Status', type: 'text', group: 'Advanced Orders' },
  { value: 'clv_tier', label: 'CLV Tier', type: 'text', group: 'Advanced Orders' },
  { value: 'repeat_product_buyer', label: 'Repeat Product Buyer', type: 'boolean', group: 'Advanced Orders' },
  { value: 'order_currency', label: 'Order Currency', type: 'text', group: 'Advanced Orders' },

  // ─── WhatsApp Channel ───
  { value: 'wa_last_message_status', label: 'Last Message Status', type: 'text', group: 'WhatsApp Channel' },
  { value: 'wa_conversation_state', label: 'Conversation State', type: 'text', group: 'WhatsApp Channel' },
  { value: 'wa_reply_rate', label: 'Reply Rate (%)', type: 'number', group: 'WhatsApp Channel' },
  { value: 'wa_avg_response_time', label: 'Avg Response Time (min)', type: 'number', group: 'WhatsApp Channel' },
  { value: 'wa_has_active_conversation', label: 'Has Active Conversation', type: 'boolean', group: 'WhatsApp Channel' },
  { value: 'wa_message_frequency', label: 'Messages Sent Count', type: 'number', group: 'WhatsApp Channel', supportsTimeWindow: true },
  { value: 'wa_last_inbound_message', label: 'Last Inbound Message', type: 'date', group: 'WhatsApp Channel', supportsTimeWindow: true },
  { value: 'wa_last_outbound_message', label: 'Last Outbound Message', type: 'date', group: 'WhatsApp Channel', supportsTimeWindow: true },
  { value: 'wa_total_conversations', label: 'Total Conversations', type: 'number', group: 'WhatsApp Channel' },
  { value: 'wa_opted_in', label: 'WhatsApp Opt-in', type: 'boolean', group: 'WhatsApp Channel' },
  { value: 'wa_opt_in_date', label: 'Opt-in Date', type: 'date', group: 'WhatsApp Channel', supportsTimeWindow: true },
  { value: 'wa_contact_source', label: 'Contact Source', type: 'text', group: 'WhatsApp Channel' },

  // ─── Campaign Performance ───
  { value: 'campaign_received_specific', label: 'Received Specific Campaign', type: 'text', group: 'Campaign Performance', entityType: 'campaign', supportsSubFilters: true, supportsTimeWindow: true, supportsFrequency: true },
  { value: 'campaign_opened_specific', label: 'Opened Specific Campaign', type: 'text', group: 'Campaign Performance', entityType: 'campaign', supportsSubFilters: true, supportsTimeWindow: true },
  { value: 'campaign_clicked_specific', label: 'Clicked in Campaign', type: 'text', group: 'Campaign Performance', entityType: 'campaign', supportsTimeWindow: true },
  { value: 'campaign_converted_specific', label: 'Converted from Campaign', type: 'text', group: 'Campaign Performance', entityType: 'campaign', supportsTimeWindow: true },
  { value: 'campaign_total_received', label: 'Total Campaigns Received', type: 'number', group: 'Campaign Performance', supportsTimeWindow: true },
  { value: 'campaign_never_received', label: 'Never Received Campaign', type: 'boolean', group: 'Campaign Performance' },
  { value: 'campaign_last_received_date', label: 'Last Campaign Received', type: 'date', group: 'Campaign Performance', supportsTimeWindow: true },
  { value: 'campaign_delivery_rate', label: 'Delivery Rate (%)', type: 'number', group: 'Campaign Performance' },
  { value: 'campaign_read_rate', label: 'Read Rate (%)', type: 'number', group: 'Campaign Performance' },
  { value: 'campaign_last_converted_at', label: 'Last Conversion Date', type: 'date', group: 'Campaign Performance', supportsTimeWindow: true },

  // ─── Journey Status ───
  { value: 'journey_completed_specific', label: 'Completed Specific Journey', type: 'text', group: 'Journey Status', entityType: 'journey', supportsSubFilters: true, supportsTimeWindow: true },
  { value: 'journey_active_in', label: 'Currently in Journey', type: 'text', group: 'Journey Status', entityType: 'journey' },
  { value: 'journey_dropped_off', label: 'Dropped Off Journey', type: 'text', group: 'Journey Status', entityType: 'journey', supportsTimeWindow: true },
  { value: 'journey_enrollment_count', label: 'Total Enrollments', type: 'number', group: 'Journey Status' },
  { value: 'journey_completion_rate', label: 'Completion Rate (%)', type: 'number', group: 'Journey Status' },
  { value: 'journey_enrolled_date', label: 'Enrollment Date', type: 'date', group: 'Journey Status', entityType: 'journey', supportsTimeWindow: true },
  { value: 'journey_never_enrolled', label: 'Never Enrolled', type: 'boolean', group: 'Journey Status' },
  { value: 'journey_current_node', label: 'Current Node', type: 'text', group: 'Journey Status' },

  // ─── Flow Interactions ───
  { value: 'flow_completed_specific', label: 'Completed Specific Flow', type: 'text', group: 'Flow Interactions', entityType: 'flow', supportsSubFilters: true, supportsTimeWindow: true },
  { value: 'flow_started_specific', label: 'Started Specific Flow', type: 'text', group: 'Flow Interactions', entityType: 'flow', supportsTimeWindow: true },
  { value: 'flow_dropout', label: 'Dropped Off Flow', type: 'text', group: 'Flow Interactions', entityType: 'flow', supportsTimeWindow: true },
  { value: 'flow_response_value', label: 'Flow Response Contains', type: 'text', group: 'Flow Interactions', entityType: 'flow' },
  { value: 'flow_total_completed', label: 'Total Flows Completed', type: 'number', group: 'Flow Interactions' },
  { value: 'flow_last_interaction', label: 'Last Flow Interaction', type: 'date', group: 'Flow Interactions', supportsTimeWindow: true },

  // ─── Chat & Conversations ───
  { value: 'chat_has_open_conversation', label: 'Has Open Conversation', type: 'boolean', group: 'Chat & Conversations' },
  { value: 'chat_assigned_to_agent', label: 'Assigned to Agent', type: 'text', group: 'Chat & Conversations', entityType: 'agent' },
  { value: 'chat_conversation_count', label: 'Conversation Count', type: 'number', group: 'Chat & Conversations' },
  { value: 'chat_avg_resolution_time', label: 'Avg Resolution Time (hrs)', type: 'number', group: 'Chat & Conversations' },
  { value: 'chat_last_conversation_date', label: 'Last Conversation Date', type: 'date', group: 'Chat & Conversations', supportsTimeWindow: true },
  { value: 'chat_unread_count', label: 'Unread Messages', type: 'number', group: 'Chat & Conversations' },
  { value: 'chat_last_closed_date', label: 'Last Conversation Closed', type: 'date', group: 'Chat & Conversations', supportsTimeWindow: true },

  // ─── Contact Enrichment ───
  { value: 'contact_created_date', label: 'Contact Created Date', type: 'date', group: 'Contact Enrichment', supportsTimeWindow: true },
  { value: 'contact_custom_field', label: 'Custom Field Value', type: 'text', group: 'Contact Enrichment', entityType: 'custom_field' },
  { value: 'contact_has_email', label: 'Has Email', type: 'boolean', group: 'Contact Enrichment' },
  { value: 'contact_has_shopify_link', label: 'Linked to Shopify', type: 'boolean', group: 'Contact Enrichment' },
  { value: 'contact_tags', label: 'Contact Tags', type: 'tags', group: 'Contact Enrichment' },
  { value: 'contact_has_phone', label: 'Has Phone Number', type: 'boolean', group: 'Contact Enrichment' },

  // ─── Engagement ───
  { value: 'whatsapp_messages_received', label: 'WhatsApp Messages Received', type: 'number', group: 'Engagement', supportsTimeWindow: true },
  { value: 'whatsapp_messages_opened', label: 'WhatsApp Messages Opened', type: 'number', group: 'Engagement', supportsTimeWindow: true },
  { value: 'whatsapp_messages_clicked', label: 'WhatsApp Messages Clicked', type: 'number', group: 'Engagement', supportsTimeWindow: true },
  { value: 'last_message_sent', label: 'Last Message Sent', type: 'date', group: 'Engagement', supportsTimeWindow: true },
  { value: 'campaign_opens', label: 'Campaign Opens', type: 'number', group: 'Engagement', supportsTimeWindow: true },
  { value: 'campaign_clicks', label: 'Campaign Clicks', type: 'number', group: 'Engagement', supportsTimeWindow: true },
  { value: 'engaged_campaign_id', label: 'Engaged with Campaign', type: 'text', group: 'Engagement', entityType: 'campaign' },
  { value: 'received_template', label: 'Received Template', type: 'text', group: 'Engagement', entityType: 'template' },
  { value: 'accepts_marketing', label: 'Accepts Marketing', type: 'boolean', group: 'Engagement' },

  // ─── Behavioral ───
  { value: 'cart_abandonment_count', label: 'Cart Abandonment Count', type: 'number', group: 'Behavioral', supportsTimeWindow: true },
  { value: 'last_abandoned_cart_date', label: 'Last Abandoned Cart Date', type: 'date', group: 'Behavioral', supportsTimeWindow: true },
  { value: 'last_seen', label: 'Last Seen', type: 'date', group: 'Behavioral', supportsTimeWindow: true },
  { value: 'in_journey', label: 'Enrolled in Journey', type: 'text', group: 'Behavioral', entityType: 'journey' },
  { value: 'in_segment', label: 'Belongs to Segment', type: 'text', group: 'Behavioral', entityType: 'segment' },

  // ─── RFM Analysis ───
  { value: 'rfm_recency_score', label: 'RFM Recency Score', type: 'number', group: 'RFM Analysis' },
  { value: 'rfm_frequency_score', label: 'RFM Frequency Score', type: 'number', group: 'RFM Analysis' },
  { value: 'rfm_monetary_score', label: 'RFM Monetary Score', type: 'number', group: 'RFM Analysis' },

  // ─── Predictive ───
  { value: 'churn_risk', label: 'Churn Risk', type: 'number', group: 'Predictive' },
  { value: 'lifetime_value_prediction', label: 'Lifetime Value Prediction', type: 'number', group: 'Predictive' },

  // ─── Shopify Events ───
  { value: 'event_order_created', label: 'Order Created', type: 'boolean', group: 'Shopify Events', supportsTimeWindow: true, supportsFrequency: true },
  { value: 'event_order_paid', label: 'Order Paid', type: 'boolean', group: 'Shopify Events', supportsTimeWindow: true, supportsFrequency: true },
  { value: 'event_order_fulfilled', label: 'Order Fulfilled', type: 'boolean', group: 'Shopify Events', supportsTimeWindow: true },
  { value: 'event_order_cancelled', label: 'Order Cancelled', type: 'boolean', group: 'Shopify Events', supportsTimeWindow: true },
  { value: 'event_order_refunded', label: 'Order Refunded', type: 'boolean', group: 'Shopify Events', supportsTimeWindow: true },
  { value: 'event_checkout_started', label: 'Checkout Started', type: 'boolean', group: 'Shopify Events', supportsTimeWindow: true },
  { value: 'event_checkout_abandoned', label: 'Checkout Abandoned', type: 'boolean', group: 'Shopify Events', supportsTimeWindow: true },
  { value: 'event_customer_created', label: 'Customer Created', type: 'boolean', group: 'Shopify Events', supportsTimeWindow: true },
  { value: 'event_customer_updated', label: 'Customer Updated', type: 'boolean', group: 'Shopify Events', supportsTimeWindow: true },
  { value: 'event_product_viewed', label: 'Product Viewed', type: 'boolean', group: 'Shopify Events', supportsTimeWindow: true, supportsFrequency: true },
  { value: 'viewed_product', label: 'Viewed Specific Product', type: 'text', group: 'Shopify Events', entityType: 'product', supportsTimeWindow: true, supportsFrequency: true },
  { value: 'event_product_added_to_cart', label: 'Product Added to Cart', type: 'boolean', group: 'Shopify Events', supportsTimeWindow: true, supportsFrequency: true },
  { value: 'added_product_to_cart', label: 'Added Specific Product to Cart', type: 'text', group: 'Shopify Events', entityType: 'product', supportsTimeWindow: true, supportsFrequency: true },
  { value: 'event_collection_viewed', label: 'Collection Viewed', type: 'boolean', group: 'Shopify Events', supportsTimeWindow: true },
  { value: 'event_subscription_created', label: 'Subscription Created', type: 'boolean', group: 'Shopify Events', status: 'requires_app', supportsTimeWindow: true },
  { value: 'event_subscription_renewed', label: 'Subscription Renewed', type: 'boolean', group: 'Shopify Events', status: 'requires_app', supportsTimeWindow: true },
  { value: 'event_subscription_cancelled', label: 'Subscription Cancelled', type: 'boolean', group: 'Shopify Events', status: 'requires_app', supportsTimeWindow: true },
];

export const SEGMENT_OPERATORS: Record<SegmentFieldType, { value: string; label: string }[]> = {
  text: [
    { value: 'contains', label: 'contains' },
    { value: 'starts_with', label: 'starts with' },
    { value: 'ends_with', label: 'ends with' },
    { value: 'equals', label: 'equals' },
    { value: 'not_equals', label: 'not equals' },
    { value: 'in', label: 'is one of' },
    { value: 'not_in', label: 'is not one of' },
    { value: 'is_empty', label: 'is empty' },
    { value: 'is_not_empty', label: 'is not empty' },
  ],
  number: [
    { value: 'equals', label: '=' },
    { value: 'greater_than', label: '>' },
    { value: 'less_than', label: '<' },
    { value: 'greater_than_or_equal', label: '>=' },
    { value: 'less_than_or_equal', label: '<=' },
    { value: 'between', label: 'between' },
  ],
  date: [
    { value: 'in_last_days', label: 'in last X days' },
    { value: 'in_last_weeks', label: 'in last X weeks' },
    { value: 'in_last_months', label: 'in last X months' },
    { value: 'after_date', label: 'after date' },
    { value: 'before_date', label: 'before date' },
    { value: 'equals', label: 'on date' },
  ],
  tags: [
    { value: 'contains', label: 'contains' },
    { value: 'not_contains', label: 'does not contain' },
  ],
  boolean: [
    { value: 'is_true', label: 'is true' },
    { value: 'is_false', label: 'is false' },
  ],
};

/** Category display order and icons (Lucide icon names) */
export const SEGMENT_FIELD_GROUPS: { name: string; icon: string }[] = [
  { name: 'Customer Attributes', icon: 'User' },
  { name: 'Order History', icon: 'ShoppingCart' },
  { name: 'Advanced Orders', icon: 'Package' },
  { name: 'WhatsApp Channel', icon: 'MessageCircle' },
  { name: 'Campaign Performance', icon: 'Target' },
  { name: 'Journey Status', icon: 'GitBranch' },
  { name: 'Flow Interactions', icon: 'Zap' },
  { name: 'Chat & Conversations', icon: 'MessageSquare' },
  { name: 'Contact Enrichment', icon: 'Contact' },
  { name: 'Engagement', icon: 'Activity' },
  { name: 'Behavioral', icon: 'MousePointer' },
  { name: 'RFM Analysis', icon: 'BarChart3' },
  { name: 'Predictive', icon: 'Brain' },
  { name: 'Shopify Events', icon: 'ShoppingBag' },
];

/** Group SEGMENT_FIELD_OPTIONS by their group property */
export function getFieldOptionsByGroup(): Record<string, SegmentFieldOption[]> {
  return SEGMENT_FIELD_OPTIONS.reduce((acc, field) => {
    if (!acc[field.group]) acc[field.group] = [];
    acc[field.group].push(field);
    return acc;
  }, {} as Record<string, SegmentFieldOption[]>);
}

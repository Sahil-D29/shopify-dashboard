export type SegmentFieldType = 'text' | 'number' | 'date' | 'tags' | 'boolean';

export interface SegmentFieldOption {
  value: string;
  label: string;
  type: SegmentFieldType;
  group: string;
}

export const SEGMENT_FIELD_OPTIONS: SegmentFieldOption[] = [
  // Customer Attributes
  { value: 'customer_name', label: 'Customer Name', type: 'text', group: 'Customer Attributes' },
  { value: 'customer_email', label: 'Email', type: 'text', group: 'Customer Attributes' },
  { value: 'customer_phone', label: 'Phone', type: 'text', group: 'Customer Attributes' },
  { value: 'customer_tags', label: 'Tags', type: 'tags', group: 'Customer Attributes' },
  { value: 'location_country', label: 'Country', type: 'text', group: 'Customer Attributes' },
  { value: 'location_city', label: 'City', type: 'text', group: 'Customer Attributes' },
  { value: 'location_state', label: 'State', type: 'text', group: 'Customer Attributes' },
  { value: 'location_postal_code', label: 'Postal Code', type: 'text', group: 'Customer Attributes' },
  { value: 'customer_since', label: 'Customer Since', type: 'date', group: 'Customer Attributes' },
  { value: 'marketing_opt_in', label: 'Marketing Opt-in', type: 'boolean', group: 'Customer Attributes' },
  { value: 'sms_opt_in', label: 'SMS Opt-in', type: 'boolean', group: 'Customer Attributes' },
  { value: 'email_opt_in', label: 'Email Opt-in', type: 'boolean', group: 'Customer Attributes' },

  // Order History
  { value: 'total_orders', label: 'Total Orders', type: 'number', group: 'Order History' },
  { value: 'total_spent', label: 'Total Spent', type: 'number', group: 'Order History' },
  { value: 'average_order_value', label: 'Average Order Value', type: 'number', group: 'Order History' },
  { value: 'first_order_date', label: 'First Order Date', type: 'date', group: 'Order History' },
  { value: 'last_order_date', label: 'Last Order Date', type: 'date', group: 'Order History' },
  { value: 'days_since_last_order', label: 'Days Since Last Order', type: 'number', group: 'Order History' },
  { value: 'orders_in_last_x_days', label: 'Orders in Last X Days', type: 'number', group: 'Order History' },
  { value: 'total_items_purchased', label: 'Total Items Purchased', type: 'number', group: 'Order History' },
  { value: 'never_ordered', label: 'Never Ordered', type: 'boolean', group: 'Order History' },
  { value: 'ordered_specific_product', label: 'Ordered Specific Product', type: 'text', group: 'Order History' },

  // Engagement
  { value: 'whatsapp_messages_received', label: 'WhatsApp Messages Received', type: 'number', group: 'Engagement' },
  { value: 'whatsapp_messages_opened', label: 'WhatsApp Messages Opened', type: 'number', group: 'Engagement' },
  { value: 'whatsapp_messages_clicked', label: 'WhatsApp Messages Clicked', type: 'number', group: 'Engagement' },
  { value: 'last_message_sent', label: 'Last Message Sent', type: 'date', group: 'Engagement' },
  { value: 'campaign_opens', label: 'Campaign Opens', type: 'number', group: 'Engagement' },
  { value: 'campaign_clicks', label: 'Campaign Clicks', type: 'number', group: 'Engagement' },
  { value: 'accepts_marketing', label: 'Accepts Marketing', type: 'boolean', group: 'Engagement' },

  // Behavioral
  { value: 'cart_abandonment_count', label: 'Cart Abandonment Count', type: 'number', group: 'Behavioral' },
  { value: 'last_abandoned_cart_date', label: 'Last Abandoned Cart Date', type: 'date', group: 'Behavioral' },
  { value: 'last_seen', label: 'Last Seen', type: 'date', group: 'Behavioral' },

  // RFM Analysis
  { value: 'rfm_recency_score', label: 'RFM Recency Score', type: 'number', group: 'RFM Analysis' },
  { value: 'rfm_frequency_score', label: 'RFM Frequency Score', type: 'number', group: 'RFM Analysis' },
  { value: 'rfm_monetary_score', label: 'RFM Monetary Score', type: 'number', group: 'RFM Analysis' },

  // Predictive
  { value: 'churn_risk', label: 'Churn Risk', type: 'number', group: 'Predictive' },
  { value: 'lifetime_value_prediction', label: 'Lifetime Value Prediction', type: 'number', group: 'Predictive' },
];

export const SEGMENT_OPERATORS: Record<SegmentFieldType, { value: string; label: string }[]> = {
  text: [
    { value: 'contains', label: 'contains' },
    { value: 'starts_with', label: 'starts with' },
    { value: 'ends_with', label: 'ends with' },
    { value: 'equals', label: 'equals' },
    { value: 'not_equals', label: 'not equals' },
    { value: 'is_empty', label: 'is empty' },
    { value: 'is_not_empty', label: 'is not empty' },
  ],
  number: [
    { value: 'equals', label: '=' },
    { value: 'greater_than', label: '>' },
    { value: 'less_than', label: '<' },
    { value: 'between', label: 'between' },
  ],
  date: [
    { value: 'in_last_days', label: 'in last X days' },
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

/** Group SEGMENT_FIELD_OPTIONS by their group property */
export function getFieldOptionsByGroup(): Record<string, SegmentFieldOption[]> {
  return SEGMENT_FIELD_OPTIONS.reduce((acc, field) => {
    if (!acc[field.group]) acc[field.group] = [];
    acc[field.group].push(field);
    return acc;
  }, {} as Record<string, SegmentFieldOption[]>);
}

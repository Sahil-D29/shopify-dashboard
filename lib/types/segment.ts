export type SegmentType = 'DYNAMIC' | 'STATIC' | 'custom';

export type ConditionField =
  // Customer Attributes
  | 'customer_name'
  | 'customer_email'
  | 'customer_phone'
  | 'customer_tags'
  | 'location_country'
  | 'location_city'
  | 'location_state'
  | 'location_postal_code'
  | 'location_address'
  | 'customer_since'
  | 'marketing_opt_in'
  | 'sms_opt_in'
  | 'email_opt_in'
  // Order History
  | 'total_orders'
  | 'total_spent'
  | 'average_order_value'
  | 'first_order_date'
  | 'last_order_date'
  | 'days_since_last_order'
  | 'orders_in_last_x_days'
  | 'total_items_purchased'
  | 'favorite_product_category'
  | 'never_ordered'
  | 'ordered_specific_product'
  | 'ordered_from_collection'
  // Advanced Order Filters
  | 'ordered_product_vendor'
  | 'ordered_product_type'
  | 'order_discount_code'
  | 'order_shipping_method'
  | 'order_payment_method'
  | 'order_fulfillment_status'
  | 'order_financial_status'
  | 'clv_tier'
  | 'repeat_product_buyer'
  | 'order_currency'
  // Engagement
  | 'whatsapp_messages_received'
  | 'whatsapp_messages_opened'
  | 'whatsapp_messages_clicked'
  | 'last_message_sent'
  | 'campaign_opens'
  | 'campaign_clicks'
  | 'journey_enrollment_status'
  | 'journey_completion_status'
  // WhatsApp Channel
  | 'wa_last_message_status'
  | 'wa_conversation_state'
  | 'wa_reply_rate'
  | 'wa_avg_response_time'
  | 'wa_has_active_conversation'
  | 'wa_message_frequency'
  | 'wa_last_inbound_message'
  | 'wa_last_outbound_message'
  | 'wa_total_conversations'
  | 'wa_opted_in'
  | 'wa_opt_in_date'
  | 'wa_contact_source'
  // Campaign Performance
  | 'campaign_received_specific'
  | 'campaign_opened_specific'
  | 'campaign_clicked_specific'
  | 'campaign_converted_specific'
  | 'campaign_total_received'
  | 'campaign_never_received'
  | 'campaign_last_received_date'
  | 'campaign_delivery_rate'
  | 'campaign_read_rate'
  | 'campaign_last_converted_at'
  // Journey Status
  | 'journey_completed_specific'
  | 'journey_active_in'
  | 'journey_dropped_off'
  | 'journey_enrollment_count'
  | 'journey_completion_rate'
  | 'journey_enrolled_date'
  | 'journey_never_enrolled'
  | 'journey_current_node'
  // Flow Interactions
  | 'flow_completed_specific'
  | 'flow_started_specific'
  | 'flow_dropout'
  | 'flow_response_value'
  | 'flow_total_completed'
  | 'flow_last_interaction'
  // Chat & Conversations
  | 'chat_has_open_conversation'
  | 'chat_assigned_to_agent'
  | 'chat_conversation_count'
  | 'chat_avg_resolution_time'
  | 'chat_last_conversation_date'
  | 'chat_unread_count'
  | 'chat_last_closed_date'
  // Contact Enrichment
  | 'contact_created_date'
  | 'contact_custom_field'
  | 'contact_has_email'
  | 'contact_has_shopify_link'
  | 'contact_tags'
  | 'contact_has_phone'
  // Behavioral
  | 'cart_abandonment_count'
  | 'last_abandoned_cart_date'
  | 'website_visits'
  | 'average_session_duration'
  | 'last_seen'
  // RFM
  | 'rfm_recency_score'
  | 'rfm_frequency_score'
  | 'rfm_monetary_score'
  | 'rfm_segment'
  // Predictive
  | 'churn_risk'
  | 'lifetime_value_prediction'
  | 'next_purchase_probability'
  // Legacy
  | 'purchased_product'
  | 'purchased_category'
  | 'cart_abandoned'
  | 'email_opened'
  | 'email_clicked'
  | 'accepts_marketing';

export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'greater_than'
  | 'less_than'
  | 'greater_than_or_equal'
  | 'less_than_or_equal'
  | 'between'
  | 'is_empty'
  | 'is_not_empty'
  | 'in_last_days'
  | 'in_last_weeks'
  | 'in_last_months'
  | 'before_date'
  | 'after_date'
  | 'is_true'
  | 'is_false'
  | 'in'
  | 'not_in';

export type LogicalOperator = 'AND' | 'OR';

// Sub-filter system for nested conditions
export interface TimeWindow {
  amount: number;
  unit: 'days' | 'weeks' | 'months';
}

export interface FrequencyQualifier {
  type: 'at_least' | 'at_most' | 'exactly';
  count: number;
}

export interface SubFilter {
  id: string;
  property: string;
  operator: ConditionOperator;
  value: string | number | string[];
}

export interface SegmentCondition {
  id: string;
  field: ConditionField;
  operator: ConditionOperator;
  value: string | number | string[];
  logicalOperator: LogicalOperator;
  // Sub-filter system
  subFilters?: SubFilter[];
  subFilterOperator?: LogicalOperator;
  timeWindow?: TimeWindow;
  frequency?: FrequencyQualifier;
}

export interface SegmentGroup {
  id: string;
  conditions: SegmentCondition[];
  groupOperator: LogicalOperator;
}

export interface CustomerSegment {
  id: string;
  name: string;
  description?: string;
  type: SegmentType;

  // Conditions (for DYNAMIC segments)
  conditionGroups?: SegmentGroup[];

  // Custom audience (for CUSTOM segments)
  customerIds?: string[];
  source?: 'manual' | 'csv_import' | 'excel_import';
  importMetadata?: {
    filename?: string;
    uploadedBy?: string;
    uploadedAt?: number;
    totalRows?: number;
    importedRows?: number;
    skippedRows?: number;
  };

  // Analytics
  customerCount: number;
  totalRevenue: number;
  averageOrderValue: number;

  // Metadata
  createdAt: number;
  updatedAt: number;
  lastCalculated?: number;

  // Folder organization
  folderId?: string;

  // Status
  isArchived: boolean;

  // Store ID (for multi-store)
  storeId?: string;
}

export interface SegmentTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  conditionGroups: SegmentGroup[];
}

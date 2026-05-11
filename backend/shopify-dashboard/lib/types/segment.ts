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
  // Engagement
  | 'whatsapp_messages_received'
  | 'whatsapp_messages_opened'
  | 'whatsapp_messages_clicked'
  | 'last_message_sent'
  | 'campaign_opens'
  | 'campaign_clicks'
  | 'journey_enrollment_status'
  | 'journey_completion_status'
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
  | 'between'
  | 'is_empty'
  | 'is_not_empty'
  | 'in_last_days'
  | 'before_date'
  | 'after_date';

export type LogicalOperator = 'AND' | 'OR';

export interface SegmentCondition {
  id: string;
  field: ConditionField;
  operator: ConditionOperator;
  value: string | number | string[];
  logicalOperator: LogicalOperator;
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


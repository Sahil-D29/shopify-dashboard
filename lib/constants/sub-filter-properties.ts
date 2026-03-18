import type { ConditionOperator } from '@/lib/types/segment';

export type SubFilterPropertyType = 'text' | 'number' | 'date';

export interface SubFilterProperty {
  name: string;
  label: string;
  type: SubFilterPropertyType;
  parentCategory: 'order' | 'campaign' | 'journey' | 'flow';
}

/** Sub-filter properties available for each parent category */
export const SUB_FILTER_PROPERTIES: SubFilterProperty[] = [
  // Order sub-filters
  { name: 'product_name', label: 'Product Name', type: 'text', parentCategory: 'order' },
  { name: 'product_price', label: 'Product Price', type: 'number', parentCategory: 'order' },
  { name: 'product_vendor', label: 'Vendor', type: 'text', parentCategory: 'order' },
  { name: 'product_type', label: 'Product Type', type: 'text', parentCategory: 'order' },
  { name: 'order_total', label: 'Order Total', type: 'number', parentCategory: 'order' },
  { name: 'discount_code', label: 'Discount Code', type: 'text', parentCategory: 'order' },
  { name: 'quantity', label: 'Quantity', type: 'number', parentCategory: 'order' },
  { name: 'sku', label: 'SKU', type: 'text', parentCategory: 'order' },
  { name: 'fulfillment_status', label: 'Fulfillment Status', type: 'text', parentCategory: 'order' },

  // Campaign sub-filters
  { name: 'template_name', label: 'Template Name', type: 'text', parentCategory: 'campaign' },
  { name: 'campaign_type', label: 'Campaign Type', type: 'text', parentCategory: 'campaign' },
  { name: 'send_date', label: 'Send Date', type: 'date', parentCategory: 'campaign' },
  { name: 'delivery_status', label: 'Delivery Status', type: 'text', parentCategory: 'campaign' },

  // Journey sub-filters
  { name: 'enrollment_date', label: 'Enrollment Date', type: 'date', parentCategory: 'journey' },
  { name: 'completion_date', label: 'Completion Date', type: 'date', parentCategory: 'journey' },
  { name: 'current_node', label: 'Current Node', type: 'text', parentCategory: 'journey' },
  { name: 'journey_status', label: 'Status', type: 'text', parentCategory: 'journey' },

  // Flow sub-filters
  { name: 'screen_id', label: 'Screen ID', type: 'text', parentCategory: 'flow' },
  { name: 'response_value', label: 'Response Value', type: 'text', parentCategory: 'flow' },
  { name: 'completion_date', label: 'Completion Date', type: 'date', parentCategory: 'flow' },
];

/** Map parent field names to their sub-filter category */
export const FIELD_TO_SUBFILTER_CATEGORY: Record<string, 'order' | 'campaign' | 'journey' | 'flow'> = {
  // Order fields
  ordered_specific_product: 'order',
  ordered_from_collection: 'order',
  ordered_product_vendor: 'order',
  ordered_product_type: 'order',
  order_discount_code: 'order',
  // Campaign fields
  campaign_received_specific: 'campaign',
  campaign_opened_specific: 'campaign',
  campaign_clicked_specific: 'campaign',
  campaign_converted_specific: 'campaign',
  // Journey fields
  journey_completed_specific: 'journey',
  journey_active_in: 'journey',
  journey_dropped_off: 'journey',
  // Flow fields
  flow_completed_specific: 'flow',
  flow_started_specific: 'flow',
  flow_dropout: 'flow',
};

/** Get available sub-filter properties for a given parent field */
export function getSubFilterProperties(parentField: string): SubFilterProperty[] {
  const category = FIELD_TO_SUBFILTER_CATEGORY[parentField];
  if (!category) return [];
  return SUB_FILTER_PROPERTIES.filter(p => p.parentCategory === category);
}

/** Get operators available for a sub-filter property type */
export function getSubFilterOperators(type: SubFilterPropertyType): { value: string; label: string }[] {
  switch (type) {
    case 'text':
      return [
        { value: 'equals', label: 'equals' },
        { value: 'not_equals', label: 'not equals' },
        { value: 'contains', label: 'contains' },
        { value: 'starts_with', label: 'starts with' },
        { value: 'is_empty', label: 'is empty' },
        { value: 'is_not_empty', label: 'is not empty' },
      ];
    case 'number':
      return [
        { value: 'equals', label: '=' },
        { value: 'greater_than', label: '>' },
        { value: 'less_than', label: '<' },
        { value: 'greater_than_or_equal', label: '>=' },
        { value: 'less_than_or_equal', label: '<=' },
        { value: 'between', label: 'between' },
      ];
    case 'date':
      return [
        { value: 'in_last_days', label: 'in last X days' },
        { value: 'after_date', label: 'after date' },
        { value: 'before_date', label: 'before date' },
      ];
  }
}

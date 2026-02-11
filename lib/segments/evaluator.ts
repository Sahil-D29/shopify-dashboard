import type { SegmentGroup, SegmentCondition } from '@/lib/types/segment';
import type { ShopifyCustomer } from '@/lib/types/shopify-customer';

function getPrimaryAddress(customer: ShopifyCustomer) {
  if (!customer.addresses || customer.addresses.length === 0) return undefined;
  const def = customer.addresses.find(a => a.default);
  return def || customer.addresses[0];
}

type ConditionPrimitive = string | number | boolean | null | undefined;
type ConditionValue = ConditionPrimitive | ConditionPrimitive[];

const isString = (value: unknown): value is string => typeof value === 'string';
const normalizeString = (value: unknown): string | undefined =>
  isString(value) ? value.toLowerCase() : undefined;

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const toTimestamp = (value: unknown): number | undefined => {
  const date = value instanceof Date ? value : value ? new Date(String(value)) : null;
  const timestamp = date?.getTime();
  return typeof timestamp === 'number' && Number.isFinite(timestamp) ? timestamp : undefined;
};

function getFieldValue(customer: ShopifyCustomer, field: string): ConditionValue {
  const addr = getPrimaryAddress(customer);
  switch (field) {
    // Customer Attributes
    case 'customer_name':
      return `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
    case 'customer_email':
      return customer.email || '';
    case 'customer_phone':
      return customer.phone || '';
    case 'customer_tags':
      return customer.tags || '';
    case 'location_country':
      return addr?.country || '';
    case 'location_city':
      return addr?.city || '';
    case 'location_state':
      return addr?.province || '';
    case 'location_postal_code':
      return addr?.zip || '';
    case 'location_address':
      return addr ? `${(addr as any).address1 || ''} ${(addr as any).address2 || ''}`.trim() : '';
    case 'customer_since':
      return customer.created_at ? new Date(customer.created_at).getTime() : undefined;
    case 'marketing_opt_in':
    case 'accepts_marketing':
      return !!(customer as any).accepts_marketing || !!(customer as any).verified_email;
    case 'sms_opt_in':
      // Not directly available, would need custom field
      return false;
    case 'email_opt_in':
      return !!(customer as any).accepts_marketing || !!(customer as any).verified_email;
    
    // Order History
    case 'total_orders':
      return Number(customer.orders_count || 0);
    case 'total_spent':
      return Number(customer.total_spent || 0);
    case 'average_order_value': {
      const orders = Number(customer.orders_count || 0);
      const spent = Number(customer.total_spent || 0);
      return orders > 0 ? spent / orders : 0;
    }
    case 'first_order_date':
    case 'last_order_date':
      // Use updated_at as proxy for last activity
      return customer.updated_at ? new Date(customer.updated_at).getTime() : undefined;
    case 'days_since_last_order': {
      const ts = customer.updated_at ? new Date(customer.updated_at).getTime() : 0;
      return ts > 0 ? Math.floor((Date.now() - ts) / 86400000) : 999;
    }
    case 'orders_in_last_x_days':
      // Would need order data, return 0 for now
      return 0;
    case 'total_items_purchased':
      // Would need order data, return 0 for now
      return 0;
    case 'favorite_product_category':
      // Would need order/product data
      return '';
    case 'never_ordered':
      return Number(customer.orders_count || 0) === 0;
    case 'ordered_specific_product':
    case 'ordered_from_collection':
      // Would need order/product data
      return false;
    
    // Engagement (would need message/campaign data)
    case 'whatsapp_messages_received':
    case 'whatsapp_messages_opened':
    case 'whatsapp_messages_clicked':
    case 'campaign_opens':
    case 'campaign_clicks':
      return 0;
    case 'last_message_sent':
      return undefined;
    case 'journey_enrollment_status':
    case 'journey_completion_status':
      return '';
    
    // Behavioral (would need tracking data)
    case 'cart_abandonment_count':
    case 'website_visits':
    case 'average_session_duration':
      return 0;
    case 'last_abandoned_cart_date':
    case 'last_seen':
      return undefined;
    
    // RFM (would need RFM calculation)
    case 'rfm_recency_score':
    case 'rfm_frequency_score':
    case 'rfm_monetary_score':
      return 0;
    case 'rfm_segment':
      return '';
    
    // Predictive (would need ML models)
    case 'churn_risk':
      return '';
    case 'lifetime_value_prediction':
    case 'next_purchase_probability':
      return 0;
    
    // Legacy
    case 'purchased_product':
    case 'purchased_category':
      return false;
    case 'cart_abandoned':
      return false;
    case 'email_opened':
    case 'email_clicked':
      return false;
    
    default:
      return undefined;
  }
}

function opCompare(value: ConditionValue, operator: string, target: ConditionValue): boolean {
  // Normalize strings case-insensitively
  const valueLower = normalizeString(value);
  const targetLower = normalizeString(target);

  switch (operator) {
    case 'equals':
      return valueLower !== undefined && targetLower !== undefined ? valueLower === targetLower : value === target;
    case 'not_equals':
      return valueLower !== undefined && targetLower !== undefined ? valueLower !== targetLower : value !== target;
    case 'contains':
      return valueLower !== undefined && targetLower !== undefined ? valueLower.includes(targetLower) : false;
    case 'not_contains':
      return valueLower !== undefined && targetLower !== undefined ? !valueLower.includes(targetLower) : false;
    case 'starts_with':
      return valueLower !== undefined && targetLower !== undefined ? valueLower.startsWith(targetLower) : false;
    case 'ends_with':
      return valueLower !== undefined && targetLower !== undefined ? valueLower.endsWith(targetLower) : false;
    case 'greater_than': {
      const valueNumber = toNumber(value);
      const targetNumber = toNumber(target);
      return valueNumber !== undefined && targetNumber !== undefined && valueNumber > targetNumber;
    }
    case 'less_than': {
      const valueNumber = toNumber(value);
      const targetNumber = toNumber(target);
      return valueNumber !== undefined && targetNumber !== undefined && valueNumber < targetNumber;
    }
    case 'between': {
      const range = Array.isArray(target) ? target : String(target ?? '').split(',');
      if (range.length < 2) return false;
      const [min, max] = range.map(toNumber);
      const valueNumber = toNumber(value);
      return (
        valueNumber !== undefined &&
        min !== undefined &&
        max !== undefined &&
        valueNumber >= min &&
        valueNumber <= max
      );
    }
    case 'is_empty':
      return value === undefined || value === null || (typeof value === 'string' && value.trim().length === 0);
    case 'is_not_empty':
      return !(value === undefined || value === null || (typeof value === 'string' && value.trim().length === 0));
    case 'in_last_days': {
      const days = toNumber(target);
      if (days === undefined) return false;
      const since = Date.now() - days * 86400000;
      const valueTimestamp = toTimestamp(value);
      return typeof since === 'number' && valueTimestamp !== undefined && valueTimestamp >= since;
    }
    case 'before_date':
      return (toTimestamp(value) ?? Number.POSITIVE_INFINITY) < (toTimestamp(target) ?? Number.NEGATIVE_INFINITY);
    case 'after_date':
      return (toTimestamp(value) ?? Number.NEGATIVE_INFINITY) > (toTimestamp(target) ?? Number.POSITIVE_INFINITY);
    default:
      return false;
  }
}

export function evaluateCondition(customer: ShopifyCustomer, condition: SegmentCondition): boolean {
  const value = getFieldValue(customer, condition.field);
  return opCompare(value, condition.operator, condition.value);
}

export function matchesGroups(customer: ShopifyCustomer, groups: SegmentGroup[]): boolean {
  if (!groups || groups.length === 0) return true;
  // Evaluate groups: groupOperator combines conditions within; overall reduce with AND across groups
  return groups.every(group => {
    const { conditions, groupOperator } = group;
    if (!conditions || conditions.length === 0) return true;
    if (groupOperator === 'OR') {
      return conditions.some(c => evaluateCondition(customer, c));
    }
    // AND
    return conditions.every(c => evaluateCondition(customer, c));
  });
}



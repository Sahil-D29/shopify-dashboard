export type TriggerSourceCategory = 'segment' | 'shopify_event' | 'time_based' | 'manual';

export type SegmentTriggerMode = 'enter' | 'exit';

export type ShopifyEventTriggerType =
  | 'product_viewed'
  | 'cart_abandoned'
  | 'order_placed'
  | 'customer_created'
  | 'product_added_to_cart'
  | 'checkout_started'
  | 'custom_event'
  | 'price_drop'
  | 'back_in_stock'
  | 'browse_abandonment'
  | 'cod_order_placed'
  | 'repeat_purchase'
  | 'review_requested'
  | 'subscription_created'
  | 'subscription_cancelled'
  | 'date_property_trigger'
  | 'whatsapp_reply_received'
  | 'whatsapp_button_clicked'
  | 'utm_link_clicked'
  | 'campaign_opened';

export type TimeBasedTriggerType = 'specific_datetime' | 'recurring_schedule' | 'attribute_date';

export type ManualTriggerMode = 'api' | 'csv';

export type DurationUnit = 'minutes' | 'hours' | 'days' | 'weeks';

export interface DurationValue {
  amount: number;
  unit: DurationUnit;
}

export interface SegmentTriggerConfig {
  mode: SegmentTriggerMode;
  segmentId?: string;
  segmentName?: string;
  estimatedAudience?: number | null;
}

export type EventFilterOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'greater_than'
  | 'less_than'
  | 'between'
  | 'is_set'
  | 'is_not_set'
  | 'starts_with'
  | 'ends_with'
  | 'in'
  | 'not_in';

export type PropertyInputType = 'text' | 'number' | 'date' | 'boolean' | 'multi-select' | 'currency';

export interface EventFilterCondition {
  id: string;
  property: string;
  operator: EventFilterOperator;
  value?: string | number | boolean | Array<string | number> | null;
  valueTo?: string | number | null;
  propertyType?: PropertyInputType;
  label?: string;
}

export interface EventFilterGroup {
  id: string;
  combinator: 'AND' | 'OR';
  conditions: EventFilterCondition[];
  groups?: EventFilterGroup[];
}

export interface ProductSelectionConfig {
  mode: 'any' | 'specific' | 'collections';
  productIds: string[];
  collectionIds: string[];
  summary?: string;
}

export interface ShopifyEventTriggerConfig {
  eventType: ShopifyEventTriggerType;
  productSelection?: ProductSelectionConfig;
  filters?: EventFilterGroup;
  advanced?: {
    viewCountThreshold?: {
      enabled: boolean;
      threshold: number;
      window: DurationValue;
    };
    // timeWindow is only used for cart_abandoned event (as abandonment window)
    // For other events (order_placed, product_viewed), triggers fire immediately
    abandonmentWindow?: DurationValue; // Only for cart_abandoned - how long cart has been abandoned
    excludeRecoveredCarts?: boolean;
    excludeIfOrderPlaced?: boolean;
    includeProducts?: ProductSelectionConfig;
    minimumCartValue?: number | null;
    orderValueRange?: {
      min?: number | null;
      max?: number | null;
    };
    statuses?: string[];
    firstOrderOnly?: boolean;
    repeatCustomerOnly?: boolean;
    discountCodeFilter?: 'any' | 'used' | 'not_used';
  };
  customEventName?: string;
}

export interface SpecificDateTriggerConfig {
  type: 'specific_datetime';
  startsAt?: string;
  timezone?: string;
}

export interface RecurringScheduleTriggerConfig {
  type: 'recurring_schedule';
  cadence: 'daily' | 'weekly' | 'monthly';
  daysOfWeek?: string[];
  dayOfMonth?: number | null;
  timeOfDay?: string; // HH:mm
  timezone?: string;
}

export interface AttributeDateTriggerConfig {
  type: 'attribute_date';
  attributeKey?: string;
  offset?: DurationValue;
  timezoneBehavior?: 'customer' | 'fixed';
  fallbackTime?: string;
}

export type TimeBasedTriggerConfig =
  | SpecificDateTriggerConfig
  | RecurringScheduleTriggerConfig
  | AttributeDateTriggerConfig;

export interface ManualTriggerConfig {
  mode: ManualTriggerMode;
  notes?: string;
}

export interface EntryFrequencySettings {
  allowReentry: boolean;
  cooldown?: DurationValue | null;
  entryLimit?: number | null;
}

export interface EntryWindowSettings {
  startsAt?: string | null;
  endsAt?: string | null;
  timezone?: string;
}

export interface AudienceEstimate {
  dailyEntries?: number | null;
  totalAudience?: number | null;
  warnings?: string[];
  conflicts?: Array<{ journeyId: string; journeyName: string }>;
  lastCalculatedAt?: string;
}

export interface JourneyTriggerConfiguration {
  category: TriggerSourceCategory;
  segment?: SegmentTriggerConfig;
  shopifyEvent?: ShopifyEventTriggerConfig;
  timeBased?: TimeBasedTriggerConfig;
  manual?: ManualTriggerConfig;
  entryFrequency: EntryFrequencySettings;
  entryWindow?: EntryWindowSettings;
  estimate?: AudienceEstimate;
}

export type UnifiedTriggerRuleType = 'user_property' | 'user_behavior' | 'user_interests';

export type UnifiedTriggerRuleOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'does_not_contain'
  | 'greater_than'
  | 'less_than'
  | 'exists'
  | 'does_not_exist';

export interface UnifiedTriggerRuleCondition {
  property: string;
  operator: UnifiedTriggerRuleOperator;
  value?: string | number;
  label?: string;
  valueLabel?: string;
}

export type UnifiedTriggerTimeFramePeriod = 'last_30_days' | 'last_7_days' | 'last_24_hours' | 'custom';

export interface UnifiedTriggerRuleTimeFrame {
  period: UnifiedTriggerTimeFramePeriod;
  customDays?: number;
}

export interface UnifiedTriggerRule {
  ruleType: UnifiedTriggerRuleType;
  category: string;
  eventName?: string;
  conditions: UnifiedTriggerRuleCondition[];
  timeFrame?: UnifiedTriggerRuleTimeFrame;
}

export interface UnifiedTriggerRuleGroup {
  operator: 'AND' | 'OR';
  rules: UnifiedTriggerRule[];
}

export interface UnifiedTriggerTargetSegment {
  type?: 'new_segment' | 'existing_segment';
  rules?: UnifiedTriggerRule[];
  ruleGroups?: UnifiedTriggerRuleGroup[];
}

export interface UnifiedTriggerConfig {
  segmentName?: string;
  targetSegment?: UnifiedTriggerTargetSegment;
  subscriptionGroups?: string[];
}

export interface TriggerValidationIssue {
  type: 'error' | 'warning';
  message: string;
  code?: string;
  relatedNodeIds?: string[];
}

/**
 * Category of trigger rule which determines the available UI options and behaviour.
 */
export type RuleCategory = 'user_property' | 'user_behavior' | 'user_interests';

/**
 * Supported comparison operators for trigger rule conditions.
 * Operator availability is determined by the selected property type.
 */
export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'greater_than'
  | 'less_than'
  | 'greater_than_or_equal'
  | 'less_than_or_equal'
  | 'exists'
  | 'not_exists'
  | 'in'
  | 'not_in';

export interface EventCondition {
  id: string;
  property: string;
  operator: ConditionOperator;
  value: string | number | boolean | string[];
}

export interface TimeFrame {
  period: 'last_24_hours' | 'last_7_days' | 'last_30_days' | 'last_90_days' | 'custom';
  customDays?: number;
}

/**
 * CleverTap-inspired trigger rule that combines an event selection, optional timeframe, and property filters.
 */
export interface CleverTapStyleRule {
  id: string;
  ruleType: RuleCategory;
  subcategory: string;
  eventName?: string;
  eventDisplayName?: string;
  action?: 'did' | 'did_not';
  timeFrame?: TimeFrame;
  conditions: EventCondition[];
}

export interface CleverTapStyleRuleGroup {
  id: string;
  operator: 'AND' | 'OR';
  rules: CleverTapStyleRule[];
}

export interface CleverTapStyleTargetSegment {
  type: 'new_segment' | 'existing_segment';
  segmentId?: string;
  segmentName?: string;
  rules: CleverTapStyleRule[];
  ruleGroups: CleverTapStyleRuleGroup[];
}

export interface CleverTapStyleTriggerConfig {
  name: string;
  targetSegment: CleverTapStyleTargetSegment;
  subscriptionGroups?: string[];
  estimatedUserCount?: number;
}

export interface EnhancedUnifiedTriggerConfig extends UnifiedTriggerConfig {
  cleverTapStyle?: CleverTapStyleTriggerConfig;
}


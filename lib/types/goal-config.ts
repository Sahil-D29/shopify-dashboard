export type GoalType =
  | 'journey_completion'
  | 'shopify_event'
  | 'whatsapp_engagement'
  | 'custom_event'
  | 'segment_entry';

export type GoalEventOperator =
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'less_than'
  | 'between'
  | 'contains'
  | 'not_contains'
  | 'in_list';

export type GoalEventValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Array<string | number | boolean>
  | { min?: string | number; max?: string | number };

export interface GoalEventFilter {
  property: string;
  operator: GoalEventOperator;
  value: GoalEventValue;
}

export interface GoalConfig {
  goalType: GoalType;
  goalName: string;
  goalValue?: number;
  goalDescription?: string;
  goalCategory: 'conversion' | 'engagement' | 'revenue' | 'retention';
  eventName?: string;
  eventFilters?: GoalEventFilter[];
  segmentId?: string;
  attributionWindow: {
    value: number;
    unit: 'hours' | 'days';
  };
  attributionModel: 'first_touch' | 'last_touch' | 'linear';
  countMultipleConversions: boolean;
  exitAfterGoal: boolean;
  markAsCompleted: boolean;
}




export type PropertyType = "string" | "number" | "boolean" | "date" | "array" | "object";

export type OperatorType =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "greater_than"
  | "less_than"
  | "between"
  | "is_set"
  | "is_not_set"
  | "starts_with"
  | "ends_with"
  | "in_list"
  | "not_in_list";

export interface PropertyDefinition {
  id: string;
  label: string;
  type: PropertyType;
  category: "customer" | "order" | "product" | "event" | "computed";
  path: string;
  availableOperators: OperatorType[];
  description?: string;
  exampleValue?: string | number | boolean | string[];
}

export type ConditionValueType = "static" | "property" | "formula";

export type ConditionPrimitive = string | number | boolean | null | undefined;

export interface ConditionRangeValue {
  min?: ConditionPrimitive;
  max?: ConditionPrimitive;
}

export type ConditionListValue = ConditionPrimitive[];

export type ConditionValue = ConditionPrimitive | ConditionRangeValue | ConditionListValue;

export interface Condition {
  id: string;
  property?: PropertyDefinition;
  operator?: OperatorType;
  value: ConditionValue;
  valueType?: ConditionValueType;
  error?: string;
}

export interface ConditionGroup {
  id: string;
  logicalOperator: "AND" | "OR";
  conditions: Condition[];
  nestedGroups?: ConditionGroup[];
  collapsed?: boolean;
}

export interface ConditionBranchConfig {
  label: string;
  customLabel?: string;
}

export interface AudiencePreview {
  trueCount: number;
  falseCount: number;
  truePercentage: number;
  falsePercentage: number;
  totalAudience: number;
  estimatedAt?: string;
}

export interface ConditionConfig {
  type: "segment" | "property" | "event" | "product_order" | "formula";
  rootGroup: ConditionGroup;
  branches: {
    true: ConditionBranchConfig;
    false: ConditionBranchConfig;
  };
  addElseBranch: boolean;
  audiencePreview?: AudiencePreview;
  segmentConfig?: SegmentConditionConfig;
  eventConfig?: EventConditionConfig;
  formulaExpression?: string;
  productCriteria?: ConditionGroup;
}

export interface SegmentConditionConfig {
  type: "segment";
  segmentIds: string[];
  matchType: "is_in" | "is_not_in";
}

export type EventOccurrenceOperator = "at_least" | "exactly" | "at_most";

export interface EventConditionConfig {
  type: "event";
  eventName: string;
  timeWindow: {
    value: number;
    unit: "hours" | "days" | "weeks";
  };
  occurrenceCount: {
    operator: EventOccurrenceOperator;
    value: number;
  };
  eventFilters?: ConditionGroup;
}



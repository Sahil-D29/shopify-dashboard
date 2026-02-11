export type TriggerType = 'event' | 'segment' | 'api' | 'legacy';

export interface EventFilter {
  id: string;
  property: string;
  operator:
    | 'equals'
    | 'not_equals'
    | 'contains'
    | 'not_contains'
    | 'gt'
    | 'gte'
    | 'lt'
    | 'lte'
    | 'in'
    | 'not_in'
    | 'exists';
  value: string | number | boolean | string[];
  conjunction?: 'AND' | 'OR';
}

export interface Rule {
  id: string;
  type: 'count' | 'firstTime' | 'withinWindow';
  count?: number;
  window?: {
    unit: 'days' | 'hours' | 'minutes';
    value: number;
  };
  firstTime?: boolean;
}

export interface UserPropertyFilter {
  id: string;
  property: string;
  operator: string;
  value: unknown;
}

export interface TriggerReachPreview {
  estimatedCount: number;
  lastUpdated: string;
  breakdown?: Record<string, number>;
}

export interface TriggerConfigState {
  name: string;
  description?: string;
  status: 'draft' | 'active';
  triggerType: TriggerType;
  events: string[];
  eventFilters: EventFilter[];
  rules: Rule[];
  userFilters: UserPropertyFilter[];
  preview: TriggerReachPreview | null;
  isValid: boolean;
  showUserFilters: boolean;
}

export interface PreviewRequestPayload {
  events: string[];
  eventFilters: EventFilter[];
  rules: Rule[];
  userFilters: UserPropertyFilter[];
}

export interface PreviewResponse {
  estimatedCount: number;
  breakdown?: Record<string, number>;
}


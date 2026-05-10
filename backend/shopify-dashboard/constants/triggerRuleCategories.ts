export interface RuleOption {
  id: string;
  label: string;
  description?: string;
  icon?: string;
}

export const USER_PROPERTY_OPTIONS: RuleOption[] = [
  { id: 'user_property', label: 'User property', description: 'Filter by user attributes' },
  { id: 'user_bucket', label: 'User Bucket' },
  { id: 'demographics', label: 'Demographics' },
  { id: 'geography', label: 'Geography' },
  { id: 'geography_radius', label: 'Geography Radius' },
  { id: 'reachability', label: 'Reachability' },
  { id: 'app_fields', label: 'App Fields' },
  { id: 'segments', label: 'Segments' },
];

export const USER_BEHAVIOR_OPTIONS: RuleOption[] = [
  { id: 'event_dot', label: 'Event (Dot)', description: 'User performed an event' },
  { id: 'event_have_not_done', label: 'Event (Have Not Done)' },
  { id: 'event_combination', label: 'Event Combination (Did Any Of)' },
  { id: 'event_property', label: 'Event property' },
  { id: 'time_of_day', label: 'Time of the day' },
  { id: 'day_of_week', label: 'Day of the week' },
];

export const USER_INTERESTS_OPTIONS: RuleOption[] = [
  { id: 'event_property', label: 'Event property' },
  { id: 'time_of_day', label: 'Time of the day' },
  { id: 'day_of_week', label: 'Day of the week' },
];

export const SYSTEM_PROPERTIES: RuleOption[] = [
  { id: 'email', label: 'Email' },
  { id: 'phone', label: 'Phone' },
];

export const CUSTOM_PROPERTIES: RuleOption[] = [
  { id: 'ct_is_test_user', label: 'ct_is_test_user' },
  { id: 'country', label: 'country' },
  { id: 'city', label: 'city' },
  { id: 'DeviceId', label: 'DeviceId' },
];



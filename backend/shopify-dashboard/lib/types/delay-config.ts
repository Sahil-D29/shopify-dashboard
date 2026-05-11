import type { ConditionValue, OperatorType } from './condition-config';

export type DelayType =
  | 'fixed_time'
  | 'wait_until_time'
  | 'wait_for_event'
  | 'optimal_send_time'
  | 'wait_for_attribute';

export interface Duration {
  value: number;
  unit: 'minutes' | 'hours' | 'days' | 'weeks';
}

export interface TimeOfDay {
  hour: number;
  minute: number;
}

export interface QuietHours {
  enabled: boolean;
  startTime: TimeOfDay;
  endTime: TimeOfDay;
  timezone: 'customer' | string;
}

export interface HolidaySettings {
  skipWeekends: boolean;
  skipHolidays: boolean;
  holidayCalendar?: 'us' | 'uk' | 'custom';
  customHolidayDates?: string[];
}

export interface ThrottlingSettings {
  enabled: boolean;
  maxUsersPerHour?: number;
  maxUsersPerDay?: number;
}

export interface FixedTimeDelayConfig {
  type: 'fixed_time';
  duration: Duration;
  description?: string;
}

export interface WaitUntilTimeConfig {
  type: 'wait_until_time';
  time: TimeOfDay;
  timezone: 'customer' | string;
  ifPassed: 'wait_until_tomorrow' | 'skip_wait' | 'continue_immediately';
  description?: string;
}

export interface WaitForEventConfig {
  type: 'wait_for_event';
  eventName: string;
  eventFilters?: {
    property: string;
    operator: OperatorType;
    value: ConditionValue;
  }[];
  maxWaitTime: Duration;
  onTimeout: 'continue' | 'exit' | 'branch_to_timeout_path';
  timeoutBranchLabel?: string;
  description?: string;
}

export interface OptimalSendTimeConfig {
  type: 'optimal_send_time';
  window: {
    duration: Duration;
  };
  fallbackTime?: TimeOfDay;
  timezone: 'customer' | string;
  description?: string;
}

export interface WaitForAttributeConfig {
  type: 'wait_for_attribute';
  attributePath: string;
  targetValue: ConditionValue;
  maxWaitTime: Duration;
  onTimeout: 'continue' | 'exit' | 'branch_to_timeout_path';
  timeoutBranchLabel?: string;
  description?: string;
}

export type DelaySpecificConfig =
  | FixedTimeDelayConfig
  | WaitUntilTimeConfig
  | WaitForEventConfig
  | OptimalSendTimeConfig
  | WaitForAttributeConfig;

export interface DelayConfig {
  delayType: DelayType;
  specificConfig: DelaySpecificConfig;
  quietHours?: QuietHours;
  holidaySettings?: HolidaySettings;
  throttling?: ThrottlingSettings;
  nodeName?: string;
  description?: string;
}

export interface DelayPreviewScenario {
  userEntersAt: string;
  userContinuesAt: string;
  explanation: string;
  warnings?: string[];
}


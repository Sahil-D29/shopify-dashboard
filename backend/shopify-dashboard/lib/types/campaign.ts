import type { ConditionValue, OperatorType } from './condition-config';

export type CampaignType = 'ONE_TIME' | 'RECURRING' | 'DRIP' | 'TRIGGER_BASED';
export type CampaignChannel = 'WHATSAPP'; // Only WhatsApp for now
export type CampaignStatus = 'DRAFT' | 'SCHEDULED' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED';
export type TriggerEvent =
  | 'order_placed'
  | 'cart_abandoned'
  | 'customer_signup'
  | 'product_viewed'
  | 'wishlist_added'
  | 'customer_birthday'
  | 'segment_entered'
  | 'segment_exited';

export interface CampaignMedia {
  type: 'image' | 'video' | 'document';
  url: string;
}

export interface CampaignButton {
  type: 'URL' | 'PHONE' | 'QUICK_REPLY';
  text: string;
  url?: string;
  phoneNumber?: string;
}

export interface CampaignMessageContent {
  subject?: string;
  body: string;
  media?: CampaignMedia;
  buttons?: CampaignButton[];
  variables?: Record<string, string>;
}

export interface CampaignCondition {
  field: string;
  operator: OperatorType;
  value: ConditionValue;
}

export interface Campaign {
  id: string;
  name: string;
  description?: string;
  type: CampaignType;
  channel: CampaignChannel;
  status: CampaignStatus;
  
  // Audience
  segmentIds: string[];
  estimatedReach: number;
  
  // Content
  templateId?: string;
  messageContent: CampaignMessageContent;
  
  // Scheduling
  scheduleType: 'IMMEDIATE' | 'SCHEDULED' | 'RECURRING';
  scheduledAt?: number;
  timezone?: string;
  recurringConfig?: {
    frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
    interval: number;
    daysOfWeek?: number[];
    time: string;
    endDate?: number;
  };
  
  // Trigger-based
  triggerEvent?: TriggerEvent;
  triggerDelay?: number; // minutes
  triggerConditions?: CampaignCondition[];
  
  // A/B Testing
  abTest?: {
    enabled: boolean;
    variants: Array<{
      id: string;
      name: string;
      percentage: number;
      messageContent: CampaignMessageContent;
    }>;
    winnerCriteria: 'OPEN_RATE' | 'CLICK_RATE' | 'CONVERSION_RATE';
    testDuration: number; // hours
  };
  
  // Drip Campaign
  dripSteps?: Array<{
    id: string;
    name: string;
    delay: number; // hours from previous step
    messageContent: CampaignMessageContent;
    conditions?: CampaignCondition[];
  }>;
  
  // Analytics
  metrics: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    converted: number;
    failed: number;
    unsubscribed: number;
    revenue: number;
  };
  
  // Metadata
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  startedAt?: number;
  completedAt?: number;
  tags: string[];
  labels: string[]; // Campaign labels: Promotional, Transactional, Follow-up, Seasonal, Retention
  
  // Advanced
  goalTracking?: {
    enabled: boolean;
    goalType: 'REVENUE' | 'CONVERSION' | 'ENGAGEMENT';
    targetValue: number;
  };

  sendingSpeed?: 'FAST' | 'MEDIUM' | 'SLOW'; // Rate limiting
  
  // Smart Timing
  useSmartTiming?: boolean; // Send at each customer's optimal time
}

export interface CampaignTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  channel: CampaignChannel;
  previewImage?: string;
  content: CampaignMessageContent;
  tags: string[];
}


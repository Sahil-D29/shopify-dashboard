import type { UnifiedTriggerConfig } from './trigger-config';

export type JourneyStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';

export type JourneyTriggerType =
  | 'segment'
  | 'product_viewed'
  | 'order_placed'
  | 'abandoned_cart'
  | 'tag_added'
  | 'first_purchase'
  | 'repeat_purchase'
  | 'birthday'
  | 'custom_date'
  | 'webhook'
  | 'manual';

export interface JourneyNodeBase {
  id: string;
  type: 'trigger' | 'delay' | 'condition' | 'action' | 'goal' | 'exit';
  position: { x: number; y: number };
  name?: string;
  description?: string;
  subtype?: string;
  data?: JourneyNodeData;
}

export interface TriggerNode extends JourneyNodeBase {
  type: 'trigger';
  trigger?: {
    type: JourneyTriggerType;
    segmentId?: string;
    tag?: string;
    productId?: string;
    hours?: number; // abandoned cart threshold
    webhookEvent?: string;
  };
}

export interface UnifiedTriggerNodeData {
  triggerConfig: UnifiedTriggerConfig;
  status: 'draft' | 'active';
  userCount?: number;
}

export interface DelayNode extends JourneyNodeBase {
  type: 'delay';
  delay: { unit: 'minutes' | 'hours' | 'days'; value: number };
}

export interface ConditionNode extends JourneyNodeBase {
  type: 'condition';
  condition: {
    kind:
      | 'opened_message'
      | 'clicked_link'
      | 'made_purchase'
      | 'has_tag'
      | 'total_spent_gt'
      | 'order_count'
      | 'product_purchased'
      | 'custom_condition';
    args?: Record<string, unknown>;
  };
}

export interface ActionNode extends JourneyNodeBase {
  type: 'action';
  action: {
    kind: 'whatsapp_template';
    templateName: string;
    language?: string;
    variables?: Record<string, string>;
    sendWindow?: { startHour: number; endHour: number };
    fallbackText?: string;
  };
}

export interface GoalNode extends JourneyNodeBase {
  type: 'goal';
  goal: { description?: string };
}

export interface ExitNode extends JourneyNodeBase {
  type: 'exit';
}

export type JourneyNode =
  | TriggerNode
  | DelayNode
  | ConditionNode
  | ActionNode
  | GoalNode
  | ExitNode;

export interface JourneyNodeData {
  meta?: Record<string, unknown>;
  config?: Record<string, unknown>;
  triggerConfig?: UnifiedTriggerConfig;
  status?: 'draft' | 'active';
  userCount?: number;
  [key: string]: unknown;
}

export interface JourneyEdge {
  id: string;
  source: string;
  target: string;
  label?: string; // e.g., Yes/No for condition splits
}

export interface JourneyReEntryRules {
  allow: boolean;
  cooldownDays: number;
}

export interface JourneyConfig {
  reEntryRules: JourneyReEntryRules;
  maxEnrollments: number | null;
  timezone: string;
  [key: string]: unknown;
}

export interface JourneyStats {
  totalEnrollments: number;
  activeEnrollments: number;
  completedEnrollments: number;
  goalConversionRate: number;
  [key: string]: number;
}

export interface JourneyDefinition {
  id: string;
  name: string;
  description?: string;
  status: JourneyStatus;
  createdAt: number | string;
  updatedAt: number | string;
  storeId?: string;
  settings?: {
    entry: {
      segmentId?: string; // default entry restriction
      frequency: 'once' | 'multiple';
      maxEntries?: number;
    };
    exit?: {
      autoExitAfterDays?: number;
      onGoal?: boolean;
    };
    timezone?: string;
    goalDescription?: string;
    testMode?: boolean;
    allowReentry?: boolean;
    reentryCooldownDays?: number;
    testPhoneNumbers?: string[];
  };
  config?: JourneyConfig;
  stats?: JourneyStats;
  createdFromTemplate?: string | null;
  nodes: JourneyNode[];
  edges: JourneyEdge[];
}

export interface JourneyEnrollment {
  id: string;
  journeyId: string;
  customerId: string;
  status: 'ACTIVE' | 'COMPLETED' | 'EXITED' | 'DROPPED';
  currentNodeId?: string;
  history: Array<{
    nodeId: string;
    enteredAt: number;
    exitedAt?: number;
    data?: Record<string, unknown>;
  }>;
  actions?: Array<{
    type: 'message_sent' | 'message_opened' | 'link_clicked' | 'purchase_made';
    at: number;
    metadata?: Record<string, unknown>;
  }>;
  startedAt: number;
  updatedAt: number;
  completedAt?: number;
  storeId?: string;
}



import type { ComponentType } from 'react';

import {
  Bell,
  Calendar,
  CalendarClock,
  CheckSquare,
  Clock,
  Edit3,
  Eye,
  GitBranch,
  LogOut,
  MessageCircle,
  ShoppingBag,
  ShoppingCart,
  Shuffle,
  Tag,
  Target,
  TrendingUp,
  User,
  Users,
  Zap,
} from 'lucide-react';

import { isUnifiedTriggerEnabled } from '@/lib/featureFlags';

export type JourneyNodeCategoryKey = 'triggers' | 'actions' | 'decisions' | 'delays' | 'goals';

export type JourneyPaletteNodeVariant =
  | 'trigger'
  | 'action'
  | 'decision'
  | 'wait'
  | 'goal'
  | 'experiment';

export interface JourneyPaletteNodeDefinition {
  id: string;
  name: string;
  description: string;
  subtype: string;
  variant: JourneyPaletteNodeVariant;
  icon: ComponentType<{ className?: string }>;
}

export interface JourneyPaletteCategory {
  id: JourneyNodeCategoryKey;
  label: string;
  emoji: string;
  variant: JourneyPaletteNodeVariant;
  nodes: JourneyPaletteNodeDefinition[];
}

const TRIGGER_NODES: JourneyPaletteNodeDefinition[] = isUnifiedTriggerEnabled()
  ? [
      {
        id: 'unified_trigger',
        name: 'Trigger',
        description: 'Start journey when an event occurs',
        subtype: 'unified_trigger',
        variant: 'trigger',
        icon: Zap,
      },
    ]
  : [
      {
        id: 'segment_joined',
        name: 'Segment Joined',
        description: 'Start journey when a customer enters a segment',
        subtype: 'segment_joined',
        variant: 'trigger',
        icon: Users,
      },
      {
        id: 'order_placed_trigger',
        name: 'Order Placed',
        description: 'Fire when a Shopify order is created',
        subtype: 'order_placed',
        variant: 'trigger',
        icon: ShoppingBag,
      },
      {
        id: 'cart_abandoned_trigger',
        name: 'Cart Abandoned',
        description: 'Engage shoppers who leave checkouts unfinished',
        subtype: 'cart_abandoned',
        variant: 'trigger',
        icon: ShoppingCart,
      },
      {
        id: 'product_viewed_trigger',
        name: 'Product Viewed',
        description: 'Personalise follow-ups by product interest',
        subtype: 'product_viewed',
        variant: 'trigger',
        icon: Eye,
      },
      {
        id: 'event_trigger',
        name: 'Event Trigger',
        description: 'On specific event',
        subtype: 'event_trigger',
        variant: 'trigger',
        icon: Zap,
      },
      {
        id: 'date_time',
        name: 'Date / Time',
        description: 'On specific date',
        subtype: 'date_time',
        variant: 'trigger',
        icon: Calendar,
      },
      {
        id: 'manual_entry',
        name: 'Manual Entry',
        description: 'Manually added',
        subtype: 'manual_entry',
        variant: 'trigger',
        icon: User,
      },
    ];

export const JOURNEY_NODE_CATALOG: JourneyPaletteCategory[] = [
  {
    id: 'triggers',
    label: 'Triggers',
    emoji: '🎯',
    variant: 'trigger',
    nodes: TRIGGER_NODES,
  },
  {
    id: 'actions',
    label: 'Actions',
    emoji: '⚡',
    variant: 'action',
    nodes: [
      {
        id: 'send_whatsapp',
        name: 'Send WhatsApp',
        description: 'Send WhatsApp template',
        subtype: 'send_whatsapp',
        variant: 'action',
        icon: MessageCircle,
      },
      {
        id: 'add_tag',
        name: 'Add Tag',
        description: 'Tag customer for segmentation',
        subtype: 'add_tag',
        variant: 'action',
        icon: Tag,
      },
      {
        id: 'update_property',
        name: 'Update Property',
        description: 'Modify customer property',
        subtype: 'update_property',
        variant: 'action',
        icon: Edit3,
      },
      {
        id: 'wait_delay_action',
        name: 'Wait / Delay',
        description: 'Pause journey progression for a duration',
        subtype: 'fixed_delay',
        variant: 'wait',
        icon: Clock,
      },
      {
        id: 'create_task',
        name: 'Create Task',
        description: 'Assign follow-up task',
        subtype: 'create_task',
        variant: 'action',
        icon: CheckSquare,
      },
    ],
  },
  {
    id: 'decisions',
    label: 'Decisions',
    emoji: '🔀',
    variant: 'decision',
    nodes: [
      {
        id: 'if_else',
        name: 'If / Else Condition',
        description: 'Branch by condition',
        subtype: 'if_else',
        variant: 'decision',
        icon: GitBranch,
      },
      {
        id: 'split_test',
        name: 'Split Test',
        description: 'Split traffic randomly',
        subtype: 'split_test',
        variant: 'decision',
        icon: Shuffle,
      },
      {
        id: 'ab_test',
        name: 'A/B Test',
        description: 'Experiment with multiple variants and measure outcomes',
        subtype: 'ab_test',
        variant: 'experiment',
        icon: GitBranch,
      },
      {
        id: 'behavior_split',
        name: 'Behavior Split',
        description: 'Split based on behavior',
        subtype: 'behavior_split',
        variant: 'decision',
        icon: TrendingUp,
      },
    ],
  },
  {
    id: 'delays',
    label: 'Delays',
    emoji: '⏱️',
    variant: 'wait',
    nodes: [
      {
        id: 'fixed_delay',
        name: 'Fixed Delay',
        description: 'Wait X hours / days',
        subtype: 'fixed_delay',
        variant: 'wait',
        icon: Clock,
      },
      {
        id: 'wait_until',
        name: 'Wait Until',
        description: 'Wait until date / time',
        subtype: 'wait_until',
        variant: 'wait',
        icon: CalendarClock,
      },
      {
        id: 'wait_for_event',
        name: 'Wait for Event',
        description: 'Wait for customer action',
        subtype: 'wait_for_event',
        variant: 'wait',
        icon: Bell,
      },
    ],
  },
  {
    id: 'goals',
    label: 'Goals',
    emoji: '✅',
    variant: 'goal',
    nodes: [
      {
        id: 'goal_achieved',
        name: 'Goal Achieved',
        description: 'Track goal completion',
        subtype: 'goal_achieved',
        variant: 'goal',
        icon: Target,
      },
      {
        id: 'order_goal',
        name: 'Order Goal',
        description: 'Track conversions tied to orders',
        subtype: 'order_goal',
        variant: 'goal',
        icon: Target,
      },
      {
        id: 'exit_journey',
        name: 'Exit Journey',
        description: 'End journey for customer',
        subtype: 'exit_journey',
        variant: 'goal',
        icon: LogOut,
      },
    ],
  },
];



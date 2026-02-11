import { NextResponse } from 'next/server';

const GOAL_TYPES = [
  {
    type: 'journey_completion',
    label: 'Journey Completion',
    description: 'Marks success when customers reach the end of the journey.',
    icon: 'trophy',
  },
  {
    type: 'shopify_event',
    label: 'Shopify Event',
    description: 'Track conversions on Shopify events such as orders or checkouts.',
    icon: 'shopping-cart',
    requiresEventSelection: true,
  },
  {
    type: 'whatsapp_engagement',
    label: 'WhatsApp Engagement',
    description: 'Goal achieved when customers reply or click WhatsApp messages.',
    icon: 'message-circle',
    requiresEngagementType: true,
  },
  {
    type: 'custom_event',
    label: 'Custom Event',
    description: 'Listen for bespoke events from your storefront or backend.',
    icon: 'zap',
    requiresEventName: true,
  },
  {
    type: 'segment_entry',
    label: 'Segment Entry',
    description: 'Goal triggers when customers enter the specified audience segment.',
    icon: 'users',
    requiresSegmentSelection: true,
  },
];

export async function GET() {
  return NextResponse.json({
    goalTypes: GOAL_TYPES,
    syncedAt: new Date().toISOString(),
  });
}



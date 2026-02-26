/**
 * Campaign presets — ready-made campaign templates users can start from.
 * Selecting a preset pre-fills the CampaignWizard form data.
 */
import type { CampaignType, TriggerEvent } from '@/lib/types/campaign';

export interface CampaignPreset {
  id: string;
  name: string;
  description: string;
  emoji: string;
  category: 'sales' | 'engagement' | 'retention' | 'lifecycle';
  type: CampaignType;
  labels: string[];
  scheduleType: 'IMMEDIATE' | 'SCHEDULED' | 'RECURRING';
  sendingSpeed: 'FAST' | 'MEDIUM' | 'SLOW';
  useSmartTiming: boolean;
  messageBody: string;
  triggerEvent?: TriggerEvent;
  triggerDelay?: number;
  recurringConfig?: {
    frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
    interval: number;
    daysOfWeek: number[];
    time: string;
  };
  dripSteps?: Array<{
    name: string;
    delayHours: number;
    messageBody: string;
  }>;
  goalTracking?: {
    enabled: boolean;
    goalType: 'REVENUE' | 'CONVERSION' | 'ENGAGEMENT';
    targetValue: number;
  };
}

export const CAMPAIGN_PRESETS: CampaignPreset[] = [
  // ── Sales ─────────────────────────────────────────────
  {
    id: 'flash-sale',
    name: 'Flash Sale',
    description: 'Send a one-time promotional message about a limited-time sale or discount.',
    emoji: '🔥',
    category: 'sales',
    type: 'ONE_TIME',
    labels: ['Promotional'],
    scheduleType: 'IMMEDIATE',
    sendingSpeed: 'FAST',
    useSmartTiming: false,
    messageBody:
      '🔥 *Flash Sale Alert!*\n\nHi {{first_name}}, we have an exclusive offer just for you!\n\nGet *FLAT 30% OFF* on all products for the next 24 hours. Use code: FLASH30\n\n🛒 Shop now before the sale ends!',
    goalTracking: {
      enabled: true,
      goalType: 'REVENUE',
      targetValue: 50000,
    },
  },

  // ── Lifecycle ─────────────────────────────────────────
  {
    id: 'welcome-series',
    name: 'Welcome Series',
    description: '3-step drip campaign to onboard new customers over their first week.',
    emoji: '👋',
    category: 'lifecycle',
    type: 'DRIP',
    labels: ['Transactional'],
    scheduleType: 'IMMEDIATE',
    sendingSpeed: 'MEDIUM',
    useSmartTiming: true,
    messageBody:
      'Welcome to our family, {{first_name}}! 🎉\n\nWe\'re thrilled to have you. Here\'s a quick intro to what we offer and how to get the best out of your experience.\n\nStay tuned — we have a special surprise coming your way soon!',
    dripSteps: [
      {
        name: 'Day 1 — Explore Our Best Sellers',
        delayHours: 24,
        messageBody:
          'Hi {{first_name}} 👋\n\nYesterday we said hello — today, let us show you our top picks!\n\n⭐ Check out our best-selling products curated just for you.\n\nHappy exploring!',
      },
      {
        name: 'Day 3 — Exclusive New Customer Offer',
        delayHours: 72,
        messageBody:
          'Hi {{first_name}}, here\'s something special! 🎁\n\nAs a new member, enjoy *15% OFF* your first order.\n\nUse code: WELCOME15\n\nValid for the next 48 hours. Don\'t miss out!',
      },
    ],
    goalTracking: {
      enabled: true,
      goalType: 'CONVERSION',
      targetValue: 100,
    },
  },

  // ── Retention ─────────────────────────────────────────
  {
    id: 'abandoned-cart',
    name: 'Abandoned Cart Recovery',
    description: 'Automatically message customers who left items in their cart.',
    emoji: '🛒',
    category: 'retention',
    type: 'TRIGGER_BASED',
    labels: ['Follow-up'],
    scheduleType: 'IMMEDIATE',
    sendingSpeed: 'FAST',
    useSmartTiming: false,
    messageBody:
      'Hi {{first_name}}, you left something behind! 🛒\n\nYour cart is waiting for you. Complete your purchase now and get *free shipping* on your order.\n\nHurry — items in your cart may sell out!',
    triggerEvent: 'cart_abandoned',
    triggerDelay: 30, // 30 minutes after abandonment
    goalTracking: {
      enabled: true,
      goalType: 'REVENUE',
      targetValue: 30000,
    },
  },

  // ── Lifecycle ─────────────────────────────────────────
  {
    id: 'post-purchase',
    name: 'Post-Purchase Follow-up',
    description: 'Thank customers after a purchase and ask for a review.',
    emoji: '📦',
    category: 'lifecycle',
    type: 'TRIGGER_BASED',
    labels: ['Transactional'],
    scheduleType: 'IMMEDIATE',
    sendingSpeed: 'MEDIUM',
    useSmartTiming: false,
    messageBody:
      'Thank you for your order, {{first_name}}! 🙏\n\nWe\'re preparing your package and it will be on its way soon.\n\nOnce you receive it, we\'d love to hear your feedback. Your review helps us improve!\n\n⭐ Rate your experience',
    triggerEvent: 'order_placed',
    triggerDelay: 1440, // 24 hours after order
    goalTracking: {
      enabled: true,
      goalType: 'ENGAGEMENT',
      targetValue: 50,
    },
  },

  // ── Retention ─────────────────────────────────────────
  {
    id: 're-engagement',
    name: 'Re-engagement Campaign',
    description: 'Win back inactive customers with a special offer.',
    emoji: '💌',
    category: 'retention',
    type: 'ONE_TIME',
    labels: ['Retention'],
    scheduleType: 'SCHEDULED',
    sendingSpeed: 'MEDIUM',
    useSmartTiming: true,
    messageBody:
      'We miss you, {{first_name}}! 💙\n\nIt\'s been a while since your last visit. We\'ve added lots of new products we think you\'ll love.\n\nHere\'s a special *20% OFF* coupon just for you: COMEBACK20\n\nCome back and see what\'s new!',
    goalTracking: {
      enabled: true,
      goalType: 'CONVERSION',
      targetValue: 75,
    },
  },

  // ── Engagement ────────────────────────────────────────
  {
    id: 'birthday-offer',
    name: 'Birthday Offer',
    description: 'Automatically send a birthday greeting with a special discount.',
    emoji: '🎂',
    category: 'engagement',
    type: 'TRIGGER_BASED',
    labels: ['Seasonal'],
    scheduleType: 'IMMEDIATE',
    sendingSpeed: 'SLOW',
    useSmartTiming: false,
    messageBody:
      'Happy Birthday, {{first_name}}! 🎂🎉\n\nTo celebrate your special day, here\'s an exclusive gift from us:\n\n🎁 *25% OFF* your next order!\nUse code: BDAY25\n\nValid for 7 days. Enjoy your day!',
    triggerEvent: 'customer_birthday',
    triggerDelay: 0, // Send immediately on birthday
    goalTracking: {
      enabled: true,
      goalType: 'REVENUE',
      targetValue: 10000,
    },
  },

  // ── Sales ─────────────────────────────────────────────
  {
    id: 'weekly-newsletter',
    name: 'Weekly Newsletter',
    description: 'Send weekly product updates and tips to keep customers engaged.',
    emoji: '📰',
    category: 'engagement',
    type: 'RECURRING',
    labels: ['Promotional'],
    scheduleType: 'RECURRING',
    sendingSpeed: 'MEDIUM',
    useSmartTiming: true,
    messageBody:
      'Hi {{first_name}}! 📰\n\nHere\'s your weekly update:\n\n✨ New arrivals this week\n🏷️ Special deals you won\'t want to miss\n💡 Tips & tricks from our team\n\nTap to explore what\'s new!',
    recurringConfig: {
      frequency: 'WEEKLY',
      interval: 1,
      daysOfWeek: [1], // Monday
      time: '10:00',
    },
    goalTracking: {
      enabled: true,
      goalType: 'ENGAGEMENT',
      targetValue: 200,
    },
  },

  // ── Retention ─────────────────────────────────────────
  {
    id: 'product-restock',
    name: 'Product Restock Alert',
    description: 'Notify customers when a popular or wishlisted product is back in stock.',
    emoji: '🔔',
    category: 'retention',
    type: 'TRIGGER_BASED',
    labels: ['Transactional'],
    scheduleType: 'IMMEDIATE',
    sendingSpeed: 'FAST',
    useSmartTiming: false,
    messageBody:
      'Great news, {{first_name}}! 🔔\n\nA product on your wishlist is back in stock!\n\nGrab it now before it sells out again. Limited quantities available.\n\n🛒 Shop Now',
    triggerEvent: 'wishlist_added',
    triggerDelay: 0,
  },
];

/** Group presets by category for display */
export const PRESET_CATEGORIES = [
  { key: 'sales' as const, label: 'Sales & Promotions', emoji: '💰' },
  { key: 'lifecycle' as const, label: 'Customer Lifecycle', emoji: '🔄' },
  { key: 'retention' as const, label: 'Retention & Recovery', emoji: '🎯' },
  { key: 'engagement' as const, label: 'Engagement', emoji: '💬' },
];

export function getPresetsByCategory(category: CampaignPreset['category']): CampaignPreset[] {
  return CAMPAIGN_PRESETS.filter(p => p.category === category);
}

export function getPresetById(id: string): CampaignPreset | undefined {
  return CAMPAIGN_PRESETS.find(p => p.id === id);
}

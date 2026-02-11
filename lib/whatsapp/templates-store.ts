import type { WhatsAppTemplate } from '@/lib/types/whatsapp-config';

type TemplateStore = {
  templates: WhatsAppTemplate[];
};

const GLOBAL_KEY = '__whatsappTemplateStore';

function ensureStore(): TemplateStore {
  const globalRef = global as typeof global & { [GLOBAL_KEY]?: TemplateStore };
  if (!globalRef[GLOBAL_KEY]) {
    globalRef[GLOBAL_KEY] = { templates: [] };
  }
  return globalRef[GLOBAL_KEY]!;
}

const SAMPLE_TEMPLATES: WhatsAppTemplate[] = [
  {
    id: 'welcome_offer_01',
    name: 'Welcome Offer',
    category: 'Promotional',
    language: 'en',
    status: 'APPROVED',
    description: 'Greet new customers with a limited-time welcome discount.',
    content:
      'Hi {{customer_first_name}}, welcome to {{store_name}}! Use code {{discount_code}} to save {{discount_value}} on your first order.',
    body:
      'Hi {{customer_first_name}}, welcome to {{store_name}}! Use code {{discount_code}} to save {{discount_value}} on your first order.',
    footer: 'Reply STOP to opt-out.',
    variables: ['customer_first_name', 'store_name', 'discount_code', 'discount_value'],
    hasMediaHeader: false,
    hasButtons: true,
    buttons: [
      { id: 'btn-claim', type: 'quick_reply', label: 'Claim Offer' },
      { id: 'btn-shop', type: 'url', label: 'Shop Now', url: 'https://demo-shopify.com/collections/new' },
    ],
    sampleValues: {
      customer_first_name: 'Ava',
      store_name: 'Cotton & Co.',
      discount_code: 'WELCOME10',
      discount_value: '10%',
    },
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    lastUsed: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
  },
  {
    id: 'order_shipped_01',
    name: 'Order Shipped Update',
    category: 'Transactional',
    language: 'en',
    status: 'APPROVED',
    description: 'Automatically notify customers when their order leaves the warehouse.',
    content:
      'Great news {{customer_first_name}}! Your order {{order_number}} has shipped via {{shipping_carrier}}. Track it here: {{tracking_url}}',
    body:
      'Great news {{customer_first_name}}! Your order {{order_number}} has shipped via {{shipping_carrier}}. Track it here: {{tracking_url}}',
    variables: ['customer_first_name', 'order_number', 'shipping_carrier', 'tracking_url'],
    hasMediaHeader: true,
    mediaType: 'IMAGE',
    mediaUrl: 'https://cdn.shopify.com/demo/shipping-label.png',
    hasButtons: true,
    buttons: [
      { id: 'btn-track', type: 'url', label: 'Track Package', url: 'https://demo-shipping.com/track/ABC123' },
    ],
    sampleValues: {
      customer_first_name: 'Liam',
      order_number: '#1245',
      shipping_carrier: 'DHL Express',
      tracking_url: 'https://demo-shipping.com/track/ABC123',
    },
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    lastUsed: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    id: 'back_in_stock_01',
    name: 'Back In Stock Alert',
    category: 'Promotional',
    language: 'en',
    status: 'PENDING',
    description: 'Alert customers when their favourite items are available again.',
    content:
      'Hi {{customer_first_name}}, {{product_name}} is back in stock! Tap below to grab it before it sells out again.',
    body:
      'Hi {{customer_first_name}}, {{product_name}} is back in stock! Tap below to grab it before it sells out again.',
    variables: ['customer_first_name', 'product_name'],
    hasMediaHeader: true,
    mediaType: 'IMAGE',
    mediaUrl: 'https://cdn.shopify.com/demo/back-in-stock.png',
    hasButtons: true,
    buttons: [
      { id: 'btn-view', type: 'url', label: 'View Product', url: 'https://demo-shopify.com/products/featured' },
      { id: 'btn-remind', type: 'quick_reply', label: 'Remind Me Later' },
    ],
    sampleValues: {
      customer_first_name: 'Ella',
      product_name: 'Signature Linen Dress',
    },
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString(),
  },
  {
    id: 'payment_reminder_01',
    name: 'Payment Reminder',
    category: 'Transactional',
    language: 'en',
    status: 'REJECTED',
    description: 'Gentle reminders for pending invoices or COD orders awaiting payment.',
    content:
      'Hello {{customer_full_name}}, your payment of {{amount_due}} for order {{order_number}} is pending. Complete it before {{due_date}} to avoid cancellation.',
    body:
      'Hello {{customer_full_name}}, your payment of {{amount_due}} for order {{order_number}} is pending. Complete it before {{due_date}} to avoid cancellation.',
    footer: 'Need help? Reply HELP.',
    variables: ['customer_full_name', 'amount_due', 'order_number', 'due_date'],
    hasMediaHeader: false,
    hasButtons: false,
    sampleValues: {
      customer_full_name: 'Noah Patel',
      amount_due: '$149.00',
      order_number: '#4501',
      due_date: 'Sat, 14 Jan',
    },
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 21).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
  },
];

function seedTemplatesIfEmpty() {
  const store = ensureStore();
  if (!store.templates || store.templates.length === 0) {
    store.templates = SAMPLE_TEMPLATES;
  }
}

export function getTemplates(): WhatsAppTemplate[] {
  seedTemplatesIfEmpty();
  return ensureStore().templates;
}

export function setTemplates(templates: WhatsAppTemplate[]) {
  const store = ensureStore();
  store.templates = templates;
}

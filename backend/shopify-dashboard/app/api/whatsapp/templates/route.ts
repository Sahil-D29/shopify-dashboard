import { NextRequest, NextResponse } from 'next/server';

import type { TemplateButton, WhatsAppTemplate, WhatsAppTemplateStatus } from '@/lib/types/whatsapp-config';

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

function matchesStatus(template: WhatsAppTemplate, status: string | null): boolean {
  if (!status || status === 'ALL') return true;
  // Case-insensitive status matching to handle variations like "Approved" vs "APPROVED"
  return template.status.toUpperCase() === status.toUpperCase();
}

function matchesSearch(template: WhatsAppTemplate, query: string | null): boolean {
  if (!query) return true;
  const lower = query.toLowerCase();
  const candidates = [
    template.name,
    template.category,
    template.content,
    template.description ?? '',
  ];
  return candidates.some(value => value.toLowerCase().includes(lower));
}

interface CreateTemplatePayload {
  id?: string;
  name?: string;
  category?: string;
  language?: string;
  description?: string;
  content?: string;
  body?: string;
  footer?: string;
  hasMediaHeader?: boolean;
  mediaType?: WhatsAppTemplate['mediaType'];
  mediaUrl?: string;
  buttons?: TemplateButton[];
  sampleValues?: Record<string, string>;
  status?: WhatsAppTemplateStatus;
}

function normaliseStatus(status: WhatsAppTemplateStatus | string | undefined): WhatsAppTemplateStatus {
  if (status === 'APPROVED' || status === 'PENDING' || status === 'REJECTED') {
    return status;
  }
  const upper = typeof status === 'string' ? status.toUpperCase() : '';
  if (upper === 'APPROVED' || upper === 'PENDING' || upper === 'REJECTED') {
    return upper;
  }
  return 'PENDING';
}

function parseVariables(content: string): string[] {
  return Array.from(content.matchAll(/\{\{(.*?)\}\}/g))
    .map(match => match[1]?.trim())
    .filter((value): value is string => Boolean(value));
}

function normaliseButtons(buttons: TemplateButton[] | undefined): TemplateButton[] | undefined {
  if (!buttons) return undefined;
  if (buttons.length === 0) return undefined;
  return buttons.map(button => ({
    ...button,
    text: button.text ?? button.label ?? '',
  }));
}

interface MetaComponentType {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  text?: string;
  format?: string;
  example?: {
    header_handle?: string[];
    header_text?: string[][];
    body_text?: string[][];
  };
  buttons?: Array<{
    type: 'URL' | 'PHONE_NUMBER' | 'QUICK_REPLY';
    text: string;
    url?: string;
    phone_number?: string;
  }>;
}

interface MetaTemplate {
  id: string;
  name: string;
  category: string;
  language: string;
  status: string;
  components?: MetaComponentType[];
  rejected_reason?: string;
}

interface MetaTemplatesResponse {
  data?: MetaTemplate[];
  paging?: {
    next?: string;
    previous?: string;
  };
  error?: {
    message?: string;
    type?: string;
    code?: number;
  };
}

function extractVariables(text: string): string[] {
  const matches = text.match(/\{\{(\d+)\}\}/g);
  if (!matches) return [];
  return Array.from(new Set(matches.map(match => match.replace(/\{\{|\}\}/g, ''))));
}

function mapButtons(metaButtons: MetaComponentType['buttons']): TemplateButton[] | undefined {
  if (!metaButtons || metaButtons.length === 0) return undefined;
  return metaButtons.map(button => ({
    id: `${button.type.toLowerCase()}_${button.text}`,
    type:
      button.type === 'URL'
        ? 'URL'
        : button.type === 'PHONE_NUMBER'
        ? 'PHONE_NUMBER'
        : 'QUICK_REPLY',
    text: button.text,
    url: button.url,
    phoneNumber: button.phone_number,
  }));
}

function mapHeader(metaComponent: MetaComponentType | undefined): WhatsAppTemplate['header'] {
  if (!metaComponent) return undefined;
  const format = metaComponent.format ?? 'TEXT';
  if (format === 'TEXT') {
    const headerText = metaComponent.text ?? metaComponent.example?.header_text?.[0]?.[0] ?? '';
    return { type: 'TEXT', content: headerText };
  }
  return {
    type: format === 'IMAGE' || format === 'VIDEO' || format === 'DOCUMENT' ? format : 'TEXT',
    content: metaComponent.text ?? metaComponent.example?.header_handle?.[0] ?? '',
  };
}

function toWhatsAppTemplate(metaTemplate: MetaTemplate): WhatsAppTemplate {
  const components = metaTemplate.components ?? [];
  const bodyComponent = components.find(component => component.type === 'BODY');
  const headerComponent = components.find(component => component.type === 'HEADER');
  const footerComponent = components.find(component => component.type === 'FOOTER');
  const buttonsComponent = components.find(component => component.type === 'BUTTONS');

  const bodyText = bodyComponent?.text ?? '';

  return {
    id: `meta_${metaTemplate.id}`,
    metaTemplateId: metaTemplate.id,
    name: metaTemplate.name,
    category: metaTemplate.category,
    language: metaTemplate.language,
    status: metaTemplate.status.toUpperCase() as WhatsAppTemplate['status'],
    body: bodyText,
    content: bodyText,
    header: mapHeader(headerComponent),
    footer: footerComponent?.text,
    buttons: mapButtons(buttonsComponent?.buttons),
    variables: extractVariables(bodyText),
    sampleValues: {},
    rejectionReason: metaTemplate.rejected_reason,
    messagesSent: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    approvedAt: metaTemplate.status === 'APPROVED' ? Date.now() : undefined,
    hasMediaHeader: Boolean(headerComponent && headerComponent.format && headerComponent.format !== 'TEXT'),
    hasButtons: Boolean(buttonsComponent?.buttons?.length),
    mediaType: headerComponent?.format as WhatsAppTemplate['mediaType'],
  };
}

async function fetchTemplatesFromWhatsApp(wabaId: string, accessToken: string): Promise<WhatsAppTemplate[]> {
  let allMetaTemplates: MetaTemplate[] = [];
  let nextPageUrl: string | null = `https://graph.facebook.com/v18.0/${wabaId}/message_templates?limit=100`;

  while (nextPageUrl) {
    const response = await fetch(nextPageUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    const data = (await response.json()) as MetaTemplatesResponse;

    if (!response.ok) {
      const errorMessage = data.error?.message ?? `HTTP ${response.status}`;
      throw new Error(`Failed to fetch templates from WhatsApp API: ${errorMessage}`);
    }

    const metaTemplates = data.data ?? [];
    allMetaTemplates = [...allMetaTemplates, ...metaTemplates];

    // Check for next page
    nextPageUrl = data.paging?.next || null;
  }

  return allMetaTemplates.map(template => {
    const converted = toWhatsAppTemplate(template);
    return {
      ...converted,
      status: converted.status.toUpperCase() as WhatsAppTemplate['status'],
    };
  });
}

export async function GET(request: NextRequest) {
  try {
    // Try to get credentials from request body (for client-side config)
    let wabaId: string | undefined;
    let accessToken: string | undefined;

    try {
      const configHeader = request.headers.get('X-WhatsApp-Config');
      if (configHeader) {
        const config = JSON.parse(configHeader) as { wabaId?: string; accessToken?: string };
        wabaId = config.wabaId;
        accessToken = config.accessToken;
      }
    } catch {
      // Ignore parse errors
    }

    // Fallback to environment variables
    wabaId = wabaId ?? process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
    accessToken = accessToken ?? process.env.WHATSAPP_ACCESS_TOKEN ?? process.env.META_ACCESS_TOKEN;

    // If credentials are available, fetch from WhatsApp API
    if (wabaId && accessToken) {
      try {
        console.log('📥 Fetching templates from WhatsApp Business API...');
        const templates = await fetchTemplatesFromWhatsApp(wabaId, accessToken);
        console.log(`✅ Fetched ${templates.length} templates from WhatsApp API`);

        const searchParams = request.nextUrl.searchParams;
        const status = searchParams.get('status');
        const search = searchParams.get('search');
        const pageParam = Number.parseInt(searchParams.get('page') ?? '1', 10);
        const pageSizeParam = Number.parseInt(searchParams.get('pageSize') ?? '12', 10);

        const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
        const pageSize = Number.isFinite(pageSizeParam) && pageSizeParam > 0 ? pageSizeParam : 12;

        const filtered = templates.filter(
          template => matchesStatus(template, status) && matchesSearch(template, search)
        );

        const total = filtered.length;
        const start = (page - 1) * pageSize;
        const end = start + pageSize;
        const paginated = filtered.slice(start, end);

        return NextResponse.json({
          templates: paginated,
          total,
          page,
          pageSize,
        });
      } catch (apiError) {
        console.error('❌ Error fetching from WhatsApp API:', apiError);
        // Fall through to return local templates as fallback
      }
    }

    // Fallback to local templates if API fetch fails or credentials not available
    console.log('📦 Using local templates (fallback)');
    const list = getTemplates();

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const pageParam = Number.parseInt(searchParams.get('page') ?? '1', 10);
    const pageSizeParam = Number.parseInt(searchParams.get('pageSize') ?? '12', 10);

    const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
    const pageSize = Number.isFinite(pageSizeParam) && pageSizeParam > 0 ? pageSizeParam : 12;

    const filtered = list.filter(template => matchesStatus(template, status) && matchesSearch(template, search));

    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginated = filtered.slice(start, end);

    return NextResponse.json({
      templates: paginated,
      total,
      page,
      pageSize,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch templates';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as CreateTemplatePayload;
    const now = new Date().toISOString();

    const content = payload.content ?? payload.body ?? '';

    if (!payload.name || !payload.category || !payload.language || !content) {
      return NextResponse.json(
        { error: 'Template name, content, category, and language are required.' },
        { status: 400 },
      );
    }

    const variables = parseVariables(content);
    const status = normaliseStatus(payload.status);
    const buttons = normaliseButtons(payload.buttons);

    const newTemplate: WhatsAppTemplate = {
      id: payload.id ?? `tmpl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      name: payload.name,
      category: payload.category,
      language: payload.language,
      status,
      description: payload.description,
      content,
      body: content,
      footer: payload.footer,
      variables,
      hasMediaHeader: Boolean(payload.hasMediaHeader),
      mediaType: payload.mediaType,
      mediaUrl: payload.mediaUrl,
      hasButtons: Boolean(buttons?.length),
      buttons,
      sampleValues: payload.sampleValues,
      createdAt: now,
      updatedAt: now,
      lastUsed: null,
    };

    const nextTemplates = [...getTemplates(), newTemplate];
    setTemplates(nextTemplates);

    return NextResponse.json({ template: newTemplate });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create template';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}



import { prisma } from '@/lib/prisma';
import { META_GRAPH_API_VERSION, resolveWhatsAppConfig } from '@/lib/config/whatsapp-config-resolver';
import { graphUrl, getAppSecretProof } from '@/lib/whatsapp/graph';
import { normalizePhone, isValidPhone } from '@/lib/whatsapp/normalize-phone';
import { sendWhatsAppMessage } from '@/lib/whatsapp/send-message';

type JsonRecord = Record<string, unknown>;

type ShopifyNotificationKind = 'order_confirmation' | 'order_shipped' | 'order_delivered' | 'order_cancelled';

interface MetaTemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  text?: string;
  buttons?: Array<{
    type: 'URL' | 'PHONE_NUMBER' | 'QUICK_REPLY';
    text: string;
    url?: string;
  }>;
}

interface MetaTemplate {
  id: string;
  name: string;
  category: string;
  language: string;
  status: string;
  components?: MetaTemplateComponent[];
}

interface MetaTemplatesResponse {
  data?: MetaTemplate[];
  paging?: { next?: string };
  error?: { message?: string };
}

const TEMPLATE_MATCHERS: Record<ShopifyNotificationKind, RegExp[]> = {
  order_confirmation: [/^order_confirmation$/i, /order.*confirm/i, /purchase.*confirm/i],
  order_shipped: [/^order_shipped$/i, /order.*ship/i, /shipping.*update/i, /dispatch/i],
  order_delivered: [/^order_delivered$/i, /order.*deliver/i, /delivered/i],
  order_cancelled: [/^order_cancelled$/i, /order.*cancel/i, /cancelled/i],
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readRecord(source: JsonRecord, key: string): JsonRecord {
  const value = source[key];
  return isRecord(value) ? value : {};
}

function readString(source: JsonRecord, key: string): string {
  const value = source[key];
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

function formatMoney(payload: JsonRecord): string {
  const amount = Number(payload.total_price ?? payload.current_total_price ?? 0);
  const currency = readString(payload, 'currency') || readString(payload, 'presentment_currency') || 'INR';
  if (!Number.isFinite(amount) || amount <= 0) return '';
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function getCustomerName(payload: JsonRecord): string {
  const customer = readRecord(payload, 'customer');
  const billing = readRecord(payload, 'billing_address');
  const shipping = readRecord(payload, 'shipping_address');
  const firstName =
    readString(customer, 'first_name') ||
    readString(billing, 'first_name') ||
    readString(shipping, 'first_name');
  const lastName =
    readString(customer, 'last_name') ||
    readString(billing, 'last_name') ||
    readString(shipping, 'last_name');
  const fullName = `${firstName} ${lastName}`.trim();
  return fullName || readString(payload, 'customer_name') || 'there';
}

function getCustomerEmail(payload: JsonRecord): string {
  const customer = readRecord(payload, 'customer');
  return readString(payload, 'email') || readString(customer, 'email');
}

function getCustomerPhone(payload: JsonRecord): string {
  const customer = readRecord(payload, 'customer');
  const billing = readRecord(payload, 'billing_address');
  const shipping = readRecord(payload, 'shipping_address');
  return (
    readString(customer, 'phone') ||
    readString(billing, 'phone') ||
    readString(shipping, 'phone') ||
    readString(payload, 'phone')
  );
}

function getOrderName(payload: JsonRecord): string {
  return readString(payload, 'name') || readString(payload, 'order_number') || `#${readString(payload, 'id')}`;
}

function getFulfillment(payload: JsonRecord): JsonRecord {
  const fulfillment = readRecord(payload, 'fulfillment');
  if (Object.keys(fulfillment).length) return fulfillment;
  const fulfillments = payload.fulfillments;
  if (Array.isArray(fulfillments) && isRecord(fulfillments[0])) return fulfillments[0];
  return payload;
}

function getTrackingUrl(payload: JsonRecord): string {
  const fulfillment = getFulfillment(payload);
  const urls = fulfillment.tracking_urls;
  if (Array.isArray(urls) && typeof urls[0] === 'string') return urls[0];
  return readString(fulfillment, 'tracking_url') || readString(payload, 'order_status_url');
}

function getTrackingNumber(payload: JsonRecord): string {
  const fulfillment = getFulfillment(payload);
  const numbers = fulfillment.tracking_numbers;
  if (Array.isArray(numbers) && typeof numbers[0] === 'string') return numbers[0];
  return readString(fulfillment, 'tracking_number') || 'available soon';
}

function getCarrier(payload: JsonRecord): string {
  const fulfillment = getFulfillment(payload);
  return readString(fulfillment, 'tracking_company') || 'our shipping partner';
}

function getNotificationKind(topic: string, payload: JsonRecord): ShopifyNotificationKind | null {
  const shipmentStatus = readString(getFulfillment(payload), 'shipment_status').toLowerCase();
  if (topic === 'orders/create') return 'order_confirmation';
  if (topic === 'orders/cancelled') return 'order_cancelled';
  if (topic === 'orders/fulfilled' || topic === 'orders/partially_fulfilled' || topic === 'fulfillments/create' || topic === 'fulfillments/update') {
    return shipmentStatus === 'delivered' ? 'order_delivered' : 'order_shipped';
  }
  return null;
}

function extractBodyVariableCount(template: MetaTemplate): number {
  const body = template.components?.find(component => component.type === 'BODY')?.text ?? '';
  const matches = body.match(/\{\{\d+\}\}/g);
  if (!matches) return 0;
  return new Set(matches).size;
}

function buildValues(kind: ShopifyNotificationKind, payload: JsonRecord, storeName: string): string[] {
  const name = getCustomerName(payload);
  const orderName = getOrderName(payload);
  const total = formatMoney(payload);
  const trackingUrl = getTrackingUrl(payload) || readString(payload, 'order_status_url') || `https://${storeName}`;

  switch (kind) {
    case 'order_confirmation':
      return [name, orderName, total || 'confirmed', storeName, readString(payload, 'order_status_url')];
    case 'order_shipped':
      return [name, orderName, getCarrier(payload), getTrackingNumber(payload), 'soon', trackingUrl];
    case 'order_delivered':
      return [name, orderName, storeName, trackingUrl];
    case 'order_cancelled':
      return [name, orderName, total || 'the order amount', storeName];
  }
}

function buildTemplateComponents(template: MetaTemplate, kind: ShopifyNotificationKind, payload: JsonRecord, storeName: string): unknown[] {
  const bodyCount = extractBodyVariableCount(template);
  const values = buildValues(kind, payload, storeName);
  const components: unknown[] = [];

  if (bodyCount > 0) {
    components.push({
      type: 'body',
      parameters: values.slice(0, bodyCount).map(value => ({ type: 'text', text: value || '-' })),
    });
  }

  const buttons = template.components?.find(component => component.type === 'BUTTONS')?.buttons ?? [];
  buttons.forEach((button, index) => {
    if (button.type === 'URL' && button.url?.includes('{{')) {
      const text = kind === 'order_shipped' ? getTrackingUrl(payload) : readString(payload, 'order_status_url');
      if (text) {
        components.push({
          type: 'button',
          sub_type: 'url',
          index: String(index),
          parameters: [{ type: 'text', text }],
        });
      }
    }
  });

  return components;
}

async function fetchApprovedTemplates(storeId: string): Promise<MetaTemplate[]> {
  const resolved = await resolveWhatsAppConfig(storeId);
  if (!resolved.valid) throw new Error(resolved.error);

  const { wabaId, accessToken } = resolved.config;
  let nextPageUrl: string | null = graphUrl(`${META_GRAPH_API_VERSION}/${wabaId}/message_templates`, accessToken, { limit: '100' });
  const proof = getAppSecretProof(accessToken);
  const templates: MetaTemplate[] = [];

  while (nextPageUrl) {
    const response = await fetch(nextPageUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    const body = (await response.json()) as MetaTemplatesResponse;
    if (!response.ok) throw new Error(body.error?.message ?? `Meta templates HTTP ${response.status}`);
    templates.push(...(body.data ?? []));
    let next = body.paging?.next ?? null;
    if (next && proof && !next.includes('appsecret_proof')) {
      next += `${next.includes('?') ? '&' : '?'}appsecret_proof=${proof}`;
    }
    nextPageUrl = next;
  }

  return templates.filter(template => template.status.toUpperCase() === 'APPROVED');
}

function chooseTemplate(templates: MetaTemplate[], kind: ShopifyNotificationKind): MetaTemplate | null {
  const matchers = TEMPLATE_MATCHERS[kind];
  return templates.find(template => matchers.some(matcher => matcher.test(template.name))) ?? null;
}

export async function sendShopifyWhatsAppNotification(topic: string, payload: JsonRecord, shopDomain: string | null): Promise<void> {
  const kind = getNotificationKind(topic, payload);
  if (!kind || !shopDomain) return;

  const orderId = readString(payload, 'id') || readString(payload, 'order_id') || getOrderName(payload);
  const eventKey = `${topic}:${orderId}:${kind}`;
  const store = await prisma.store.findUnique({
    where: { shopifyDomain: shopDomain },
    select: { id: true, storeName: true, shopifyDomain: true },
  });
  if (!store) return;

  const existing = await prisma.message.findFirst({
    where: {
      storeId: store.id,
      direction: 'OUTBOUND',
      metadata: { path: ['shopifyNotificationKey'], equals: eventKey } as never,
    },
    select: { id: true },
  });
  if (existing) return;

  const phone = normalizePhone(getCustomerPhone(payload));
  if (!phone || !isValidPhone(phone)) {
    console.warn(`[shopify-notifications] ${eventKey} skipped: missing customer WhatsApp phone`);
    return;
  }

  const templates = await fetchApprovedTemplates(store.id);
  const template = chooseTemplate(templates, kind);
  if (!template) {
    console.warn(`[shopify-notifications] ${eventKey} skipped: no approved ${kind} template found`);
    return;
  }

  const customer = readRecord(payload, 'customer');
  const customerId = readString(customer, 'id');
  const contact = await prisma.contact.upsert({
    where: { storeId_phone: { storeId: store.id, phone } },
    update: {
      name: getCustomerName(payload),
      email: getCustomerEmail(payload) || undefined,
      shopifyCustomerId: customerId || undefined,
      source: 'SHOPIFY',
      metadata: {
        shopifyNotificationLastOrderId: orderId,
        shopifyDomain: store.shopifyDomain,
      },
    },
    create: {
      storeId: store.id,
      phone,
      name: getCustomerName(payload),
      email: getCustomerEmail(payload) || null,
      shopifyCustomerId: customerId || null,
      source: 'SHOPIFY',
      optInStatus: 'NOT_SET',
      tags: [],
      customFields: {},
      metadata: {
        createdFrom: 'shopify_webhook_notification',
        shopifyNotificationLastOrderId: orderId,
        shopifyDomain: store.shopifyDomain,
      },
    },
    select: { id: true },
  });

  const conversation = await prisma.conversation.upsert({
    where: { storeId_contactId: { storeId: store.id, contactId: contact.id } },
    update: {
      status: 'OPEN',
      lastMessageAt: new Date(),
      lastMessagePreview: template.name.slice(0, 100),
      metadata: { shopifyNotificationKey: eventKey },
    },
    create: {
      storeId: store.id,
      contactId: contact.id,
      status: 'OPEN',
      lastMessageAt: new Date(),
      lastMessagePreview: template.name.slice(0, 100),
      metadata: { shopifyNotificationKey: eventKey },
    },
    select: { id: true },
  });

  const result = await sendWhatsAppMessage({
    storeId: store.id,
    contactId: contact.id,
    conversationId: conversation.id,
    phone,
    type: 'template',
    templateName: template.name,
    templateLanguage: template.language,
    templateComponents: buildTemplateComponents(template, kind, payload, store.storeName || store.shopifyDomain),
    sentBy: null,
  });

  if (result.dbMessageId) {
    await prisma.message.update({
      where: { id: result.dbMessageId },
      data: {
        metadata: {
          shopifyNotificationKey: eventKey,
          shopifyTopic: topic,
          shopifyOrderId: orderId,
          notificationKind: kind,
        },
      },
    });
  }

  if (!result.success) {
    console.error(`[shopify-notifications] ${eventKey} failed: ${result.error ?? 'unknown error'}`);
  }
}

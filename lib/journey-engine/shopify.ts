import { journeyShopifyClient } from './store-client';
import { sendTemplate } from '@/lib/whatsapp/template-send';
import { errorIssues, type SendIssue } from '@/lib/whatsapp/issues';
import type { TemplateInput } from '@/lib/whatsapp/template-payload';
import { type ShopifyCustomerResponse, type ShopifyOrderListResponse } from '@/lib/shopify/client';
import { readJsonFile, writeJsonFile } from '@/lib/utils/json-storage';
import type { ShopifyCustomer } from '@/lib/types/shopify-customer';
import type { WhatsAppTemplateComponent } from '@/lib/types/whatsapp-config';

export async function fetchShopifyCustomer(customerId: string, storeId?: string): Promise<ShopifyCustomer | null> {
  if (!customerId) return null;
  try {
    const response = await (await journeyShopifyClient(storeId)).getCustomer(customerId);
    return response?.customer ?? null;
  } catch (error) {
    console.error('[journey-engine] Failed to fetch customer', customerId, error);
    return null;
  }
}

export async function getCustomerOrders(customerId: string, storeId?: string) {
  if (!customerId) return [];
  try {
    const response: ShopifyOrderListResponse = await (await journeyShopifyClient(storeId)).getCustomerOrders(customerId);
    const orders = response?.orders ?? [];
    return Array.isArray(orders) ? orders : [];
  } catch (error) {
    console.error('[journey-engine] Failed to fetch customer orders', customerId, error);
    return [];
  }
}

export async function addCustomerTag(customerId: string, tagName: string, storeId?: string) {
  if (!customerId || !tagName) return;
  try {
    const customerRes: ShopifyCustomerResponse = await (await journeyShopifyClient(storeId)).getCustomer(customerId);
    const customer = customerRes?.customer;
    const tags = customer?.tags ? String(customer.tags).split(',').map(tag => tag.trim()) : [];
    if (!tags.includes(tagName)) {
      tags.push(tagName);
      await (await journeyShopifyClient(storeId)).request(`/customers/${customerId}.json`, {
        method: 'PUT',
        body: JSON.stringify({ customer: { id: customerId, tags: tags.join(', ') } }),
      });
    }
  } catch (error) {
    console.error('[journey-engine] Failed to add customer tag', customerId, tagName, error);
  }
}

export async function updateCustomerMetafield(customerId: string, key: string, value: string, storeId?: string) {
  if (!customerId || !key) return;
  try {
    await (await journeyShopifyClient(storeId)).request(`/customers/${customerId}/metafields.json`, {
      method: 'POST',
      body: JSON.stringify({
        metafield: {
          namespace: 'journey_builder',
          key,
          type: 'single_line_text_field',
          value,
        },
      }),
    });
  } catch (error) {
    console.error('[journey-engine] Failed to update customer metafield', customerId, key, error);
  }
}

export interface SendWhatsAppPayload {
  to: string;
  template: string;
  language: string;
  components?: WhatsAppTemplateComponent[];
  storeId?: string;
  input?: TemplateInput;
  context?: Record<string, any>;
}

export interface SendWhatsAppResult {
  success: boolean;
  messageId?: string;
  message?: string;
  wabaMessageId?: string;
  phoneNumber?: string;
  error?: string;
  userMessage?: string;
  stub?: boolean;
  issues?: SendIssue[];
}

export async function sendWhatsAppMessage(payload: SendWhatsAppPayload): Promise<SendWhatsAppResult> {
  try {
    const result = await sendTemplate(payload.storeId ?? '', payload.to, {
      templateName: payload.template, templateLanguage: payload.language, components: payload.components, ...payload.input,
    }, payload.context);
    return { ...result, wabaMessageId: result.messageId };
  } catch (error) {
    const issues = errorIssues(error);
    return { success: false, error: issues[0].message, issues };
  }
}

export function storeCampaignMessage(record: Record<string, unknown>) {
  try {
    const existing = readJsonFile<Record<string, unknown>>('campaign-messages.json');
    existing.unshift(record);
    const MAX = 500;
    if (existing.length > MAX) existing.length = MAX;
    writeJsonFile('campaign-messages.json', existing);
  } catch (error) {
    console.error('[journey-engine] Failed to persist campaign message', error);
  }
}


import crypto from 'crypto';

import { shopifyClient, type ShopifyCustomerResponse, type ShopifyOrderListResponse } from '@/lib/shopify/client';
import { readJsonFile, writeJsonFile } from '@/lib/utils/json-storage';
import type { ShopifyCustomer } from '@/lib/types/shopify-customer';
import type { WhatsAppTemplateComponent } from '@/lib/types/whatsapp-config';

export async function fetchShopifyCustomer(customerId: string): Promise<ShopifyCustomer | null> {
  if (!customerId) return null;
  try {
    const response = await shopifyClient.getCustomer(customerId);
    return response?.customer ?? null;
  } catch (error) {
    console.error('[journey-engine] Failed to fetch customer', customerId, error);
    return null;
  }
}

export async function getCustomerOrders(customerId: string) {
  if (!customerId) return [];
  try {
    const response: ShopifyOrderListResponse = await shopifyClient.getCustomerOrders(customerId);
    const orders = response?.orders ?? [];
    return Array.isArray(orders) ? orders : [];
  } catch (error) {
    console.error('[journey-engine] Failed to fetch customer orders', customerId, error);
    return [];
  }
}

export async function addCustomerTag(customerId: string, tagName: string) {
  if (!customerId || !tagName) return;
  try {
    const customerRes: ShopifyCustomerResponse = await shopifyClient.getCustomer(customerId);
    const customer = customerRes?.customer;
    const tags = customer?.tags ? String(customer.tags).split(',').map(tag => tag.trim()) : [];
    if (!tags.includes(tagName)) {
      tags.push(tagName);
      await shopifyClient.request(`/customers/${customerId}.json`, {
        method: 'PUT',
        body: JSON.stringify({ customer: { id: customerId, tags: tags.join(', ') } }),
      });
    }
  } catch (error) {
    console.error('[journey-engine] Failed to add customer tag', customerId, tagName, error);
  }
}

export async function updateCustomerMetafield(customerId: string, key: string, value: string) {
  if (!customerId || !key) return;
  try {
    await shopifyClient.request(`/customers/${customerId}/metafields.json`, {
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
}

export async function sendWhatsAppMessage(payload: SendWhatsAppPayload): Promise<SendWhatsAppResult> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_BASE_URL || process.env.NEXTAUTH_URL;
    if (!baseUrl) {
      console.warn('[journey-engine] APP base URL not configured. Skipping WhatsApp send and returning stub response.');
      return {
        success: true,
        messageId: `stub_${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`,
        stub: true,
      };
    }

    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/whatsapp/send-template`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        templateName: payload.template,
        phoneNumber: payload.to,
        language: payload.language,
        components: payload.components,
        variables: {},
      }),
    });

    const data = (await response.json()) as SendWhatsAppResult & { error?: string };
    if (!response.ok) {
      throw new Error(data?.error || 'Failed to send WhatsApp message');
    }
    return data;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[journey-engine] Failed to send WhatsApp message:', message);
    return { success: false, error: message };
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


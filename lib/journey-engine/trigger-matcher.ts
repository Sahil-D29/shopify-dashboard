import type { JourneyDefinition, JourneyNode, JourneyNodeData } from '@/lib/types/journey';

import { fetchShopifyCustomer } from './shopify';
import { evaluateConditions } from './condition-evaluator';
import { startJourneyExecution } from './executor';
import {
  getActiveJourneys,
  getCustomerEnrollments,
  getLastEnrollment,
} from './storage';
import type { EngineCondition, ConditionContext } from './condition-evaluator';

type JsonRecord = Record<string, unknown>;

interface EventPayload {
  shop?: string | null;
  payload: JsonRecord;
  receivedAt?: string;
}

interface TriggerMeta {
  triggerType?: string;
  webhookEvent?: string;
  segmentId?: string;
  conditions?: EngineCondition[];
  conditionJoin?: 'all' | 'any' | 'AND' | 'OR';
  orderValueOperator?: 'gt' | 'lt' | 'eq' | 'equals';
  orderValueAmount?: number;
  productCategories?: string[];
  customerTags?: string[];
  locationField?: string;
  locationValue?: string;
}

interface JourneyEventCustomer {
  id: string;
  email?: string | null;
  phone?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(item => String(item)) : [];

const normaliseJoinLogic = (join: TriggerMeta['conditionJoin']): 'all' | 'any' =>
  join && join.toLowerCase() === 'any' ? 'any' : 'all';

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toEngineConditions = (value: unknown): EngineCondition[] =>
  Array.isArray(value)
    ? value.filter((item): item is EngineCondition => {
        if (!isRecord(item)) return false;
        const source = item.source;
        const field = item.field;
        const operator = item.operator;
        return (
          typeof source === 'string' &&
          typeof field === 'string' &&
          typeof operator === 'string'
        );
      })
    : [];

const parseTags = (tags: string | null | undefined): string[] =>
  typeof tags === 'string'
    ? tags
        .split(',')
        .map(tag => tag.trim())
        .filter(Boolean)
    : [];

export async function matchAndExecuteJourneys(eventType: string, eventData: EventPayload) {
  const journeys = getActiveJourneys();
  if (journeys.length === 0) return;

  for (const journey of journeys) {
    const triggerNodes = journey.nodes.filter(node => node.type === 'trigger');
    if (!triggerNodes.length) continue;

    for (const trigger of triggerNodes) {
      const config = extractTriggerConfig(trigger);
      if (!(await triggerMatches(config, eventType, eventData))) {
        continue;
      }

      const customers = await getAffectedCustomers(eventData);
      for (const customer of customers) {
        if (!customer?.id) continue;
        const allowed = await canEnterJourney(journey, customer.id);
        if (!allowed) continue;

        await startJourneyExecution(journey, customer, trigger, eventData.payload as JsonRecord);
      }
    }
  }
}

async function triggerMatches(config: TriggerMeta, eventType: string, eventData: EventPayload): Promise<boolean> {
  const expectedEvent = (config.webhookEvent || config.triggerType || '').toLowerCase();
  if (expectedEvent && expectedEvent !== eventType.toLowerCase()) {
    return false;
  }

  const payload = eventData.payload ?? {};
  const primaryCustomer = extractPrimaryCustomer(payload);
  const customer = primaryCustomer?.id ? await fetchShopifyCustomer(primaryCustomer.id) : null;

  if (config.orderValueOperator && config.orderValueAmount) {
    const total = toNumber(
      payload.total_price ??
        payload.subtotal_price ??
        payload.total ??
        payload.totalPrice ??
        payload.totalAmount,
    ) ?? 0;
    switch (config.orderValueOperator) {
      case 'gt':
        if (!(total > config.orderValueAmount)) return false;
        break;
      case 'lt':
        if (!(total < config.orderValueAmount)) return false;
        break;
      case 'eq':
      case 'equals':
        if (!(total === config.orderValueAmount)) return false;
        break;
      default:
        break;
    }
  }

  if (config.productCategories && config.productCategories.length) {
    const categories = new Set<string>();
    const lineItems = Array.isArray(payload.line_items)
      ? (payload.line_items as unknown[])
      : Array.isArray(payload.items)
        ? (payload.items as unknown[])
        : [];
    lineItems.forEach(item => {
      if (isRecord(item)) {
        const productType =
          typeof item.product_type === 'string'
            ? item.product_type
            : typeof item.productType === 'string'
              ? item.productType
              : undefined;
        if (productType) categories.add(productType);
      }
    });
    if (!config.productCategories.some(category => categories.has(category))) {
      return false;
    }
  }

  if (config.customerTags && config.customerTags.length) {
    const tags = parseTags(customer?.tags ?? null);
    if (!config.customerTags.every(tag => tags.includes(tag))) {
      return false;
    }
  }

  if (config.locationField && config.locationValue) {
    const defaultAddress = customer?.default_address;
    if (isRecord(defaultAddress)) {
      const value = (defaultAddress as Record<string, unknown>)[config.locationField];
      if (!value || String(value).toLowerCase() !== String(config.locationValue).toLowerCase()) {
        return false;
      }
    } else {
      return false;
    }
  }

  if (config.conditions && config.conditions.length) {
    const logic = normaliseJoinLogic(config.conditionJoin);
    const conditionContext: ConditionContext = {
      triggerEvent: eventData.payload,
      order: eventData.payload,
    };
    if (primaryCustomer?.id) {
      conditionContext.customerId = primaryCustomer.id;
      conditionContext.customer = customer ?? null;
    }
    const evaluated = await evaluateConditions(config.conditions, conditionContext, logic);
    if (!evaluated) return false;
  }

  return true;
}

async function getAffectedCustomers(eventData: EventPayload): Promise<JourneyEventCustomer[]> {
  const payload = eventData.payload ?? {};
  const customer = extractPrimaryCustomer(payload);
  if (customer?.id) {
    const full = await fetchShopifyCustomer(customer.id);
    return [
      {
        id: customer.id,
        email: customer.email ?? full?.email ?? null,
        phone: customer.phone ?? full?.phone ?? null,
        first_name: full?.first_name ?? null,
        last_name: full?.last_name ?? null,
      },
    ];
  }
  return [];
}

function extractPrimaryCustomer(payload: JsonRecord): JourneyEventCustomer | null {
  if (!payload) return null;
  if (isRecord(payload.customer)) {
    const customer = payload.customer as JsonRecord;
    const id = customer.id ?? payload.customer_id ?? payload.id;
    if (!id) return null;
    return {
      id: String(id),
      email: typeof customer.email === 'string' ? customer.email : null,
      phone: typeof customer.phone === 'string' ? customer.phone : null,
      first_name: typeof customer.first_name === 'string' ? customer.first_name : null,
      last_name: typeof customer.last_name === 'string' ? customer.last_name : null,
    };
  }
  if (typeof payload.customer_id !== 'undefined' || typeof payload.id !== 'undefined') {
    const id = payload.customer_id ?? payload.id;
    return {
      id: String(id),
      email: typeof payload.email === 'string' ? payload.email : typeof payload.contact_email === 'string' ? payload.contact_email : null,
      phone: typeof payload.phone === 'string' ? payload.phone : null,
    };
  }
  return null;
}

function extractTriggerConfig(node: JourneyNode): TriggerMeta {
  const nodeData = node.data as JourneyNodeData | undefined;
  const metaSource = isRecord(nodeData?.meta) ? (nodeData.meta as JsonRecord) : {};
  const dataSource = isRecord(nodeData) ? (nodeData as JsonRecord) : {};
  const triggerSource = isRecord((node as { trigger?: JsonRecord }).trigger) ? ((node as { trigger?: JsonRecord }).trigger as JsonRecord) : {};
  const meta = { ...dataSource, ...metaSource, ...triggerSource };
  return {
    triggerType: typeof meta.triggerType === 'string' ? meta.triggerType : typeof meta.type === 'string' ? meta.type : undefined,
    webhookEvent: typeof meta.webhookEvent === 'string' ? meta.webhookEvent : typeof meta.eventType === 'string' ? meta.eventType : undefined,
    segmentId: typeof meta.segmentId === 'string' ? meta.segmentId : undefined,
    conditions: toEngineConditions(meta.conditions ?? meta.args),
    conditionJoin: typeof meta.conditionJoin === 'string' ? meta.conditionJoin as TriggerMeta['conditionJoin'] : typeof meta.conditionLogic === 'string' ? meta.conditionLogic as TriggerMeta['conditionJoin'] : undefined,
    orderValueOperator: meta.orderValueOperator as TriggerMeta['orderValueOperator'],
    orderValueAmount: toNumber(meta.orderValueAmount) ?? undefined,
    productCategories: toStringArray(meta.productCategories),
    customerTags: toStringArray(meta.customerTags),
    locationField: typeof meta.locationField === 'string' ? meta.locationField : undefined,
    locationValue: typeof meta.locationValue === 'string' ? meta.locationValue : undefined,
  };
}

async function canEnterJourney(journey: JourneyDefinition, customerId: string): Promise<boolean> {
  const settings = (journey.settings as Record<string, unknown>) || {};
  const allowReentry = typeof settings.allowReentry === 'boolean' ? settings.allowReentry : false;
  const cooldownDays = typeof settings.reentryCooldownDays === 'number' ? settings.reentryCooldownDays : typeof settings.reentryCooldown === 'number' ? settings.reentryCooldown : 0;

  const prior = getCustomerEnrollments(journey.id, customerId);
  if (!allowReentry) {
    return prior.length === 0;
  }

  if (cooldownDays) {
    const last = getLastEnrollment(journey.id, customerId);
    if (last) {
      const cooldownEnd = new Date(last.enteredAt);
      cooldownEnd.setDate(cooldownEnd.getDate() + Number(cooldownDays));
      if (Date.now() < cooldownEnd.getTime()) {
        return false;
      }
    }
  }

  return true;
}


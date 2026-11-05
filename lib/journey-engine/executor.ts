import { replayDeliveryReceipt } from '@/lib/whatsapp/delivery-receipts';
import { prisma } from '@/lib/prisma';
import { checkoutKey, checkoutPurchased, checkoutTemplateInput } from './checkout';
import { normalizePhone } from '@/lib/whatsapp/normalize-phone';
import { whatsappNodeConfig, isWhatsAppNode } from '@/lib/whatsapp/node-config';
import { errorIssues, issue, SendValidationError } from '@/lib/whatsapp/issues';
import type { JourneyDefinition, JourneyEdge, JourneyNode, JourneyNodeData } from '@/lib/types/journey';
import type { EngineCondition, ConditionContext } from './condition-evaluator';
import type { ShopifyOrder, ShopifyOrderLineItem } from '@/lib/shopify/client';
import type { ShopifyCustomer } from '@/lib/types/shopify-customer';
import type {
  WhatsAppTemplateBodyParameter,
  WhatsAppTemplateComponent,
} from '@/lib/types/whatsapp-config';

import {
  appendEnrollment,
  appendJourneyActivity,
  cancelScheduledExecutionsForEnrollment,
  getEnrollmentById,
  getJourneyActivityLogs,
  markScheduledExecution,
  addScheduledExecution,
  getScheduledExecutions,
  updateEnrollmentRecord,
  JourneyEnrollmentRecord,
  ScheduledExecutionRecord,
  getJourneyById,
} from './storage';
import { convertToMilliseconds, generateId, nextRetryDelay } from './utils';
import {
  addCustomerTag,
  fetchShopifyCustomer,
  getCustomerOrders,
  sendWhatsAppMessage,
  storeCampaignMessage,
  updateCustomerMetafield,
} from './shopify';
import { evaluateConditions } from './condition-evaluator';

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_RETRY_BASE_MS = 60_000;

type JsonRecord = Record<string, unknown>;

interface ExperimentVariantConfig {
  id?: string;
  label?: string;
  weight?: number;
}

interface NodeConfig extends JsonRecord {
  type?: string;
  subtype?: string;
  templateName?: string;
  templateLanguage?: string;
  components?: WhatsAppTemplateComponent[];
  tagName?: string;
  propertyKey?: string;
  propertyValue?: string;
  delayMode?: 'event' | 'until' | string;
  eventName?: string;
  timeoutDuration?: number;
  timeoutUnit?: 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks';
  waitUntil?: string;
  duration?: number;
  unit?: 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks';
  conditions?: EngineCondition[];
  conditionJoin?: 'all' | 'any';
  trueLabel?: string;
  falseLabel?: string;
  variants?: ExperimentVariantConfig[];
  evaluationMetric?: string;
  guardrailMetric?: string;
  sampleSize?: number;
  retryMaxAttempts?: number;
  retryDelayMs?: number;
  retryDelayMinutes?: number;
  retryMaxDelayMs?: number;
  retryStrategy?: 'linear' | 'exponential';
  goalType?: string;
  orderThreshold?: number;
  minValue?: number;
  productId?: string;
  linkTracking?: string;
}

interface CustomerSummary {
  id: string;
  email?: string | null;
  phone?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}

const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const parseTags = (tags: string | null | undefined): string[] =>
  typeof tags === 'string'
    ? tags
        .split(',')
        .map(tag => tag.trim())
        .filter(Boolean)
    : [];

const hasLineItem = (lineItems: ShopifyOrderLineItem[], productId: string): boolean =>
  lineItems.some(item => String(item.product_id ?? '') === productId);

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toWhatsAppBodyParameter = (value: unknown): WhatsAppTemplateBodyParameter | null => {
  if (!isRecord(value)) return null;
  return value.type === 'text' && typeof value.text === 'string' ? { type: 'text', text: value.text } : null;
};

const toWhatsAppComponent = (value: unknown): WhatsAppTemplateComponent | null => {
  if (!isRecord(value)) return null;
  const type = typeof value.type === 'string' ? value.type : undefined;
  if (!type) return null;

  if (type === 'body') {
    const parameters = Array.isArray(value.parameters)
      ? value.parameters
          .map(toWhatsAppBodyParameter)
          .filter((param): param is WhatsAppTemplateBodyParameter => param !== null)
      : [];
    return { type: 'body', parameters };
  }

  const parameters =
    Array.isArray(value.parameters) && value.parameters.every(isRecord)
      ? (value.parameters as Array<Record<string, unknown>>)
      : undefined;

  return parameters ? { type, parameters } : { type };
};

export async function startJourneyExecution(
  journey: JourneyDefinition,
  customer: CustomerSummary,
  triggerNode: JourneyNode,
  eventData: JsonRecord
) {
  if (!journey.storeId) throw new Error('Journey store is required');
  if (journey.settings?.testMode && !journey.settings.testPhoneNumbers?.some(phone => normalizePhone(phone) === normalizePhone(customer.phone ?? ''))) return;
  const enrollment: JourneyEnrollmentRecord = {
    id: generateId('enroll'),
    journeyId: journey.id,
    customerId: customer.id,
    customerEmail: customer.email ?? undefined,
    customerPhone: customer.phone ?? undefined,
    status: 'active',
    currentNodeId: triggerNode.id,
    completedNodes: [triggerNode.id],
    enteredAt: new Date().toISOString(),
    lastActivityAt: new Date().toISOString(),
    completedAt: null,
    goalAchieved: false,
    conversionValue: undefined,
    context: {
      storeId: journey.storeId,
      triggerEvent: eventData,
      customer: { ...customer, ...(eventData.customer as object ?? {}) },
      order: eventData.order,
      product: eventData.product,
      variables: {},
    },
    waitingForEvent: null,
    waitingForEventTimeout: null,
    waitingForGoal: false,
    goalNodeId: null,
    metadata: {},
  };

  const key = checkoutKey(eventData);
  const claimKey = key ?? (journey.settings?.allowReentry ? String(eventData.eventId ?? enrollment.id) : customer.id);
  try {
    await prisma.$transaction(async tx => {
      await tx.journeyEntryClaim.create({ data: { id: crypto.randomUUID(), storeId: journey.storeId!, journeyId: journey.id, checkoutKey: claimKey, enrollmentId: enrollment.id } });
      await tx.journeyEnrollmentDoc.create({ data: { id: enrollment.id, journeyId: journey.id, customerId: customer.id, status: enrollment.status, data: JSON.parse(JSON.stringify(enrollment)) } });
    });
  } catch (error) { if ((error as any).code === 'P2002') return; throw error; }
  await logJourneyActivity(enrollment.id, 'journey_started', {
    journeyId: journey.id,
    journeyName: journey.name,
    customerId: customer.id,
    reason: key ? 'abandoned_checkout' : 'trigger_matched',
    checkoutKey: key,
  });

  const nextEdge = findNextEdge(journey.edges, triggerNode.id);
  if (!nextEdge) {
    return;
  }
  const nextNode = journey.nodes.find(node => node.id === nextEdge.target);
  if (nextNode) {
    await executeNode(journey, enrollment, nextNode);
  }
}

export async function executeNode(
  journey: JourneyDefinition,
  enrollment: JourneyEnrollmentRecord,
  node?: JourneyNode
) {
  if (!node) return;
  const liveJourney = await prisma.journeyDoc.findFirst({ where: { id: journey.id, storeId: journey.storeId, status: 'ACTIVE' } });
  const liveEnrollment = await prisma.journeyEnrollmentDoc.findUnique({ where: { id: enrollment.id } });
  if (!liveJourney || !liveEnrollment || !['active', 'waiting'].includes(liveEnrollment.status)) return;

  enrollment.status = 'active';
  enrollment.currentNodeId = node.id;
  enrollment.lastActivityAt = new Date().toISOString();
  await updateEnrollmentRecord(enrollment);

  await logJourneyActivity(enrollment.id, 'node_entered', {
    nodeId: node.id,
    nodeType: node.type,
  });

  switch (node.type) {
    case 'action':
      await executeActionNode(journey, enrollment, node);
      break;
    case 'delay':
      await executeDelayNode(journey, enrollment, node);
      break;
    case 'condition':
      await executeConditionNode(journey, enrollment, node);
      break;
    case 'goal':
      await executeGoalNode(journey, enrollment, node);
      break;
    default:
      await moveToNextNode(journey, enrollment, node);
      break;
  }
}

async function executeActionNode(
  journey: JourneyDefinition,
  enrollment: JourneyEnrollmentRecord,
  node: JourneyNode
) {
  const config = extractNodeConfig(node);
  const nodeData = node.data as JourneyNodeData | undefined;
  const subtype = node.subtype ?? (typeof nodeData?.subtype === 'string' ? nodeData.subtype : undefined) ?? (typeof config.type === 'string' ? config.type : undefined);
  let acceptedMessageId: string | undefined;
  try {
    if (isWhatsAppNode(node)) {
      if (!enrollment.customerPhone) throw new SendValidationError([issue('MISSING_PHONE', 'This recipient has no WhatsApp phone number.', 'phone')]);
      let input = config;
      if (journey.settings?.checkoutReminder) {
        const event = enrollment.context.triggerEvent as Record<string, any>;
        let purchased: boolean;
        try { purchased = await checkoutPurchased(journey.storeId!, event); }
        catch (error) {
          if (error instanceof SendValidationError) throw error;
          throw new SendValidationError([{ ...issue('PURCHASE_CHECK_FAILED', 'Could not verify whether this checkout was purchased. No message was sent.'), retryable: true, action: 'Check the Shopify connection, then revalidate this journey.' }]);
        }
        if (purchased) { await exitJourney(enrollment, 'purchase_completed'); return; }
        input = await checkoutTemplateInput(journey.storeId!, config, event);
      }
      const current = await prisma.journeyEnrollmentDoc.findUnique({ where: { id: enrollment.id } });
      if (!current || !['active', 'waiting'].includes(current.status)) return;
      const messageResult = await sendWhatsAppMessage({
        to: enrollment.customerPhone,
        template: config.templateName || '',
        language: config.templateLanguage || 'en',
        components: config.components || [],
        storeId: journey.storeId,
        input,
        context: { ...enrollment.context, customer: { ...(enrollment.context.customer as object ?? {}), phone: enrollment.customerPhone, email: enrollment.customerEmail } },
      });
      if (!messageResult.success) {
        throw new SendValidationError(messageResult.issues ?? [issue('SEND_FAILED', messageResult.error ?? 'Sending failed')]);
      }
      acceptedMessageId = messageResult.messageId;
      await logJourneyActivity(enrollment.id, 'whatsapp_sent', {
        nodeId: node.id,
        template: config.templateName,
        result: messageResult,
      });
      if (acceptedMessageId) await replayDeliveryReceipt(acceptedMessageId, journey.storeId!);
      storeCampaignMessage({
        id: generateId('msg'),
        journeyId: journey.id,
        enrollmentId: enrollment.id,
        nodeId: node.id,
        to: enrollment.customerPhone,
        templateName: config.templateName,
        sentAt: new Date().toISOString(),
        meta: messageResult,
      });
    } else if (subtype === 'add_tag' && config.tagName) {
      await addCustomerTag(enrollment.customerId, config.tagName, journey.storeId);
      await logJourneyActivity(enrollment.id, 'tag_added', {
        nodeId: node.id,
        tagName: config.tagName,
      });
    } else if (subtype === 'update_property' && config.propertyKey) {
      await updateCustomerMetafield(enrollment.customerId, config.propertyKey, config.propertyValue ?? '', journey.storeId);
      await logJourneyActivity(enrollment.id, 'property_updated', {
        nodeId: node.id,
        propertyKey: config.propertyKey,
      });
    }

    await clearFailure(enrollment, node.id);
    enrollment.completedNodes.push(node.id);
    await updateEnrollmentRecord(enrollment);
    await moveToNextNode(journey, enrollment, node);
  } catch (error) {
    if (acceptedMessageId) error = new SendValidationError([{ ...issue('SEND_OUTCOME_UNKNOWN', 'Meta accepted the message, but recording the result failed. Do not resend.'), customerFixable: false, referenceId: acceptedMessageId, action: 'Contact support to reconcile this message.' }]);
    console.error('[journey-engine] Action node failed', error);
    const attempt = await recordFailure(enrollment, node.id, error);
    await logJourneyActivity(enrollment.id, 'node_error', {
      nodeId: node.id,
      error: errorIssues(error)[0].message,
      issues: errorIssues(error).map(item => ({ ...item, nodeId: node.id })),
      attempt,
    });
    if (error instanceof SendValidationError && !error.issues.some(item => item.retryable)) {
      enrollment.status = 'failed';
      enrollment.exitReason = 'node_failure';
      await updateEnrollmentRecord(enrollment);
      await cancelScheduledExecutionsForEnrollment(enrollment.id);
    } else await scheduleRetryIfPossible(journey, enrollment, node, attempt, 'node_action_failure');
  }
}

async function executeDelayNode(
  journey: JourneyDefinition,
  enrollment: JourneyEnrollmentRecord,
  node: JourneyNode
) {
  const config = extractNodeConfig(node);
  const now = Date.now();
  let resumeAt: number | null = null;

  if (config.delayMode === 'event') {
    enrollment.waitingForEvent = config.eventName || null;
    if (config.timeoutDuration && config.timeoutUnit) {
      const timeoutMs =
        config.timeoutUnit === 'seconds'
          ? Number(config.timeoutDuration) * 1000
          : convertToMilliseconds(
              config.timeoutDuration,
              config.timeoutUnit as 'minutes' | 'hours' | 'days' | 'weeks'
            );
      enrollment.waitingForEventTimeout = new Date(now + timeoutMs).toISOString();
    }
    enrollment.status = 'waiting';
    enrollment.completedNodes.push(node.id);
    await updateEnrollmentRecord(enrollment);
    return;
  }

  if (config.delayMode === 'until' && config.waitUntil) {
    resumeAt = Date.parse(config.waitUntil);
  } else if (config.duration && config.unit) {
    const delayMs =
      config.unit === 'seconds'
        ? Number(config.duration) * 1000
        : convertToMilliseconds(
            config.duration,
            config.unit as 'minutes' | 'hours' | 'days' | 'weeks'
          );
    resumeAt = now + delayMs;
  }

  if (!resumeAt) {
    await moveToNextNode(journey, enrollment, node);
    return;
  }

  const schedule: ScheduledExecutionRecord = {
    id: generateId('sched'),
    journeyId: journey.id,
    enrollmentId: enrollment.id,
    nodeId: node.id,
    resumeAt: new Date(resumeAt).toISOString(),
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  await addScheduledExecution(schedule);

  enrollment.status = 'waiting';
  enrollment.completedNodes.push(node.id);
  await updateEnrollmentRecord(enrollment);
}

async function executeConditionNode(
  journey: JourneyDefinition,
  enrollment: JourneyEnrollmentRecord,
  node: JourneyNode
) {
  const config = extractNodeConfig(node);

  if (node.subtype === 'ab_test' || config.type === 'ab_test') {
    await executeExperimentNode(journey, enrollment, node, config);
    return;
  }

  const customer = await fetchShopifyCustomer(enrollment.customerId, String(enrollment.context.storeId ?? ''));
  const context: ConditionContext = {
    storeId: journey.storeId,
    customer,
    customerId: enrollment.customerId,
    triggerEvent: (enrollment.context.triggerEvent as JsonRecord | undefined) ?? {},
    order: (enrollment.context.triggerEvent as JsonRecord | undefined) ?? {},
  };

  const result = await evaluateConditions(config.conditions ?? [], context, (config.conditionJoin as 'all' | 'any') ?? 'all');

  await logJourneyActivity(enrollment.id, 'condition_evaluated', {
    nodeId: node.id,
    result,
  });

  await clearFailure(enrollment, node.id);
  enrollment.completedNodes.push(node.id);
  await updateEnrollmentRecord(enrollment);

  const label = result ? (config.trueLabel || 'Yes') : (config.falseLabel || 'No');
  const nextEdge = findNextEdge(journey.edges, node.id, label);
  if (nextEdge) {
    const nextNode = journey.nodes.find(item => item.id === nextEdge.target);
    await executeNode(journey, enrollment, nextNode);
  } else {
    await exitJourney(enrollment, 'no_path');
  }
}

async function executeGoalNode(
  journey: JourneyDefinition,
  enrollment: JourneyEnrollmentRecord,
  node: JourneyNode
) {
  const config = extractNodeConfig(node);
  const achieved = await checkGoalAchievement(config, enrollment);

  if (achieved) {
    enrollment.status = 'completed';
    enrollment.goalAchieved = true;
    enrollment.completedAt = new Date().toISOString();
    enrollment.completedNodes.push(node.id);
    await updateEnrollmentRecord(enrollment);
    await logJourneyActivity(enrollment.id, 'goal_achieved', {
      nodeId: node.id,
      goalType: config.goalType,
    });
  } else {
    enrollment.waitingForGoal = true;
    enrollment.goalNodeId = node.id;
    await updateEnrollmentRecord(enrollment);
    await logJourneyActivity(enrollment.id, 'goal_pending', {
      nodeId: node.id,
    });
  }
}

export async function moveToNextNode(
  journey: JourneyDefinition,
  enrollment: JourneyEnrollmentRecord,
  currentNode: JourneyNode
) {
  const nextEdge = findNextEdge(journey.edges, currentNode.id);
  if (!nextEdge) {
    await exitJourney(enrollment, 'completed');
    return;
  }

  const nextNode = journey.nodes.find(node => node.id === nextEdge.target);
  if (!nextNode) {
    await exitJourney(enrollment, 'no_path');
    return;
  }

  await executeNode(journey, enrollment, nextNode);
}

export async function exitJourney(
  enrollment: JourneyEnrollmentRecord,
  reason: 'completed' | 'timeout' | 'no_path' | 'manual' | 'unsubscribed' | 'purchase_completed'
) {
  enrollment.status = 'exited';
  enrollment.exitReason = reason;
  enrollment.completedAt = new Date().toISOString();
  await updateEnrollmentRecord(enrollment);
  await cancelScheduledExecutionsForEnrollment(enrollment.id);
  await logJourneyActivity(enrollment.id, 'journey_exited', { reason });
}

function extractNodeConfig(node: JourneyNode): NodeConfig {
  const nodeData = (node.data ?? {}) as JourneyNodeData;
  const combined: NodeConfig = {};

  if (nodeData && typeof nodeData === 'object') {
    Object.assign(combined, nodeData as JsonRecord);
  }
  if (nodeData.meta && typeof nodeData.meta === 'object') {
    Object.assign(combined, nodeData.meta as JsonRecord);
  }
  if (nodeData.config && typeof nodeData.config === 'object') {
    Object.assign(combined, nodeData.config as JsonRecord);
  }

  Object.assign(combined, whatsappNodeConfig(node));
  delete combined.meta;
  delete combined.config;

  if (Array.isArray(combined.components)) {
    combined.components = combined.components
      .map(toWhatsAppComponent)
      .filter((component): component is WhatsAppTemplateComponent => component !== null);
  }

  if (Array.isArray(combined.variants)) {
    combined.variants = combined.variants as ExperimentVariantConfig[];
  }

  return {
    type: node.subtype ?? (typeof nodeData.subtype === 'string' ? nodeData.subtype : undefined) ?? (typeof combined.type === 'string' ? combined.type : undefined),
    ...combined,
  };
}

function findNextEdge(edges: JourneyEdge[], sourceId: string, label?: string): JourneyEdge | undefined {
  if (label) {
    const byLabel = edges.find(edge => edge.source === sourceId && edge.label === label);
    if (byLabel) return byLabel;
  }
  return edges.find(edge => edge.source === sourceId);
}

async function logJourneyActivity(enrollmentId: string, eventType: string, data: JsonRecord) {
  await appendJourneyActivity({
    id: generateId('log'),
    enrollmentId,
    timestamp: new Date().toISOString(),
    eventType,
    data,
  });
}

interface FailureState {
  attempts: number;
  firstFailedAt: string;
  lastFailedAt: string;
  lastError?: string;
}

function getFailureMap(enrollment: JourneyEnrollmentRecord): Record<string, FailureState> {
  const metadata = (enrollment.metadata ??= {});
  const map = (metadata.failures ??= {});
  return map as Record<string, FailureState>;
}

async function recordFailure(enrollment: JourneyEnrollmentRecord, nodeId: string, error: unknown): Promise<number> {
  const failures = getFailureMap(enrollment);
  const nowIso = new Date().toISOString();
  const existing = failures[nodeId];
  if (existing) {
    existing.attempts += 1;
    existing.lastFailedAt = nowIso;
    existing.lastError = error ? getErrorMessage(error) : existing.lastError;
    failures[nodeId] = existing;
    enrollment.metadata!.failures = failures;
  } else {
    failures[nodeId] = {
      attempts: 1,
      firstFailedAt: nowIso,
      lastFailedAt: nowIso,
      lastError: error ? getErrorMessage(error) : undefined,
    };
  }
  await updateEnrollmentRecord(enrollment);
  return failures[nodeId].attempts;
}

async function clearFailure(enrollment: JourneyEnrollmentRecord, nodeId: string) {
  const failures = getFailureMap(enrollment);
  if (!failures[nodeId]) return;
  delete failures[nodeId];
  enrollment.metadata!.failures = failures;
  await updateEnrollmentRecord(enrollment);
}

async function scheduleRetryIfPossible(
  journey: JourneyDefinition,
  enrollment: JourneyEnrollmentRecord,
  node: JourneyNode,
  attempt: number,
  reason: string
) {
  const config = extractNodeConfig(node);
  const configuredMaxAttempts = Number(config.retryMaxAttempts ?? config.maxAttempts);
  const maxAttempts =
    Number.isFinite(configuredMaxAttempts) && configuredMaxAttempts > 0
      ? configuredMaxAttempts
      : DEFAULT_MAX_ATTEMPTS;

  if (attempt >= maxAttempts) {
    enrollment.status = 'failed';
    enrollment.exitReason = 'node_failure';
    enrollment.completedAt = new Date().toISOString();
    await updateEnrollmentRecord(enrollment);
    await cancelScheduledExecutionsForEnrollment(enrollment.id);
    await logJourneyActivity(enrollment.id, 'journey_failed', {
      nodeId: node.id,
      attempts: attempt,
      reason,
    });
    return;
  }

  const baseDelayMsCandidate =
    Number(config.retryDelayMs) ||
    (config.retryDelayMinutes ? convertToMilliseconds(config.retryDelayMinutes, 'minutes') : undefined) ||
    DEFAULT_RETRY_BASE_MS;
  const baseDelayMs = Number(baseDelayMsCandidate) > 0 ? Number(baseDelayMsCandidate) : DEFAULT_RETRY_BASE_MS;
  const maxDelayMs = Number(config.retryMaxDelayMs) > 0 ? Number(config.retryMaxDelayMs) : undefined;
  const strategy = (config.retryStrategy as 'linear' | 'exponential') ?? 'exponential';
  const delayMs = nextRetryDelay(attempt, strategy, baseDelayMs, maxDelayMs ?? baseDelayMs * 32);

  const schedule: ScheduledExecutionRecord = {
    id: generateId('retry'),
    journeyId: journey.id,
    enrollmentId: enrollment.id,
    nodeId: node.id,
    resumeAt: new Date(Date.now() + delayMs).toISOString(),
    status: 'pending',
    createdAt: new Date().toISOString(),
    metadata: {
      kind: 'retry',
      attempt,
      reason,
    },
  };

  await addScheduledExecution(schedule);

  enrollment.status = 'waiting';
  enrollment.currentNodeId = node.id;
  await updateEnrollmentRecord(enrollment);

  await logJourneyActivity(enrollment.id, 'retry_scheduled', {
    nodeId: node.id,
    attempt,
    delayMs,
    strategy,
  });
}

interface ExperimentAssignment {
  variantId?: string;
  variantLabel: string;
  weight?: number;
  assignedAt: string;
  evaluationMetric?: string;
  guardrailMetric?: string;
  sampleSize?: number;
  edgeId?: string;
}

type ExperimentAssignments = Record<string, ExperimentAssignment>;

function getExperimentAssignments(enrollment: JourneyEnrollmentRecord): ExperimentAssignments {
  const metadata = (enrollment.metadata ??= {});
  const experiments = (metadata.experiments ??= {});
  return experiments as ExperimentAssignments;
}

function pickVariant(
  variants: Array<{ id?: string; label?: string; weight?: number }>
): { variantId?: string; variantLabel: string; weight?: number } | null {
  if (!variants.length) return null;
  const normalised = variants.map(variant => {
    const variantId =
      typeof variant.id === 'string' && variant.id.trim().length > 0 ? variant.id : undefined;
    return {
      variantId,
      variantLabel: variant.label || variantId || 'Variant',
      weight: Number.isFinite(variant.weight) ? Math.max(0, Number(variant.weight)) : 0,
    };
  });

  const totalWeight = normalised.reduce((sum, variant) => sum + variant.weight, 0);
  if (totalWeight <= 0) {
    const equalWeight = 100 / normalised.length;
    normalised.forEach(variant => {
      variant.weight = equalWeight;
    });
  }

  const sum = normalised.reduce((acc, variant) => acc + variant.weight, 0);
  let threshold = Math.random() * sum;
  for (const variant of normalised) {
    threshold -= variant.weight;
    if (threshold <= 0) {
      return variant;
    }
  }
  return normalised[normalised.length - 1];
}

async function executeExperimentNode(
  journey: JourneyDefinition,
  enrollment: JourneyEnrollmentRecord,
  node: JourneyNode,
  config: NodeConfig
) {
  const variants = Array.isArray(config?.variants) ? (config.variants as ExperimentVariantConfig[]) : [];
  if (!variants.length) {
    await logJourneyActivity(enrollment.id, 'experiment_error', {
      nodeId: node.id,
      error: 'No variants configured',
    });
    await exitJourney(enrollment, 'no_path');
    return;
  }

  const assignments = getExperimentAssignments(enrollment);
  let assignment = assignments[node.id];

  if (!assignment) {
    const choice = pickVariant(variants);
    if (!choice) {
      await logJourneyActivity(enrollment.id, 'experiment_error', {
        nodeId: node.id,
        error: 'Unable to choose variant',
      });
      await exitJourney(enrollment, 'no_path');
      return;
    }
    assignment = {
      variantId: choice.variantId,
      variantLabel: choice.variantLabel,
      weight: choice.weight,
      assignedAt: new Date().toISOString(),
      evaluationMetric: config?.evaluationMetric,
      guardrailMetric: config?.guardrailMetric,
      sampleSize: config?.sampleSize,
    };
    assignments[node.id] = assignment;
    enrollment.metadata!.experiments = assignments;
    await updateEnrollmentRecord(enrollment);
    await logJourneyActivity(enrollment.id, 'experiment_assigned', {
      nodeId: node.id,
      variantId: assignment.variantId,
      variantLabel: assignment.variantLabel,
      weight: assignment.weight,
    });
  }

  await clearFailure(enrollment, node.id);
  if (!enrollment.completedNodes.includes(node.id)) {
    enrollment.completedNodes.push(node.id);
  }
  await updateEnrollmentRecord(enrollment);

  const label = assignment.variantLabel || assignment.variantId;
  let nextEdge = label ? findNextEdge(journey.edges, node.id, label) : undefined;
  if (!nextEdge && assignment.variantId) {
    nextEdge = findNextEdge(journey.edges, node.id, assignment.variantId);
  }
  if (!nextEdge) {
    await logJourneyActivity(enrollment.id, 'experiment_no_path', {
      nodeId: node.id,
      variantId: assignment.variantId,
      variantLabel: assignment.variantLabel,
    });
    enrollment.status = 'failed';
    enrollment.exitReason = 'node_failure';
    enrollment.completedAt = new Date().toISOString();
    await updateEnrollmentRecord(enrollment);
    await cancelScheduledExecutionsForEnrollment(enrollment.id);
    return;
  }

  const nextNode = journey.nodes.find(item => item.id === nextEdge.target);
  if (!nextNode) {
    await logJourneyActivity(enrollment.id, 'experiment_no_target', {
      nodeId: node.id,
      variantId: assignment.variantId,
      variantLabel: assignment.variantLabel,
      edgeId: nextEdge.id,
    });
    await exitJourney(enrollment, 'no_path');
    return;
  }

  assignments[node.id] = {
    ...assignment,
    edgeId: nextEdge.id,
  };
  enrollment.metadata!.experiments = assignments;
  await updateEnrollmentRecord(enrollment);

  await logJourneyActivity(enrollment.id, 'experiment_variant_selected', {
    nodeId: node.id,
    variantId: assignment.variantId,
    variantLabel: assignment.variantLabel,
    edgeId: nextEdge.id,
  });

  await executeNode(journey, enrollment, nextNode);
}

async function checkGoalAchievement(goalConfig: NodeConfig, enrollment: JourneyEnrollmentRecord): Promise<boolean> {
  const customer = await fetchShopifyCustomer(enrollment.customerId, String(enrollment.context.storeId ?? ''));
  const orders = await getCustomerOrders(enrollment.customerId, String(enrollment.context.storeId ?? ''));

  switch (goalConfig.goalType) {
    case 'order_value': {
      const minValue = toNumber(goalConfig.orderThreshold ?? goalConfig.minValue) ?? 0;
      const total = orders
        .filter(order => Date.parse(order.created_at) >= Date.parse(enrollment.enteredAt))
        .reduce((sum, order) => sum + (toNumber(order.total_price) ?? 0), 0);
      return total >= minValue;
    }
    case 'product_purchased': {
      const productId = goalConfig.productId;
      if (!productId) return false;
      return orders.some(order =>
        Date.parse(order.created_at) >= Date.parse(enrollment.enteredAt) &&
        hasLineItem(order.line_items ?? [], productId)
      );
    }
    case 'tag_added': {
      const tagName = goalConfig.tagName;
      if (!tagName) return false;
      const tags = parseTags(customer?.tags ?? null);
      return tags.includes(tagName);
    }
    case 'link_clicked': {
      const tracking = goalConfig.linkTracking;
      if (!tracking) return false;
      const logs = await getJourneyActivityLogs();
      return logs.some(
        log =>
          log.enrollmentId === enrollment.id &&
          log.eventType === 'link_clicked' &&
          String((log.data?.tracking ?? '')).toLowerCase() === tracking.toLowerCase(),
      );
    }
    case 'order_any':
    default: {
      return orders.some(order => Date.parse(order.created_at) >= Date.parse(enrollment.enteredAt));
    }
  }
}

export async function scheduleNodeExecution(payload: ScheduledExecutionRecord) {
  await addScheduledExecution(payload);
}

export function getEnrollment(enrollmentId: string) {
  return getEnrollmentById(enrollmentId);
}

export async function processScheduledExecutions(nowIso: string): Promise<{ processed: number; failed: number }> {
  const dueDocs = await prisma.journeyScheduleDoc.findMany({ where: { status: 'pending', resumeAt: { lte: new Date(nowIso) } }, orderBy: { resumeAt: 'asc' }, take: 100 });
  const due = dueDocs.map(doc => ({ ...(doc.data as unknown as ScheduledExecutionRecord), status: doc.status as ScheduledExecutionRecord['status'] }));
  let processed = 0;
  let failed = 0;

  for (const record of due) {
    try {
      const enrollment = await getEnrollmentById(record.enrollmentId);
      if (!enrollment) {
        await markScheduledExecution(record.id, 'failed', 'enrollment_not_found');
        failed += 1;
        continue;
      }

      const journey = await getJourneyById(record.journeyId);
      if (!journey) {
        await markScheduledExecution(record.id, 'failed', 'journey_not_found');
        failed += 1;
        continue;
      }

      if (enrollment.journeyId !== journey.id || !journey.storeId || enrollment.context.storeId !== journey.storeId) {
        await markScheduledExecution(record.id, 'failed', 'STORE_MISMATCH'); failed++; continue;
      }
      if (!['active', 'waiting'].includes(enrollment.status)) { await markScheduledExecution(record.id, 'cancelled'); continue; }
      if (journey.status !== 'ACTIVE') continue;
      const claim = await prisma.journeyScheduleDoc.updateMany({ where: { id: record.id, status: 'pending' }, data: { status: 'processing' } });
      if (!claim.count) continue;
      const node = journey.nodes.find(item => item.id === record.nodeId);
      if (!node) {
        await markScheduledExecution(record.id, 'failed', 'node_not_found');
        failed += 1;
        continue;
      }

      const kind = record.metadata?.kind as string | undefined;
      processed += 1;

      if (kind === 'retry') {
        enrollment.status = 'active';
        await updateEnrollmentRecord(enrollment);
        await executeNode(journey, enrollment, node);
      } else {
        await moveToNextNode(journey, enrollment, node);
      }
      await markScheduledExecution(record.id, 'processed');
    } catch (error) {
      console.error('[journey-engine] Failed to process scheduled execution', error);
      await markScheduledExecution(record.id, 'failed', getErrorMessage(error));
      failed += 1;
    }
  }

  return { processed, failed };
}

// Helper import to avoid circular reference


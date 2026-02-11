import { readJsonFile, writeJsonFile } from '@/lib/utils/json-storage';
import type { CustomerSegment } from '@/lib/types/segment';
import type { JourneyDefinition, JourneyEnrollment, JourneyNode } from '@/lib/types/journey';
import type { ShopifyCustomer } from '@/lib/types/shopify-customer';
import { ShopifyClient, type ShopifyOrder, type ShopifyOrderListResponse } from '@/lib/shopify/client';
import { validateWhatsAppConfig } from '@/lib/config/whatsapp-env';

/**
 * Journey Execution Engine
 * Processes journey enrollments and moves customers through journey nodes
 */

export interface JourneyExecutionContext {
  journey: JourneyDefinition;
  enrollment: JourneyEnrollment;
  customer: ShopifyCustomer;
  shopifyClient: ShopifyClient;
}

type TriggerEventData =
  | { type: 'order_created'; customerId?: string }
  | { type: 'customer_updated'; tags?: string[] }
  | undefined;

interface WhatsAppTemplateComponent {
  type: 'body';
  parameters: Array<{ type: 'text'; text: string }>;
}

interface WhatsAppApiSuccess {
  messages?: Array<{ id?: string }>;
}

interface WhatsAppApiError {
  error?: { message?: string };
}

const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const parseTags = (tags: string | null): string[] =>
  typeof tags === 'string'
    ? tags
        .split(',')
        .map(tag => tag.trim().toLowerCase())
        .filter(Boolean)
    : [];

const toNumber = (value: unknown): number | undefined => {
  const num = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(num) ? num : undefined;
};

const hasLineItemProductId = (order: ShopifyOrder, productId: string): boolean =>
  order.line_items?.some(line => String(line.product_id ?? '') === productId) ?? false;

/**
 * Check if a customer matches a journey trigger
 */
export async function checkTrigger(
  trigger: JourneyNode & { type: 'trigger' },
  customer: ShopifyCustomer,
  eventData?: TriggerEventData,
  shopifyClient?: ShopifyClient
): Promise<boolean> {
  const { trigger: triggerConfig } = trigger;

  switch (triggerConfig?.type) {
    case 'segment': {
      if (!triggerConfig.segmentId || !shopifyClient) return false;
      // Load segment and evaluate customer against it
      const segments = readJsonFile<CustomerSegment>('segments.json');
      const segment = segments.find(item => item.id === triggerConfig.segmentId);
      if (!segment) return false;
      
      // Use segment evaluator to check if customer matches
      const { matchesGroups } = await import('@/lib/segments/evaluator');
      return matchesGroups(customer, segment.conditionGroups || []);
    }

    case 'order_placed':
      return eventData?.type === 'order_created' && eventData.customerId === String(customer.id);

    case 'abandoned_cart': {
      if (!shopifyClient) return false;
      const hours = triggerConfig.hours || 24;
      const checkouts = await shopifyClient.getAbandonedCheckouts({ status: 'open' });
      const customerCheckouts =
        checkouts.checkouts?.filter(
          checkout => checkout.customer?.id === customer.id || checkout.email === customer.email,
        ) ?? [];
      return customerCheckouts.some(checkout => {
        const updatedAt = checkout.updated_at ? new Date(checkout.updated_at) : null;
        if (!updatedAt) return false;
        const hoursSince = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60);
        return hoursSince >= hours;
      });
    }

    case 'tag_added':
      return (
        eventData?.type === 'customer_updated' &&
        !!eventData.tags?.map(tag => tag.toLowerCase()).includes((triggerConfig.tag || '').toLowerCase())
      );

    case 'first_purchase': {
      if (!shopifyClient) return false;
      const orders = await shopifyClient.getCustomerOrders(String(customer.id));
      return (orders.orders?.length ?? 0) === 1;
    }

    case 'repeat_purchase': {
      if (!shopifyClient) return false;
      const orders = await shopifyClient.getCustomerOrders(String(customer.id));
      return (orders.orders?.length ?? 0) >= 2;
    }

    case 'manual':
      return true; // Manual enrollment always matches

    default:
      return false;
  }
}

/**
 * Execute a delay node
 */
export function shouldProcessDelay(
  node: JourneyNode & { type: 'delay' },
  enrollment: JourneyEnrollment
): boolean {
  const { delay } = node;
  const historyEntry = enrollment.history.find(h => h.nodeId === node.id);
  if (!historyEntry || !historyEntry.enteredAt) return false;

  const enteredAt = historyEntry.enteredAt;
  const now = Date.now();
  const delayMs = delay.value * (
    delay.unit === 'minutes' ? 60 * 1000 :
    delay.unit === 'hours' ? 60 * 60 * 1000 :
    24 * 60 * 60 * 1000
  );

  return (now - enteredAt) >= delayMs;
}

/**
 * Execute an action node (send WhatsApp message)
 */
export async function executeAction(
  node: JourneyNode & { type: 'action' },
  customer: ShopifyCustomer,
  context: JourneyExecutionContext
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { action } = node;
  
  if (action.kind !== 'whatsapp_template') {
    return { success: false, error: 'Unsupported action type' };
  }

  // Validate WhatsApp config
  const validation = validateWhatsAppConfig();
  if (!validation.valid) {
    return { success: false, error: 'WhatsApp not configured' };
  }

  const config = validation.config;
  const phone = customer.phone || customer.default_address?.phone;
  if (!phone) {
    return { success: false, error: 'Customer has no phone number' };
  }

  // Format phone number
  let formattedPhone = String(phone).replace(/[\s\-\+\(\)]/g, '');
  if (formattedPhone.startsWith('0')) {
    return { success: false, error: 'Invalid phone format' };
  }

  // Build template variables from customer data
  const variables: Record<string, string> = { ...(action.variables ?? {}) };
  // Auto-populate common variables
  if (customer.first_name) variables.first_name = customer.first_name;
  if (customer.last_name) variables.last_name = customer.last_name;
  if (customer.email) variables.email = customer.email;

  // Check send window (9 AM - 9 PM)
  const now = new Date();
  const hour = now.getHours();
  const sendWindow = action.sendWindow || { startHour: 9, endHour: 21 };
  if (hour < sendWindow.startHour || hour >= sendWindow.endHour) {
    // Queue for later or skip
    return { success: false, error: 'Outside send window' };
  }

  // Build WhatsApp API payload
  const components: WhatsAppTemplateComponent[] = [];
  if (Object.keys(variables).length > 0) {
    const parameters = Object.entries(variables).map(([_, value]) => ({
      type: 'text' as const,
      text: String(value),
    }));
    components.push({ type: 'body', parameters });
  }

  const messagePayload = {
    messaging_product: 'whatsapp',
    to: formattedPhone,
    type: 'template',
    template: {
      name: action.templateName,
      language: { code: action.language || 'en' },
      components: components.length > 0 ? components : undefined,
    },
  };

  try {
    const apiUrl = `https://graph.facebook.com/v18.0/${config.phoneNumberId}/messages`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messagePayload),
    });

    const result = (await response.json()) as WhatsAppApiSuccess & WhatsAppApiError;
    
    if (!response.ok) {
      return { success: false, error: result.error?.message || 'WhatsApp API error' };
    }

    return { success: true, messageId: result.messages?.[0]?.id };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Evaluate a condition node
 */
export async function evaluateCondition(
  node: JourneyNode & { type: 'condition' },
  customer: ShopifyCustomer,
  enrollment: JourneyEnrollment,
  shopifyClient?: ShopifyClient
): Promise<boolean> {
  const { condition } = node;

  switch (condition.kind) {
    case 'opened_message': {
      // Check if customer opened a message in this journey
      const lastAction = enrollment.actions?.find(a => a.type === 'message_opened');
      return !!lastAction;
    }

    case 'clicked_link': {
      const lastAction = enrollment.actions?.find(a => a.type === 'link_clicked');
      return !!lastAction;
    }

    case 'made_purchase': {
      if (!shopifyClient) return false;
      const orders = await shopifyClient.getCustomerOrders(String(customer.id));
      const startedAt = enrollment.startedAt;
      const recentOrders = (orders.orders ?? []).filter(order => {
        const createdAt = order.created_at ? Date.parse(order.created_at) : NaN;
        return Number.isFinite(createdAt) && createdAt > startedAt;
      });
      return recentOrders.length > 0;
    }

    case 'has_tag': {
      const tag = typeof condition.args?.tag === 'string' ? condition.args.tag : '';
      const customerTags = parseTags(customer.tags);
      return customerTags.includes(tag.toLowerCase());
    }

    case 'total_spent_gt': {
      const amount = toNumber(condition.args?.amount) ?? 0;
      const totalSpent = toNumber(customer.total_spent) ?? 0;
      return totalSpent > amount;
    }

    case 'order_count': {
      const minOrders = toNumber(condition.args?.min) ?? 0;
      const orderCount = customer.orders_count ?? 0;
      return orderCount >= minOrders;
    }

    case 'product_purchased': {
      if (!shopifyClient || !condition.args?.productId) return false;
      const orders: ShopifyOrderListResponse = await shopifyClient.getCustomerOrders(String(customer.id));
      const productId = String(condition.args.productId);
      return (orders.orders ?? []).some(order => hasLineItemProductId(order, productId));
    }

    default:
      return false;
  }
}

/**
 * Process a single journey enrollment - move customer to next node
 */
export async function processEnrollment(
  enrollmentId: string,
  shopifyClient: ShopifyClient
): Promise<void> {
  const enrollments = readJsonFile<JourneyEnrollment>('journey-enrollments.json');
  const enrollment = enrollments.find(e => e.id === enrollmentId);
  if (!enrollment || enrollment.status !== 'ACTIVE') return;

  const journeys = readJsonFile<JourneyDefinition>('journeys.json');
  const journey = journeys.find(j => j.id === enrollment.journeyId);
  if (!journey || journey.status !== 'ACTIVE') return;

  // Get customer from Shopify
  const customerData = await shopifyClient.getCustomer(enrollment.customerId);
  const customer = customerData.customer;
  if (!customer) return;

  const currentNodeId = enrollment.currentNodeId;
  if (!currentNodeId) {
    // Find trigger node and start journey
    const triggerNode = journey.nodes.find(n => n.type === 'trigger');
    if (triggerNode) {
      enrollment.currentNodeId = triggerNode.id;
      enrollment.history.push({
        nodeId: triggerNode.id,
        enteredAt: Date.now(),
      });
      writeJsonFile('journey-enrollments.json', enrollments);
    }
    return;
  }

  const currentNode = journey.nodes.find(n => n.id === currentNodeId);
  if (!currentNode) return;

  const context: JourneyExecutionContext = {
    journey,
    enrollment,
    customer,
    shopifyClient,
  };

  // Process node based on type
  if (currentNode.type === 'delay') {
    if (!shouldProcessDelay(currentNode, enrollment)) {
      return; // Still waiting
    }
  } else if (currentNode.type === 'action') {
    const result = await executeAction(currentNode, customer, context);
    if (result.success) {
      enrollment.actions = enrollment.actions || [];
      enrollment.actions.push({
        type: 'message_sent',
        at: Date.now(),
        metadata: { messageId: result.messageId, nodeId: currentNode.id },
      });
    }
  } else if (currentNode.type === 'goal') {
    enrollment.status = 'COMPLETED';
    enrollment.completedAt = Date.now();
    const historyEntry = enrollment.history.find(h => h.nodeId === currentNodeId);
    if (historyEntry) historyEntry.exitedAt = Date.now();
    writeJsonFile('journey-enrollments.json', enrollments);
    return;
  } else if (currentNode.type === 'exit') {
    enrollment.status = 'EXITED';
    writeJsonFile('journey-enrollments.json', enrollments);
    return;
  }

  // Find next node(s) via edges
  const outgoingEdges = journey.edges.filter(e => e.source === currentNodeId);
  if (outgoingEdges.length === 0) {
    // No next node - mark as dropped
    enrollment.status = 'DROPPED';
    writeJsonFile('journey-enrollments.json', enrollments);
    return;
  }

  // For condition nodes, evaluate and choose path
  if (currentNode.type === 'condition') {
    const conditionResult = await evaluateCondition(currentNode, customer, enrollment, shopifyClient);
    const nextEdge = outgoingEdges.find(e => 
      (conditionResult && e.label === 'Yes') || (!conditionResult && e.label === 'No')
    ) || outgoingEdges[0];
    
    const nextNodeId = nextEdge.target;
    enrollment.currentNodeId = nextNodeId;
    const historyEntry = enrollment.history.find(h => h.nodeId === currentNodeId);
    if (historyEntry) historyEntry.exitedAt = Date.now();
    enrollment.history.push({
      nodeId: nextNodeId,
      enteredAt: Date.now(),
    });
  } else {
    // For other nodes, take first edge
    const nextNodeId = outgoingEdges[0].target;
    enrollment.currentNodeId = nextNodeId;
    const historyEntry = enrollment.history.find(h => h.nodeId === currentNodeId);
    if (historyEntry) historyEntry.exitedAt = Date.now();
    enrollment.history.push({
      nodeId: nextNodeId,
      enteredAt: Date.now(),
    });
  }

  enrollment.updatedAt = Date.now();
  writeJsonFile('journey-enrollments.json', enrollments);
}

/**
 * Enroll a customer in a journey
 */
export async function enrollCustomer(
  journeyId: string,
  customerId: string,
  shopifyClient: ShopifyClient
): Promise<JourneyEnrollment | null> {
  const journeys = readJsonFile<JourneyDefinition>('journeys.json');
  const journey = journeys.find(j => j.id === journeyId);
  if (!journey || journey.status !== 'ACTIVE') return null;

  const enrollments = readJsonFile<JourneyEnrollment>('journey-enrollments.json');
  
  // Check entry rules
  if (journey.settings?.entry?.frequency === 'once') {
    const existing = enrollments.find(
      e => e.journeyId === journeyId && e.customerId === String(customerId) && e.status === 'COMPLETED'
    );
    if (existing) return null; // Already completed once
  }

  const maxEntries = journey.settings?.entry?.maxEntries;
  if (maxEntries) {
    const count = enrollments.filter(
      e => e.journeyId === journeyId && e.customerId === String(customerId)
    ).length;
    if (count >= maxEntries) return null;
  }

  // Create enrollment
  const enrollment: JourneyEnrollment = {
    id: `enr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    journeyId,
    customerId: String(customerId),
    status: 'ACTIVE',
    history: [],
    actions: [],
    startedAt: Date.now(),
    updatedAt: Date.now(),
  };

  enrollments.push(enrollment);
  writeJsonFile('journey-enrollments.json', enrollments);

  // Process immediately to start journey
  await processEnrollment(enrollment.id, shopifyClient);

  return enrollment;
}


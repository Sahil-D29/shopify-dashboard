import type { ShopifyClient } from '@/lib/shopify/client';
import { readJsonFile } from '@/lib/utils/json-storage';
import { enrollCustomer, processEnrollment } from '@/lib/journeys/executor';
import type {
  JourneyDefinition,
  JourneyEnrollment,
  JourneyNode,
} from '@/lib/types/journey';
import type { ShopifyCustomer } from '@/lib/types/shopify-customer';
import { matchesGroups } from '@/lib/segments/evaluator';
import type { CustomerSegment } from '@/lib/types/segment';
import type { ShopifyCheckout } from '@/lib/shopify/client';

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const isCheckoutRecord = (value: unknown): value is ShopifyCheckout =>
  typeof value === 'object' && value !== null && ('updated_at' in value || 'customer' in value);

const extractCheckouts = (value: unknown): ShopifyCheckout[] => {
  if (typeof value !== 'object' || value === null) return [];
  if (!('checkouts' in value)) return [];
  const checkouts = Reflect.get(value, 'checkouts');
  if (!Array.isArray(checkouts)) return [];
  return checkouts.filter(isCheckoutRecord);
};

const isShopifyCustomerRecord = (value: unknown): value is ShopifyCustomer =>
  typeof value === 'object' && value !== null && 'id' in value;

interface JourneyEngineLogEntry {
  level: 'info' | 'warn' | 'error';
  message: string;
  context?: Record<string, unknown>;
}

export interface JourneyEngineOptions {
  shopifyClient: ShopifyClient;
  logger?: (entry: JourneyEngineLogEntry) => void;
  includeTestJourneys?: boolean;
  testPhoneNumbers?: string[];
  testCustomerIds?: string[];
  dryRun?: boolean;
}

export interface JourneyEngineResult {
  journeysProcessed: number;
  enrollmentsCreated: number;
  enrollmentsProcessed: number;
  skipped: number;
  errors: JourneyEngineLogEntry[];
}

export interface JourneyTestOptions {
  phoneNumbers?: string[];
  customerIds?: string[];
}

export interface JourneyTestResult {
  journey: JourneyDefinition;
  simulatedCustomers: Array<{ id: string; phone?: string }>;
  message: string;
}

function log(logger: JourneyEngineOptions['logger'], entry: JourneyEngineLogEntry, bucket: JourneyEngineLogEntry[]) {
  if (logger) logger(entry);
  bucket.push(entry);
}

async function loadCustomers(shopifyClient: ShopifyClient): Promise<ShopifyCustomer[]> {
  try {
    const customers = await shopifyClient.fetchAll<ShopifyCustomer>('customers', { limit: 250 });
    return customers;
  } catch (error) {
    console.warn('Falling back to cached customers.json', getErrorMessage(error));
    return readJsonFile<ShopifyCustomer>('customers.json');
  }
}

function getTriggerSubtype(triggerNode: JourneyNode & { type: 'trigger' }): string {
  if (triggerNode.subtype) return triggerNode.subtype;
  const triggerType = triggerNode.trigger?.type;
  switch (triggerType) {
    case 'segment':
      return 'segment_joined';
    case 'abandoned_cart':
      return 'abandoned_cart';
    case 'custom_date':
    case 'birthday':
      return 'date_time';
    case 'webhook':
    case 'order_placed':
    case 'tag_added':
    case 'first_purchase':
    case 'repeat_purchase':
      return 'event_trigger';
    case 'manual':
    default:
      return 'manual_entry';
  }
}

function canReenter(journey: JourneyDefinition, customerId: string, enrollments: JourneyEnrollment[]): boolean {
  const allowReentry = journey.settings?.allowReentry ?? false;
  if (!allowReentry) {
    return false;
  }

  const cooldown = journey.settings?.reentryCooldownDays;
  if (!cooldown) {
    return true;
  }

  const now = Date.now();
  const mostRecent = enrollments
    .filter(e => e.journeyId === journey.id && e.customerId === String(customerId))
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];

  if (!mostRecent) return true;

  const completedAt = mostRecent.completedAt || mostRecent.updatedAt;
  if (!completedAt) return true;

  const msSince = now - completedAt;
  return msSince >= cooldown * 86400000;
}

function hasActiveEnrollment(journey: JourneyDefinition, customerId: string, enrollments: JourneyEnrollment[]): boolean {
  return enrollments.some(
    e =>
      e.journeyId === journey.id &&
      e.customerId === String(customerId) &&
      (e.status === 'ACTIVE' || e.status === 'COMPLETED' || e.status === 'EXITED')
  );
}

function resolveSegmentCandidates(
  journey: JourneyDefinition,
  triggerNode: JourneyNode & { type: 'trigger' },
  customers: ShopifyCustomer[],
  logger: JourneyEngineOptions['logger'],
  logErrors: JourneyEngineLogEntry[]
): ShopifyCustomer[] {
  try {
    const segmentId = triggerNode.trigger?.segmentId || journey.settings?.entry?.segmentId;
    if (!segmentId) return [];
    const segments = readJsonFile<CustomerSegment>('segments.json');
    const matchedSegment = segments.find(item => item.id === segmentId);
    if (!matchedSegment) {
      log(
        logger,
        {
          level: 'warn',
          message: 'Segment not found for journey trigger',
          context: { journeyId: journey.id, segmentId },
        },
        logErrors,
      );
      return [];
    }
    return customers.filter(customer =>
      matchesGroups(customer, matchedSegment.conditionGroups ?? [])
    );
  } catch (error) {
    log(
      logger,
      {
        level: 'error',
        message: 'Failed to resolve segment candidates',
        context: { journeyId: journey.id, error: getErrorMessage(error) },
      },
      logErrors,
    );
    return [];
  }
}

async function resolveAbandonedCartCandidates(
  triggerNode: JourneyNode & { type: 'trigger' },
  shopifyClient: ShopifyClient,
  logger: JourneyEngineOptions['logger'],
  logErrors: JourneyEngineLogEntry[]
): Promise<ShopifyCustomer[]> {
  try {
    const thresholdHours = triggerNode.trigger?.hours ?? 24;
    const response = await shopifyClient.getAbandonedCheckouts({ status: 'open', limit: 100 });
    const checkouts = extractCheckouts(response);
    const cutoffMs = thresholdHours * 3600000;
    const now = Date.now();

    return checkouts
      .filter(checkout => {
        if (!checkout.updated_at) return false;
        const updatedAt = new Date(checkout.updated_at).getTime();
        return now - updatedAt >= cutoffMs;
      })
      .map(checkout => (isShopifyCustomerRecord(checkout.customer) ? checkout.customer : null))
      .filter((customer): customer is ShopifyCustomer => Boolean(customer));
  } catch (error) {
    log(
      logger,
      {
        level: 'error',
        message: 'Failed to load abandoned checkouts',
        context: { error: getErrorMessage(error) },
      },
      logErrors,
    );
    return [];
  }
}

export async function runJourneyEngine(options: JourneyEngineOptions): Promise<JourneyEngineResult> {
  const { shopifyClient, logger, includeTestJourneys = false, testPhoneNumbers = [], testCustomerIds = [], dryRun } = options;
  if (!shopifyClient) {
    throw new Error('Shopify client is required to run the journey engine');
  }

  const errors: JourneyEngineLogEntry[] = [];
  const journeys = readJsonFile<JourneyDefinition>('journeys.json');
  const enrollments = readJsonFile<JourneyEnrollment>('journey-enrollments.json');
  const customers = await loadCustomers(shopifyClient);

  let journeysProcessed = 0;
  let enrollmentsCreated = 0;

  for (const journey of journeys) {
    if (journey.status !== 'ACTIVE') continue;
    if (journey.settings?.testMode && !includeTestJourneys) continue;

    const triggerNode = journey.nodes.find(node => node.type === 'trigger') as JourneyNode & { type: 'trigger' } | undefined;
    if (!triggerNode) {
      log(logger, { level: 'warn', message: 'Journey missing trigger node', context: { journeyId: journey.id } }, errors);
      continue;
    }

    const triggerSubtype = getTriggerSubtype(triggerNode);
    if (triggerSubtype === 'manual_entry') {
      // Manual journeys require manual enrollment
      continue;
    }

    journeysProcessed += 1;

    const candidateCustomers = await (async () => {
      switch (triggerSubtype) {
        case 'segment_joined':
          return resolveSegmentCandidates(journey, triggerNode, customers, logger, errors);
        case 'abandoned_cart':
          return await resolveAbandonedCartCandidates(triggerNode, shopifyClient, logger, errors);
        case 'event_trigger':
        case 'date_time':
        default:
          return [];
      }
    })();

    if (candidateCustomers.length === 0) {
      continue;
    }

    for (const customer of candidateCustomers) {
      const customerId = String(customer.id);

      const journeyTestPhones = journey.settings?.testPhoneNumbers || [];
      const combinedTestPhones = Array.from(new Set([...(testPhoneNumbers || []), ...journeyTestPhones]));
      const isTestCustomer =
        testCustomerIds.includes(customerId) ||
        (customer.phone && combinedTestPhones.includes(String(customer.phone)));

      if (journey.settings?.testMode && !isTestCustomer) {
        continue;
      }

      if (hasActiveEnrollment(journey, customerId, enrollments)) {
        if (!canReenter(journey, customerId, enrollments)) {
          continue;
        }
      }

      if (dryRun) {
        log(logger, { level: 'info', message: 'Dry-run enrollment', context: { journeyId: journey.id, customerId } }, errors);
        continue;
      }

      try {
        const enrollment = await enrollCustomer(journey.id, customerId, shopifyClient);
        if (enrollment) {
          enrollmentsCreated += 1;
        }
      } catch (error) {
        log(
          logger,
          {
            level: 'error',
            message: 'Failed to enroll customer',
            context: { journeyId: journey.id, customerId, error: getErrorMessage(error) },
          },
          errors,
        );
      }
    }
  }

  // Process active enrollments
  const refreshedEnrollments = readJsonFile<JourneyEnrollment>('journey-enrollments.json');
  const activeEnrollments = refreshedEnrollments.filter(e => e.status === 'ACTIVE');
  let processedCount = 0;

  for (const enrollment of activeEnrollments) {
    try {
      await processEnrollment(enrollment.id, shopifyClient);
      processedCount += 1;
    } catch (error) {
      log(
        logger,
        {
          level: 'error',
          message: 'Failed to process enrollment',
          context: { enrollmentId: enrollment.id, error: getErrorMessage(error) },
        },
        errors,
      );
    }
  }

  return {
    journeysProcessed,
    enrollmentsCreated,
    enrollmentsProcessed: processedCount,
    skipped: journeys.length - journeysProcessed,
    errors,
  };
}

export async function runJourneyTest(journeyId: string, options: JourneyTestOptions = {}): Promise<JourneyTestResult> {
  const journeys = readJsonFile<JourneyDefinition>('journeys.json');
  const journey = journeys.find(item => item.id === journeyId);
  if (!journey) {
    throw new Error('Journey not found');
  }

  const simulatedCustomers = [] as Array<{ id: string; phone?: string }>;

  if (options.customerIds) {
    options.customerIds.forEach(id => simulatedCustomers.push({ id }));
  }

  if (options.phoneNumbers) {
    options.phoneNumbers.forEach(phone => simulatedCustomers.push({ id: `test_${phone}`, phone }));
  }

  return {
    journey,
    simulatedCustomers,
    message: 'Journey test simulated. No live enrollments were created.',
  };
}



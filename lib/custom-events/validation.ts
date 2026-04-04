import { prisma } from '@/lib/prisma';
import { getAllEnhancedShopifyEvents } from '@/constants/shopifyEvents';

const EVENT_NAME_REGEX = /^[a-z][a-z0-9_]{2,49}$/;
const MAX_PAYLOAD_SIZE = 65536; // 64KB

export function isValidEventName(name: string): boolean {
  return EVENT_NAME_REGEX.test(name);
}

export function isBuiltInEvent(name: string): boolean {
  const builtInIds = getAllEnhancedShopifyEvents().map((e) => e.id);
  return builtInIds.includes(name);
}

export async function validateEventDefinitionExists(
  storeId: string,
  eventName: string
): Promise<boolean> {
  const def = await prisma.customEventDefinition.findUnique({
    where: { storeId_eventName: { storeId, eventName } },
    select: { isActive: true },
  });
  return !!def?.isActive;
}

export function validatePayloadSize(properties: Record<string, unknown>): boolean {
  const size = JSON.stringify(properties).length;
  return size <= MAX_PAYLOAD_SIZE;
}

export interface ValidationError {
  field: string;
  message: string;
}

export function validateEventPayload(body: {
  eventName?: string;
  properties?: Record<string, unknown>;
}): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!body.eventName || typeof body.eventName !== 'string') {
    errors.push({ field: 'eventName', message: 'eventName is required and must be a string' });
  } else if (!isValidEventName(body.eventName)) {
    errors.push({
      field: 'eventName',
      message: 'eventName must be 3-50 chars, lowercase alphanumeric with underscores, starting with a letter',
    });
  }

  if (body.properties && typeof body.properties !== 'object') {
    errors.push({ field: 'properties', message: 'properties must be an object' });
  } else if (body.properties && !validatePayloadSize(body.properties)) {
    errors.push({ field: 'properties', message: 'properties payload exceeds 64KB limit' });
  }

  return errors;
}

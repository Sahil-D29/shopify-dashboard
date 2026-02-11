import { fetchShopifyCustomer } from '@/lib/journey-engine/shopify';
import type { OperatorType, ConditionValue } from '@/lib/types/condition-config';
import type { ShopifyCustomer } from '@/lib/types/shopify-customer';

type ComparisonOperator = OperatorType | 'gt' | 'lt';

export interface EngineCondition {
  source: 'customer' | 'order' | 'product';
  field: string;
  operator: ComparisonOperator;
  value: ConditionValue;
}

type JsonRecord = Record<string, unknown>;

export interface ConditionContext {
  customerId?: string;
  customer?: ShopifyCustomer | null;
  order?: JsonRecord;
  product?: JsonRecord;
  triggerEvent?: JsonRecord;
  [key: string]: unknown;
}

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const toLowerCaseString = (value: unknown): string => String(value ?? '').toLowerCase();

function getNestedValue(source: unknown, path: string): unknown {
  if (!source || typeof source !== 'object') return undefined;
  return path.split('.').reduce<unknown>((value, key) => {
    if (!value || typeof value !== 'object') return undefined;
    const record = value as JsonRecord;
    return key in record ? record[key] : undefined;
  }, source);
}

function compare(operator: ComparisonOperator, actual: unknown, expected: ConditionValue): boolean {
  switch (operator) {
    case 'equals':
      return actual === expected;
    case 'not_equals':
      return actual !== expected;
    case 'contains':
      return toLowerCaseString(actual).includes(toLowerCaseString(expected));
    case 'not_contains':
      return !toLowerCaseString(actual).includes(toLowerCaseString(expected));
    case 'starts_with':
      return toLowerCaseString(actual).startsWith(toLowerCaseString(expected));
    case 'greater_than':
    case 'gt': {
      const actualNumber = toNumber(actual);
      const expectedNumber = toNumber(expected);
      return actualNumber !== undefined && expectedNumber !== undefined && actualNumber > expectedNumber;
    }
    case 'less_than':
    case 'lt': {
      const actualNumber = toNumber(actual);
      const expectedNumber = toNumber(expected);
      return actualNumber !== undefined && expectedNumber !== undefined && actualNumber < expectedNumber;
    }
    case 'between': {
      const range = Array.isArray(expected) ? expected : [];
      if (range.length !== 2) return false;
      const [min, max] = range.map(toNumber);
      const actualNumber = toNumber(actual);
      return (
        actualNumber !== undefined &&
        min !== undefined &&
        max !== undefined &&
        actualNumber >= min &&
        actualNumber <= max
      );
    }
    case 'is_set':
      return actual !== undefined && actual !== null && String(actual).trim().length > 0;
    case 'is_not_set':
      return actual === undefined || actual === null || String(actual).trim().length === 0;
    default:
      return false;
  }
}

export async function evaluateConditions(
  conditions: EngineCondition[],
  context: ConditionContext,
  logic: 'all' | 'any' = 'all',
): Promise<boolean> {
  if (!conditions || conditions.length === 0) return true;

  const results = await Promise.all(conditions.map(condition => evaluateSingleCondition(condition, context)));

  return logic === 'all' ? results.every(Boolean) : results.some(Boolean);
}

async function evaluateSingleCondition(condition: EngineCondition, context: ConditionContext): Promise<boolean> {
  const { source, field, operator, value } = condition;

  let actualValue: unknown;

  if (source === 'customer') {
    if (context.customer) {
      actualValue = getNestedValue(context.customer, field);
    } else if (context.customerId) {
      const customer = await fetchShopifyCustomer(context.customerId);
      actualValue = getNestedValue(customer, field);
    }
  } else if (source === 'order') {
    actualValue = getNestedValue(context.order ?? context.triggerEvent, field);
  } else if (source === 'product') {
    actualValue = getNestedValue(context.product ?? context.triggerEvent, field);
  }

  return compare(operator, actualValue, value);
}


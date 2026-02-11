import type { ConditionOperator } from '@/lib/types/trigger-config';
import type { ShopifyEventProperty } from '@/constants/shopifyEvents';

type PropertyType = ShopifyEventProperty['type'];

export type OperatorOption = {
  value: ConditionOperator;
  label: string;
};

export const OPERATORS: Record<PropertyType, OperatorOption[]> = {
  string: [
    { value: 'equals', label: 'Equals' },
    { value: 'not_equals', label: 'Does not equal' },
    { value: 'contains', label: 'Contains' },
    { value: 'not_contains', label: 'Does not contain' },
    { value: 'in', label: 'Is any of' },
    { value: 'not_in', label: 'Is none of' },
    { value: 'exists', label: 'Exists' },
    { value: 'not_exists', label: 'Does not exist' },
  ],
  number: [
    { value: 'equals', label: 'Equals' },
    { value: 'not_equals', label: 'Does not equal' },
    { value: 'greater_than', label: 'Greater than' },
    { value: 'greater_than_or_equal', label: 'Greater than or equal' },
    { value: 'less_than', label: 'Less than' },
    { value: 'less_than_or_equal', label: 'Less than or equal' },
    { value: 'exists', label: 'Exists' },
    { value: 'not_exists', label: 'Does not exist' },
  ],
  boolean: [
    { value: 'equals', label: 'Equals' },
    { value: 'not_equals', label: 'Does not equal' },
    { value: 'exists', label: 'Exists' },
    { value: 'not_exists', label: 'Does not exist' },
  ],
  date: [
    { value: 'equals', label: 'On' },
    { value: 'not_equals', label: 'Not on' },
    { value: 'greater_than', label: 'After' },
    { value: 'less_than', label: 'Before' },
    { value: 'exists', label: 'Exists' },
    { value: 'not_exists', label: 'Does not exist' },
  ],
};

export const VALUE_INPUT_TYPE: Record<PropertyType, 'text' | 'number' | 'date'> = {
  string: 'text',
  number: 'number',
  boolean: 'text',
  date: 'date',
};


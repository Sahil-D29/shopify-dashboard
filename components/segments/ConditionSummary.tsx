'use client';

import { useMemo } from 'react';
import { SEGMENT_FIELD_OPTIONS } from '@/lib/constants/segment-fields';
import type { ConditionValue } from './ConditionRow';
import { FileText } from 'lucide-react';

type Group = {
  id: string;
  groupOperator: 'AND' | 'OR';
  conditions: ConditionValue[];
};

function getFieldLabel(field: string): string {
  const match = SEGMENT_FIELD_OPTIONS.find(f => f.value === field);
  if (match) return match.label;
  if (field.startsWith('custom_event:')) {
    return field.slice('custom_event:'.length).replace(/_/g, ' ');
  }
  return field;
}

function getOperatorLabel(operator: string): string {
  const labels: Record<string, string> = {
    equals: 'is',
    not_equals: 'is not',
    contains: 'contains',
    not_contains: 'does not contain',
    starts_with: 'starts with',
    ends_with: 'ends with',
    greater_than: '>',
    less_than: '<',
    greater_than_or_equal: '>=',
    less_than_or_equal: '<=',
    between: 'is between',
    is_empty: 'is empty',
    is_not_empty: 'is not empty',
    in_last_days: 'in last',
    in_last_weeks: 'in last',
    in_last_months: 'in last',
    before_date: 'before',
    after_date: 'after',
    is_true: 'is true',
    is_false: 'is false',
    in: 'is one of',
    not_in: 'is not one of',
  };
  return labels[operator] || operator;
}

function formatValue(value: ConditionValue['value'], operator: string): string {
  if (operator === 'is_empty' || operator === 'is_not_empty' || operator === 'is_true' || operator === 'is_false') {
    return '';
  }
  if (operator === 'in_last_days') return `${value} days`;
  if (operator === 'in_last_weeks') return `${value} weeks`;
  if (operator === 'in_last_months') return `${value} months`;
  if (Array.isArray(value)) return value.join(' - ');
  if (typeof value === 'number') return value.toLocaleString();
  return String(value || '...');
}

function describeCondition(c: ConditionValue): string {
  const field = getFieldLabel(c.field);
  const op = getOperatorLabel(c.operator);
  const val = formatValue(c.value, c.operator);

  let desc = `${field} ${op}`;
  if (val) desc += ` ${val}`;

  if (c.frequency?.type && c.frequency.count) {
    desc += ` (${c.frequency.type.replace('_', ' ')} ${c.frequency.count} times)`;
  }
  if (c.timeWindow?.amount) {
    desc += ` in last ${c.timeWindow.amount} ${c.timeWindow.unit}`;
  }
  if (c.subFilters?.length) {
    const sfDesc = c.subFilters.map(sf => `${sf.property} ${getOperatorLabel(sf.operator)} ${sf.value || '...'}`).join(` ${c.subFilterOperator || 'AND'} `);
    desc += ` where ${sfDesc}`;
  }
  return desc;
}

interface ConditionSummaryProps {
  groups: Group[];
}

export function ConditionSummary({ groups }: ConditionSummaryProps) {
  const summary = useMemo(() => {
    const parts: string[] = [];

    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      if (group.conditions.length === 0) continue;

      const condDescs: string[] = [];

      // Attribute / event conditions
      for (const c of group.conditions) {
        condDescs.push(describeCondition(c));
      }

      const joinWord = group.groupOperator === 'OR' ? ' OR ' : ' AND ';
      const groupDesc = condDescs.join(joinWord);

      if (i > 0) parts.push('AND');
      parts.push(condDescs.length > 1 ? `(${groupDesc})` : groupDesc);
    }

    return parts.join(' ');
  }, [groups]);

  if (!summary) return null;

  return (
    <div className="flex items-start gap-2 px-4 py-3 bg-primary/5 border border-primary/20 rounded-lg">
      <FileText className="w-4 h-4 text-primary mt-0.5 shrink-0" />
      <div>
        <p className="text-xs font-medium text-foreground mb-0.5">Segment Summary</p>
        <p className="text-sm text-foreground/80">
          Customers where <span className="font-medium">{summary}</span>
        </p>
      </div>
    </div>
  );
}

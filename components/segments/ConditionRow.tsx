'use client';

import { useState } from 'react';
import { Trash2, Clock, Hash, Plus, ChevronDown, ChevronRight, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  SEGMENT_FIELD_OPTIONS,
  SEGMENT_OPERATORS,
  type SegmentFieldType,
  type EntityType,
} from '@/lib/constants/segment-fields';
import { FieldSelect } from './FieldSelect';
import { SubFilterRow } from './SubFilterRow';
import { ProductSelect } from '@/components/selectors/ProductSelect';
import { CampaignSelect } from '@/components/selectors/CampaignSelect';
import { TemplateSelect } from '@/components/selectors/TemplateSelect';
import { SegmentSelect } from '@/components/selectors/SegmentSelect';
import { JourneySelect } from '@/components/selectors/JourneySelect';
import { CountrySelect } from '@/components/selectors/CountrySelect';
import { StateSelect } from '@/components/selectors/StateSelect';
import { FlowSelect } from '@/components/selectors/FlowSelect';
import { AgentSelect } from '@/components/selectors/AgentSelect';
import { CollectionSelect } from '@/components/selectors/CollectionSelect';
import type { SubFilter, TimeWindow, FrequencyQualifier } from '@/lib/types/segment';
import { getSubFilterProperties, FIELD_TO_SUBFILTER_CATEGORY, UNIVERSAL_SUB_FILTER_PROPERTIES } from '@/lib/constants/sub-filter-properties';

type NumberRange = [number, number];

export interface ConditionValue {
  id: string;
  field: string;
  operator: string;
  value: string | number | string[] | NumberRange;
  // Sub-filter system
  subFilters?: SubFilter[];
  subFilterOperator?: 'AND' | 'OR';
  timeWindow?: TimeWindow;
  frequency?: FrequencyQualifier;
}

const ensureNumberRange = (value: ConditionValue['value']): NumberRange => {
  if (Array.isArray(value)) {
    const [min, max] = value as Array<string | number | undefined>;
    return [Number(min ?? 0), Number(max ?? 0)];
  }
  return [0, 0];
};

function getFieldType(field: string): SegmentFieldType {
  const meta = SEGMENT_FIELD_OPTIONS.find(f => f.value === field);
  return meta?.type ?? 'text';
}

function getFieldEntityType(field: string): EntityType | undefined {
  const meta = SEGMENT_FIELD_OPTIONS.find(f => f.value === field);
  return meta?.entityType;
}

function getFieldMeta(field: string) {
  return SEGMENT_FIELD_OPTIONS.find(f => f.value === field);
}

export default function ConditionRow({
  condition,
  onChange,
  onRemove,
}: {
  condition: ConditionValue;
  onChange: (next: ConditionValue) => void;
  onRemove: () => void;
}) {
  const fieldType = getFieldType(condition.field);
  const operators = SEGMENT_OPERATORS[fieldType] ?? SEGMENT_OPERATORS.text;
  const fieldMeta = getFieldMeta(condition.field);

  const showTimeWindow = fieldMeta?.supportsTimeWindow ?? false;
  const showFrequency = fieldMeta?.supportsFrequency ?? false;
  const subFilterCategory = FIELD_TO_SUBFILTER_CATEGORY[condition.field];
  const availableSubFilterProps = subFilterCategory
    ? getSubFilterProperties(condition.field)
    : UNIVERSAL_SUB_FILTER_PROPERTIES;

  const [isExpanded, setIsExpanded] = useState(
    !!(condition.subFilters?.length || condition.timeWindow?.amount || condition.frequency?.count)
  );

  const hasAdvanced = true; // Every condition has expandable filters

  const isNoValueOp =
    condition.operator === 'is_empty' ||
    condition.operator === 'is_not_empty' ||
    condition.operator === 'is_true' ||
    condition.operator === 'is_false';

  const addSubFilter = () => {
    const firstProp = availableSubFilterProps[0];
    if (!firstProp) return;
    const newSf: SubFilter = {
      id: crypto.randomUUID(),
      property: firstProp.name,
      operator: 'equals',
      value: '',
    };
    onChange({
      ...condition,
      subFilters: [...(condition.subFilters || []), newSf],
      subFilterOperator: condition.subFilterOperator || 'AND',
    });
  };

  const updateSubFilter = (sfId: string, updated: SubFilter) => {
    onChange({
      ...condition,
      subFilters: (condition.subFilters || []).map(sf => sf.id === sfId ? updated : sf),
    });
  };

  const removeSubFilter = (sfId: string) => {
    onChange({
      ...condition,
      subFilters: (condition.subFilters || []).filter(sf => sf.id !== sfId),
    });
  };

  return (
    <div className="rounded-lg border border-border bg-muted/30 overflow-hidden">
      {/* Main condition row */}
      <div className="flex items-center gap-2 p-3">
        {/* Expand toggle for advanced options */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`shrink-0 transition-colors ${isExpanded ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          title="Toggle filters"
        >
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <Filter className="w-4 h-4" />}
        </button>

        {/* Field selector */}
        <FieldSelect
          value={condition.field}
          onValueChange={(nextField) => {
            const nextType = getFieldType(nextField);
            const defaultOp = SEGMENT_OPERATORS[nextType]?.[0]?.value ?? '';
            onChange({
              ...condition,
              field: nextField,
              operator: defaultOp,
              value: '',
              subFilters: undefined,
              subFilterOperator: undefined,
              timeWindow: undefined,
              frequency: undefined,
            });
          }}
          className="w-[200px]"
        />

        {/* Operator selector */}
        <Select
          value={condition.operator}
          onValueChange={(op) => onChange({ ...condition, operator: op })}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Operator" />
          </SelectTrigger>
          <SelectContent>
            {operators.map(op => (
              <SelectItem key={op.value} value={op.value}>
                {op.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Value input */}
        {isNoValueOp ? null : fieldType === 'boolean' ? null : fieldType === 'number' && condition.operator === 'between' ? (
          <div className="flex items-center gap-2">
            {(() => {
              const [minValue, maxValue] = ensureNumberRange(condition.value);
              return (
                <>
                  <Input
                    type="number"
                    placeholder="Min"
                    value={String(minValue)}
                    onChange={event => {
                      const min = Number(event.target.value || 0);
                      onChange({ ...condition, value: [min, maxValue] });
                    }}
                    className="w-24"
                  />
                  <span className="text-sm text-gray-500">and</span>
                  <Input
                    type="number"
                    placeholder="Max"
                    value={String(maxValue)}
                    onChange={event => {
                      const max = Number(event.target.value || 0);
                      onChange({ ...condition, value: [minValue, max] });
                    }}
                    className="w-24"
                  />
                </>
              );
            })()}
          </div>
        ) : fieldType === 'number' ? (
          <Input
            type="number"
            value={typeof condition.value === 'number' ? condition.value : Number(condition.value ?? 0)}
            onChange={event => onChange({ ...condition, value: Number(event.target.value) })}
            className="w-32"
          />
        ) : fieldType === 'date' ? (
          <Input
            type={condition.operator === 'in_last_days' || condition.operator === 'in_last_weeks' || condition.operator === 'in_last_months' ? 'number' : 'date'}
            placeholder={condition.operator === 'in_last_days' ? 'Days' : condition.operator === 'in_last_weeks' ? 'Weeks' : condition.operator === 'in_last_months' ? 'Months' : ''}
            value={typeof condition.value === 'string' ? condition.value : String(condition.value ?? '')}
            onChange={event =>
              onChange({
                ...condition,
                value: condition.operator === 'in_last_days' || condition.operator === 'in_last_weeks' || condition.operator === 'in_last_months'
                  ? Number(event.target.value)
                  : event.target.value,
              })
            }
            className="w-40"
          />
        ) : (() => {
          const entityType = getFieldEntityType(condition.field);
          const strValue = typeof condition.value === 'string' ? condition.value : '';
          if (entityType === 'product') {
            return <ProductSelect value={strValue} onValueChange={(val) => onChange({ ...condition, value: val })} className="w-56" />;
          }
          if (entityType === 'campaign') {
            return <CampaignSelect value={strValue} onValueChange={(val) => onChange({ ...condition, value: val })} className="w-56" />;
          }
          if (entityType === 'template') {
            return <TemplateSelect value={strValue} onValueChange={(val) => onChange({ ...condition, value: val })} className="w-56" />;
          }
          if (entityType === 'journey') {
            return <JourneySelect value={strValue} onValueChange={(val) => onChange({ ...condition, value: val })} className="w-56" />;
          }
          if (entityType === 'segment') {
            return <SegmentSelect value={strValue} onValueChange={(val) => onChange({ ...condition, value: val })} className="w-56" />;
          }
          if (entityType === 'country') {
            return <CountrySelect value={strValue} onValueChange={(val) => onChange({ ...condition, value: val })} className="w-56" />;
          }
          if (entityType === 'state') {
            return <StateSelect value={strValue} onValueChange={(val) => onChange({ ...condition, value: val })} className="w-56" />;
          }
          if (entityType === 'flow') {
            return <FlowSelect value={strValue} onValueChange={(val) => onChange({ ...condition, value: val })} className="w-56" />;
          }
          if (entityType === 'agent') {
            return <AgentSelect value={strValue} onValueChange={(val) => onChange({ ...condition, value: val })} className="w-56" />;
          }
          if (entityType === 'collection') {
            return <CollectionSelect value={strValue} onValueChange={(val) => onChange({ ...condition, value: val })} className="w-56" />;
          }
          return (
            <Input
              type="text"
              value={strValue}
              onChange={event => onChange({ ...condition, value: event.target.value })}
              placeholder="Enter value..."
              className="w-56"
            />
          );
        })()}

        {/* Frequency qualifier inline */}
        {showFrequency && isExpanded && (
          <div className="flex items-center gap-1.5 shrink-0">
            <Hash className="w-3.5 h-3.5 text-muted-foreground" />
            <Select
              value={condition.frequency?.type || ''}
              onValueChange={(type) =>
                onChange({
                  ...condition,
                  frequency: {
                    type: type as FrequencyQualifier['type'],
                    count: condition.frequency?.count || 1,
                  },
                })
              }
            >
              <SelectTrigger className="w-[100px] h-8 text-xs">
                <SelectValue placeholder="Frequency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="at_least" className="text-xs">at least</SelectItem>
                <SelectItem value="at_most" className="text-xs">at most</SelectItem>
                <SelectItem value="exactly" className="text-xs">exactly</SelectItem>
              </SelectContent>
            </Select>
            {condition.frequency?.type && (
              <>
                <Input
                  type="number"
                  min={0}
                  value={condition.frequency?.count ?? 1}
                  onChange={(e) =>
                    onChange({
                      ...condition,
                      frequency: {
                        type: condition.frequency!.type,
                        count: Number(e.target.value) || 0,
                      },
                    })
                  }
                  className="w-16 h-8 text-xs"
                />
                <span className="text-xs text-muted-foreground">times</span>
              </>
            )}
          </div>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={onRemove}
          className="ml-auto shrink-0 text-muted-foreground hover:text-destructive"
          aria-label="Remove condition"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      {/* Expanded section: Time window + Sub-filters */}
      {isExpanded && (
        <div className="border-t border-border bg-card px-3 py-2 space-y-2">
          {/* Time Window */}
          {showTimeWindow && (
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground">in the last</span>
              <Input
                type="number"
                min={0}
                value={condition.timeWindow?.amount ?? ''}
                onChange={(e) =>
                  onChange({
                    ...condition,
                    timeWindow: {
                      amount: Number(e.target.value) || 0,
                      unit: condition.timeWindow?.unit || 'days',
                    },
                  })
                }
                placeholder="0"
                className="w-16 h-7 text-xs"
              />
              <Select
                value={condition.timeWindow?.unit || 'days'}
                onValueChange={(unit) =>
                  onChange({
                    ...condition,
                    timeWindow: {
                      amount: condition.timeWindow?.amount || 0,
                      unit: unit as TimeWindow['unit'],
                    },
                  })
                }
              >
                <SelectTrigger className="w-[90px] h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="days" className="text-xs">days</SelectItem>
                  <SelectItem value="weeks" className="text-xs">weeks</SelectItem>
                  <SelectItem value="months" className="text-xs">months</SelectItem>
                </SelectContent>
              </Select>
              {condition.timeWindow?.amount ? (
                <button
                  onClick={() => onChange({ ...condition, timeWindow: undefined })}
                  className="text-xs text-muted-foreground hover:text-destructive"
                >
                  clear
                </button>
              ) : null}
            </div>
          )}

          {/* Sub-filters - available on ALL conditions */}
          <div className="space-y-1">
            {(condition.subFilters || []).length > 0 && (
              <div className="flex items-center gap-2 pl-6 pb-1">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Property filters</span>
                  <Select
                    value={condition.subFilterOperator || 'AND'}
                    onValueChange={(op) => onChange({ ...condition, subFilterOperator: op as 'AND' | 'OR' })}
                  >
                    <SelectTrigger className="w-[70px] h-5 text-[10px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AND" className="text-xs">AND</SelectItem>
                      <SelectItem value="OR" className="text-xs">OR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {(condition.subFilters || []).map((sf) => (
                <SubFilterRow
                  key={sf.id}
                  subFilter={sf}
                  availableProperties={availableSubFilterProps}
                  onChange={(updated) => updateSubFilter(sf.id, updated)}
                  onRemove={() => removeSubFilter(sf.id)}
                />
              ))}

            <button
              onClick={addSubFilter}
              className="flex items-center gap-1 pl-6 text-xs text-primary hover:text-primary/80 py-1"
            >
              <Plus className="w-3 h-3" />
              Add property filter
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

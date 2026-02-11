"use client";

import { Fragment, useMemo } from "react";
import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
  EventFilterCondition,
  EventFilterGroup,
  EventFilterOperator,
  PropertyInputType,
} from "@/lib/types/trigger-config";
import { cn } from "@/lib/utils";
import { DynamicValueInput } from "@/components/journeys/nodes/trigger/DynamicValueInput";

export interface PropertyOption {
  id: string;
  label: string;
  type: PropertyInputType;
  category?: string;
  description?: string;
  options?: Array<{ value: string; label: string }>;
  path?: string;
}

interface EventFilterBuilderProps {
  value?: EventFilterGroup;
  onChange: (value: EventFilterGroup) => void;
  availableProperties: PropertyOption[];
  allowNestedGroups?: boolean;
  className?: string;
  emptyLabel?: string;
}

const DEFAULT_GROUP: EventFilterGroup = {
  id: "root",
  combinator: "AND",
  conditions: [],
  groups: [],
};

const OPERATOR_OPTIONS: Record<PropertyInputType, EventFilterOperator[]> = {
  text: ["equals", "not_equals", "contains", "not_contains", "starts_with", "ends_with", "is_set", "is_not_set"],
  number: ["equals", "not_equals", "greater_than", "less_than", "between", "in", "not_in", "is_set", "is_not_set"],
  date: ["equals", "not_equals", "greater_than", "less_than", "between", "is_set", "is_not_set"],
  boolean: ["equals", "not_equals", "is_set", "is_not_set"],
  "multi-select": ["in", "not_in", "equals", "contains", "is_set", "is_not_set"],
  currency: ["equals", "not_equals", "greater_than", "less_than", "between", "is_set", "is_not_set"],
};

function generateId(prefix: string) {
  try {
    return `${prefix}_${crypto.randomUUID()}`;
  } catch {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

function getPropertyById(properties: PropertyOption[], id?: string) {
  if (!id) return undefined;
  return properties.find(property => property.id === id);
}

interface GroupEditorProps {
  group: EventFilterGroup;
  depth: number;
  properties: PropertyOption[];
  onChange: (group: EventFilterGroup) => void;
  onRemove?: () => void;
  allowNestedGroups: boolean;
}

function renderValueInput(
  condition: EventFilterCondition,
  property: PropertyOption | undefined,
  handleChange: (updates: Partial<EventFilterCondition>) => void,
) {
  const operator = condition.operator;

  if (operator === "is_set" || operator === "is_not_set") {
    return null;
  }

  // Use DynamicValueInput for properties that have metadata
  const propertyId = condition.property;
  if (propertyId) {
    return (
      <DynamicValueInput
        propertyId={propertyId}
        operator={operator}
        value={operator === "between" ? { min: condition.value, max: condition.valueTo } : condition.value}
        onChange={(newValue) => {
          if (operator === "between") {
            handleChange({
              value: newValue?.min ?? null,
              valueTo: newValue?.max ?? null,
            });
          } else {
            handleChange({ value: newValue });
          }
        }}
      />
    );
  }

  // Fallback for properties without metadata
  const type = property?.type ?? condition.propertyType ?? "text";

  if (type === "boolean") {
    return (
      <select
        className="w-32 rounded-lg border border-[#E8E4DE] bg-white px-2 py-1 text-sm text-[#4A4139]"
        value={condition.value === true ? "true" : condition.value === false ? "false" : ""}
        onChange={event => handleChange({ value: event.target.value === "true" })}
      >
        <option value="">Select</option>
        <option value="true">True</option>
        <option value="false">False</option>
      </select>
    );
  }

  if (operator === "between") {
    return (
      <div className="flex items-center gap-2">
        <Input
          type={type === "number" || type === "currency" ? "number" : type === "date" ? "date" : "text"}
          className="w-32"
          value={condition.value != null ? String(condition.value) : ""}
          onChange={event =>
            handleChange({
              value: event.target.value === "" ? null : event.target.value,
            })
          }
        />
        <span className="text-xs uppercase tracking-[0.2em] text-[#B9AA9F]">and</span>
        <Input
          type={type === "number" || type === "currency" ? "number" : type === "date" ? "date" : "text"}
          className="w-32"
          value={condition.valueTo != null ? String(condition.valueTo) : ""}
          onChange={event =>
            handleChange({
              valueTo: event.target.value === "" ? null : event.target.value,
            })
          }
        />
      </div>
    );
  }

  if (property?.options?.length) {
    return (
      <select
        className="w-40 rounded-lg border border-[#E8E4DE] bg-white px-2 py-1 text-sm text-[#4A4139]"
        value={condition.value != null ? String(condition.value) : ""}
        onChange={event => handleChange({ value: event.target.value })}
      >
        <option value="">Select value</option>
        {property.options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  if (operator === "in" || operator === "not_in") {
    return (
      <Textarea
        rows={2}
        className="w-60"
        placeholder="Enter comma separated values"
        value={Array.isArray(condition.value) ? condition.value.join(", ") : condition.value ? String(condition.value) : ""}
        onChange={event => {
          const raw = event.target.value;
          const values = raw
            .split(",")
            .map(item => item.trim())
            .filter(Boolean);
          handleChange({ value: values });
        }}
      />
    );
  }

  return (
    <Input
      type={type === "number" || type === "currency" ? "number" : type === "date" ? "date" : "text"}
      className="w-48"
      value={condition.value != null ? String(condition.value) : ""}
      onChange={event =>
        handleChange({
          value: event.target.value === "" ? null : event.target.value,
        })
      }
    />
  );
}

function GroupEditor({ group, depth, properties, onChange, onRemove, allowNestedGroups }: GroupEditorProps) {
  const handleCombinatorChange = (combinator: "AND" | "OR") => {
    onChange({ ...group, combinator });
  };

  const handleConditionChange = (conditionIndex: number, updates: Partial<EventFilterCondition>) => {
    const nextConditions = group.conditions.slice();
    nextConditions[conditionIndex] = { ...nextConditions[conditionIndex], ...updates };
    onChange({ ...group, conditions: nextConditions });
  };

  const handleConditionPropertyChange = (conditionIndex: number, propertyId: string) => {
    const property = getPropertyById(properties, propertyId);
    const defaultOperator = property ? OPERATOR_OPTIONS[property.type][0] : "equals";
    const nextConditions = group.conditions.slice();
    nextConditions[conditionIndex] = {
      ...nextConditions[conditionIndex],
      property: propertyId,
      propertyType: property?.type ?? "text",
      operator: nextConditions[conditionIndex].operator || defaultOperator,
      value: property?.type === "boolean" ? true : null,
      valueTo: null,
    };
    onChange({ ...group, conditions: nextConditions });
  };

  const handleOperatorChange = (conditionIndex: number, operator: EventFilterOperator) => {
    const nextConditions = group.conditions.slice();
    nextConditions[conditionIndex] = {
      ...nextConditions[conditionIndex],
      operator,
      value: operator === "is_set" || operator === "is_not_set" ? null : nextConditions[conditionIndex].value,
      valueTo: operator === "between" ? nextConditions[conditionIndex].valueTo : null,
    };
    onChange({ ...group, conditions: nextConditions });
  };

  const handleRemoveCondition = (conditionIndex: number) => {
    const nextConditions = group.conditions.filter((_, index) => index !== conditionIndex);
    onChange({ ...group, conditions: nextConditions });
  };

  const handleAddCondition = () => {
    const defaultProperty = properties[0];
    onChange({
      ...group,
      conditions: [
        ...group.conditions,
        {
          id: generateId("condition"),
          property: defaultProperty?.id ?? "",
          propertyType: defaultProperty?.type ?? "text",
          operator: defaultProperty ? OPERATOR_OPTIONS[defaultProperty.type][0] : "equals",
          value: null,
        },
      ],
    });
  };

  const handleAddGroup = () => {
    const nextGroups = [...(group.groups ?? []), { ...DEFAULT_GROUP, id: generateId("group") }];
    onChange({ ...group, groups: nextGroups });
  };

  const handleNestedGroupChange = (index: number, nested: EventFilterGroup) => {
    const groups = [...(group.groups ?? [])];
    groups[index] = nested;
    onChange({ ...group, groups });
  };

  const handleRemoveGroup = (index: number) => {
    const groups = (group.groups ?? []).filter((_, idx) => idx !== index);
    onChange({ ...group, groups });
  };

  const hasContent = group.conditions.length > 0 || (group.groups?.length ?? 0) > 0;

  return (
    <div
      className={cn(
        "space-y-4 rounded-2xl border border-[#E8E4DE] bg-[#FAF9F6] p-5",
        depth > 0 ? "bg-white" : "bg-[#FAF9F6]",
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Label className="text-xs font-semibold uppercase tracking-[0.3em] text-[#B9AA9F]">
            {depth === 0 ? "Conditions" : "Nested Group"}
          </Label>
          <div className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs text-[#8B7F76] shadow-sm">
            Match
            <select
              className="ml-2 rounded-lg border border-[#E8E4DE] bg-white px-2 py-1 text-xs uppercase tracking-widest text-[#4A4139]"
              value={group.combinator}
              onChange={event => handleCombinatorChange(event.target.value as "AND" | "OR")}
            >
              <option value="AND">All</option>
              <option value="OR">Any</option>
            </select>
          </div>
        </div>
        {onRemove ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-[#B45151] hover:bg-[#FDECEC]"
            onClick={onRemove}
          >
            <X className="mr-2 h-4 w-4" />
            Remove group
          </Button>
        ) : null}
      </div>

      <div className="space-y-4">
        {group.conditions.map((condition, index) => {
          const property = getPropertyById(properties, condition.property);
          const operators = property ? OPERATOR_OPTIONS[property.type] : OPERATOR_OPTIONS.text;

          return (
            <div
              key={condition.id}
              className="rounded-xl border border-[#E8E4DE] bg-white px-4 py-4 shadow-sm transition hover:border-[#D4A574]"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
                <div className="flex flex-1 flex-col gap-2">
                  <Label className="text-xs uppercase tracking-[0.2em] text-[#B9AA9F]">Property</Label>
                  <select
                    className="rounded-lg border border-[#E8E4DE] bg-white px-3 py-2 text-sm text-[#4A4139] focus:border-[#D4A574] focus:outline-none focus:ring-2 focus:ring-[#D4A574]/20"
                    value={condition.property}
                    onChange={event => handleConditionPropertyChange(index, event.target.value)}
                  >
                    {properties.map(option => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {property?.description ? (
                    <p className="text-[11px] text-[#8B7F76]">{property.description}</p>
                  ) : null}
                </div>

                <div className="flex flex-1 flex-col gap-2">
                  <Label className="text-xs uppercase tracking-[0.2em] text-[#B9AA9F]">Operator</Label>
                  <select
                    className="rounded-lg border border-[#E8E4DE] bg-white px-3 py-2 text-sm text-[#4A4139] focus:border-[#D4A574] focus:outline-none focus:ring-2 focus:ring-[#D4A574]/20"
                    value={condition.operator}
                    onChange={event => handleOperatorChange(index, event.target.value as EventFilterOperator)}
                  >
                    {operators.map(option => (
                      <option key={option} value={option}>
                        {option.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-1 flex-col gap-2">
                  <Label className="text-xs uppercase tracking-[0.2em] text-[#B9AA9F]">Value</Label>
                  {renderValueInput(condition, property, updates => handleConditionChange(index, updates))}
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-[#B45151] hover:bg-[#FDECEC]"
                  onClick={() => handleRemoveCondition(index)}
                >
                  <X className="mr-2 h-4 w-4" />
                  Remove condition
                </Button>
              </div>
            </div>
          );
        })}

        {allowNestedGroups && group.groups?.length
          ? group.groups.map((nestedGroup, index) => (
              <Fragment key={nestedGroup.id}>
                <div className="flex justify-center">
                  <span className="rounded-full bg-[#EFE9E1] px-3 py-1 text-[11px] uppercase tracking-[0.3em] text-[#9D8978]">
                    {group.combinator}
                  </span>
                </div>
                <GroupEditor
                  group={nestedGroup}
                  depth={depth + 1}
                  properties={properties}
                  onChange={nested => handleNestedGroupChange(index, nested)}
                  onRemove={() => handleRemoveGroup(index)}
                  allowNestedGroups={allowNestedGroups}
                />
              </Fragment>
            ))
          : null}
      </div>

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-[#E8E4DE] text-[#4A4139] hover:bg-[#F5F3EE]"
          onClick={handleAddCondition}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add condition
        </Button>
        {allowNestedGroups ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-[#8B7F76] hover:bg-[#F5F3EE]"
            onClick={handleAddGroup}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add group
          </Button>
        ) : null}
      </div>

      {!hasContent ? (
        <p className="rounded-xl border border-dashed border-[#E8E4DE] bg-white/70 px-4 py-4 text-center text-xs text-[#8B7F76]">
          No conditions configured yet. Use “Add condition” to apply filters.
        </p>
      ) : null}
    </div>
  );
}

export function EventFilterBuilder({
  value,
  onChange,
  availableProperties,
  allowNestedGroups = true,
  className,
  emptyLabel,
}: EventFilterBuilderProps) {
  const resolvedGroup = useMemo<EventFilterGroup>(() => {
    if (value && value.id) {
      return {
        ...value,
        conditions: value.conditions ?? [],
        groups: value.groups ?? [],
      };
    }
    return { ...DEFAULT_GROUP, id: generateId("group-root") };
  }, [value]);

  if (!availableProperties.length) {
    return (
      <div className={cn("rounded-2xl border border-dashed border-[#E8E4DE] bg-[#FAF9F6] px-5 py-6 text-center text-sm text-[#8B7F76]", className)}>
        {emptyLabel ?? "No filterable properties available for this event."}
      </div>
    );
  }

  return (
    <div className={className}>
      <GroupEditor
        group={resolvedGroup}
        depth={0}
        properties={availableProperties}
        onChange={onChange}
        allowNestedGroups={allowNestedGroups}
      />
    </div>
  );
}

export default EventFilterBuilder;



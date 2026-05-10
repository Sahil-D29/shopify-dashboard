"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, GripVertical, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

import type {
  Condition,
  ConditionGroup,
  OperatorType,
  PropertyDefinition,
} from "@/lib/types/condition-config";

import { OperatorSelector } from "./OperatorSelector";
import type { PropertyCategory } from "./PropertySelector";
import { PropertySelector } from "./PropertySelector";
import { ValueInput } from "./ValueInput";

interface RuleBuilderProps {
  group: ConditionGroup;
  categories: PropertyCategory[];
  onChange: (group: ConditionGroup) => void;
  depth?: number;
  recentPropertyIds?: string[];
  onRecentPropertyAdd?: (propertyId: string) => void;
  disabled?: boolean;
}

interface DragState {
  groupId: string;
  conditionId: string;
}

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function createBlankCondition(): Condition {
  return {
    id: createId("cond"),
    value: "",
    valueType: "static",
  };
}

function createBlankGroup(): ConditionGroup {
  return {
    id: createId("group"),
    logicalOperator: "AND",
    conditions: [createBlankCondition()],
    nestedGroups: [],
    collapsed: false,
  };
}

function updateGroupById(root: ConditionGroup, targetId: string, updater: (group: ConditionGroup) => ConditionGroup): ConditionGroup {
  if (root.id === targetId) {
    return updater(root);
  }

  const nestedGroups = root.nestedGroups?.map(group => updateGroupById(group, targetId, updater)) ?? [];
  return {
    ...root,
    nestedGroups,
  };
}

function removeGroupById(root: ConditionGroup, targetId: string): ConditionGroup {
  return {
    ...root,
    nestedGroups: root.nestedGroups
      ?.filter(group => group.id !== targetId)
      .map(group => removeGroupById(group, targetId)),
  };
}

function ensureConditions(group: ConditionGroup): ConditionGroup {
  if (!group.conditions.length) {
    return {
      ...group,
      conditions: [createBlankCondition()],
    };
  }
  return group;
}

export function RuleBuilder({
  group,
  categories,
  onChange,
  depth = 0,
  recentPropertyIds = [],
  onRecentPropertyAdd,
  disabled = false,
}: RuleBuilderProps) {
  const [dragState, setDragState] = useState<DragState | null>(null);

  const flattenedProperties: PropertyDefinition[] = useMemo(
    () => categories.flatMap(category => category.properties),
    [categories],
  );

  const handleGroupChange = (updater: (group: ConditionGroup) => ConditionGroup) => {
    onChange(updater(group));
  };

  const handleLogicalOperatorChange = (logicalOperator: ConditionGroup["logicalOperator"]) => {
    handleGroupChange(current => ({ ...current, logicalOperator }));
  };

  const handleToggleCollapse = () => {
    handleGroupChange(current => ({ ...current, collapsed: !current.collapsed }));
  };

  const handleAddCondition = () => {
    handleGroupChange(current => ({
      ...current,
      conditions: [...current.conditions, createBlankCondition()],
    }));
  };

  const handleAddGroup = () => {
    handleGroupChange(current => ({
      ...current,
      nestedGroups: [...(current.nestedGroups ?? []), createBlankGroup()],
    }));
  };

  const handleConditionPropertyChange = (conditionId: string, property: PropertyDefinition) => {
    const firstOperator = property.availableOperators?.[0];
    handleGroupChange(current => ({
      ...current,
      conditions: current.conditions.map(condition =>
        condition.id === conditionId
          ? {
              ...condition,
              property,
              operator: firstOperator,
              value: "",
              error: undefined,
            }
          : condition,
      ),
    }));
    onRecentPropertyAdd?.(property.id);
  };

  const handleConditionOperatorChange = (conditionId: string, operator: OperatorType) => {
    handleGroupChange(current => ({
      ...current,
      conditions: current.conditions.map(condition =>
        condition.id === conditionId
          ? {
              ...condition,
              operator,
              value: operator === "between" ? ["", ""] : "",
              error: undefined,
            }
          : condition,
      ),
    }));
  };

  const handleConditionValueChange = (conditionId: string, value: any) => {
    handleGroupChange(current => ({
      ...current,
      conditions: current.conditions.map(condition =>
        condition.id === conditionId
          ? {
              ...condition,
              value,
              error: undefined,
            }
          : condition,
      ),
    }));
  };

  const handleDeleteCondition = (conditionId: string) => {
    handleGroupChange(current => ensureConditions({
      ...current,
      conditions: current.conditions.filter(condition => condition.id !== conditionId),
    }));
  };

  const handleDeleteGroup = (nestedGroupId: string) => {
    if (typeof window !== "undefined" && !window.confirm("Remove this condition group?")) {
      return;
    }
    handleGroupChange(current => ({
      ...current,
      nestedGroups: current.nestedGroups?.filter(group => group.id !== nestedGroupId),
    }));
  };

  const handleDragStart = (groupId: string, conditionId: string) => (event: React.DragEvent<HTMLDivElement>) => {
    if (disabled) return;
    setDragState({ groupId, conditionId });
    event.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (dragState) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    }
  };

  const handleDrop = (targetGroupId: string, targetConditionId: string) => (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!dragState) return;
    const { groupId: sourceGroupId, conditionId } = dragState;
    setDragState(null);

    if (sourceGroupId !== targetGroupId) return;
    if (conditionId === targetConditionId) return;

    const reorder = (list: Condition[], fromId: string, toId: string) => {
      const currentIndex = list.findIndex(item => item.id === fromId);
      const targetIndex = list.findIndex(item => item.id === toId);
      if (currentIndex === -1 || targetIndex === -1) return list;
      const updated = [...list];
      const [moved] = updated.splice(currentIndex, 1);
      updated.splice(targetIndex, 0, moved);
      return updated;
    };

    handleGroupChange(current => ({
      ...current,
      conditions: reorder(current.conditions, conditionId, targetConditionId),
    }));
  };

  const renderConditionRow = (condition: Condition, index: number) => {
    const selectedProperty = condition.property
      ? flattenedProperties.find(property => property.id === condition.property?.id) ?? condition.property
      : undefined;

    return (
      <div
        key={condition.id}
        className={cn(
          "relative flex flex-col gap-3 rounded-xl border border-[#E8E4DE] bg-white px-4 py-3 shadow-sm transition",
          condition.error ? "border-red-200" : "hover:shadow-md",
        )}
        draggable={!disabled}
        onDragStart={handleDragStart(group.id, condition.id)}
        onDragOver={handleDragOver}
        onDrop={handleDrop(group.id, condition.id)}
      >
        <div className="flex items-start gap-3">
          <div className="flex flex-col items-center gap-2 pt-1">
            <button
              type="button"
              className="cursor-grab text-[#B9AA9F] hover:text-[#8B7F76]"
              title="Drag to reorder"
              disabled={disabled}
            >
              <GripVertical className="h-4 w-4" />
            </button>
            <Button
              variant="ghost"
              size="icon"
              disabled={disabled}
              className="text-[#B9AA9F] hover:text-red-500"
              onClick={() => handleDeleteCondition(condition.id)}
              title="Remove condition"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex flex-1 flex-col gap-3">
            <PropertySelector
              categories={categories}
              value={selectedProperty}
              onSelect={property => handleConditionPropertyChange(condition.id, property)}
              recentPropertyIds={recentPropertyIds}
              disabled={disabled}
            />
            <div className="grid gap-3 md:grid-cols-[220px_1fr]">
              <OperatorSelector
                property={selectedProperty}
                operator={condition.operator}
                onChange={operator => handleConditionOperatorChange(condition.id, operator)}
                disabled={disabled || !selectedProperty}
              />
              <ValueInput
                property={selectedProperty}
                operator={condition.operator}
                value={condition.value}
                onChange={value => handleConditionValueChange(condition.id, value)}
                disabled={disabled}
              />
            </div>

            {condition.error ? (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                <AlertTriangle className="h-4 w-4" />
                {condition.error}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  return (
    <section
      className={cn(
        "space-y-4 rounded-2xl border border-[#E8E4DE] bg-white px-4 py-4 shadow-sm",
        depth > 0 ? "bg-[#FAF9F6]" : "bg-white",
      )}
      style={{ marginLeft: depth > 0 ? depth * 16 : 0 }}
    >
      <header className="flex items-center justify-between rounded-xl bg-[#F5F3EE] px-3 py-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="text-[#8B7F76]" onClick={handleToggleCollapse}>
            {group.collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
          <span className="text-xs uppercase tracking-[0.3em] text-[#8B7F76]">Group</span>
          <ToggleGroup
            type="single"
            value={group.logicalOperator}
            onValueChange={value => value && handleLogicalOperatorChange(value as ConditionGroup["logicalOperator"])}
            disabled={disabled}
            className="ml-2"
          >
            <ToggleGroupItem value="AND" className="px-3 text-xs font-semibold">
              AND
            </ToggleGroupItem>
            <ToggleGroupItem value="OR" className="px-3 text-xs font-semibold">
              OR
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </header>

      {!group.collapsed ? (
        <div className="space-y-3">
          {group.conditions.map(renderConditionRow)}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="border-[#E8E4DE] text-[#4A4139] hover:bg-[#F5F3EE]"
              onClick={handleAddCondition}
              disabled={disabled}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Condition
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-[#E8E4DE] text-[#4A4139] hover:bg-[#F5F3EE]"
              onClick={handleAddGroup}
              disabled={disabled}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Group
            </Button>
          </div>

          {group.nestedGroups?.map((nestedGroup, index) => (
            <div key={nestedGroup.id} className="relative">
              <div className="absolute left-[6px] top-0 bottom-0 w-px bg-[#E8E4DE]" />
              <RuleBuilder
                group={nestedGroup}
                categories={categories}
                depth={depth + 1}
                onChange={nextNestedGroup =>
                  handleGroupChange(current => ({
                    ...current,
                    nestedGroups: current.nestedGroups?.map(group => (group.id === nestedGroup.id ? nextNestedGroup : group)),
                  }))
                }
                recentPropertyIds={recentPropertyIds}
                onRecentPropertyAdd={onRecentPropertyAdd}
                disabled={disabled}
              />
              <div className="mt-2 flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-[#B9AA9F] hover:text-red-500"
                  onClick={() => handleDeleteGroup(nestedGroup.id)}
                  disabled={disabled}
                >
                  <Trash2 className="mr-2 h-3 w-3" />
                  Remove group
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}




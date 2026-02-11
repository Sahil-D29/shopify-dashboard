"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { AlertCircle, AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Loader2, Plus, Sparkles } from "lucide-react";

import Modal from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/lib/hooks/useToast";
import { cn } from "@/lib/utils";

import type {
  AudiencePreview,
  ConditionConfig,
  ConditionGroup,
  EventConditionConfig,
  OperatorType,
  PropertyDefinition,
  SegmentConditionConfig,
} from "@/lib/types/condition-config";
import { RuleBuilder } from "@/components/journeys/nodes/condition/RuleBuilder";
import type { PropertyCategory } from "@/components/journeys/nodes/condition/PropertySelector";
import { AudienceSplitPreview } from "@/components/journeys/nodes/condition/AudienceSplitPreview";

type JsonMap = Record<string, unknown>;

const getString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim().length > 0 ? value : undefined;

const getNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const isJsonMap = (value: unknown): value is JsonMap => typeof value === "object" && value !== null && !Array.isArray(value);

type ConditionType = ConditionConfig["type"];

interface SegmentOption {
  id: string;
  name: string;
  description?: string;
  memberCount: number;
  updatedAt: string;
}

interface EventDefinition {
  id: string;
  name: string;
  description?: string;
  defaultTimeWindow?: {
    value: number;
    unit: "hours" | "days" | "weeks";
  };
  defaultOccurrence?: {
    operator: "at_least" | "exactly" | "at_most";
    value: number;
  };
}

interface ConditionConfigModalProps {
  open: boolean;
  journeyId: string;
  nodeId?: string;
  initialConfig?: ConditionConfig | null;
  onClose: () => void;
  onSave: (config: ConditionConfig) => void;
  testMode?: boolean;
}

interface StepDefinition {
  id: string;
  title: string;
  description: string;
}

const steps: StepDefinition[] = [
  {
    id: "type",
    title: "Condition Type",
    description: "Choose the evaluation strategy for this decision.",
  },
  {
    id: "build",
    title: "Build Conditions",
    description: "Define rules that determine which branch users will follow.",
  },
  {
    id: "branches",
    title: "Branch Labels",
    description: "Customise the labels shown for true/false branches.",
  },
  {
    id: "preview",
    title: "Audience Preview",
    description: "Estimate how users will split between the branches.",
  },
  {
    id: "review",
    title: "Review & Save",
    description: "Double check configuration before saving.",
  },
];

const defaultBranchConfig: ConditionConfig["branches"] = {
  true: { label: "Yes", customLabel: "" },
  false: { label: "No", customLabel: "" },
};

function createBlankGroup(): ConditionGroup {
  return {
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `group_${Math.random().toString(36).slice(2, 10)}`,
    logicalOperator: "AND",
    conditions: [
      {
        id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `cond_${Math.random().toString(36).slice(2, 10)}`,
        value: "",
        valueType: "static",
      },
    ],
    nestedGroups: [],
    collapsed: false,
  } satisfies ConditionGroup;
}

function hasValidConditions(group: ConditionGroup): boolean {
  const conditionsValid = group.conditions.every(condition => {
    if (!condition.property || !condition.operator) return false;
    if (condition.operator === "is_set" || condition.operator === "is_not_set") return true;

    if (condition.operator === "between") {
      return Array.isArray(condition.value) && condition.value.length === 2 && condition.value[0] !== "" && condition.value[1] !== "";
    }

    return condition.value !== null && condition.value !== undefined && condition.value !== "";
  });

  const nestedValid = (group.nestedGroups ?? []).every(hasValidConditions);
  return conditionsValid && nestedValid;
}

function normaliseBetweenValue(value: unknown): [string, string] {
  if (Array.isArray(value)) {
    const [min, max] = value;
    return [getString(min) ?? String(min ?? ""), getString(max) ?? String(max ?? "")];
  }
  if (isJsonMap(value)) {
    return [getString(value.min) ?? String(value.min ?? ""), getString(value.max) ?? String(value.max ?? "")];
  }
  return [String(value ?? ""), ""];
}

const operatorLabels: Record<OperatorType, string> = {
  equals: "is equal to",
  not_equals: "is not equal to",
  contains: "contains",
  not_contains: "does not contain",
  greater_than: "is greater than",
  less_than: "is less than",
  between: "is between",
  is_set: "is set",
  is_not_set: "is not set",
  starts_with: "starts with",
  ends_with: "ends with",
  in_list: "is in list",
  not_in_list: "is not in list",
};

function summariseGroup(group: ConditionGroup, depth = 0): string[] {
  const lines: string[] = [];
  const indent = "  ".repeat(depth);
  lines.push(`${indent}${group.logicalOperator} group:`);

  group.conditions.forEach(condition => {
    const propLabel = getString(condition.property?.label) ?? "Select property";
    const operatorLabel = condition.operator ? operatorLabels[condition.operator] ?? condition.operator : "operator";
    let valueLabel = "";
    if (condition.operator === "between") {
      const [min, max] = normaliseBetweenValue(condition.value);
      valueLabel = `${min} and ${max}`;
    } else if (Array.isArray(condition.value)) {
      valueLabel = condition.value.map(item => getString(item) ?? String(item ?? "")).join(", ");
    } else if (condition.value !== undefined && condition.value !== "") {
      valueLabel = getString(condition.value) ?? String(condition.value);
    }
    lines.push(`${indent}- ${propLabel} ${operatorLabel}${valueLabel ? ` ${valueLabel}` : ""}`);
  });

  (group.nestedGroups ?? []).forEach(nested => {
    lines.push(...summariseGroup(nested, depth + 1));
  });

  return lines;
}

export default function ConditionConfigModal({
  open,
  journeyId,
  nodeId,
  initialConfig,
  onClose,
  onSave,
  testMode = false,
}: ConditionConfigModalProps) {
  const toast = useToast();
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [conditionType, setConditionType] = useState<ConditionType>("property");
  const [rootGroup, setRootGroup] = useState<ConditionGroup>(() => createBlankGroup());
  const [branches, setBranches] = useState<ConditionConfig["branches"]>(defaultBranchConfig);
  const [addElseBranch, setAddElseBranch] = useState(false);
  const [audiencePreview, setAudiencePreview] = useState<AudiencePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [propertyCategories, setPropertyCategories] = useState<PropertyCategory[]>([]);
  const [propertiesLoading, setPropertiesLoading] = useState(false);
  const [propertiesError, setPropertiesError] = useState<string | null>(null);

  const [recentPropertyIds, setRecentPropertyIds] = useState<string[]>([]);

  const [segments, setSegments] = useState<SegmentOption[]>([]);
  const [segmentsLoading, setSegmentsLoading] = useState(false);
  const [segmentsError, setSegmentsError] = useState<string | null>(null);
  const [segmentSearch, setSegmentSearch] = useState("");
  const [selectedSegments, setSelectedSegments] = useState<string[]>([]);
  const [segmentMatchType, setSegmentMatchType] = useState<SegmentConditionConfig["matchType"]>("is_in");

  const [events, setEvents] = useState<EventDefinition[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [eventConfig, setEventConfig] = useState<EventConditionConfig>({
    type: "event",
    eventName: "",
    timeWindow: { value: 7, unit: "days" },
    occurrenceCount: { operator: "at_least", value: 1 },
  });

  const [formulaExpression, setFormulaExpression] = useState("");
  const [productCriteria, setProductCriteria] = useState<ConditionGroup>(() => createBlankGroup());

  const currentStep = steps[activeStepIndex];

  useEffect(() => {
    if (!open) return;
    setPropertiesLoading(true);
    setPropertiesError(null);
    fetch("/api/properties")
      .then(async response => {
        if (!response.ok) throw new Error("Failed to load properties");
        const data = await response.json();
        setPropertyCategories(data.categories ?? []);
      })
      .catch(error => {
        console.error("[ConditionConfigModal] load properties", error);
        setPropertiesError(error?.message ?? "Unable to load properties");
      })
      .finally(() => setPropertiesLoading(false));
  }, [open]);

  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchSegments = useCallback(
    (query: string) => {
      setSegmentsLoading(true);
      setSegmentsError(null);
      const url = new URL("/api/segments", window.location.origin);
      if (query) url.searchParams.set("search", query);
      fetch(url.toString())
        .then(async response => {
          if (!response.ok) throw new Error("Failed to load segments");
          const data = await response.json();
          const segmentList = Array.isArray(data.segments)
            ? data.segments
                .filter((segment: unknown): segment is JsonMap => isJsonMap(segment) && typeof segment.id === "string")
                .map((segment: JsonMap) => ({
                  id: String(segment.id),
                  name: getString(segment.name) ?? "Untitled Segment",
                  description: getString(segment.description),
                  memberCount: getNumber(segment.memberCount) ?? getNumber(segment.customerCount) ?? 0,
                  updatedAt: getString(segment.updatedAt) ?? new Date().toISOString(),
                }))
            : [];
          setSegments(segmentList);
        })
        .catch(error => {
          console.error("[ConditionConfigModal] load segments", error);
          setSegmentsError(error?.message ?? "Unable to load segments");
        })
        .finally(() => setSegmentsLoading(false));
    },
    [],
  );

  useEffect(() => {
    if (!open || conditionType !== "segment") return;
    fetchSegments(segmentSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, conditionType]);

  const handleSegmentSearchChange = (value: string) => {
    setSegmentSearch(value);
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    const timeout = setTimeout(() => {
      fetchSegments(value);
    }, 300);
    debounceTimeoutRef.current = timeout;
  };

  useEffect(() => () => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setEventsLoading(true);
    setEventsError(null);
    fetch("/api/events")
      .then(async response => {
        if (!response.ok) throw new Error("Failed to load events");
        const data = await response.json();
        const eventList = Array.isArray(data.events)
          ? data.events
              .filter((event: unknown): event is JsonMap => isJsonMap(event) && typeof event.id === "string")
              .map((event: JsonMap) => ({
                id: String(event.id),
                name: getString(event.name) ?? "Unnamed event",
                description: getString(event.description),
                defaultTimeWindow: isJsonMap(event.defaultTimeWindow)
                  ? {
                      value: getNumber(event.defaultTimeWindow.value) ?? 7,
                      unit: (getString(event.defaultTimeWindow.unit) as EventConditionConfig['timeWindow']['unit']) ?? 'days',
                    }
                  : undefined,
                defaultOccurrence: isJsonMap(event.defaultOccurrence)
                  ? {
                      operator:
                        (getString(event.defaultOccurrence.operator) as EventConditionConfig["occurrenceCount"]["operator"]) ??
                        "at_least",
                      value: getNumber(event.defaultOccurrence.value) ?? 1,
                    }
                  : undefined,
              }))
          : [];
        setEvents(eventList);
      })
      .catch(error => {
        console.error("[ConditionConfigModal] load events", error);
        setEventsError(error?.message ?? "Unable to load events");
      })
      .finally(() => setEventsLoading(false));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!initialConfig) {
      setConditionType("property");
      setRootGroup(createBlankGroup());
      setBranches(defaultBranchConfig);
      setAddElseBranch(false);
      setAudiencePreview(null);
      setSelectedSegments([]);
      setSegmentMatchType("is_in");
      setEventConfig({
        type: "event",
        eventName: "",
        timeWindow: { value: 7, unit: "days" },
        occurrenceCount: { operator: "at_least", value: 1 },
      });
      setFormulaExpression("");
      setProductCriteria(createBlankGroup());
      setActiveStepIndex(0);
      setRecentPropertyIds([]);
      return;
    }

    setConditionType(initialConfig.type);
    setRootGroup(initialConfig.rootGroup ?? createBlankGroup());
    setBranches(initialConfig.branches ?? defaultBranchConfig);
    setAddElseBranch(Boolean(initialConfig.addElseBranch));
    setAudiencePreview(initialConfig.audiencePreview ?? null);
    if (initialConfig.segmentConfig) {
      setSelectedSegments(initialConfig.segmentConfig.segmentIds);
      setSegmentMatchType(initialConfig.segmentConfig.matchType);
    }
    if (initialConfig.eventConfig) {
      setEventConfig(initialConfig.eventConfig);
    }
    if (initialConfig.formulaExpression) {
      setFormulaExpression(initialConfig.formulaExpression);
    }
    if (initialConfig.productCriteria) {
      setProductCriteria(initialConfig.productCriteria);
    }
    setActiveStepIndex(0);
  }, [initialConfig, open]);

  const eventProperties = useMemo<PropertyCategory[]>(() => {
    const eventCategory = propertyCategories.find(category => category.label.toLowerCase().includes("event"));
    if (!eventCategory) return [];
    return [eventCategory];
  }, [propertyCategories]);

  const productCategories = useMemo<PropertyCategory[]>(() => {
    return propertyCategories.filter(category =>
      category.label.toLowerCase().includes("product") || category.label.toLowerCase().includes("order"),
    );
  }, [propertyCategories]);

  const handleRecentPropertyAdd = (propertyId: string) => {
    setRecentPropertyIds(prev => {
      if (prev.includes(propertyId)) {
        return [propertyId, ...prev.filter(id => id !== propertyId)].slice(0, 7);
      }
      return [propertyId, ...prev].slice(0, 7);
    });
  };

  const validateCurrentStep = (): boolean => {
    if (currentStep.id === "type") {
      if (conditionType === "segment" && selectedSegments.length === 0) {
        toast.error("Select at least one segment.");
        return false;
      }
      if (conditionType === "event" && !eventConfig.eventName) {
        toast.error("Choose an event to evaluate.");
        return false;
      }
      return true;
    }

    if (currentStep.id === "build") {
      if (conditionType === "segment" && selectedSegments.length === 0) {
        toast.error("Add at least one segment.");
        return false;
      }
      if (conditionType === "event") {
        if (!eventConfig.eventName) {
          toast.error("Choose an event before continuing.");
          return false;
        }
        if (!eventConfig.timeWindow.value || eventConfig.timeWindow.value <= 0) {
          toast.error("Provide a valid time window.");
          return false;
        }
        if (!eventConfig.occurrenceCount.value || eventConfig.occurrenceCount.value <= 0) {
          toast.error("Provide a valid occurrence threshold.");
          return false;
        }
        return true;
      }
      if (conditionType === "product_order") {
        if (!hasValidConditions(productCriteria)) {
          toast.error("Complete the product/order criteria.");
          return false;
        }
      }
      if (conditionType === "formula") {
        if (!formulaExpression.trim()) {
          toast.error("Provide a formula expression.");
          return false;
        }
      }
      if ((conditionType === "property" || conditionType === "product_order") && !hasValidConditions(rootGroup)) {
        toast.error("Add at least one complete condition.");
        return false;
      }
      return true;
    }

    if (currentStep.id === "branches") {
      const trueLabel = branches.true.customLabel || branches.true.label;
      const falseLabel = branches.false.customLabel || branches.false.label;
      if (!trueLabel?.trim() || !falseLabel?.trim()) {
        toast.error("Branch labels cannot be empty.");
        return false;
      }
      return true;
    }

    return true;
  };

  const handleNext = () => {
    if (!validateCurrentStep()) return;
    setActiveStepIndex(index => Math.min(index + 1, steps.length - 1));
  };

  const handleBack = () => {
    setPreviewError(null);
    setActiveStepIndex(index => Math.max(index - 1, 0));
  };

  const handleCalculatePreview = async () => {
    try {
      setPreviewLoading(true);
      setPreviewError(null);
      const response = await fetch("/api/conditions/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildConfigObject()),
      });
      if (!response.ok) {
        throw new Error("Unable to generate preview");
      }
      const data = await response.json();
      setAudiencePreview(data);
    } catch (error) {
      console.error("[ConditionConfigModal] preview", error);
      setPreviewError(error instanceof Error ? error.message : "Failed to calculate audience split.");
    } finally {
      setPreviewLoading(false);
    }
  };

  const buildConfigObject = (): ConditionConfig => {
    const config: ConditionConfig = {
      type: conditionType,
      rootGroup,
      branches,
      addElseBranch,
      audiencePreview: audiencePreview ?? undefined,
    };

    if (conditionType === "segment") {
      config.segmentConfig = {
        type: "segment",
        segmentIds: selectedSegments,
        matchType: segmentMatchType,
      };
    }
    if (conditionType === "event") {
      config.eventConfig = {
        ...eventConfig,
        eventFilters: eventConfig.eventFilters ?? rootGroup,
      };
    }
    if (conditionType === "formula") {
      config.formulaExpression = formulaExpression.trim();
    }
    if (conditionType === "product_order") {
      config.productCriteria = productCriteria;
    }
    return config;
  };

  const handleSave = async () => {
    if (!validateCurrentStep()) return;
    const config = buildConfigObject();

    try {
      if (journeyId && nodeId) {
        const response = await fetch(`/api/journeys/${journeyId}/nodes/${nodeId}/condition-config`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(config),
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload?.error ?? "Failed to save condition configuration");
        }
      }
      onSave(config);
      toast.success("Condition node updated.");
    } catch (error) {
      console.error("[ConditionConfigModal] save", error);
      toast.error(error instanceof Error ? error.message : "Unable to save condition configuration.");
    }
  };

  const renderConditionTypeStep = () => (
    <section className="grid gap-4">
      <RadioGroup value={conditionType} onValueChange={value => setConditionType(value as ConditionType)}>
        <div className="grid gap-3 md:grid-cols-2">
          {[
            { value: "segment", title: "Segment Membership", description: "Route users based on existing segments." },
            { value: "property", title: "Property Check", description: "Evaluate customer, order, or product properties." },
            { value: "event", title: "Event Occurred", description: "Branch when an event happens within a time window." },
            { value: "product_order", title: "Product / Order Criteria", description: "Build order or product specific logic." },
            { value: "formula", title: "Custom Formula", description: "Write a custom expression using properties." },
          ].map(option => (
            <Label
              key={option.value}
              htmlFor={`condition-type-${option.value}`}
              className={cn(
                "flex cursor-pointer flex-col gap-2 rounded-2xl border px-4 py-4 shadow-sm transition hover:border-[#D4A574]",
                conditionType === option.value ? "border-[#D4A574] bg-[#FDF6ED]" : "border-[#E8E4DE] bg-white",
              )}
            >
              <div className="flex items-start gap-3">
                <RadioGroupItem id={`condition-type-${option.value}`} value={option.value} />
                <div>
                  <p className="text-sm font-semibold text-[#4A4139]">{option.title}</p>
                  <p className="text-xs text-[#8B7F76]">{option.description}</p>
                </div>
              </div>
            </Label>
          ))}
        </div>
      </RadioGroup>
    </section>
  );

  const renderSegmentBuilder = () => (
    <section className="space-y-4 rounded-2xl border border-[#E8E4DE] bg-white p-5 shadow-sm">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-[0.3em] text-[#B9AA9F]">Segment Logic</p>
        <h3 className="text-lg font-semibold text-[#4A4139]">Segment Membership</h3>
      </header>

      <RadioGroup
        value={segmentMatchType}
        onValueChange={value => setSegmentMatchType(value as SegmentConditionConfig["matchType"])}
        className="grid gap-2 sm:grid-cols-2"
      >
        <Label
          htmlFor="segment-match-in"
          className={cn(
            "flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm",
            segmentMatchType === "is_in" ? "border-[#D4A574] bg-[#FDF6ED]" : "border-[#E8E4DE] bg-white",
          )}
        >
          <RadioGroupItem id="segment-match-in" value="is_in" />
          User is in selected segment(s)
        </Label>
        <Label
          htmlFor="segment-match-not"
          className={cn(
            "flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm",
            segmentMatchType === "is_not_in" ? "border-[#D4A574] bg-[#FDF6ED]" : "border-[#E8E4DE] bg-white",
          )}
        >
          <RadioGroupItem id="segment-match-not" value="is_not_in" />
          User is not in selected segment(s)
        </Label>
      </RadioGroup>

      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-[0.25em] text-[#B9AA9F]">Select segments</Label>
        <Input
          placeholder="Search segments..."
          value={segmentSearch}
          onChange={event => handleSegmentSearchChange(event.target.value)}
        />
        <div className="rounded-2xl border border-[#E8E4DE] bg-[#FAF9F6]">
          <ScrollArea className="max-h-60 px-3 py-3">
            {segmentsLoading ? (
              <div className="flex items-center gap-2 text-sm text-[#8B7F76]">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading segments...
              </div>
            ) : segmentsError ? (
              <div className="flex items-center gap-2 text-sm text-red-600">
                <AlertTriangle className="h-4 w-4" />
                {segmentsError}
              </div>
            ) : (
              <div className="space-y-2">
                {segments.map(segment => {
                  const checked = selectedSegments.includes(segment.id);
                  return (
                    <label
                      key={segment.id}
                      className={cn(
                        "flex cursor-pointer items-start justify-between gap-3 rounded-xl border px-3 py-2 text-sm transition",
                        checked ? "border-[#D4A574] bg-white" : "border-transparent hover:border-[#E8E4DE]",
                      )}
                    >
                      <div>
                        <p className="font-semibold text-[#4A4139]">{segment.name}</p>
                        <p className="text-xs text-[#8B7F76]">{segment.description}</p>
                        <p className="text-xs text-[#B9AA9F]">
                          {segment.memberCount.toLocaleString()} users • Updated{" "}
                          {new Date(segment.updatedAt).toLocaleString()}
                        </p>
                      </div>
                      <Checkbox
                        checked={checked}
                        onCheckedChange={checkedValue => {
                          setSelectedSegments(prev =>
                            checkedValue
                              ? [...prev, segment.id]
                              : prev.filter(id => id !== segment.id),
                          );
                        }}
                      />
                    </label>
                  );
                })}
                {!segments.length ? (
                  <p className="text-sm text-[#8B7F76]">No segments match your search.</p>
                ) : null}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    </section>
  );

  const renderEventBuilder = () => (
    <section className="space-y-4 rounded-2xl border border-[#E8E4DE] bg-white p-5 shadow-sm">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-[0.3em] text-[#B9AA9F]">Event Logic</p>
        <h3 className="text-lg font-semibold text-[#4A4139]">Event Occurrence</h3>
      </header>

      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-[0.25em] text-[#B9AA9F]">Select event</Label>
        <Select
          value={eventConfig.eventName}
          onValueChange={value =>
            setEventConfig(prev => ({
              ...prev,
              eventName: value,
            }))
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={eventsLoading ? "Loading events..." : "Select event"} />
          </SelectTrigger>
          <SelectContent>
            {events.map(event => (
              <SelectItem key={event.id} value={event.id}>
                {event.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {eventsError ? <p className="text-sm text-red-600">{eventsError}</p> : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-[#4A4139]">In the last</span>
        <Input
          type="number"
          className="w-20"
          min={1}
          value={eventConfig.timeWindow.value}
          onChange={event =>
            setEventConfig(prev => ({
              ...prev,
              timeWindow: {
                ...prev.timeWindow,
                value: Number(event.target.value) || 1,
              },
            }))
          }
        />
        <Select
          value={eventConfig.timeWindow.unit}
          onValueChange={value =>
            setEventConfig(prev => ({
              ...prev,
              timeWindow: {
                ...prev.timeWindow,
                unit: value as EventConditionConfig["timeWindow"]["unit"],
              },
            }))
          }
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="hours">hours</SelectItem>
            <SelectItem value="days">days</SelectItem>
            <SelectItem value="weeks">weeks</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={eventConfig.occurrenceCount.operator}
          onValueChange={value =>
            setEventConfig(prev => ({
              ...prev,
              occurrenceCount: { ...prev.occurrenceCount, operator: value as EventConditionConfig["occurrenceCount"]["operator"] },
            }))
          }
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="at_least">At least</SelectItem>
            <SelectItem value="exactly">Exactly</SelectItem>
            <SelectItem value="at_most">At most</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="number"
          className="w-20"
          min={1}
          value={eventConfig.occurrenceCount.value}
          onChange={event =>
            setEventConfig(prev => ({
              ...prev,
              occurrenceCount: { ...prev.occurrenceCount, value: Number(event.target.value) || 1 },
            }))
          }
        />
        <span className="text-sm text-[#4A4139]">time(s)</span>
      </div>

      <details className="rounded-xl border border-dashed border-[#D9CABD] bg-[#FAF9F6] px-4 py-3">
        <summary className="cursor-pointer text-sm font-semibold text-[#4A4139]">Event Filters (optional)</summary>
        <div className="mt-3 space-y-3">
          <RuleBuilder
            group={eventConfig.eventFilters ?? rootGroup}
            categories={eventProperties.length ? eventProperties : propertyCategories}
            onChange={next => setEventConfig(prev => ({ ...prev, eventFilters: next }))}
            recentPropertyIds={recentPropertyIds}
            onRecentPropertyAdd={handleRecentPropertyAdd}
          />
        </div>
      </details>
    </section>
  );

  const renderProductCriteria = () => (
    <RuleBuilder
      group={productCriteria}
      categories={productCategories.length ? productCategories : propertyCategories}
      onChange={setProductCriteria}
      recentPropertyIds={recentPropertyIds}
      onRecentPropertyAdd={handleRecentPropertyAdd}
    />
  );

  const renderRuleStep = () => {
    if (conditionType === "segment") return renderSegmentBuilder();
    if (conditionType === "event") return renderEventBuilder();
    if (conditionType === "product_order") return renderProductCriteria();
    if (conditionType === "formula") {
      return (
        <section className="space-y-4 rounded-2xl border border-[#E8E4DE] bg-white p-5 shadow-sm">
          <header className="space-y-1">
            <p className="text-xs uppercase tracking-[0.3em] text-[#B9AA9F]">Formula Builder</p>
            <h3 className="text-lg font-semibold text-[#4A4139]">Custom Expression</h3>
          </header>
          <Textarea
            placeholder="e.g. customer.order_count >= 5 && customer.lifetime_value > 500"
            value={formulaExpression}
            onChange={event => setFormulaExpression(event.target.value)}
            className="min-h-[160px]"
          />
          <p className="text-xs text-[#8B7F76]">
            Use Liquid/JavaScript style expressions to evaluate complex logic. You can reference properties like{" "}
            <code className="rounded bg-[#F5F3EE] px-1">customer.lifetime_value</code> or computed fields.
          </p>
        </section>
      );
    }

    return (
      <RuleBuilder
        group={rootGroup}
        categories={propertyCategories}
        onChange={setRootGroup}
        recentPropertyIds={recentPropertyIds}
        onRecentPropertyAdd={handleRecentPropertyAdd}
      />
    );
  };

  const renderBranchStep = () => (
    <section className="grid gap-4 md:grid-cols-2">
      {(["true", "false"] as const).map(key => {
        const branch = branches[key];
        const accent =
          key === "true"
            ? "border-[#D1E7D6] bg-[#F5FBF7]"
            : "border-[#F5D5D2] bg-[#FDF5F4]";
        return (
          <div key={key} className={cn("space-y-3 rounded-2xl border p-4", accent)}>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-white text-[#4A4139]">
                {key === "true" ? "True Branch" : "False Branch"}
              </Badge>
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-[0.25em] text-[#B9AA9F]">Default</Label>
              <Input value={branch.label} disabled />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-[0.25em] text-[#B9AA9F]">Custom Label</Label>
              <Input
                placeholder={key === "true" ? "e.g., VIP Customers" : "e.g., Regular Customers"}
                value={branch.customLabel ?? ""}
                onChange={event =>
                  setBranches(prev => ({
                    ...prev,
                    [key]: {
                      ...prev[key],
                      customLabel: event.target.value,
                    },
                  }))
                }
              />
            </div>
          </div>
        );
      })}

      <div className="col-span-full rounded-2xl border border-[#E8E4DE] bg-white px-4 py-3">
        <label className="flex items-center gap-3 text-sm text-[#4A4139]">
          <Checkbox checked={addElseBranch} onCheckedChange={value => setAddElseBranch(Boolean(value))} />
          Add "Else" branch if neither true nor false conditions are met
        </label>
      </div>
    </section>
  );

  const renderPreviewStep = () => (
    <div className="space-y-4">
      <AudienceSplitPreview
        trueCount={audiencePreview?.trueCount ?? 0}
        falseCount={audiencePreview?.falseCount ?? 0}
        truePercentage={audiencePreview?.truePercentage ?? 0}
        falsePercentage={audiencePreview?.falsePercentage ?? 0}
        totalAudience={audiencePreview?.totalAudience ?? 0}
        testMode={testMode}
        onTestClick={() => toast.info("Test mode is not yet implemented for condition previews.")}
      />

      {previewError ? (
        <div className="flex items-center gap-2 rounded-xl border border-[#F1C8AD] bg-[#FEF3EF] px-4 py-3 text-sm text-[#9C613C]">
          <AlertCircle className="h-4 w-4" />
          {previewError}
        </div>
      ) : null}

      <Button
        type="button"
        variant="outline"
        className="border-[#E8E4DE] text-[#4A4139] hover:bg-[#F5F3EE]"
        onClick={handleCalculatePreview}
        disabled={previewLoading}
      >
        {previewLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
        Refresh Audience Estimate
      </Button>
    </div>
  );

  const renderReviewStep = () => {
    const summaryLines = summariseGroup(rootGroup);
    const trueLabel = branches.true.customLabel?.trim() || branches.true.label;
    const falseLabel = branches.false.customLabel?.trim() || branches.false.label;

    return (
      <section className="space-y-4 rounded-2xl border border-[#E8E4DE] bg-white p-5 shadow-sm">
        <header className="space-y-1">
          <p className="text-xs uppercase tracking-[0.3em] text-[#B9AA9F]">Summary</p>
          <h3 className="text-lg font-semibold text-[#4A4139]">Review configuration</h3>
        </header>

        <div className="space-y-3 rounded-xl border border-[#F5F3EE] bg-[#FAF9F6] px-4 py-3 text-sm text-[#4A4139]">
          <p>
            <span className="font-semibold">Type:</span> {conditionType.replace("_", " ")}
          </p>
          <p>
            <span className="font-semibold">True branch:</span> {trueLabel}
          </p>
          <p>
            <span className="font-semibold">False branch:</span> {falseLabel}
          </p>
          <p>
            <span className="font-semibold">Else branch:</span> {addElseBranch ? "Enabled" : "Disabled"}
          </p>
        </div>

        <div className="space-y-2 rounded-xl border border-[#E8E4DE] bg-white px-4 py-3 text-sm text-[#4A4139]">
          <p className="font-semibold text-[#4A4139]">Logic:</p>
          <pre className="whitespace-pre-wrap text-xs text-[#8B7F76]">{summaryLines.join("\n")}</pre>
        </div>
      </section>
    );
  };

  const renderStep = () => {
    switch (currentStep.id) {
      case "type":
        return renderConditionTypeStep();
      case "build":
        if (propertiesError) {
          return (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {propertiesError}
              <div className="mt-2">
                <Button size="sm" variant="outline" onClick={() => setActiveStepIndex(0)}>
                  Retry
                </Button>
              </div>
            </div>
          );
        }
        if (propertiesLoading && !propertyCategories.length) {
          return (
            <div className="flex items-center gap-2 text-sm text-[#8B7F76]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading properties...
            </div>
          );
        }
        return renderRuleStep();
      case "branches":
        return renderBranchStep();
      case "preview":
        return renderPreviewStep();
      case "review":
        return renderReviewStep();
      default:
        return null;
    }
  };

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Configure Condition Node"
      subtitle="Build logic that splits users into distinct paths."
      size="xl"
    >
      <div className="flex flex-col gap-6">
        <div className="space-y-3 rounded-2xl border border-[#E8E4DE] bg-white px-4 py-4 shadow-sm">
          <div className="flex items-center justify-between text-sm text-[#4A4139]">
            <span className="font-semibold uppercase tracking-[0.25em] text-[#B9AA9F]">
              Step {activeStepIndex + 1} of {steps.length}
            </span>
            <span>{currentStep.title}</span>
          </div>
          <p className="text-xs text-[#8B7F76]">{currentStep.description}</p>
          <div className="flex w-full gap-2">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={cn("h-1 flex-1 rounded-full", index <= activeStepIndex ? "bg-[#D4A574]" : "bg-[#E8E4DE]")}
              />
            ))}
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto pr-1">{renderStep()}</div>

        <footer className="flex flex-col gap-3 border-t border-[#E8E4DE] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="border-[#E8E4DE] text-[#4A4139] hover:bg-[#F5F3EE]"
              onClick={handleBack}
              disabled={activeStepIndex === 0}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-[#E8E4DE] text-[#4A4139] hover:bg-[#F5F3EE]"
              onClick={handleNext}
              disabled={activeStepIndex === steps.length - 1}
            >
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="border-[#E8E4DE] text-[#4A4139] hover:bg-[#F5F3EE]"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-[#4A4139] text-white hover:bg-[#2F2721]"
              onClick={handleSave}
              disabled={activeStepIndex !== steps.length - 1}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Save Condition
            </Button>
          </div>
        </footer>
      </div>
    </Modal>
  );
}


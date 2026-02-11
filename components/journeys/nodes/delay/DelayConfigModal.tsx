"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";

import Modal from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/lib/hooks/useToast";
import { cn } from "@/lib/utils";

import type {
  DelayConfig,
  DelayPreviewScenario,
  DelaySpecificConfig,
  DelayType,
  Duration,
  FixedTimeDelayConfig,
  OptimalSendTimeConfig,
  WaitForAttributeConfig,
  WaitForEventConfig,
  WaitUntilTimeConfig,
} from "@/lib/types/delay-config";

import { DelayPreviewCard } from "./DelayPreviewCard";
import { DelayTypeSelector } from "./DelayTypeSelector";
import { DurationPicker } from "./DurationPicker";
import { EventSelector } from "./EventSelector";
import { HolidaySettingsConfig } from "./HolidaySettingsConfig";
import { OptimalTimePreview } from "./OptimalTimePreview";
import { QuietHoursConfig } from "./QuietHoursConfig";
import { ThrottlingConfig } from "./ThrottlingConfig";
import { TimePicker } from "./TimePicker";

const STORAGE_VERSION = "delay-config/v1";

interface DelayConfigModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (config: DelayConfig) => void;
  journeyId: string;
  nodeId: string;
  initialConfig?: DelayConfig | null;
}

interface WizardStep {
  id: "type" | "details" | "restrictions" | "preview";
  title: string;
  description: string;
}

interface OptimalPreviewPayload {
  historicalData: { hour: number; engagementRate: number }[];
  optimalWindow?: { start: number; end: number };
}

const DEFAULT_CONFIG: DelayConfig = {
  delayType: "fixed_time",
  specificConfig: {
    type: "fixed_time",
    duration: { value: 1, unit: "days" },
  },
  quietHours: {
    enabled: false,
    startTime: { hour: 21, minute: 0 },
    endTime: { hour: 9, minute: 0 },
    timezone: "customer",
  },
  holidaySettings: {
    skipWeekends: false,
    skipHolidays: false,
    holidayCalendar: "us",
  },
  throttling: {
    enabled: false,
  },
  nodeName: "",
  description: "",
};

const STEPS: WizardStep[] = [
  {
    id: "type",
    title: "Delay Type",
    description: "Select the kind of delay that fits this step.",
  },
  {
    id: "details",
    title: "Timing Details",
    description: "Fine-tune how and when the delay releases customers.",
  },
  {
    id: "restrictions",
    title: "Restrictions",
    description: "Respect quiet hours, holidays, and throttling limits.",
  },
  {
    id: "preview",
    title: "Review & Preview",
    description: "Confirm configuration and inspect representative scenarios.",
  },
];

const DELAY_TYPE_LABELS: Record<DelayType, string> = {
  fixed_time: "Fixed time",
  wait_until_time: "Wait until time",
  wait_for_event: "Wait for event",
  optimal_send_time: "Optimal send time",
  wait_for_attribute: "Wait for attribute",
};

const DURATION_LABELS: Record<Duration["unit"], { singular: string; plural: string }> = {
  minutes: { singular: "minute", plural: "minutes" },
  hours: { singular: "hour", plural: "hours" },
  days: { singular: "day", plural: "days" },
  weeks: { singular: "week", plural: "weeks" },
};

function getDefaultSpecificConfig(type: DelayType): DelaySpecificConfig {
  switch (type) {
    case "fixed_time":
      return { type: "fixed_time", duration: { value: 1, unit: "days" } };
    case "wait_until_time":
      return {
        type: "wait_until_time",
        time: { hour: 10, minute: 0 },
        timezone: "customer",
        ifPassed: "wait_until_tomorrow",
      };
    case "wait_for_event":
      return {
        type: "wait_for_event",
        eventName: "",
        eventFilters: [],
        maxWaitTime: { value: 3, unit: "days" },
        onTimeout: "continue",
      };
    case "optimal_send_time":
      return {
        type: "optimal_send_time",
        window: { duration: { value: 24, unit: "hours" } },
        fallbackTime: { hour: 10, minute: 0 },
        timezone: "customer",
      };
    case "wait_for_attribute":
      return {
        type: "wait_for_attribute",
        attributePath: "",
        targetValue: "",
        maxWaitTime: { value: 7, unit: "days" },
        onTimeout: "continue",
      };
    default:
      return { type: "fixed_time", duration: { value: 1, unit: "days" } };
  }
}

function applyDefaults(source?: DelayConfig | null): DelayConfig {
  const type = source?.delayType ?? DEFAULT_CONFIG.delayType;
  const specific = source?.specificConfig
    ? ({ ...getDefaultSpecificConfig(type), ...source.specificConfig } as DelaySpecificConfig)
    : getDefaultSpecificConfig(type);

  return {
    delayType: type,
    specificConfig: specific,
    quietHours: {
      ...DEFAULT_CONFIG.quietHours!,
      ...(source?.quietHours ?? {}),
    },
    holidaySettings: {
      ...DEFAULT_CONFIG.holidaySettings!,
      ...(source?.holidaySettings ?? {}),
    },
    throttling: {
      ...DEFAULT_CONFIG.throttling!,
      ...(source?.throttling ?? {}),
    },
    nodeName: source?.nodeName ?? DEFAULT_CONFIG.nodeName,
    description: source?.description ?? DEFAULT_CONFIG.description,
  };
}

function validateDetails(config: DelayConfig): string[] {
  const errors: string[] = [];

  switch (config.delayType) {
    case "fixed_time": {
      const details = config.specificConfig as FixedTimeDelayConfig;
      if (details.duration.value <= 0) errors.push("Duration must be greater than zero.");
      break;
    }
    case "wait_until_time": {
      const details = config.specificConfig as WaitUntilTimeConfig;
      if (details.time.hour < 0 || details.time.hour > 23) errors.push("Hour must be between 0 and 23.");
      if (details.time.minute < 0 || details.time.minute > 59) errors.push("Minute must be between 0 and 59.");
      break;
    }
    case "wait_for_event": {
      const details = config.specificConfig as WaitForEventConfig;
      if (!details.eventName.trim()) errors.push("Select an event to wait for.");
      if (details.maxWaitTime.value <= 0) errors.push("Maximum wait time must be positive.");
      break;
    }
    case "optimal_send_time": {
      const details = config.specificConfig as OptimalSendTimeConfig;
      if (!details.window?.duration) errors.push("Provide an optimisation window.");
      if (!details.fallbackTime) errors.push("Provide a fallback time.");
      break;
    }
    case "wait_for_attribute": {
      const details = config.specificConfig as WaitForAttributeConfig;
      if (!details.attributePath.trim()) errors.push("Attribute path is required.");
      if (details.targetValue === undefined || details.targetValue === "") errors.push("Provide a target value.");
      if (details.maxWaitTime.value <= 0) errors.push("Maximum wait time must be positive.");
      break;
    }
    default:
      break;
  }

  return errors;
}

function validateRestrictions(config: DelayConfig): string[] {
  const errors: string[] = [];

  if (config.quietHours?.enabled) {
    if (!config.quietHours.startTime || !config.quietHours.endTime) {
      errors.push("Specify both quiet hours start and end time.");
    }
  }

  if (config.throttling?.enabled) {
    if (!config.throttling.maxUsersPerHour && !config.throttling.maxUsersPerDay) {
      errors.push("Provide hourly or daily throttling limits.");
    }
  }

  return errors;
}

function formatDuration(duration: Duration): string {
  const labels = DURATION_LABELS[duration.unit];
  return duration.value === 1
    ? `${duration.value} ${labels.singular}`
    : `${duration.value} ${labels.plural}`;
}

function formatTimeOfDay(time?: { hour: number; minute: number }): string {
  if (!time) return "--:--";
  const hour12 = time.hour % 12 || 12;
  const suffix = time.hour >= 12 ? "PM" : "AM";
  return `${hour12}:${time.minute.toString().padStart(2, "0")} ${suffix}`;
}

function getDelaySummary(config: DelayConfig): string {
  switch (config.delayType) {
    case "fixed_time": {
      const details = config.specificConfig as FixedTimeDelayConfig;
      return `Wait ${formatDuration(details.duration)}`;
    }
    case "wait_until_time": {
      const details = config.specificConfig as WaitUntilTimeConfig;
      const tz = details.timezone === "customer" ? "customer timezone" : details.timezone;
      return `Wait until ${formatTimeOfDay(details.time)} (${tz})`;
    }
    case "wait_for_event": {
      const details = config.specificConfig as WaitForEventConfig;
      const eventName = details.eventName || "selected event";
      return `Wait for ${eventName} (timeout ${formatDuration(details.maxWaitTime)})`;
    }
    case "optimal_send_time": {
      const details = config.specificConfig as OptimalSendTimeConfig;
      return `AI chooses the best send time within ${formatDuration(details.window.duration)}`;
    }
    case "wait_for_attribute": {
      const details = config.specificConfig as WaitForAttributeConfig;
      const target = String(details.targetValue ?? "?");
      return `Wait until ${details.attributePath || "attribute"} equals ${target} (timeout ${formatDuration(details.maxWaitTime)})`;
    }
    default:
      return DELAY_TYPE_LABELS[config.delayType];
  }
}

export default function DelayConfigModal({
  open,
  onClose,
  onSave,
  journeyId,
  nodeId,
  initialConfig,
}: DelayConfigModalProps) {
  const toast = useToast();

  const [config, setConfig] = useState<DelayConfig>(() => applyDefaults(initialConfig));
  const [stepIndex, setStepIndex] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [previewScenarios, setPreviewScenarios] = useState<DelayPreviewScenario[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [optimalPreview, setOptimalPreview] = useState<OptimalPreviewPayload | null>(null);
  const [optimalLoading, setOptimalLoading] = useState(false);
  const [optimalError, setOptimalError] = useState<string | null>(null);

  const cacheKey = useMemo(() => `${STORAGE_VERSION}:${journeyId}:${nodeId}`, [journeyId, nodeId]);
  const currentStep = STEPS[stepIndex];

  const persistDraft = useCallback(
    (nextConfig: DelayConfig) => {
      if (typeof window === "undefined") return;
      window.localStorage.setItem(cacheKey, JSON.stringify(nextConfig));
    },
    [cacheKey],
  );

  const hydrateFromSource = useCallback(
    (source?: DelayConfig | null) => {
      const hydrated = applyDefaults(source);
      setConfig(hydrated);
      setErrors([]);
      setPreviewScenarios([]);
      setPreviewError(null);
      return hydrated;
    },
    [],
  );

  const loadOptimalPreview = useCallback(async () => {
    try {
      setOptimalLoading(true);
      setOptimalError(null);
      const response = await fetch("/api/delays/optimal-time/preview");
      if (!response.ok) throw new Error("Failed to load engagement insights.");
      const payload = (await response.json()) as OptimalPreviewPayload;
      setOptimalPreview(payload);
    } catch (error) {
      console.error("[DelayConfigModal] optimal preview", error);
      const message = error instanceof Error ? error.message : String(error);
      setOptimalError(message || "Unable to load engagement insights.");
      setOptimalPreview(null);
    } finally {
      setOptimalLoading(false);
    }
  }, []);

  const handlePreview = useCallback(async () => {
    try {
      setPreviewLoading(true);
      setPreviewError(null);
      const response = await fetch("/api/delays/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error ?? "Unable to generate preview scenarios.");
      }
      const payload = (await response.json()) as { scenarios?: DelayPreviewScenario[] };
      setPreviewScenarios(payload.scenarios ?? []);
    } catch (error) {
      console.error("[DelayConfigModal] preview", error);
      const message = error instanceof Error ? error.message : String(error);
      setPreviewError(message || "Unable to generate preview scenarios.");
    } finally {
      setPreviewLoading(false);
    }
  }, [config]);

  useEffect(() => {
    if (!open) return;
    setStepIndex(0);

    const draft = typeof window !== "undefined" ? window.localStorage.getItem(cacheKey) : null;
    if (initialConfig) {
      hydrateFromSource(initialConfig);
      return;
    }
    if (draft) {
      try {
        hydrateFromSource(JSON.parse(draft) as DelayConfig);
        return;
      } catch (error) {
        console.warn("[DelayConfigModal] failed to parse cached config", error);
      }
    }
    hydrateFromSource(DEFAULT_CONFIG);
  }, [cacheKey, hydrateFromSource, initialConfig, open]);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => persistDraft(config), 250);
    return () => window.clearTimeout(id);
  }, [config, open, persistDraft]);

  useEffect(() => {
    if (!open) return;
    if (config.delayType !== "optimal_send_time") {
      setOptimalPreview(null);
      setOptimalError(null);
      setOptimalLoading(false);
      return;
    }
    void loadOptimalPreview();
  }, [config.delayType, loadOptimalPreview, open]);

  const handleDelayTypeChange = useCallback((type: DelayType) => {
    setConfig(prev => ({
      ...applyDefaults({
        ...prev,
        delayType: type,
        specificConfig: getDefaultSpecificConfig(type),
      }),
    }));
    setStepIndex(1);
    setPreviewScenarios([]);
  }, []);

  const updateSpecificConfig = useCallback(
    <T extends DelaySpecificConfig>(updates: Partial<T>) => {
      setConfig(prev => ({
        ...prev,
        specificConfig: { ...(prev.specificConfig as T), ...updates } as DelaySpecificConfig,
      }));
    },
    [],
  );

  const handleQuietHoursChange = useCallback((quietHours: NonNullable<DelayConfig["quietHours"]>) => {
    setConfig(prev => ({ ...prev, quietHours }));
  }, []);

  const handleHolidayChange = useCallback((holidaySettings: NonNullable<DelayConfig["holidaySettings"]>) => {
    setConfig(prev => ({ ...prev, holidaySettings }));
  }, []);

  const handleThrottlingChange = useCallback((throttling: NonNullable<DelayConfig["throttling"]>) => {
    setConfig(prev => ({ ...prev, throttling }));
  }, []);

  const handleBack = useCallback(() => {
    setErrors([]);
    setStepIndex(index => Math.max(index - 1, 0));
  }, []);

  const handleNext = useCallback(async () => {
    if (stepIndex >= STEPS.length - 1) return;

    const validationErrors =
      currentStep.id === "details"
        ? validateDetails(config)
        : currentStep.id === "restrictions"
        ? validateRestrictions(config)
        : [];

    if (validationErrors.length) {
      setErrors(validationErrors);
      toast.error("Resolve validation issues to continue.");
      return;
    }

    setErrors([]);
    const nextIndex = stepIndex + 1;
    setStepIndex(nextIndex);

    if (STEPS[nextIndex].id === "preview") {
      await handlePreview();
    }
  }, [config, currentStep.id, handlePreview, stepIndex, toast]);

  const handleSave = useCallback(async () => {
    const validationErrors = [...validateDetails(config), ...validateRestrictions(config)];
    if (validationErrors.length) {
      setErrors(validationErrors);
      toast.error("Fix validation issues before saving.");
      setStepIndex(validationErrors.length && validateDetails(config).length ? 1 : 2);
      return;
    }

    try {
      setSaving(true);
      const response = await fetch(`/api/journeys/${journeyId}/nodes/${nodeId}/delay-config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error ?? "Failed to save delay configuration.");
      }
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(cacheKey);
      }
      onSave(config);
      toast.success("Delay configuration saved.");
    } catch (error) {
      console.error("[DelayConfigModal] save", error);
      const message = error instanceof Error ? error.message : String(error);
      toast.error(message || "Unable to save delay configuration.");
    } finally {
      setSaving(false);
    }
  }, [cacheKey, config, journeyId, nodeId, onSave, toast]);

  const restrictionsSummary = useMemo(() => {
    const lines: string[] = [];
    if (config.quietHours?.enabled) {
      lines.push(
        `Quiet hours ${formatTimeOfDay(config.quietHours.startTime)} – ${formatTimeOfDay(config.quietHours.endTime)} (${config.quietHours.timezone === "customer" ? "customer timezone" : config.quietHours.timezone}).`,
      );
    }
    if (config.holidaySettings?.skipWeekends) {
      lines.push("Skip weekends.");
    }
    if (config.holidaySettings?.skipHolidays) {
      lines.push("Skip public holidays.");
    }
    if (config.throttling?.enabled) {
      const parts = [
        config.throttling.maxUsersPerHour
          ? `${config.throttling.maxUsersPerHour.toLocaleString()} users/hour`
          : null,
        config.throttling.maxUsersPerDay ? `${config.throttling.maxUsersPerDay.toLocaleString()} users/day` : null,
      ].filter(Boolean);
      lines.push(`Throttling enabled${parts.length ? ` (${parts.join(", ")})` : ""}.`);
    }
    return lines;
  }, [config]);

  const renderTypeStep = () => (
    <section className="space-y-6">
      <DelayTypeSelector value={config.delayType} onChange={handleDelayTypeChange} />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-[0.25em] text-[#94A3B8]">Node label</Label>
          <Input
            placeholder="Delay node name"
            value={config.nodeName ?? ""}
            onChange={event => setConfig(prev => ({ ...prev, nodeName: event.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-[0.25em] text-[#94A3B8]">Internal description</Label>
          <Textarea
            placeholder="Explain why this delay exists. Visible only inside the builder."
            value={config.description ?? ""}
            onChange={event => setConfig(prev => ({ ...prev, description: event.target.value }))}
            className="min-h-[80px]"
          />
        </div>
      </div>
    </section>
  );

  const renderFixedTimeConfig = (specific: FixedTimeDelayConfig) => (
    <section className="space-y-4">
      <DurationPicker
        label="How long should users wait?"
        value={specific.duration}
        onChange={duration => updateSpecificConfig<FixedTimeDelayConfig>({ duration })}
      />
      <Textarea
        placeholder="Optional note about this delay"
        value={specific.description ?? ""}
        onChange={event => updateSpecificConfig<FixedTimeDelayConfig>({ description: event.target.value })}
      />
    </section>
  );

  const renderWaitUntilConfig = (specific: WaitUntilTimeConfig) => (
    <section className="space-y-6">
      <TimePicker
        label="Target time of day"
        value={specific.time}
        onChange={time => updateSpecificConfig<WaitUntilTimeConfig>({ time })}
        timezone={specific.timezone}
        allowTimezoneSelection
        minuteStep={5}
        onTimezoneChange={timezone => updateSpecificConfig<WaitUntilTimeConfig>({ timezone })}
      />
      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-[0.25em] text-[#94A3B8]">If the time already passed today</Label>
        <Select
          value={specific.ifPassed}
          onValueChange={value =>
            updateSpecificConfig<WaitUntilTimeConfig>({ ifPassed: value as WaitUntilTimeConfig["ifPassed"] })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select behaviour" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="wait_until_tomorrow">Wait until the same time tomorrow</SelectItem>
            <SelectItem value="skip_wait">Skip wait (continue immediately)</SelectItem>
            <SelectItem value="continue_immediately">Continue immediately with warning</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Textarea
        placeholder="Optional note about this delay"
        value={specific.description ?? ""}
        onChange={event => updateSpecificConfig<WaitUntilTimeConfig>({ description: event.target.value })}
      />
    </section>
  );

  const renderWaitForEventConfig = (specific: WaitForEventConfig) => (
    <section className="space-y-6">
      <EventSelector
        value={specific.eventName}
        onChange={eventName => updateSpecificConfig<WaitForEventConfig>({ eventName })}
        eventFilters={specific.eventFilters}
        onFiltersChange={eventFilters => updateSpecificConfig<WaitForEventConfig>({ eventFilters })}
      />
      <DurationPicker
        label="Maximum wait time (timeout)"
        value={specific.maxWaitTime}
        onChange={maxWaitTime => updateSpecificConfig<WaitForEventConfig>({ maxWaitTime })}
        minValue={1}
      />
      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-[0.25em] text-[#94A3B8]">If the event never happens</Label>
        <Select
          value={specific.onTimeout}
          onValueChange={value =>
            updateSpecificConfig<WaitForEventConfig>({ onTimeout: value as WaitForEventConfig["onTimeout"] })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select behaviour" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="continue">Continue the main path</SelectItem>
            <SelectItem value="exit">Exit the journey</SelectItem>
            <SelectItem value="branch_to_timeout_path">Branch to timeout path</SelectItem>
          </SelectContent>
        </Select>
        {specific.onTimeout === "branch_to_timeout_path" ? (
          <Input
            placeholder="Timeout branch label (optional)"
            value={specific.timeoutBranchLabel ?? ""}
            onChange={event =>
              updateSpecificConfig<WaitForEventConfig>({ timeoutBranchLabel: event.target.value })
            }
          />
        ) : null}
      </div>
      <Textarea
        placeholder="Optional note about this delay"
        value={specific.description ?? ""}
        onChange={event => updateSpecificConfig<WaitForEventConfig>({ description: event.target.value })}
      />
    </section>
  );

  const renderOptimalSendTimeConfig = (specific: OptimalSendTimeConfig) => (
    <section className="space-y-6">
      <DurationPicker
        label="Optimisation window"
        value={specific.window?.duration ?? { value: 24, unit: "hours" }}
        onChange={duration =>
          updateSpecificConfig<OptimalSendTimeConfig>({
            window: { ...(specific.window ?? { duration }), duration },
          })
        }
        minValue={1}
        allowedUnits={["hours", "days"]}
      />
      <TimePicker
        label="Fallback send time"
        value={specific.fallbackTime ?? { hour: 10, minute: 0 }}
        onChange={time => updateSpecificConfig<OptimalSendTimeConfig>({ fallbackTime: time })}
        timezone={specific.timezone}
        allowTimezoneSelection
        minuteStep={15}
        onTimezoneChange={timezone => updateSpecificConfig<OptimalSendTimeConfig>({ timezone })}
      />
      <Textarea
        placeholder="Optional note about this delay"
        value={specific.description ?? ""}
        onChange={event => updateSpecificConfig<OptimalSendTimeConfig>({ description: event.target.value })}
      />
      <OptimalTimePreview
        historicalData={optimalPreview?.historicalData}
        optimalWindow={optimalPreview?.optimalWindow}
        selectedWindow={specific.window?.duration ?? { value: 24, unit: "hours" }}
        loading={optimalLoading}
        error={optimalError}
        onRefresh={loadOptimalPreview}
      />
    </section>
  );

  const renderWaitForAttributeConfig = (specific: WaitForAttributeConfig) => (
    <section className="space-y-6">
      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-[0.25em] text-[#94A3B8]">Attribute path</Label>
        <Input
          placeholder="e.g. properties.subscription.status"
          value={specific.attributePath}
          onChange={event => updateSpecificConfig<WaitForAttributeConfig>({ attributePath: event.target.value })}
        />
        <p className="text-xs text-[#64748B]">
          Provide the path to the customer attribute to monitor. Use dot notation for nested properties.
        </p>
      </div>
      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-[0.25em] text-[#94A3B8]">Target value</Label>
        <Input
          placeholder="e.g. active"
          value={typeof specific.targetValue === 'string' || typeof specific.targetValue === 'number' ? String(specific.targetValue) : ""}
          onChange={event => updateSpecificConfig<WaitForAttributeConfig>({ targetValue: event.target.value })}
        />
      </div>
      <DurationPicker
        label="Maximum wait time (timeout)"
        value={specific.maxWaitTime}
        onChange={maxWaitTime => updateSpecificConfig<WaitForAttributeConfig>({ maxWaitTime })}
        minValue={1}
      />
      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-[0.25em] text-[#94A3B8]">If the attribute never reaches the value</Label>
        <Select
          value={specific.onTimeout}
          onValueChange={value =>
            updateSpecificConfig<WaitForAttributeConfig>({ onTimeout: value as WaitForAttributeConfig["onTimeout"] })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select behaviour" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="continue">Continue the main path</SelectItem>
            <SelectItem value="exit">Exit the journey</SelectItem>
            <SelectItem value="branch_to_timeout_path">Branch to timeout path</SelectItem>
          </SelectContent>
        </Select>
        {specific.onTimeout === "branch_to_timeout_path" ? (
          <Input
            placeholder="Timeout branch label (optional)"
            value={specific.timeoutBranchLabel ?? ""}
            onChange={event =>
              updateSpecificConfig<WaitForAttributeConfig>({ timeoutBranchLabel: event.target.value })
            }
          />
        ) : null}
      </div>
      <Textarea
        placeholder="Optional note about this delay"
        value={specific.description ?? ""}
        onChange={event => updateSpecificConfig<WaitForAttributeConfig>({ description: event.target.value })}
      />
    </section>
  );

  const renderDetailsStep = () => {
    switch (config.delayType) {
      case "fixed_time":
        return renderFixedTimeConfig(config.specificConfig as FixedTimeDelayConfig);
      case "wait_until_time":
        return renderWaitUntilConfig(config.specificConfig as WaitUntilTimeConfig);
      case "wait_for_event":
        return renderWaitForEventConfig(config.specificConfig as WaitForEventConfig);
      case "optimal_send_time":
        return renderOptimalSendTimeConfig(config.specificConfig as OptimalSendTimeConfig);
      case "wait_for_attribute":
        return renderWaitForAttributeConfig(config.specificConfig as WaitForAttributeConfig);
      default:
        return null;
    }
  };

  const renderRestrictionsStep = () => (
    <section className="space-y-6">
      <QuietHoursConfig value={config.quietHours!} onChange={handleQuietHoursChange} />
      <HolidaySettingsConfig value={config.holidaySettings!} onChange={handleHolidayChange} />
      <ThrottlingConfig value={config.throttling!} onChange={handleThrottlingChange} />
    </section>
  );

  const renderPreviewStep = () => (
    <section className="space-y-6">
      <section className="space-y-3 rounded-2xl border border-[#E2E8F0] bg-white p-5">
        <header>
          <p className="text-sm font-semibold text-[#1E293B]">Summary</p>
          <p className="text-xs text-[#64748B]">Review the configuration before saving it to your journey.</p>
        </header>
        <ul className="space-y-2 text-sm text-[#475569]">
          <li>
            <span className="font-semibold text-[#1E293B]">Delay:</span> {getDelaySummary(config)}
          </li>
          {config.description ? (
            <li>
              <span className="font-semibold text-[#1E293B]">Internal note:</span> {config.description}
            </li>
          ) : null}
          {restrictionsSummary.length ? (
            <li>
              <span className="font-semibold text-[#1E293B]">Restrictions:</span>{" "}
              {restrictionsSummary.map((line, index) => (
                <span key={line}>
                  {line}
                  {index < restrictionsSummary.length - 1 ? " " : ""}
                </span>
              ))}
            </li>
          ) : (
            <li>
              <span className="font-semibold text-[#1E293B]">Restrictions:</span> None applied.
            </li>
          )}
        </ul>
      </section>

      <DelayPreviewCard
        config={config}
        scenarios={previewScenarios}
        onRefresh={handlePreview}
        loading={previewLoading}
        error={previewError}
      />
    </section>
  );

  const renderStepContent = () => {
    switch (currentStep.id) {
      case "type":
        return renderTypeStep();
      case "details":
        return renderDetailsStep();
      case "restrictions":
        return renderRestrictionsStep();
      case "preview":
        return renderPreviewStep();
      default:
        return null;
    }
  };

  const stepIndicator = (
    <ol className="grid gap-3 md:grid-cols-4">
      {STEPS.map((step, index) => {
        const status = index < stepIndex ? "complete" : index === stepIndex ? "current" : "upcoming";
        return (
          <li
            key={step.id}
            className={cn(
              "rounded-2xl border p-4 transition",
              status === "current" && "border-[#3B82F6] bg-[#EFF6FF]",
              status === "complete" && "border-[#4ADE80] bg-[#F0FDF4]",
              status === "upcoming" && "border-[#E2E8F0] bg-white",
            )}
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold",
                  status === "current" && "bg-[#3B82F6] text-white",
                  status === "complete" && "bg-[#4ADE80] text-white",
                  status === "upcoming" && "bg-[#E2E8F0] text-[#64748B]",
                )}
                aria-hidden
              >
                {status === "complete" ? <CheckCircle2 className="h-5 w-5" /> : index + 1}
              </div>
              <div>
                <p className="text-sm font-semibold text-[#1E293B]">{step.title}</p>
                <p className="text-xs text-[#64748B]">{step.description}</p>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Configure delay"
      subtitle="Guide customers through delays that respect quiet hours, holidays, and throttling rules."
      size="xl"
      footer={
        <div className="flex items-center justify-between">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={handleBack} disabled={stepIndex === 0}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            {stepIndex < STEPS.length - 1 ? (
              <Button type="button" onClick={handleNext}>
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button type="button" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save delay
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {stepIndicator}
        {errors.length ? (
          <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4" />
            <ul className="space-y-1">
              {errors.map(error => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {renderStepContent()}
      </div>
    </Modal>
  );
}


"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";

import Modal from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useToast } from "@/lib/hooks/useToast";
import type { GoalConfig, GoalType } from "@/lib/types/goal-config";

import { GoalTypeSelector } from "./GoalTypeSelector";
import { GoalDetailsForm } from "./GoalDetailsForm";
import { EventFilterBuilder } from "./EventFilterBuilder";
import { AttributionSettings } from "./AttributionSettings";
import { ExitBehaviorForm } from "./ExitBehaviorForm";
import { GoalPreview } from "./GoalPreview";

interface GoalConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: GoalConfig) => void;
  initialConfig?: GoalConfig | null;
  journeyId: string;
  nodeId: string;
}

type WizardStepId = "type" | "details" | "attribution" | "exit" | "preview";

interface WizardStep {
  id: WizardStepId;
  title: string;
  description: string;
}

const STEPS: WizardStep[] = [
  { id: "type", title: "Choose goal type", description: "Select how this goal will be tracked." },
  { id: "details", title: "Define goal details", description: "Name, category and measurement criteria." },
  { id: "attribution", title: "Attribution settings", description: "Configure attribution window and model." },
  { id: "exit", title: "Exit behaviour", description: "Decide what happens after goal completion." },
  { id: "preview", title: "Review & save", description: "Double-check before saving the configuration." },
];

const DEFAULT_GOAL_CONFIG: GoalConfig = {
  goalType: "journey_completion",
  goalName: "Journey Completed",
  goalCategory: "conversion",
  attributionWindow: { value: 7, unit: "days" },
  attributionModel: "last_touch",
  countMultipleConversions: false,
  exitAfterGoal: true,
  markAsCompleted: true,
};

function validateGoal(config: GoalConfig): string[] {
  const errors: string[] = [];
  if (!config.goalName.trim()) {
    errors.push("Goal name is required.");
  }

  if (
    (config.goalType === "shopify_event" ||
      config.goalType === "whatsapp_engagement" ||
      config.goalType === "custom_event") &&
    !config.eventName?.trim()
  ) {
    errors.push("Event name is required for the selected goal type.");
  }

  if (config.goalType === "segment_entry" && !config.segmentId?.trim()) {
    errors.push("Segment ID is required for segment-based goals.");
  }

  if (config.attributionWindow.value <= 0) {
    errors.push("Attribution window must be greater than zero.");
  }

  return errors;
}

export function GoalConfigModal({ isOpen, onClose, onSave, initialConfig, journeyId, nodeId }: GoalConfigModalProps) {
  const toast = useToast();
  const [config, setConfig] = useState<GoalConfig>(DEFAULT_GOAL_CONFIG);
  const [stepIndex, setStepIndex] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const storageKey = useMemo(() => `goal_config:${journeyId}:${nodeId}`, [journeyId, nodeId]);

  useEffect(() => {
    if (!isOpen) return;
    setStepIndex(0);
    setErrors([]);
    const draft = typeof window !== "undefined" ? window.localStorage.getItem(storageKey) : null;
    if (draft && !initialConfig) {
      try {
        const parsed = JSON.parse(draft) as GoalConfig;
        setConfig({ ...DEFAULT_GOAL_CONFIG, ...parsed });
        return;
      } catch (error) {
        console.warn("[GoalConfigModal] Failed to parse cached config", error);
      }
    }
    if (initialConfig) {
      setConfig({ ...DEFAULT_GOAL_CONFIG, ...initialConfig });
    } else {
      setConfig(DEFAULT_GOAL_CONFIG);
    }
  }, [initialConfig, isOpen, storageKey]);

  useEffect(() => {
    if (!isOpen) return;
    const timeout = window.setTimeout(() => {
      window.localStorage.setItem(storageKey, JSON.stringify(config));
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [config, isOpen, storageKey]);

  const handleStepChange = (direction: "next" | "prev") => {
    if (direction === "next") {
      const nextIndex = Math.min(stepIndex + 1, STEPS.length - 1);
      setStepIndex(nextIndex);
      setErrors([]);
    } else {
      const prevIndex = Math.max(stepIndex - 1, 0);
      setStepIndex(prevIndex);
      setErrors([]);
    }
  };

  const handleTypeChange = (goalType: GoalType) => {
    const nextConfig: GoalConfig = {
      ...config,
      goalType,
    };

    if (goalType === "shopify_event" || goalType === "whatsapp_engagement" || goalType === "custom_event") {
      nextConfig.eventName = nextConfig.eventName ?? "";
    } else {
      delete nextConfig.eventName;
      delete nextConfig.eventFilters;
    }

    if (goalType === "segment_entry") {
      nextConfig.segmentId = nextConfig.segmentId ?? "";
    } else {
      delete nextConfig.segmentId;
    }

    if (goalType === "journey_completion") {
      nextConfig.exitAfterGoal = true;
      nextConfig.markAsCompleted = true;
    }

    setConfig(nextConfig);
  };

  const handleSave = async () => {
    const validationErrors = validateGoal(config);
    if (validationErrors.length) {
      setErrors(validationErrors);
      toast.error("Fix validation issues before saving.");
      setStepIndex(1);
      return;
    }

    try {
      setSaving(true);
      const response = await fetch(`/api/journeys/${journeyId}/nodes/${nodeId}/goal-config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error ?? "Failed to save goal configuration.");
      }
      window.localStorage.removeItem(storageKey);
      onSave(config);
      toast.success("Goal configuration saved.");
    } catch (error: any) {
      console.error("[GoalConfigModal] save", error);
      toast.error(error?.message ?? "Unable to save goal configuration.");
    } finally {
      setSaving(false);
    }
  };

  const currentStep = STEPS[stepIndex];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Configure Goal"
      subtitle="Define what success looks like for this journey."
      size="xl"
    >
      <div className="flex flex-col gap-6">
        <header className="space-y-3 rounded-2xl border border-[#E2E8F0] bg-white px-4 py-4 shadow-sm">
          <div className="flex items-center justify-between text-sm text-[#1E293B]">
            <span className="font-semibold uppercase tracking-[0.25em] text-[#94A3B8]">
              Step {stepIndex + 1} of {STEPS.length}
            </span>
            <span>{currentStep.title}</span>
          </div>
          <p className="text-xs text-[#64748B]">{currentStep.description}</p>
          <div className="flex gap-2">
            {STEPS.map((step, index) => (
              <div
                key={step.id}
                className={cn("h-1 flex-1 rounded-full", index <= stepIndex ? "bg-[#10B981]" : "bg-[#E2E8F0]")}
              />
            ))}
          </div>
        </header>

        {errors.length ? (
          <div className="space-y-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-600">
            <div className="flex items-center gap-2 font-semibold">
              <AlertCircle className="h-4 w-4" />
              <span>Validation issues</span>
            </div>
            <ul className="list-disc space-y-1 pl-5">
              {errors.map(error => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="max-h-[60vh] overflow-y-auto pr-1">
          {currentStep.id === "type" ? (
            <GoalTypeSelector value={config.goalType} onChange={handleTypeChange} />
          ) : currentStep.id === "details" ? (
            <div className="space-y-4">
              <GoalDetailsForm value={config} onChange={setConfig} />
              {(config.goalType === "shopify_event" ||
                config.goalType === "whatsapp_engagement" ||
                config.goalType === "custom_event") && (
                <EventFilterBuilder
                  filters={config.eventFilters ?? []}
                  onChange={eventFilters => setConfig(prev => ({ ...prev, eventFilters }))}
                />
              )}
            </div>
          ) : currentStep.id === "attribution" ? (
            <AttributionSettings value={config} onChange={setConfig} />
          ) : currentStep.id === "exit" ? (
            <ExitBehaviorForm value={config} onChange={setConfig} />
          ) : (
            <GoalPreview config={config} />
          )}
        </div>

        <footer className="flex flex-col gap-3 border-t border-[#E2E8F0] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="border-[#E2E8F0] text-[#1E293B] hover:bg-[#E2E8F0]/40"
              onClick={() => handleStepChange("prev")}
              disabled={stepIndex === 0}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-[#E2E8F0] text-[#1E293B] hover:bg-[#E2E8F0]/40"
              onClick={() => handleStepChange("next")}
              disabled={stepIndex >= STEPS.length - 1}
            >
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="border-[#E2E8F0] text-[#1E293B] hover:bg-[#E2E8F0]/40"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-[#10B981] text-white hover:bg-[#059669]"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              Save goal
            </Button>
          </div>
        </footer>
      </div>
    </Modal>
  );
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}



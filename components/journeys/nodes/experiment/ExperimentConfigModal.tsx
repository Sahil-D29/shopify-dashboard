"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardEdit,
  FlaskConical,
  LayoutList,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react";

import Modal from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/lib/hooks/useToast";
import { cn } from "@/lib/utils";

import type {
  ExperimentConfig,
  ExperimentType,
  Goal,
  SampleSizeParams,
  SampleSizeResult,
  Variant,
  WinningCriteria,
} from "@/lib/types/experiment-config";

import { ExperimentTypeSelector } from "./ExperimentTypeSelector";
import { VariantManager } from "./VariantManager";
import { TrafficSplitVisualizer } from "./TrafficSplitVisualizer";
import { SampleSizeCalculator } from "./SampleSizeCalculator";
import { GoalSelector } from "./GoalSelector";
import { WinningCriteriaForm } from "./WinningCriteriaForm";
import { ExperimentSummary } from "./ExperimentSummary";

interface ExperimentConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: ExperimentConfig) => void;
  initialConfig?: ExperimentConfig | null;
  journeyId: string;
  nodeId: string;
  estimatedDailyTraffic?: number;
}

interface StepDefinition {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const steps: StepDefinition[] = [
  { id: "info", title: "Experiment Info", description: "Define hypothesis, type, and context.", icon: ClipboardEdit },
  { id: "variants", title: "Variants", description: "Manage variants and traffic allocation.", icon: LayoutList },
  { id: "sample", title: "Sample Size", description: "Estimate required sample size.", icon: FlaskConical },
  { id: "goals", title: "Goals", description: "Select goals to measure success.", icon: Target },
  { id: "criteria", title: "Winning Criteria", description: "Define when to declare a winner.", icon: Trophy },
  { id: "review", title: "Review & Save", description: "Preview configuration and save.", icon: Sparkles },
];

const DEFAULT_VARIANTS: Variant[] = [
  { id: "control", name: "Control", isControl: true, trafficAllocation: 50, color: "#6366F1" },
  { id: "variant_1", name: "Variant B", isControl: false, trafficAllocation: 50, color: "#F59E0B" },
];

const DEFAULT_SAMPLE_PARAMS: SampleSizeParams = {
  baselineConversionRate: 0.05,
  minimumDetectableEffect: 0.2,
  confidenceLevel: 0.95,
  statisticalPower: 0.8,
  numberOfVariants: DEFAULT_VARIANTS.length,
};

const DEFAULT_WINNING_CRITERIA: WinningCriteria = {
  strategy: "automatic",
  statisticalSignificance: 0.95,
  minimumLift: 0.05,
  minimumRuntime: { value: 7, unit: "days" },
  postTestAction: "send_all_to_winner",
  removeLosingPaths: true,
};

const DEFAULT_CONFIG: ExperimentConfig = {
  experimentName: "",
  description: "",
  hypothesis: "",
  experimentType: "ab_test",
  variants: DEFAULT_VARIANTS,
  sampleSize: { params: DEFAULT_SAMPLE_PARAMS, result: undefined },
  duration: { minimumDays: 7, maximumDays: undefined },
  goals: [],
  primaryGoalId: "",
  winningCriteria: DEFAULT_WINNING_CRITERIA,
};

function roundAllocations(variants: Variant[]): Variant[] {
  const total = variants.reduce((sum, variant) => sum + variant.trafficAllocation, 0);
  if (Math.abs(total - 100) <= 0.01) return variants;
  const factor = 100 / total;
  let accum = 0;
  const scaled = variants.map((variant, index) => {
    const allocation = Number((variant.trafficAllocation * factor).toFixed(1));
    if (index === variants.length - 1) {
      const remainder = Number((100 - accum - allocation).toFixed(1));
      return { ...variant, trafficAllocation: allocation + remainder };
    }
    accum += allocation;
    return { ...variant, trafficAllocation: allocation };
  });
  return scaled;
}

function validateExperimentConfig(config: ExperimentConfig): string[] {
  const errors: string[] = [];
  if (!config.experimentName.trim()) {
    errors.push("Experiment name is required.");
  }
  if (config.variants.length < 2) {
    errors.push("At least two variants required.");
  }
  const totalAllocation = config.variants.reduce((sum, variant) => sum + variant.trafficAllocation, 0);
  if (Math.abs(totalAllocation - 100) > 0.5) {
    errors.push("Traffic allocation must sum to 100%.");
  }
  const controlCount = config.variants.filter(variant => variant.isControl).length;
  if (controlCount !== 1) {
    errors.push("Exactly one control variant required.");
  }
  if (!config.goals.length) {
    errors.push("At least one goal required.");
  }
  if (!config.primaryGoalId) {
    errors.push("Primary goal must be selected.");
  }
  if (!config.sampleSize.result) {
    errors.push("Calculate sample size before saving.");
  }
  if (config.winningCriteria.strategy === "automatic") {
    if (!config.winningCriteria.statisticalSignificance) {
      errors.push("Statistical significance is required for automatic winner.");
    }
    if (!config.winningCriteria.minimumRuntime.value) {
      errors.push("Minimum runtime required for automatic strategy.");
    }
  }
  if (
    config.winningCriteria.postTestAction === "send_all_to_specific" &&
    !config.winningCriteria.specificVariantId
  ) {
    errors.push("Choose a variant for post-test action.");
  }
  return errors;
}

export default function ExperimentConfigModal({
  isOpen,
  onClose,
  onSave,
  initialConfig,
  journeyId,
  nodeId,
  estimatedDailyTraffic,
}: ExperimentConfigModalProps) {
  const toast = useToast();
  const [stepIndex, setStepIndex] = useState(0);
  const [config, setConfig] = useState<ExperimentConfig>(DEFAULT_CONFIG);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const cacheKey = useMemo(() => `experiment_config_${journeyId}_${nodeId}`, [journeyId, nodeId]);

  useEffect(() => {
    if (!isOpen) return;
    setStepIndex(0);

    const draft = typeof window !== "undefined" ? window.localStorage.getItem(cacheKey) : null;
    if (draft) {
      try {
        const parsed = JSON.parse(draft) as ExperimentConfig;
        if (!initialConfig) {
          setConfig(parsed);
          return;
        }
      } catch (error) {
        console.warn("Failed to parse experiment draft", error);
      }
    }

    if (initialConfig) {
      setConfig(initialConfig);
    } else {
      setConfig(DEFAULT_CONFIG);
    }
  }, [isOpen, initialConfig, cacheKey]);

  useEffect(() => {
    if (!isOpen) return;
    const id = setTimeout(() => {
      try {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(cacheKey, JSON.stringify(config));
        }
      } catch (error) {
        console.warn("Failed to save experiment draft", error);
      }
    }, 400);
    return () => clearTimeout(id);
  }, [config, cacheKey, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setErrors([]);
    }
  }, [isOpen]);

  const currentStep = steps[stepIndex];

  const handleExperimentTypeChange = (type: ExperimentType) => {
    setConfig(prev => ({
      ...prev,
      experimentType: type,
      variants: (() => {
        if (prev.variants.length === 0) return DEFAULT_VARIANTS;
        if (type === "ab_test" && prev.variants.length > 5) {
          return roundAllocations(prev.variants.slice(0, 5));
        }
        return prev.variants;
      })(),
    }));
  };

  const handleVariantsChange = (variants: Variant[]) => {
    setConfig(prev => ({
      ...prev,
      variants: roundAllocations(variants),
      sampleSize: {
        ...prev.sampleSize,
        params: { ...prev.sampleSize.params, numberOfVariants: variants.length },
        result: undefined,
      },
    }));
  };

  const handleSampleParamsChange = (params: SampleSizeParams) => {
    setConfig(prev => ({
      ...prev,
      sampleSize: {
        ...prev.sampleSize,
        params,
      },
    }));
  };

  const handleSampleResult = (result: SampleSizeResult) => {
    setConfig(prev => ({
      ...prev,
      sampleSize: {
        ...prev.sampleSize,
        result,
      },
    }));
  };

  const handleGoalsChange = (goals: Goal[], primaryGoalId: string) => {
    setConfig(prev => ({
      ...prev,
      goals,
      primaryGoalId,
    }));
  };

  const handleWinningCriteriaChange = (criteria: WinningCriteria) => {
    setConfig(prev => ({
      ...prev,
      winningCriteria: criteria,
    }));
  };

  const validateStep = (): boolean => {
    switch (currentStep.id) {
      case "info":
        if (!config.experimentName.trim()) {
          toast.error("Experiment name is required.");
          return false;
        }
        return true;
      case "variants": {
        if (config.variants.length < 2) {
          toast.error("Add at least two variants.");
          return false;
        }
        const controlCount = config.variants.filter(variant => variant.isControl).length;
        if (controlCount !== 1) {
          toast.error("Exactly one control variant required.");
          return false;
        }
        const total = config.variants.reduce((sum, variant) => sum + variant.trafficAllocation, 0);
        if (Math.abs(total - 100) > 0.5) {
          toast.error("Traffic allocation must sum to 100%.");
          return false;
        }
        return true;
      }
      case "sample":
        if (!config.sampleSize.result) {
          toast.error("Calculate sample size before continuing.");
          return false;
        }
        return true;
      case "goals":
        if (!config.goals.length) {
          toast.error("Add at least one goal.");
          return false;
        }
        if (!config.primaryGoalId) {
          toast.error("Set a primary goal.");
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (!validateStep()) return;
    setStepIndex(index => Math.min(index + 1, steps.length - 1));
  };

  const handleBack = () => {
    setStepIndex(index => Math.max(index - 1, 0));
  };

  const handleSave = async () => {
    setErrors([]);
    const validationErrors = validateExperimentConfig(config);
    if (validationErrors.length) {
      setErrors(validationErrors);
      toast.error("Fix validation errors before saving.");
      const firstErrorStep = validationErrors[0]?.includes("Variant")
        ? 1
        : validationErrors[0]?.includes("goal")
          ? 3
          : validationErrors[0]?.includes("Sample")
            ? 2
            : 0;
      setStepIndex(firstErrorStep);
      return;
    }

    try {
      setSaving(true);
      const response = await fetch(`/api/journeys/${journeyId}/nodes/${nodeId}/experiment-config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error ?? "Failed to save experiment configuration.");
      }
      onSave(config);
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(cacheKey);
      }
      toast.success("Experiment configuration saved.");
    } catch (error: any) {
      console.error("[ExperimentConfigModal] save", error);
      toast.error(error?.message ?? "Unable to save experiment.");
    } finally {
      setSaving(false);
    }
  };

  const renderInfoStep = () => (
    <section className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Experiment name</Label>
          <Input
            placeholder="e.g. Hero banner CTA experiment"
            value={config.experimentName}
            onChange={event => setConfig(prev => ({ ...prev, experimentName: event.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label>Experiment duration (minimum days)</Label>
          <Input
            type="number"
            min={1}
            value={config.duration.minimumDays}
            onChange={event => setConfig(prev => ({ ...prev, duration: { ...prev.duration, minimumDays: Number(event.target.value) } }))}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea
          placeholder="Explain the purpose of this experiment..."
          value={config.description}
          onChange={event => setConfig(prev => ({ ...prev, description: event.target.value }))}
          className="min-h-[80px]"
        />
      </div>
      <div className="space-y-2">
        <Label>Hypothesis</Label>
        <Textarea
          placeholder="If we change..., then ... will improve because..."
          value={config.hypothesis}
          onChange={event => setConfig(prev => ({ ...prev, hypothesis: event.target.value }))}
          className="min-h-[80px]"
        />
      </div>
      <ExperimentTypeSelector
        value={config.experimentType}
        onChange={handleExperimentTypeChange}
        disableMultivariate={estimatedDailyTraffic !== undefined ? estimatedDailyTraffic < 5000 : false}
        estimatedDailyTraffic={estimatedDailyTraffic}
      />
    </section>
  );

  const renderVariantStep = () => (
    <VariantManager
      variants={config.variants}
      onChange={handleVariantsChange}
      experimentType={config.experimentType}
      estimatedDailyTraffic={estimatedDailyTraffic}
    />
  );

  const renderSampleStep = () => (
    <SampleSizeCalculator
      params={config.sampleSize.params}
      result={config.sampleSize.result}
      onChange={handleSampleParamsChange}
      onCalculate={handleSampleResult}
      numberOfVariants={config.variants.length}
      estimatedDailyTraffic={estimatedDailyTraffic}
    />
  );

  const renderGoalsStep = () => (
    <GoalSelector goals={config.goals} primaryGoalId={config.primaryGoalId} onChange={handleGoalsChange} />
  );

  const renderCriteriaStep = () => (
    <WinningCriteriaForm criteria={config.winningCriteria} onChange={handleWinningCriteriaChange} variants={config.variants} />
  );

  const renderReviewStep = () => (
    <ExperimentSummary config={config} onEditStep={step => setStepIndex(step)} />
  );

  const renderStep = () => {
    switch (currentStep.id) {
      case "info":
        return renderInfoStep();
      case "variants":
        return renderVariantStep();
      case "sample":
        return renderSampleStep();
      case "goals":
        return renderGoalsStep();
      case "criteria":
        return renderCriteriaStep();
      case "review":
        return renderReviewStep();
      default:
        return null;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Configure Experiment"
      subtitle="Set up variants, goals, and winning criteria."
      size="xl"
    >
      <div className="flex flex-col gap-6">
        <div className="space-y-3 rounded-2xl border border-[#E2E8F0] bg-white px-4 py-4 shadow-sm">
          <div className="flex items-center justify-between text-sm text-[#1E293B]">
            <span className="font-semibold uppercase tracking-[0.25em] text-[#94A3B8]">
              Step {stepIndex + 1} of {steps.length}
            </span>
            <span>{currentStep.title}</span>
          </div>
          <p className="text-xs text-[#64748B]">{currentStep.description}</p>
          <div className="flex w-full gap-2">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={cn("h-1 flex-1 rounded-full", index <= stepIndex ? "bg-[#6366F1]" : "bg-[#E2E8F0]")}
              />
            ))}
          </div>
        </div>

        {errors.length ? (
          <div className="space-y-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-600">
            <div className="flex items-center gap-2 font-semibold">
              <AlertCircle className="h-4 w-4" />
              <span>Validation errors</span>
            </div>
            <ul className="list-disc space-y-1 pl-5">
              {errors.map(error => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="max-h-[60vh] overflow-y-auto pr-1">{renderStep()}</div>

        <footer className="flex flex-col gap-3 border-t border-[#E2E8F0] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="border-[#E2E8F0] text-[#1E293B] hover:bg-[#E2E8F0]/40"
              onClick={handleBack}
              disabled={stepIndex === 0}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-[#E2E8F0] text-[#1E293B] hover:bg-[#E2E8F0]/40"
              onClick={handleNext}
              disabled={stepIndex === steps.length - 1}
            >
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="border-[#E2E8F0] text-[#1E293B] hover:bg-[#E2E8F0]/40" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-[#6366F1] text-white hover:bg-[#4F46E5]"
              onClick={handleSave}
              disabled={stepIndex !== steps.length - 1 || saving}
            >
              {saving ? <ArrowRight className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              Save experiment
            </Button>
          </div>
        </footer>
      </div>
    </Modal>
  );
}



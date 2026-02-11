"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, GripVertical, Star, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import type { ExperimentType, Variant } from "@/lib/types/experiment-config";
import { TrafficSplitVisualizer } from "./TrafficSplitVisualizer";

interface VariantManagerProps {
  variants: Variant[];
  onChange: (variants: Variant[]) => void;
  experimentType: ExperimentType;
  estimatedDailyTraffic?: number;
  disabled?: boolean;
}

const COLOR_PALETTE = ["#6366F1", "#F59E0B", "#10B981", "#EC4899", "#0EA5E9", "#8B5CF6", "#F97316", "#14B8A6", "#EF4444", "#84CC16"];

function createVariant(index: number, isControl: boolean): Variant {
  return {
    id: `variant_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: isControl ? "Control" : `Variant ${index + 1}`,
    trafficAllocation: 0,
    isControl,
    color: COLOR_PALETTE[index % COLOR_PALETTE.length],
  };
}

function normaliseAllocations(variants: Variant[]): Variant[] {
  const total = variants.reduce((sum, variant) => sum + variant.trafficAllocation, 0);
  if (total === 100) return variants;
  if (total === 0) {
    const equalShare = Math.floor((100 / variants.length) * 100) / 100;
    const remainder = 100 - equalShare * variants.length;
    return variants.map((variant, index) => ({
      ...variant,
      trafficAllocation: index === variants.length - 1 ? equalShare + remainder : equalShare,
    }));
  }
  return variants.map(variant => ({
    ...variant,
    trafficAllocation: Number(((variant.trafficAllocation / total) * 100).toFixed(1)),
  }));
}

function distributeEqually(variants: Variant[]): Variant[] {
  const length = variants.length;
  if (length === 0) return variants;
  const base = Math.floor((100 / length) * 10) / 10;
  let remainder = Number((100 - base * length).toFixed(1));
  return variants.map((variant, index) => {
    const allocation = index === length - 1 ? Number((base + remainder).toFixed(1)) : base;
    if (index === length - 1) remainder = 0;
    return { ...variant, trafficAllocation: allocation };
  });
}

function distributeWithControlPriority(variants: Variant[]): Variant[] {
  const control = variants.find(v => v.isControl);
  if (!control) return distributeEqually(variants);
  const controlShare = Math.min(50, 100);
  const remaining = Math.max(0, 100 - controlShare);
  const others = variants.filter(v => !v.isControl);
  if (others.length === 0) {
    return variants.map(variant => ({ ...variant, trafficAllocation: variant.isControl ? 100 : 0 }));
  }
  const equalOthers = Number((remaining / others.length).toFixed(1));
  let remainder = Number((100 - controlShare - equalOthers * others.length).toFixed(1));
  return variants.map(variant => {
    if (variant.isControl) {
      return { ...variant, trafficAllocation: controlShare };
    }
    const allocation = variant === others[others.length - 1] ? Number((equalOthers + remainder).toFixed(1)) : equalOthers;
    if (variant === others[others.length - 1]) remainder = 0;
    return { ...variant, trafficAllocation: allocation };
  });
}

export function VariantManager({
  variants,
  onChange,
  experimentType,
  estimatedDailyTraffic,
  disabled = false,
}: VariantManagerProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const maxVariants = experimentType === "ab_test" ? 5 : 10;
  const canAddVariant = variants.length < maxVariants;
  const minVariants = 2;

  const totalAllocation = useMemo(() => variants.reduce((sum, variant) => sum + variant.trafficAllocation, 0), [variants]);
  const allocationError = Math.abs(totalAllocation - 100) > 0.5;
  const controlCount = variants.filter(variant => variant.isControl).length;

  const handleAddVariant = () => {
    if (!canAddVariant) return;
    const newVariant = createVariant(variants.length, variants.length === 0);
    const nextVariants = [...variants, newVariant];
    const allocated = distributeEqually(nextVariants);
    onChange(allocated);
  };

  const handleRemoveVariant = (id: string) => {
    if (variants.length <= minVariants) return;
    const next = variants.filter(variant => variant.id !== id);
    const adjusted = distributeEqually(next);
    onChange(adjusted);
  };

  const handleVariantChange = (id: string, updates: Partial<Variant>) => {
    onChange(
      variants.map(variant => (variant.id === id ? { ...variant, ...updates } : variant)),
    );
  };

  const handleSetControl = (id: string) => {
    onChange(
      variants.map(variant => ({
        ...variant,
        isControl: variant.id === id,
      })),
    );
  };

  const handleAllocationChange = (id: string, nextValue: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(nextValue)));
    const target = variants.find(variant => variant.id === id);
    if (!target) return;
    const oldRemaining = 100 - target.trafficAllocation;
    const newRemaining = 100 - clamped;
    const others = variants.filter(variant => variant.id !== id);

    let nextVariants: Variant[];
    if (others.length === 0) {
      nextVariants = [{ ...target, trafficAllocation: 100 }];
    } else {
      let adjustedOthers: Variant[];
      if (oldRemaining <= 0 || newRemaining <= 0) {
        const equal = Math.max(0, Math.floor((newRemaining / others.length) * 10) / 10);
        let remainder = Number((newRemaining - equal * others.length).toFixed(1));
        adjustedOthers = others.map((variant, index) => {
          const allocation = index === others.length - 1 ? Number((equal + remainder).toFixed(1)) : equal;
          if (index === others.length - 1) remainder = 0;
          return { ...variant, trafficAllocation: allocation };
        });
      } else {
        adjustedOthers = others.map(variant => {
          const proportion = variant.trafficAllocation / oldRemaining;
          return { ...variant, trafficAllocation: Number((proportion * newRemaining).toFixed(1)) };
        });
      }
      nextVariants = [
        ...adjustedOthers,
        { ...target, trafficAllocation: clamped },
      ];
    }
    onChange(normaliseAllocations(nextVariants));
  };

  const handleDragStart = (variantId: string) => () => {
    if (disabled) return;
    setDraggingId(variantId);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (!draggingId) return;
    event.preventDefault();
  };

  const handleDrop = (targetId: string) => (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!draggingId || draggingId === targetId) return;
    const currentIndex = variants.findIndex(variant => variant.id === draggingId);
    const targetIndex = variants.findIndex(variant => variant.id === targetId);
    if (currentIndex === -1 || targetIndex === -1) return;
    const reordered = [...variants];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(targetIndex, 0, moved);
    onChange(reordered);
    setDraggingId(null);
  };

  const handleSplitEqually = () => {
    onChange(distributeEqually(variants));
  };

  const handleResetControlSplit = () => {
    onChange(distributeWithControlPriority(variants));
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[#1E293B]">Variants</h3>
          <p className="text-xs text-[#64748B]">
            {experimentType === "ab_test"
              ? "Create up to 5 variants (including control)."
              : "Create up to 10 variants for multivariate testing."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleSplitEqually} disabled={disabled}>
            Split equally
          </Button>
          <Button variant="outline" size="sm" onClick={handleResetControlSplit} disabled={disabled}>
            Control 50 / share remainder
          </Button>
          <Button variant="default" size="sm" onClick={handleAddVariant} disabled={!canAddVariant || disabled}>
            Add variant
          </Button>
        </div>
      </div>

      {allocationError ? (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
          <AlertTriangle className="mt-0.5 h-4 w-4" />
          <div>
            Traffic allocation must equal 100%. Currently set to {totalAllocation.toFixed(1)}%.
          </div>
        </div>
      ) : null}

      {controlCount !== 1 ? (
        <div className="flex items-start gap-2 rounded-xl border border-[#FDE68A] bg-[#FEF3C7] px-3 py-2 text-xs text-[#92400E]">
          <Star className="mt-0.5 h-4 w-4" />
          <div>Exactly one variant must be marked as control.</div>
        </div>
      ) : null}

      <div className="space-y-3">
        {variants.map((variant, index) => (
          <div
            key={variant.id}
            className={cn(
              "relative flex flex-col gap-3 rounded-2xl border border-[#E2E8F0] bg-white px-4 py-4 shadow-sm transition",
              draggingId === variant.id && "border-[#7C3AED] shadow-lg",
            )}
            draggable={!disabled}
            onDragStart={handleDragStart(variant.id)}
            onDragOver={handleDragOver}
            onDrop={handleDrop(variant.id)}
          >
            <div className="flex items-start gap-3">
              <button
                type="button"
                className="mt-1 cursor-grab text-[#94A3B8] hover:text-[#6366F1]"
                disabled={disabled}
                title="Drag to reorder"
              >
                <GripVertical className="h-4 w-4" />
              </button>
              <div className="flex flex-1 flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Input
                      value={variant.name}
                      onChange={event => handleVariantChange(variant.id, { name: event.target.value })}
                      disabled={disabled}
                    />
                    {variant.isControl ? (
                      <Badge variant="secondary" className="bg-[#DCFCE7] text-[#15803D]">
                        Control
                      </Badge>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={variant.color ?? COLOR_PALETTE[index % COLOR_PALETTE.length]}
                      onChange={event => handleVariantChange(variant.id, { color: event.target.value })}
                      disabled={disabled}
                      className="h-9 w-9 cursor-pointer rounded border border-[#E2E8F0] bg-white"
                    />
                    <Button
                      variant={variant.isControl ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleSetControl(variant.id)}
                      disabled={disabled}
                    >
                      <Star className="mr-2 h-4 w-4" />
                      Set control
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={variants.length <= minVariants || disabled}
                      onClick={() => handleRemoveVariant(variant.id)}
                      className="text-[#94A3B8] hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <Textarea
                  placeholder="Describe what distinguishes this variant..."
                  value={variant.description ?? ""}
                  onChange={event => handleVariantChange(variant.id, { description: event.target.value })}
                  disabled={disabled}
                />

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-[#64748B]">
                    <span>Traffic allocation</span>
                    <span>
                      {variant.trafficAllocation.toFixed(1)}%{" "}
                      {estimatedDailyTraffic
                        ? `• ~${Math.round((variant.trafficAllocation / 100) * estimatedDailyTraffic).toLocaleString()} users/day`
                        : ""}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={variant.trafficAllocation}
                    onChange={event => handleAllocationChange(variant.id, Number(event.target.value))}
                    disabled={disabled}
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <TrafficSplitVisualizer variants={variants} estimatedDailyTraffic={estimatedDailyTraffic} />
    </section>
  );
}



"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AlertTriangle, Plus, Shuffle, Trash2 } from 'lucide-react';

import Modal from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { JourneyNodeData } from '@/components/journeys/builder/nodes';

type JsonMap = Record<string, unknown>;

const getString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value : undefined;

const getNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const isJsonMap = (value: unknown): value is JsonMap => typeof value === 'object' && value !== null && !Array.isArray(value);

interface ABTestConfigModalProps {
  open: boolean;
  initialMeta?: JourneyNodeData['meta'];
  onClose: () => void;
  onSave: (meta: JourneyNodeData['meta']) => void;
}

type ExperimentVariant = {
  id: string;
  label: string;
  description?: string;
  weight: number;
  goal?: string;
};

interface ExperimentState {
  label: string;
  description: string;
  evaluationMetric: string;
  guardrailMetric?: string;
  confidenceLevel: number;
  minimumDurationDays: number;
  sampleSize?: number;
  variants: ExperimentVariant[];
}

const EVALUATION_METRICS = [
  { value: 'conversion_rate', label: 'Conversion Rate' },
  { value: 'revenue', label: 'Revenue Generated' },
  { value: 'click_through_rate', label: 'Click Through Rate' },
  { value: 'message_replies', label: 'Message Replies' },
];

const GUARDRAIL_METRICS = [
  { value: 'drop_off_rate', label: 'Drop-off Rate' },
  { value: 'unsubscribe_rate', label: 'Unsubscribe Rate' },
  { value: 'message_spam_reports', label: 'Spam Reports' },
  { value: 'none', label: 'None' },
];

function generateVariantId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

function normaliseVariants(variants: ExperimentVariant[]): ExperimentVariant[] {
  if (!variants.length) return variants;
  const positive = variants.map(variant => ({
    ...variant,
    weight: Number.isFinite(variant.weight) ? Math.max(0, Math.round(variant.weight)) : 0,
  }));
  const total = positive.reduce((sum, variant) => sum + variant.weight, 0);
  if (total <= 0) {
    const evenWeight = Math.round(100 / positive.length);
    let remainder = 100;
    return positive.map((variant, index) => {
      const weight = index === positive.length - 1 ? remainder : evenWeight;
      remainder -= weight;
      return { ...variant, weight };
    });
  }

  let remainder = 100;
  const normalised = positive.map((variant, index) => {
    let weight = Math.round((variant.weight / total) * 100);
    if (index === positive.length - 1) {
      weight = remainder;
    }
    remainder -= weight;
    return { ...variant, weight };
  });

  return normalised;
}

function createVariant(partial?: Partial<ExperimentVariant>): ExperimentVariant {
  return {
    id: partial?.id || generateVariantId(),
    label: partial?.label || 'Variant',
    description: partial?.description,
    weight: typeof partial?.weight === 'number' ? partial.weight : 0,
    goal: partial?.goal,
  };
}

const DEFAULT_STATE: ExperimentState = {
  label: 'A/B Test',
  description: '',
  evaluationMetric: 'conversion_rate',
  guardrailMetric: 'drop_off_rate',
  confidenceLevel: 95,
  minimumDurationDays: 7,
  variants: [
    { id: generateVariantId(), label: 'Variant A', weight: 50 },
    { id: generateVariantId(), label: 'Variant B', weight: 50 },
  ],
};

export default function ABTestConfigModal({ open, initialMeta, onClose, onSave }: ABTestConfigModalProps) {
  const [state, setState] = useState<ExperimentState>(DEFAULT_STATE);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      const variants = Array.isArray(initialMeta?.variants)
        ? initialMeta.variants.map(variant => createVariant(variant as Partial<ExperimentVariant>))
        : DEFAULT_STATE.variants.map(createVariant);

      const nextState: ExperimentState = {
        label: getString(initialMeta?.label) ?? 'A/B Test',
        description: getString(initialMeta?.description) ?? '',
        evaluationMetric: getString(initialMeta?.evaluationMetric) ?? 'conversion_rate',
        guardrailMetric: getString(initialMeta?.guardrailMetric) ?? DEFAULT_STATE.guardrailMetric,
        confidenceLevel:
          getNumber(initialMeta?.confidenceLevel) !== undefined
            ? Math.min(99, Math.max(80, Math.round(getNumber(initialMeta?.confidenceLevel) ?? DEFAULT_STATE.confidenceLevel)))
            : DEFAULT_STATE.confidenceLevel,
        minimumDurationDays:
          getNumber(initialMeta?.minimumDurationDays) !== undefined
            ? Math.max(1, Math.round(getNumber(initialMeta?.minimumDurationDays) ?? DEFAULT_STATE.minimumDurationDays))
            : DEFAULT_STATE.minimumDurationDays,
        sampleSize:
          getNumber(initialMeta?.sampleSize) !== undefined && (getNumber(initialMeta?.sampleSize) ?? 0) > 0
            ? Math.round(getNumber(initialMeta?.sampleSize) ?? 0)
            : undefined,
        variants: normaliseVariants(variants),
      };
      setState(nextState);
    });
    return () => cancelAnimationFrame(frame);
  }, [initialMeta, open]);

  const totalWeight = useMemo(
    () => state.variants.reduce((sum, variant) => sum + (Number.isFinite(variant.weight) ? variant.weight : 0), 0),
    [state.variants]
  );

  const weightIsBalanced = Math.abs(totalWeight - 100) <= 1;

  const handleVariantChange = useCallback(
    (id: string, updates: Partial<ExperimentVariant>) => {
      setState(prev => ({
        ...prev,
        variants: prev.variants.map(variant => (variant.id === id ? { ...variant, ...updates } : variant)),
      }));
    },
    []
  );

  const handleAddVariant = useCallback(() => {
    setState(prev => ({
      ...prev,
      variants: prev.variants.concat(createVariant({ label: `Variant ${String.fromCharCode(65 + prev.variants.length)}` })),
    }));
  }, []);

  const handleRemoveVariant = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      variants: prev.variants.length > 2 ? prev.variants.filter(variant => variant.id !== id) : prev.variants,
    }));
  }, []);

  const handleStateChange = useCallback(<T extends keyof ExperimentState>(key: T, value: ExperimentState[T]) => {
    setState(prev => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  const canSave = useMemo(() => {
    if (state.variants.length < 2) return false;
    if (!state.label.trim()) return false;
    if (!state.variants.every(variant => variant.label.trim().length > 0)) return false;
    if (!state.variants.every(variant => Number.isFinite(variant.weight))) return false;
    return true;
  }, [state.label, state.variants]);

  const handleSave = useCallback(() => {
    if (!canSave) return;
    const variants = normaliseVariants(state.variants);
    const meta: JourneyNodeData['meta'] = {
      ...(initialMeta || {}),
      label: state.label.trim() || 'A/B Test',
      description: state.description,
      evaluationMetric: state.evaluationMetric,
      guardrailMetric: state.guardrailMetric === 'none' ? undefined : state.guardrailMetric,
      confidenceLevel: state.confidenceLevel,
      minimumDurationDays: state.minimumDurationDays,
      sampleSize: state.sampleSize,
      variants,
    };
    onSave(meta);
  }, [canSave, initialMeta, onSave, state]);

  const footer = (
    <div className="flex flex-1 items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-xs text-[#8B7F76]">
        <Shuffle className="h-4 w-4 text-[#6A5C8F]" />
        {weightIsBalanced ? (
          <span>Traffic allocation sums to {totalWeight}%.</span>
        ) : (
          <span className="flex items-center gap-1 text-[#C8998F]">
            <AlertTriangle className="h-3.5 w-3.5" /> Weights sum to {totalWeight}%. They will be normalised on save.
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          className="border-[#E8E4DE] bg-white text-[#4A4139] hover:bg-[#F5F3EE]"
          onClick={onClose}
        >
          Cancel
        </Button>
        <Button
          type="button"
          className="bg-[#6A5C8F] text-white hover:bg-[#5A4F7D]"
          disabled={!canSave}
          onClick={handleSave}
        >
          Save Experiment
        </Button>
      </div>
    </div>
  );

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Configure A/B Test"
      subtitle="Define variants, metrics, and experiment guardrails."
      size="xl"
      gradient
      footer={footer}
    >
      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="space-y-6">
          <section className="space-y-4 rounded-2xl border border-[#E8E4DE] bg-white p-6 shadow-sm">
            <div>
              <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8B7F76]">Experiment Name</Label>
              <Input
                value={state.label}
                onChange={event => handleStateChange('label', event.target.value)}
                placeholder="e.g. Welcome journey template test"
                className="mt-2"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8B7F76]">Description</Label>
              <Textarea
                rows={3}
                value={state.description}
                onChange={event => handleStateChange('description', event.target.value)}
                placeholder="Describe the hypothesis for this experiment."
                className="mt-2"
              />
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border border-[#E8E4DE] bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-[#B8977F]">Variants</h3>
                <p className="text-xs text-[#8B7F76]">Add up to four variants to test different experiences.</p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="border-[#E8E4DE] bg-white text-[#4A4139] hover:bg-[#F5F3EE]"
                onClick={handleAddVariant}
                disabled={state.variants.length >= 4}
              >
                <Plus className="mr-1 h-4 w-4" /> Add Variant
              </Button>
            </div>

            <div className="space-y-3">
              {state.variants.map((variant, index) => (
                <div
                  key={variant.id}
                  className="rounded-2xl border border-[#E8E4DE] bg-[#FAF9F6] p-4 shadow-inner"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-1 flex-col gap-2">
                      <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8B7F76]">
                        Variant {String.fromCharCode(65 + index)} Name
                      </Label>
                      <Input
                        value={variant.label}
                        onChange={event => handleVariantChange(variant.id, { label: event.target.value })}
                      />
                    </div>
                    <div className="flex items-end gap-3">
                      <div>
                        <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8B7F76]">
                          Weight (%)
                        </Label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={variant.weight}
                          onChange={event =>
                            handleVariantChange(variant.id, {
                              weight: Number(event.target.value),
                            })
                          }
                          className="mt-1 w-24"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="mt-5 h-10 w-10 border-[#E8E4DE] text-[#C8998F] hover:bg-[#FDECEC]"
                        onClick={() => handleRemoveVariant(variant.id)}
                        disabled={state.variants.length <= 2}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3">
                    <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8B7F76]">Notes</Label>
                    <Textarea
                      rows={2}
                      value={variant.description ?? ''}
                      onChange={event => handleVariantChange(variant.id, { description: event.target.value })}
                      placeholder="Optional: describe what changes in this variant."
                      className="mt-1"
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border border-[#E8E4DE] bg-white p-6 shadow-sm">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8B7F76]">
                  Evaluation Metric
                </Label>
                <select
                  className="mt-2 w-full rounded-lg border border-[#E8E4DE] bg-white px-3 py-2 text-sm text-[#4A4139] focus:border-[#6A5C8F] focus:outline-none focus:ring-2 focus:ring-[#6A5C8F]/20"
                  value={state.evaluationMetric}
                  onChange={event => handleStateChange('evaluationMetric', event.target.value)}
                >
                  {EVALUATION_METRICS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8B7F76]">
                  Guardrail Metric
                </Label>
                <select
                  className="mt-2 w-full rounded-lg border border-[#E8E4DE] bg-white px-3 py-2 text-sm text-[#4A4139] focus:border-[#6A5C8F] focus:outline-none focus:ring-2 focus:ring-[#6A5C8F]/20"
                  value={state.guardrailMetric ?? 'none'}
                  onChange={event => handleStateChange('guardrailMetric', event.target.value === 'none' ? undefined : event.target.value)}
                >
                  {GUARDRAIL_METRICS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8B7F76]">
                  Confidence Level (%)
                </Label>
                <Input
                  className="mt-2"
                  type="number"
                  min={80}
                  max={99}
                  value={state.confidenceLevel}
                  onChange={event =>
                    handleStateChange('confidenceLevel', Math.min(99, Math.max(80, Number(event.target.value))))
                  }
                />
              </div>
              <div>
                <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8B7F76]">
                  Minimum Duration (days)
                </Label>
                <Input
                  className="mt-2"
                  type="number"
                  min={1}
                  value={state.minimumDurationDays}
                  onChange={event => handleStateChange('minimumDurationDays', Math.max(1, Number(event.target.value)))}
                />
              </div>
              <div>
                <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8B7F76]">
                  Planned Sample Size (optional)
                </Label>
                <Input
                  className="mt-2"
                  type="number"
                  min={0}
                  value={state.sampleSize ?? ''}
                  onChange={event => {
                    const value = Number(event.target.value);
                    handleStateChange('sampleSize', Number.isFinite(value) && value > 0 ? value : undefined);
                  }}
                />
              </div>
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-[#E8E4DE] bg-[#F6F1EB] p-5 shadow-sm">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[#B8977F]">Summary</h3>
            <ul className="mt-3 space-y-2 text-sm text-[#4A4139]">
              <li>
                <strong>{state.variants.length}</strong> variants, confidence {state.confidenceLevel}%
              </li>
              <li>
                Evaluating <strong>{EVALUATION_METRICS.find(metric => metric.value === state.evaluationMetric)?.label ?? state.evaluationMetric}</strong>
              </li>
              <li>
                Guardrail: <strong>{state.guardrailMetric ? GUARDRAIL_METRICS.find(metric => metric.value === state.guardrailMetric)?.label ?? state.guardrailMetric : 'None'}</strong>
              </li>
              <li>
                Minimum runtime <strong>{state.minimumDurationDays} days</strong>
              </li>
              {state.sampleSize ? (
                <li>
                  Target sample size <strong>{state.sampleSize.toLocaleString()}</strong>
                </li>
              ) : null}
            </ul>
          </section>
          <section className="rounded-2xl border border-[#E8E4DE] bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[#B8977F]">Traffic Allocation</h3>
            <div className="mt-3 space-y-3">
              {state.variants.map(variant => (
                <div key={variant.id} className="flex items-center justify-between text-sm text-[#4A4139]">
                  <span>{variant.label || 'Variant'}</span>
                  <span className="font-semibold">{variant.weight}%</span>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </Modal>
  );
}


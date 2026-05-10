"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Award, Target } from 'lucide-react';

import Modal from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { JourneyNodeData } from '@/components/journeys/builder/nodes';

type JsonMap = Record<string, unknown>;

const getString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value : undefined;

const getNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

type GoalType = 'order_any' | 'order_value' | 'product_purchased' | 'tag_added' | 'link_clicked';

interface GoalState {
  goalType: GoalType;
  goalName: string;
  conversionWindow: number;
  productId?: string;
  productName?: string;
  orderThreshold?: number;
  tagName?: string;
  linkTracking?: string;
}

interface GoalConfigModalProps {
  open: boolean;
  initialMeta?: JourneyNodeData['meta'];
  onClose: () => void;
  onSave: (meta: JourneyNodeData['meta']) => void;
}

const GOAL_OPTIONS: Array<{ value: GoalType; label: string; description: string }> = [
  { value: 'order_any', label: 'Any Order Placed', description: 'Count the first order placed after entering the journey.' },
  { value: 'order_value', label: 'Order Value Exceeds Amount', description: 'Track customers who spend above a threshold.' },
  { value: 'product_purchased', label: 'Specific Product Purchased', description: 'Goal achieved when a selected product is purchased.' },
  { value: 'tag_added', label: 'Customer Tagged', description: 'Track when a customer receives a specific tag.' },
  { value: 'link_clicked', label: 'Link Clicked', description: 'Conversion when a tracked link is clicked.' },
];

const DEFAULT_STATE: GoalState = {
  goalType: 'order_any',
  goalName: 'Order Placed',
  conversionWindow: 30,
  orderThreshold: 0,
  productId: '',
  productName: '',
  tagName: '',
  linkTracking: '',
};

function buildSummary(state: GoalState) {
  switch (state.goalType) {
    case 'order_any':
      return 'Goal: Order placed within journey window';
    case 'order_value':
      return `Goal: Order total ≥ ${state.orderThreshold ?? 0}`;
    case 'product_purchased':
      return `Goal: Purchased ${state.productName || state.productId || 'selected product'}`;
    case 'tag_added':
      return `Goal: Customer tagged with “${state.tagName || 'tag'}”`;
    case 'link_clicked':
      return `Goal: Link clicked (${state.linkTracking || 'tracking id'})`;
    default:
      return 'Goal configured';
  }
}

export default function GoalConfigModal({ open, initialMeta, onClose, onSave }: GoalConfigModalProps) {
  const [state, setState] = useState<GoalState>(DEFAULT_STATE);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      const next: GoalState = {
        goalType: (getString(initialMeta?.goalType) as GoalType) ?? 'order_any',
        goalName: getString(initialMeta?.goalName) ?? DEFAULT_STATE.goalName,
        conversionWindow: getNumber(initialMeta?.conversionWindow) ?? DEFAULT_STATE.conversionWindow,
        productId: getString(initialMeta?.productId) ?? '',
        productName: getString(initialMeta?.productName) ?? '',
        orderThreshold: getNumber(initialMeta?.orderThreshold) ?? 0,
        tagName: getString(initialMeta?.tagName) ?? '',
        linkTracking: getString(initialMeta?.linkTracking) ?? '',
      };
      setState(next);
    });
    return () => cancelAnimationFrame(frame);
  }, [open, initialMeta]);

  const summary = useMemo(() => buildSummary(state), [state]);

  const handleChange = useCallback(<K extends keyof GoalState>(key: K, value: GoalState[K]) => {
    setState(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleGoalTypeChange = useCallback((goalType: GoalType) => {
    setState(prev => ({ ...prev, goalType }));
    if (goalType === 'order_any') {
      setState(prev => ({ ...prev, goalName: 'Order Placed' }));
    }
  }, []);

  const canSave = useMemo(() => {
    switch (state.goalType) {
      case 'order_value':
        return Boolean(state.orderThreshold && state.orderThreshold > 0);
      case 'product_purchased':
        return Boolean(state.productId || state.productName);
      case 'tag_added':
        return Boolean(state.tagName?.trim());
      case 'link_clicked':
        return Boolean(state.linkTracking?.trim());
      default:
        return true;
    }
  }, [state]);

  const handleSave = useCallback(() => {
    const meta: JourneyNodeData['meta'] = {
      ...(initialMeta || {}),
      goalType: state.goalType,
      goalName: state.goalName,
      conversionWindow: state.conversionWindow,
      productId: state.productId,
      productName: state.productName,
      orderThreshold: state.orderThreshold,
      tagName: state.tagName,
      linkTracking: state.linkTracking,
      goalDescription: summary,
      goalSummary: summary,
    };

    if (!meta.label || meta.label === '') {
      meta.label = state.goalName || 'Goal';
    }

    onSave(meta);
  }, [initialMeta, onSave, state, summary]);

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Configure Goal"
      subtitle="Track what success looks like for this journey."
      size="lg"
    >
      <div className="space-y-6">
        <div className="rounded-2xl border border-[#E8E4DE] bg-white p-5 shadow-sm">
          <Label className="text-sm font-semibold text-[#4A4139]">Goal Type</Label>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {GOAL_OPTIONS.map(goal => (
              <button
                key={goal.value}
                type="button"
                className={`flex flex-col items-start gap-2 rounded-2xl border px-4 py-4 text-left transition ${state.goalType === goal.value ? 'border-[#D4A574] bg-[#FAF2E9] shadow' : 'border-[#E8E4DE] bg-white hover:border-[#D4A574]/60'}`}
                onClick={() => handleGoalTypeChange(goal.value)}
              >
                <Target className={`h-4 w-4 ${state.goalType === goal.value ? 'text-[#D4A574]' : 'text-[#8B7F76]'}`} />
                <span className="text-sm font-semibold text-[#4A4139]">{goal.label}</span>
                <span className="text-xs text-[#8B7F76]">{goal.description}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Goal Name</Label>
            <Input
              value={state.goalName}
              onChange={event => handleChange('goalName', event.target.value)}
              placeholder="e.g. Post-purchase review"
            />
          </div>
          <div className="space-y-2">
            <Label>Conversion Window (days)</Label>
            <Input
              type="number"
              min={1}
              value={state.conversionWindow}
              onChange={event => handleChange('conversionWindow', Number(event.target.value))}
            />
          </div>
        </div>

        {state.goalType === 'order_value' ? (
          <div className="space-y-2 rounded-2xl border border-[#E8E4DE] bg-white p-5">
            <Label>Order Threshold</Label>
            <Input
              type="number"
              min={0}
              value={state.orderThreshold ?? 0}
              onChange={event => handleChange('orderThreshold', Number(event.target.value))}
            />
            <p className="text-xs text-[#8B7F76]">Goal is marked complete when the customer places an order above this value.</p>
          </div>
        ) : null}

        {state.goalType === 'product_purchased' ? (
          <div className="grid gap-3 rounded-2xl border border-[#E8E4DE] bg-white p-5">
            <div className="space-y-2">
              <Label>Product ID</Label>
              <Input
                value={state.productId ?? ''}
                onChange={event => handleChange('productId', event.target.value)}
                placeholder="Shopify product ID"
              />
            </div>
            <div className="space-y-2">
              <Label>Product Name</Label>
              <Input
                value={state.productName ?? ''}
                onChange={event => handleChange('productName', event.target.value)}
                placeholder="Friendly name for analytics"
              />
            </div>
          </div>
        ) : null}

        {state.goalType === 'tag_added' ? (
          <div className="space-y-2 rounded-2xl border border-[#E8E4DE] bg-white p-5">
            <Label>Tag Name</Label>
            <Input
              value={state.tagName ?? ''}
              onChange={event => handleChange('tagName', event.target.value)}
              placeholder="e.g. VIP, Loyal"
            />
          </div>
        ) : null}

        {state.goalType === 'link_clicked' ? (
          <div className="space-y-2 rounded-2xl border border-[#E8E4DE] bg-white p-5">
            <Label>Tracking Identifier</Label>
            <Input
              value={state.linkTracking ?? ''}
              onChange={event => handleChange('linkTracking', event.target.value)}
              placeholder="e.g. utm_campaign=winback"
            />
            <p className="text-xs text-[#8B7F76]">Use the same tracking value when sending links to measure conversions.</p>
          </div>
        ) : null}

        <div className="rounded-2xl border border-[#E8E4DE] bg-[#FAF9F6] p-4 text-sm text-[#8B7F76]">
          <p className="text-xs uppercase tracking-[0.3em] text-[#B8977F]">Summary</p>
          <p className="mt-2 text-lg font-semibold text-[#4A4139]">{summary}</p>
          <p className="text-xs text-[#8B7F76]">Conversion window: {state.conversionWindow} days</p>
        </div>

        <footer className="flex items-center justify-end gap-3">
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
            className="bg-[#D4A574] text-white hover:bg-[#B8835D]"
            disabled={!canSave}
            onClick={handleSave}
          >
            Save Goal
          </Button>
        </footer>
      </div>
    </Modal>
  );
}


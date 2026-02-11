"use client";

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Node } from '@xyflow/react';
import {
  CalendarClock,
  Gauge,
  GitBranch,
  MessageCircle,
  Settings2,
  Sparkles,
  Target as TargetIcon,
  Trash2,
  Trophy,
  X,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { ExperimentConfig } from '@/lib/types/experiment-config';
import { createDefaultUnifiedTriggerConfig } from './trigger/utils';
import type { EnhancedUnifiedTriggerConfig, UnifiedTriggerConfig } from '@/lib/types/trigger-config';
import { isUnifiedTriggerEnabled, isJourneyTriggerV2Enabled } from '@/lib/featureFlags';
import type { WhatsAppActionConfig, WhatsAppTemplate, WhatsAppTemplateStatus } from '@/lib/types/whatsapp-config';
import { MobilePreview } from '../MobilePreview';
import type { StepId } from '../modals/WhatsAppActionModal';

import type { JourneyNodeData } from './nodes';
import { TriggerConfigPanel } from './trigger/TriggerConfigPanel';
import { TriggerConfigErrorBoundary } from './trigger/TriggerConfigErrorBoundary';
import { TriggerConfig } from '../trigger/TriggerConfig';
import type { TriggerConfigState } from '../trigger/types';
import { configToState, stateToConfig } from '../trigger/stateMappers';

interface SegmentApiSegment {
  id: string;
  name?: string | null;
}

interface SegmentsApiResponse {
  segments?: SegmentApiSegment[];
}

export interface JourneyNodeInspectorProps {
  node: Node<JourneyNodeData> | null;
  onClose?: () => void;
  onDelete?: (nodeId: string) => void;
  onUpdate?: (nodeId: string, updates: Partial<JourneyNodeData['meta']>) => void;
  onOpenWhatsAppConfig?: (nodeId: string, step?: StepId) => void;
  onUpdateTriggerConfig?: (nodeId: string, config: UnifiedTriggerConfig) => void;
  onTriggerStatusChange?: (nodeId: string, status: 'draft' | 'active') => void;
  onTriggerSave?: (nodeId: string) => void;
  className?: string;
}

const PanelSection = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="space-y-3 rounded-2xl border border-[#E8E4DE] bg-white p-5 shadow-sm">
    <h3 className="text-sm font-semibold uppercase tracking-wide text-[#B8977F]">{title}</h3>
    <div className="space-y-4 text-sm text-[#8B7F76]">{children}</div>
  </section>
);

export function JourneyNodeInspector({
  node,
  onClose,
  onDelete,
  onUpdate,
  onOpenWhatsAppConfig,
  onUpdateTriggerConfig,
  onTriggerStatusChange,
  onTriggerSave,
  className,
}: JourneyNodeInspectorProps) {
  const inspectorClassName = cn(
    'flex h-full min-w-[280px] max-w-full basis-0 flex-1 flex-col overflow-hidden border-l border-[#E8E4DE] bg-[#FAF9F6] transition-[flex-grow,flex-basis,width] duration-200 ease-in-out',
    className
  );

  if (!node) {
    return (
      <aside className={inspectorClassName}>
        <div className="mx-auto flex flex-1 flex-col items-center justify-center gap-3 px-6 py-6 text-center text-sm text-[#8B7F76]">
          <Settings2 className="h-6 w-6 text-[#B8977F]" />
          <p>Select a node to configure it</p>
        </div>
      </aside>
    );
  }

  const variant = node.data.variant;
  const [segments, setSegments] = useState<Array<{ id: string; name: string }>>([]);
  const [segmentsLoading, setSegmentsLoading] = useState(false);
  const [segmentsError, setSegmentsError] = useState<string | null>(null);

  const headerStyles = useMemo(() => {
    if (!variant) return 'from-[#F5F3EE] to-[#FAF9F6]';
    switch (variant) {
      case 'trigger':
        return 'from-[#F5F3EE] to-[#FAF9F6]';
      case 'action':
        return 'from-[#F6F1EA] to-[#FAF9F6]';
      case 'decision':
        return 'from-[#F2F7F1] to-[#FAF9F6]';
      case 'wait':
        return 'from-[#EFEAE5] to-[#FAF9F6]';
      case 'goal':
        return 'from-[#FCEFE5] to-[#FAF9F6]';
      default:
        return 'from-[#F5F3EE] to-[#FAF9F6]';
    }
  }, [variant]);

  const triggerConfigData = useMemo(() => {
    if (!node || variant !== 'trigger' || !node.data.meta?.unified) return undefined;
    return (
      (node.data.triggerConfig as EnhancedUnifiedTriggerConfig | undefined) ??
      createDefaultUnifiedTriggerConfig()
    );
  }, [node, variant]);

  const triggerStatus = useMemo<'draft' | 'active'>(() => {
    if (!node || variant !== 'trigger') return 'draft';
    return (node.data.status as 'draft' | 'active' | undefined) ?? 'draft';
  }, [node, variant]);

  useEffect(() => {
    let cancelled = false;
    const fetchSegments = async () => {
      try {
        setSegmentsLoading(true);
        const res = await fetch('/api/segments', { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to load segments');
        const payload: SegmentsApiResponse = await res.json();
        if (!cancelled) {
          const items = Array.isArray(payload.segments)
            ? payload.segments
                .filter((segment): segment is SegmentApiSegment => typeof segment?.id === 'string' && segment.id.length > 0)
                .map(segment => ({ id: segment.id, name: segment.name && segment.name.trim().length > 0 ? segment.name : segment.id }))
            : [];
          setSegments(items);
          setSegmentsError(null);
        }
      } catch (error: unknown) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Unable to load segments';
          setSegmentsError(message);
        }
      } finally {
        if (!cancelled) setSegmentsLoading(false);
      }
    };

    fetchSegments();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleMetaChange = (field: string, value: unknown) => {
    if (!node.id) return;
    onUpdate?.(node.id, {
      ...(node.data.meta || {}),
      [field]: value,
    });
  };

  const meta = node.data.meta || {};
  const whatsappConfig = meta.whatsappActionConfig as WhatsAppActionConfig | undefined;

  const previewTemplate = useMemo<WhatsAppTemplate | null>(() => {
    if (whatsappConfig?.templateDefinition) return whatsappConfig.templateDefinition;
    if (!meta.templateName) return null;
    const status =
      (whatsappConfig?.templateStatus ||
        (typeof meta.templateStatus === 'string' ? (meta.templateStatus as WhatsAppTemplateStatus) : undefined)) ??
      'APPROVED';
    const variables =
      whatsappConfig?.variableMappings?.map(mapping => mapping.variable) ??
      (Array.isArray(meta.variables) ? (meta.variables as string[]) : []);
    return {
      id: whatsappConfig?.templateId ?? (meta.templateId as string) ?? `template_${node.id}`,
      name: whatsappConfig?.templateName ?? (meta.templateName as string),
      category: whatsappConfig?.templateCategory ?? ((meta.templateCategory as string) ?? 'MARKETING'),
      language: whatsappConfig?.templateLanguage ?? ((meta.templateLanguage as string) ?? 'en'),
      status,
      content: whatsappConfig?.previewBody ?? '',
      body: whatsappConfig?.previewBody ?? '',
      footer: undefined,
      buttons: undefined,
      variables,
      hasMediaHeader: Boolean(whatsappConfig?.mediaUrl ?? meta.hasMediaHeader),
      hasButtons: Boolean(whatsappConfig?.buttonActions && Object.keys(whatsappConfig.buttonActions).length),
      sampleValues: undefined,
      header: undefined,
      previewImageUrl: undefined,
      createdAt: undefined,
      updatedAt: undefined,
      submittedAt: undefined,
      metaTemplateId: undefined,
      rejectionReason: undefined,
      messagesSent: undefined,
      approvedAt: undefined,
      lastUsedAt: undefined,
      lastUsed: undefined,
      mediaType: undefined,
      mediaUrl: whatsappConfig?.mediaUrl,
    };
  }, [
    meta.hasMediaHeader,
    meta.templateCategory,
    meta.templateId,
    meta.templateLanguage,
    meta.templateName,
    meta.templateStatus,
    meta.variables,
    node.id,
    whatsappConfig,
  ]);
  const previewPlainVariables = whatsappConfig?.previewPlainVariables ?? {};
  const experimentConfig =
    (meta.experimentConfig as ExperimentConfig | undefined) ??
    (node.data.experimentConfig as ExperimentConfig | undefined);
  const experimentVariants =
    experimentConfig?.variants ??
    (Array.isArray(meta.variants)
      ? (meta.variants as Array<{ id?: string; label?: string; weight?: number; color?: string; control?: boolean; description?: string }>).map(variant => ({
          id: variant.id ?? `variant_${Math.random()}`,
          name: variant.label ?? 'Variant',
          trafficAllocation: typeof variant.weight === 'number' ? variant.weight : 0,
          isControl: Boolean(variant.control),
          color: variant.color,
          description: variant.description,
        }))
      : []);
  const experimentPrimaryGoal = experimentConfig?.goals.find(goal => goal.id === experimentConfig.primaryGoalId);
  const experimentSample = experimentConfig?.sampleSize?.result;
  const experimentStatus = experimentConfig?.status?.status ?? ((meta.status as { status?: string } | undefined)?.status) ?? 'draft';
  const experimentWinner =
    experimentConfig?.status?.winnerDeclared && experimentConfig.status?.winningVariantId
      ? experimentConfig.variants.find(variant => variant.id === experimentConfig.status?.winningVariantId)
      : undefined;
  const experimentStatusLabel = experimentStatus.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());

  if (!node) {
    return (
      <aside className={inspectorClassName}>
        <div className="mx-auto flex flex-1 flex-col items-center justify-center gap-3 px-6 py-6 text-center text-sm text-[#8B7F76]">
          <Settings2 className="h-6 w-6 text-[#B8977F]" />
          <p>Select a node to configure it</p>
        </div>
      </aside>
    );
  }

  const triggerInitialState = useMemo(
    () => configToState(triggerConfigData, triggerStatus),
    [triggerConfigData, triggerStatus],
  );
  const [triggerDraftState, setTriggerDraftState] = useState<TriggerConfigState | undefined>(undefined);

  const triggerV2Enabled =
    variant === 'trigger' && node.data.meta?.unified && isJourneyTriggerV2Enabled();
  const triggerV1Enabled =
    variant === 'trigger' && node.data.meta?.unified && isUnifiedTriggerEnabled() && !triggerV2Enabled;

  if (triggerV2Enabled && triggerConfigData) {
    return (
      <aside className={inspectorClassName}>
        <TriggerConfig
          key={`trigger-v2-${node.id}`}
          initialState={triggerInitialState}
          onChange={setTriggerDraftState}
          onSave={state => {
            const nextConfig = stateToConfig(state, triggerConfigData);
            onUpdateTriggerConfig?.(node.id, nextConfig);
            onTriggerSave?.(node.id);
          }}
          onStatusChange={(nextStatus, snapshot) => {
            setTriggerDraftState(snapshot);
            onTriggerStatusChange?.(node.id, nextStatus);
          }}
        />
      </aside>
    );
  }

  if (triggerV1Enabled) {
    const triggerConfig =
      (node.data.triggerConfig as EnhancedUnifiedTriggerConfig | undefined) ??
      createDefaultUnifiedTriggerConfig();
    const status = (node.data.status as 'draft' | 'active' | undefined) ?? 'draft';

    return (
      <aside className={inspectorClassName}>
        <TriggerConfigErrorBoundary>
          <TriggerConfigPanel
            triggerConfig={triggerConfig ?? createDefaultUnifiedTriggerConfig()}
            status={status}
            isOpen
            onClose={() => onClose?.()}
            onChange={config => onUpdateTriggerConfig?.(node.id, config)}
            onStatusChange={nextStatus => onTriggerStatusChange?.(node.id, nextStatus)}
            onSave={config => {
              onUpdateTriggerConfig?.(node.id, config);
              onTriggerSave?.(node.id);
            }}
          />
        </TriggerConfigErrorBoundary>
      </aside>
    );
  }

  return (
    <aside className={inspectorClassName}>
      <div className={cn('border-b border-[#E8E4DE] bg-gradient-to-br px-4 py-5 relative', headerStyles)}>
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden absolute top-4 right-4 p-2 rounded-lg hover:bg-white/50 text-[#8B7F76] hover:text-[#4A4139] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Close inspector"
          >
            <X className="h-5 w-5" />
          </button>
        )}
        <p className="text-xs uppercase tracking-[0.3em] text-[#B8977F]">Selected Node</p>
        <h2 className="text-xl sm:text-2xl font-semibold text-[#4A4139] pr-12 lg:pr-0">{node.data.label}</h2>
        <p className="text-sm text-[#8B7F76]">{node.data.description}</p>
      </div>
      <div className="flex-1 space-y-6 overflow-y-auto px-4 py-5 custom-scrollbar">
        <PanelSection title="Basic Details">
          <div className="space-y-2">
            <Label htmlFor="nodeLabel">Display Name</Label>
            <Input
              id="nodeLabel"
              value={String(meta.label ?? node.data.label ?? '')}
              onChange={event => handleMetaChange('label', event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nodeDescription">Description</Label>
            <Textarea
              id="nodeDescription"
              rows={3}
              value={String(meta.description ?? node.data.description ?? '')}
              onChange={event => handleMetaChange('description', event.target.value)}
            />
          </div>
        </PanelSection>

        {variant === 'experiment' ? (
          <PanelSection title="Experiment Details">
            {!experimentConfig ? (
              <div className="rounded-xl border border-dashed border-[#E8E4DE] bg-[#F5F3EE]/70 px-4 py-6 text-center text-sm text-[#8B7F76]">
                Configure this experiment to manage variants, goals, and winning criteria. Use the edit button on the node to launch
                the setup wizard.
              </div>
            ) : (
              <div className="space-y-4 text-xs text-[#4A4139]">
                <div className="flex items-start justify-between gap-3 rounded-xl border border-[#E8E4DE] bg-white px-3 py-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#3A3028]">
                      <GitBranch className="h-4 w-4 text-[#7C3AED]" />
                      <span>{experimentConfig.experimentName || 'Experiment'}</span>
                    </div>
                    {experimentConfig.hypothesis ? (
                      <p className="text-xs text-[#8B7F76]">“{experimentConfig.hypothesis}”</p>
                    ) : null}
                    {experimentConfig.description ? (
                      <p className="text-xs text-[#8B7F76]">{experimentConfig.description}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-end gap-2 text-right">
                    <Badge className="bg-[#E0E7FF] text-[11px] font-semibold uppercase tracking-wide text-[#4338CA]">
                      {experimentConfig.experimentType === 'ab_test' ? 'A/B Test' : 'Multivariate'}
                    </Badge>
                    <Badge className="bg-[#FDE68A] text-[11px] font-semibold uppercase tracking-wide text-[#92400E]">
                      {experimentStatusLabel}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-2 rounded-xl border border-[#E8E4DE] bg-white px-3 py-3">
                  <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-[#B8977F]">
                    <span className="flex items-center gap-2 text-[#7C3AED]">
                      <Sparkles className="h-3 w-3" />
                      Variants
                    </span>
                    <span>{experimentVariants.length} total</span>
                  </div>
                  <div className="space-y-2">
                    {experimentVariants.map(variant => (
                      <div
                        key={variant.id}
                        className="flex items-center justify-between rounded-lg border border-[#EDE9FE] bg-[#F8F5FF] px-3 py-2 text-xs"
                      >
                        <div className="flex flex-col">
                          <span className="font-semibold text-[#4C1D95]">
                            {variant.name} {variant.isControl ? '(Control)' : ''}
                          </span>
                          {variant.description ? (
                            <span className="text-[11px] text-[#6B7280]">{variant.description}</span>
                          ) : null}
                        </div>
                        <span className="text-[#5B21B6]">{variant.trafficAllocation.toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>

                {experimentSample ? (
                  <div className="grid gap-3 rounded-xl border border-[#DBEAFE] bg-[#EFF6FF] px-3 py-3 md:grid-cols-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-[#1D4ED8]">
                        <Gauge className="h-3 w-3" />
                        Users / Variant
                      </div>
                      <p className="text-base font-semibold text-[#1E3A8A]">
                        {experimentSample.usersPerVariant.toLocaleString()}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <div className="text-[11px] uppercase tracking-wide text-[#1D4ED8]">Total Users</div>
                      <p className="text-base font-semibold text-[#1E3A8A]">
                        {experimentSample.totalUsers.toLocaleString()}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <div className="text-[11px] uppercase tracking-wide text-[#1D4ED8]">Estimated Days</div>
                      <p className="text-base font-semibold text-[#1E3A8A]">{experimentSample.estimatedDays}</p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2 text-xs text-[#B45309]">
                    Sample size not calculated yet.
                  </div>
                )}

                <div className="space-y-2 rounded-xl border border-[#FEE2E2] bg-[#FEF2F2] px-3 py-3">
                  <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-[#B91C1C]">
                    <span className="flex items-center gap-2">
                      <TargetIcon className="h-3 w-3" />
                      Goals
                    </span>
                    {experimentPrimaryGoal ? (
                      <Badge className="bg-white text-[10px] font-semibold uppercase tracking-wider text-[#B91C1C]">
                        Primary: {experimentPrimaryGoal.name}
                      </Badge>
                    ) : null}
                  </div>
                  {experimentConfig.goals.length ? (
                    <ul className="space-y-1 text-xs text-[#7F1D1D]">
                      {experimentConfig.goals.map(goal => (
                        <li key={goal.id}>
                          <span className="font-semibold text-[#991B1B]">{goal.name}</span> • {goal.type.replace(/_/g, ' ')} •{' '}
                          {goal.attributionWindow.value} {goal.attributionWindow.unit}
                          {goal.isPrimary ? ' (Primary)' : ''}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>No goals configured.</p>
                  )}
                </div>

                <div className="space-y-2 rounded-xl border border-[#D1FAE5] bg-[#ECFDF5] px-3 py-3 text-xs text-[#047857]">
                  <div className="flex items-center justify-between text-[11px] uppercase tracking-wide">
                    <span className="flex items-center gap-2">
                      <Trophy className="h-3 w-3" />
                      Winning Criteria
                    </span>
                  </div>
                  <p>
                    Strategy:{' '}
                    {experimentConfig.winningCriteria.strategy === 'automatic'
                      ? 'Automatic — declare winner when criteria satisfied'
                      : 'Manual — review metrics before selecting winner'}
                  </p>
                  <p>Minimum lift: {(experimentConfig.winningCriteria.minimumLift * 100).toFixed(1)}%</p>
                  <p>
                    Minimum runtime: {experimentConfig.winningCriteria.minimumRuntime.value}{' '}
                    {experimentConfig.winningCriteria.minimumRuntime.unit}
                  </p>
                  <p>
                    Post-test action: {experimentConfig.winningCriteria.postTestAction.replace(/_/g, ' ')}
                    {experimentConfig.winningCriteria.postTestAction === 'send_all_to_specific' &&
                    experimentConfig.winningCriteria.specificVariantId
                      ? ` → ${
                          experimentVariants.find(variant => variant.id === experimentConfig.winningCriteria.specificVariantId)?.name ??
                          'Variant'
                        }`
                      : ''}
                  </p>
                </div>

                {experimentWinner ? (
                  <div className="flex items-center gap-2 rounded-xl border border-[#FDE68A] bg-[#FEF3C7] px-3 py-2 text-xs text-[#92400E]">
                    <Trophy className="h-3 w-3" />
                    Winner declared: <span className="font-semibold text-[#B45309]">{experimentWinner.name}</span>
                  </div>
                ) : null}
              </div>
            )}
          </PanelSection>
        ) : null}

        {variant === 'trigger' ? (
          <PanelSection title="Trigger Settings">
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="triggerType">Trigger Type</Label>
                <select
                  id="triggerType"
                  className="w-full rounded-lg border border-[#E8E4DE] bg-white px-3 py-2 text-sm text-[#4A4139] focus:border-[#D4A574] focus:outline-none focus:ring-2 focus:ring-[#D4A574]/20"
                  value={(meta.triggerType as string) ?? node.data.subtype ?? 'segment_joined'}
                  onChange={event => handleMetaChange('triggerType', event.target.value)}
                >
                  <option value="segment_joined">Segment Joined</option>
                  <option value="event_trigger">Event Trigger</option>
                  <option value="date_time">Date / Time</option>
                  <option value="abandoned_cart">Abandoned Cart</option>
                  <option value="manual_entry">Manual Entry</option>
                </select>
              </div>

              {(meta.triggerType === 'segment_joined' || (!meta.triggerType && node.data.subtype === 'segment_joined')) ? (
                <div className="space-y-2">
                  <Label htmlFor="triggerSegment">Segment</Label>
                  <select
                    id="triggerSegment"
                    className="w-full rounded-lg border border-[#E8E4DE] bg-white px-3 py-2 text-sm text-[#4A4139] focus:border-[#D4A574] focus:outline-none focus:ring-2 focus:ring-[#D4A574]/20"
                    value={String(meta.segmentId ?? '')}
                    onChange={event => handleMetaChange('segmentId', event.target.value)}
                  >
                    <option value="">Select segment</option>
                    {segments.map(segment => (
                      <option key={segment.id} value={segment.id}>
                        {segment.name}
                      </option>
                    ))}
                  </select>
                  {segmentsLoading ? <p className="text-xs text-[#B8977F]">Loading segments…</p> : null}
                  {segmentsError ? <p className="text-xs text-[#C8998F]">{segmentsError}</p> : null}
                </div>
              ) : null}

              {(meta.triggerType === 'event_trigger' || (!meta.triggerType && node.data.subtype === 'event_trigger')) ? (
                <div className="space-y-2">
                  <Label htmlFor="triggerEvent">Event Name</Label>
                  <Input
                    id="triggerEvent"
                    placeholder="e.g. order_created"
                    value={String(meta.eventName ?? '')}
                    onChange={event => handleMetaChange('eventName', event.target.value)}
                  />
                </div>
              ) : null}

              {(meta.triggerType === 'date_time' || (!meta.triggerType && node.data.subtype === 'date_time')) ? (
                <div className="space-y-2">
                  <Label htmlFor="triggerDate">Schedule</Label>
                  <Input
                    id="triggerDate"
                    type="datetime-local"
                    value={String(meta.scheduledAt ?? '')}
                    onChange={event => handleMetaChange('scheduledAt', event.target.value)}
                  />
                </div>
              ) : null}

              {(meta.triggerType === 'abandoned_cart' || (!meta.triggerType && node.data.subtype === 'abandoned_cart')) ? (
                <div className="space-y-2">
                  <Label htmlFor="triggerHours">Hours Since Abandonment</Label>
                  <Input
                    id="triggerHours"
                    type="number"
                    min={1}
                    value={Number(meta.hours ?? 24)}
                    onChange={event => handleMetaChange('hours', Number(event.target.value))}
                  />
                </div>
              ) : null}

              {(meta.triggerType === 'manual_entry' || (!meta.triggerType && node.data.subtype === 'manual_entry')) ? (
                <div className="rounded-lg border border-dashed border-[#E8E4DE] bg-[#F5F3EE] px-3 py-2 text-xs text-[#8B7F76]">
                  Customers must be enrolled manually via the API or customer list. No automatic trigger evaluation is performed.
                </div>
              ) : null}
            </div>
          </PanelSection>
        ) : null}

        {variant === 'action' && node.data.subtype === 'send_whatsapp' ? (
          <PanelSection title="WhatsApp Message">
            {whatsappConfig ? (
              <div className="space-y-4">
                <div className="flex flex-col gap-1 rounded-xl border border-[#E8E4DE] bg-white px-3 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-[#3A3028]">{whatsappConfig.templateName}</p>
                      <p className="text-xs text-[#8B7F76]">
                        {(whatsappConfig.templateCategory ?? meta.templateCategory ?? 'MARKETING').toString()} •{' '}
                        {(whatsappConfig.templateLanguage ?? meta.templateLanguage ?? 'en').toString().toUpperCase()}
                      </p>
                    </div>
                    <Badge className="rounded-full bg-[#F5F3EE] text-xs font-semibold uppercase tracking-wide text-[#B7791F]">
                      {(whatsappConfig.templateStatus ??
                        (meta.templateStatus as WhatsAppTemplateStatus) ??
                        'APPROVED') || 'APPROVED'}
                    </Badge>
                  </div>
                  <p className="text-xs text-[#8B7F76]">
                    {whatsappConfig.previewBody
                      ? 'Rendered preview with sample data.'
                      : 'Preview will appear once variables are mapped.'}
                  </p>
                </div>

                {previewTemplate ? (
                  <div className="rounded-3xl border border-[#E8E4DE] bg-[#F8F7F5] p-4">
                    <MobilePreview template={previewTemplate} variableValues={previewPlainVariables} />
                  </div>
                ) : null}

                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.3em] text-[#B9AA9F]">Variable Mapping</p>
                  {whatsappConfig.variableMappings?.length ? (
                    <div className="divide-y divide-[#F0ECE6] rounded-2xl border border-[#E8E4DE] bg-white">
                      {whatsappConfig.variableMappings.map(mapping => (
                        <div key={mapping.variable} className="flex flex-col gap-1 px-3 py-2 text-sm text-[#4A4139]">
                          <div className="flex items-center justify-between gap-2">
                            <Badge className="rounded-full bg-[#F5F3EE] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8B7F76]">
                              {mapping.variable}
                            </Badge>
                            <span className="text-xs text-[#8B7F76]">
                              {mapping.dataSource === 'static'
                                ? mapping.property || 'Static value'
                                : mapping.property || 'Select property'}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#A8A29E]">
                            Fallback: {mapping.fallbackValue?.trim().length ? mapping.fallbackValue : '—'}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-[#E8E4DE] bg-[#FFFBF7] px-3 py-4 text-xs text-[#8B7F76]">
                      This template does not require variables.
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    className="flex-1 bg-[#D4A574] text-white hover:bg-[#B8835D]"
                    onClick={() => onOpenWhatsAppConfig?.(node.id, 'template')}
                  >
                    Edit Configuration
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 border-[#E8E4DE] text-[#4A4139] hover:bg-[#F5F3EE]"
                    onClick={() => onOpenWhatsAppConfig?.(node.id, 'preview')}
                  >
                    Preview & Test
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-[#8B7F76]">
                  Select an approved WhatsApp template, map variables, and configure delivery windows. Use the button below to
                  launch the full configuration workspace.
                </p>
                <Button
                  type="button"
                  className="w-full bg-[#D4A574] text-white hover:bg-[#B8835D]"
                  onClick={() => onOpenWhatsAppConfig?.(node.id, 'template')}
                >
                  Configure WhatsApp Message
                </Button>
              </div>
            )}
          </PanelSection>
        ) : null}

        {variant === 'decision' ? (
          <PanelSection title="Rule Builder">
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="conditionType">Condition Type</Label>
                <select
                  id="conditionType"
                  className="w-full rounded-lg border border-[#E8E4DE] bg-white px-3 py-2 text-sm text-[#4A4139] focus:border-[#D4A574] focus:outline-none focus:ring-2 focus:ring-[#D4A574]/20"
                  value={String(meta.conditionType ?? '')}
                  onChange={event => handleMetaChange('conditionType', event.target.value)}
                >
                  <option value="">Select condition</option>
                  <option value="customer_property">Customer property</option>
                  <option value="event">Event</option>
                  <option value="tag">Tag</option>
                  <option value="behavior">Behavior</option>
                </select>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="operator">Operator</Label>
                  <select
                    id="operator"
                    className="w-full rounded-lg border border-[#E8E4DE] bg-white px-3 py-2 text-sm text-[#4A4139] focus:border-[#D4A574] focus:outline-none focus:ring-2 focus:ring-[#D4A574]/20"
                    value={String(meta.operator ?? '')}
                    onChange={event => handleMetaChange('operator', event.target.value)}
                  >
                    <option value="">Choose operator</option>
                    <option value="equals">Equals</option>
                    <option value="contains">Contains</option>
                    <option value="gt">Greater than</option>
                    <option value="lt">Less than</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="conditionValue">Value</Label>
                  <Input
                    id="conditionValue"
                    value={String(meta.value ?? '')}
                    onChange={event => handleMetaChange('value', event.target.value)}
                  />
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1 text-xs">
                  <Label>True Path Label</Label>
                  <Input
                    value={String(meta.trueLabel ?? 'Yes')}
                    onChange={event => handleMetaChange('trueLabel', event.target.value)}
                  />
                </div>
                <div className="space-y-1 text-xs">
                  <Label>False Path Label</Label>
                  <Input
                    value={String(meta.falseLabel ?? 'No')}
                    onChange={event => handleMetaChange('falseLabel', event.target.value)}
                  />
                </div>
              </div>
            </div>
          </PanelSection>
        ) : null}

        {variant === 'wait' ? (
          <PanelSection title="Timing">
            <div className="space-y-3">
              <p className="flex items-center gap-2 rounded-lg border border-[#E8E4DE] bg-[#F5F3EE] px-3 py-2 text-xs text-[#8B7F76]">
                <CalendarClock className="h-4 w-4" />
                Configure how long customers should wait before continuing.
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="duration">Duration</Label>
                  <Input
                    id="duration"
                    type="number"
                    min={0}
                    value={Number(meta.duration ?? 1)}
                    onChange={event => handleMetaChange('duration', Number(event.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unit">Unit</Label>
                  <select
                    id="unit"
                    className="w-full rounded-lg border border-[#E8E4DE] bg-white px-3 py-2 text-sm text-[#4A4139] focus:border-[#D4A574] focus:outline-none focus:ring-2 focus:ring-[#D4A574]/20"
                    value={String(meta.unit ?? 'hours')}
                    onChange={event => handleMetaChange('unit', event.target.value)}
                  >
                    <option value="minutes">Minutes</option>
                    <option value="hours">Hours</option>
                    <option value="days">Days</option>
                    <option value="weeks">Weeks</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="waitUntil">Wait Until (Optional)</Label>
                <Input
                  id="waitUntil"
                  type="datetime-local"
                  value={String(meta.waitUntil ?? '')}
                  onChange={event => handleMetaChange('waitUntil', event.target.value)}
                />
              </div>
            </div>
          </PanelSection>
        ) : null}

        {variant === 'goal' ? (
          <PanelSection title="Goal Settings">
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="goalType">Goal Definition</Label>
                <select
                  id="goalType"
                  className="w-full rounded-lg border border-[#E8E4DE] bg-white px-3 py-2 text-sm text-[#4A4139] focus:border-[#D4A574] focus:outline-none focus:ring-2 focus:ring-[#D4A574]/20"
                  value={String(meta.goalType ?? '')}
                  onChange={event => handleMetaChange('goalType', event.target.value)}
                >
                  <option value="">Select goal</option>
                  <option value="purchase">Purchase</option>
                  <option value="form_submit">Form submit</option>
                  <option value="page_visit">Page visit</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="goalValue">Value Tracking</Label>
                <Input
                  id="goalValue"
                  type="number"
                  min={0}
                  value={String(meta.goalValue ?? '')}
                  onChange={event => handleMetaChange('goalValue', event.target.value)}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(meta.autoExit)}
                  onChange={event => handleMetaChange('autoExit', event.target.checked)}
                  className="h-4 w-4 rounded border-[#E8E4DE] text-[#D4A574] focus:ring-[#D4A574]/30"
                />
                Auto-exit journey once goal is achieved
              </label>
            </div>
          </PanelSection>
        ) : null}
      </div>
      <div className="border-t border-[#E8E4DE] bg-white px-6 py-4">
        <Button
          className="w-full gap-2 bg-[#C8998F] text-white hover:bg-[#B5837A]"
          onClick={() => node?.id && onDelete?.(node.id)}
        >
          <Trash2 className="h-4 w-4" />
          Delete Node
        </Button>
      </div>
    </aside>
  );
}



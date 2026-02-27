'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  FlaskConical,
  MessageSquare,
  Plus,
  RefreshCw,
  Repeat,
  Sparkles,
  Target,
  Trash2,
  Users,
  Zap,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/lib/hooks/useToast';
import type {
  Campaign,
  CampaignMessageContent,
  CampaignType,
  TriggerEvent,
} from '@/lib/types/campaign';
import type { Segment } from '@/lib/types';
import type { CustomerSegment } from '@/lib/types/segment';
import type { WhatsAppTemplate } from '@/lib/types/whatsapp-config';
import { UnifiedWhatsAppConfig } from '@/components/journeys/nodes/whatsapp/UnifiedWhatsAppConfig';
import { AdvancedWhatsAppSettings } from '@/components/campaigns/AdvancedWhatsAppSettings';
import { CreateSegmentModal } from '@/components/segments/CreateSegmentModal';
import { CAMPAIGN_PRESETS, PRESET_CATEGORIES, type CampaignPreset } from '@/lib/data/campaign-presets';
import FollowUpBuilder, { type FollowUpStep } from '@/components/campaigns/FollowUpBuilder';
import { fetchWithConfig } from '@/lib/fetch-with-config';

interface CampaignWizardProps {
  campaignId?: string;
  onComplete: () => void;
}

type ScheduleType = 'IMMEDIATE' | 'SCHEDULED' | 'RECURRING';
type SendingSpeed = 'FAST' | 'MEDIUM' | 'SLOW';

interface RecurringConfig {
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  interval: number;
  daysOfWeek: number[];
  time: string;
  endDate?: number;
}

interface GoalTracking {
  enabled: boolean;
  goalType: 'REVENUE' | 'CONVERSION' | 'ENGAGEMENT';
  targetValue: number;
}

interface ABTestVariant {
  id: string;
  name: string;
  percentage: number;
  messageContent: CampaignMessageContent;
}

interface ABTestConfig {
  enabled: boolean;
  variants: ABTestVariant[];
  winnerCriteria: 'OPEN_RATE' | 'CLICK_RATE' | 'CONVERSION_RATE';
  testDuration: number;
}

interface CampaignFormData {
  name: string;
  description: string;
  channel: 'WHATSAPP';
  type: CampaignType;
  segmentIds: string[];
  messageContent: CampaignMessageContent;
  scheduleType: ScheduleType;
  scheduledAt?: number;
  timezone: string;
  sendingSpeed: SendingSpeed;
  labels: string[];
  useSmartTiming: boolean;
  templateId?: string;
  goalTracking?: GoalTracking;
  abTest?: ABTestConfig;
  recurringConfig?: RecurringConfig;
  triggerEvent?: TriggerEvent;
  triggerDelay?: number;
  triggerConditions?: Array<{ field: string; operator: string; value: string }>;
  whatsappConfig?: {
    variableMappings?: any[];
    bodyFields?: any[];
    sendWindow?: any;
    rateLimiting?: any;
    failureHandling?: any;
    exitPaths?: any;
    mediaUrl?: string;
    useDynamicMedia?: boolean;
  };
  followUpSteps?: FollowUpStep[];
}

interface CampaignResponse {
  campaign?: Partial<Campaign>;
  error?: string;
}

interface SegmentListResponse {
  segments?: CustomerSegment[];
  error?: string;
}

interface TemplateListResponse {
  templates?: WhatsAppTemplateWithComponents[];
  error?: string;
}

interface WhatsAppTemplateWithComponents extends WhatsAppTemplate {
  components?: TemplateComponent[];
}

interface ApiErrorPayload {
  error?: string;
  message?: string;
}

interface TemplateSelectorProps {
  onSelectTemplate: (template: WhatsAppTemplateWithComponents) => void;
}

const stepFlow = [
  { number: 1, title: 'Campaign Details', icon: Sparkles },
  { number: 2, title: 'Select Audience', icon: Users },
  { number: 3, title: 'Create Message', icon: MessageSquare },
  { number: 4, title: 'Schedule', icon: Calendar },
  { number: 5, title: 'Review & Launch', icon: Target },
] as const;

const speedOptions: Array<{ value: SendingSpeed; label: string; desc: string }> = [
  { value: 'FAST', label: 'Fast', desc: '1000/min' },
  { value: 'MEDIUM', label: 'Medium', desc: '500/min' },
  { value: 'SLOW', label: 'Slow', desc: '100/min' },
];

const TRIGGER_EVENTS: Array<{ value: TriggerEvent; label: string; desc: string }> = [
  { value: 'order_placed', label: 'Order Placed', desc: 'When a customer completes an order' },
  { value: 'cart_abandoned', label: 'Cart Abandoned', desc: 'When a cart is left inactive' },
  { value: 'customer_signup', label: 'Customer Sign-Up', desc: 'When a new customer registers' },
  { value: 'product_viewed', label: 'Product Viewed', desc: 'When a product page is viewed' },
  { value: 'wishlist_added', label: 'Added to Wishlist', desc: 'When a product is wishlisted' },
  { value: 'customer_birthday', label: 'Customer Birthday', desc: "On customer's birthday" },
  { value: 'segment_entered', label: 'Segment Entered', desc: 'When customer enters a segment' },
  { value: 'segment_exited', label: 'Segment Exited', desc: 'When customer exits a segment' },
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type TemplateComponent =
  | { type: 'BODY' | 'body'; text?: string; [key: string]: unknown }
  | { type: string; [key: string]: unknown };

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

const defaultCampaignData: CampaignFormData = {
  name: '',
  description: '',
  channel: 'WHATSAPP',
  type: 'ONE_TIME',
  segmentIds: [],
  messageContent: { body: '' },
  scheduleType: 'IMMEDIATE',
  scheduledAt: undefined,
  timezone: 'Asia/Kolkata',
  sendingSpeed: 'MEDIUM',
  labels: [],
  useSmartTiming: false,
};

export default function CampaignWizard({ campaignId, onComplete }: CampaignWizardProps) {
  const router = useRouter();
  const toast = useToast();

  const [currentStep, setCurrentStep] = useState(1);
  const [segments, setSegments] = useState<CustomerSegment[]>([]);
  const [loadingSegments, setLoadingSegments] = useState(true);
  const [loadingCampaign, setLoadingCampaign] = useState(Boolean(campaignId));
  const [campaignData, setCampaignData] = useState<CampaignFormData>(defaultCampaignData);

  const isEditMode = Boolean(campaignId);
  const [showPresets, setShowPresets] = useState(!isEditMode);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);

  const applyPreset = useCallback((preset: CampaignPreset) => {
    setSelectedPresetId(preset.id);
    setCampaignData(prev => ({
      ...prev,
      name: preset.name,
      description: preset.description,
      type: preset.type,
      labels: preset.labels,
      scheduleType: preset.scheduleType,
      sendingSpeed: preset.sendingSpeed,
      useSmartTiming: preset.useSmartTiming,
      messageContent: { body: preset.messageBody },
      triggerEvent: preset.triggerEvent,
      triggerDelay: preset.triggerDelay,
      recurringConfig: preset.recurringConfig
        ? { ...preset.recurringConfig, endDate: undefined }
        : undefined,
      goalTracking: preset.goalTracking,
    }));
    setShowPresets(false);
  }, []);

  const loadCampaign = useCallback(async () => {
    if (!campaignId) return;
    setLoadingCampaign(true);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}`, { cache: 'no-store' });
      const payload = (await response.json().catch(() => ({}))) as CampaignResponse;
      if (!response.ok || !payload.campaign) {
        throw new Error(payload.error ?? 'Unable to load campaign');
      }
      const campaign = payload.campaign;
      setCampaignData({
        name: campaign.name ?? '',
        description: campaign.description ?? '',
        channel: 'WHATSAPP',
        type: (campaign.type as CampaignType | undefined) ?? 'ONE_TIME',
        segmentIds: campaign.segmentIds ?? [],
        messageContent: campaign.messageContent ?? { body: '' },
        scheduleType: (campaign.scheduleType as ScheduleType | undefined) ?? 'IMMEDIATE',
        scheduledAt: campaign.scheduledAt,
        timezone: campaign.timezone ?? 'Asia/Kolkata',
        sendingSpeed: (campaign.sendingSpeed as SendingSpeed | undefined) ?? 'MEDIUM',
        labels: campaign.labels ?? [],
        useSmartTiming: campaign.useSmartTiming ?? false,
        templateId: campaign.templateId,
        goalTracking: campaign.goalTracking as GoalTracking | undefined,
        abTest: campaign.abTest as ABTestConfig | undefined,
        recurringConfig: campaign.recurringConfig as RecurringConfig | undefined,
        triggerEvent: campaign.triggerEvent as TriggerEvent | undefined,
        triggerDelay: campaign.triggerDelay,
        triggerConditions: campaign.triggerConditions as any,
      });
    } catch (error) {
      console.error('Failed to load campaign', error);
      toast.error(getErrorMessage(error, 'Failed to load campaign data'));
    } finally {
      setLoadingCampaign(false);
    }
  }, [campaignId, toast]);

  const loadSegments = useCallback(async () => {
    setLoadingSegments(true);
    try {
      // Use fetchWithConfig to include store headers; fall back to plain fetch
      let response: Response;
      try {
        response = await fetchWithConfig('/api/segments', { cache: 'no-store' });
      } catch {
        response = await fetch('/api/segments', { cache: 'no-store' });
      }
      const payload = (await response.json().catch(() => ({}))) as SegmentListResponse;
      if (!response.ok) throw new Error(payload.error ?? 'Unable to load segments');
      setSegments(payload.segments ?? []);
    } catch (error) {
      console.error('Failed to load segments', error);
      toast.error(getErrorMessage(error, 'Failed to load segments'));
    } finally {
      setLoadingSegments(false);
    }
  }, [toast]);

  useEffect(() => { void loadSegments(); }, [loadSegments]);
  useEffect(() => {
    if (campaignId) void loadCampaign();
    else setCampaignData(defaultCampaignData);
  }, [campaignId, loadCampaign]);

  const steps = useMemo(() => stepFlow, []);
  const selectedSegments = useMemo(
    () => segments.filter(s => campaignData.segmentIds.includes(s.id)),
    [segments, campaignData.segmentIds],
  );
  const estimatedReach = useMemo(
    () => selectedSegments.reduce((sum, s) => sum + (s.customerCount ?? 0), 0),
    [selectedSegments],
  );

  const handleNext = () => setCurrentStep(prev => (prev < steps.length ? prev + 1 : prev));
  const handleBack = (event?: React.MouseEvent) => {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    setCurrentStep(prev => { if (prev > 1) return prev - 1; router.push('/campaigns'); return prev; });
  };

  const handleLaunch = async () => {
    try {
      const url = isEditMode ? `/api/campaigns/${campaignId}` : '/api/campaigns';
      const method = isEditMode ? 'PUT' : 'POST';
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(campaignData),
      });
      const payload = (await response.json().catch(() => ({}))) as ApiErrorPayload;
      if (!response.ok) throw new Error(payload.error ?? payload.message ?? 'Unable to save campaign');
      toast.success(isEditMode ? 'Campaign updated successfully' : 'Campaign launched successfully');
      onComplete();
    } catch (error) {
      console.error('Failed to launch campaign', error);
      toast.error(getErrorMessage(error, `Failed to ${isEditMode ? 'update' : 'create'} campaign`));
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
      {/* Header with steps */}
      <div className="border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50 p-8">
        <h2 className="mb-6 text-2xl font-bold text-gray-900">
          {isEditMode ? 'Edit WhatsApp Campaign' : 'Create New WhatsApp Campaign'}
        </h2>
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.number} className="flex flex-1 items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-full border-2 transition-all ${
                    currentStep > step.number
                      ? 'border-green-500 bg-green-500 text-white'
                      : currentStep === step.number
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-gray-300 bg-white text-gray-400'
                  }`}
                >
                  {currentStep > step.number ? <Check className="h-6 w-6" /> : <step.icon className="h-6 w-6" />}
                </div>
                <span className={`mt-2 text-xs font-medium ${currentStep >= step.number ? 'text-gray-900' : 'text-gray-400'}`}>
                  {step.title}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div className={`mx-4 h-1 flex-1 rounded-full transition-all ${currentStep > step.number ? 'bg-green-500' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Preset Selector (only for new campaigns, before step 1) */}
      {!isEditMode && currentStep === 1 && showPresets && (
        <div className="border-b border-gray-200 bg-gradient-to-r from-amber-50 to-orange-50 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                Start from a Preset
              </h3>
              <p className="text-sm text-gray-600">Choose a template to pre-fill your campaign, or start from scratch.</p>
            </div>
            <button
              onClick={() => setShowPresets(false)}
              className="text-sm text-gray-500 hover:text-gray-800 font-medium"
            >
              Skip &rarr;
            </button>
          </div>
          <div className="space-y-4">
            {PRESET_CATEGORIES.map(cat => {
              const presets = CAMPAIGN_PRESETS.filter(p => p.category === cat.key);
              if (presets.length === 0) return null;
              return (
                <div key={cat.key}>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    {cat.emoji} {cat.label}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    {presets.map(preset => (
                      <button
                        key={preset.id}
                        onClick={() => applyPreset(preset)}
                        className={`text-left p-4 rounded-xl border-2 transition-all hover:shadow-md ${
                          selectedPresetId === preset.id
                            ? 'border-blue-500 bg-blue-50 shadow-sm'
                            : 'border-gray-200 bg-white hover:border-blue-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xl">{preset.emoji}</span>
                          <span className="font-semibold text-sm text-gray-900">{preset.name}</span>
                        </div>
                        <p className="text-xs text-gray-500 line-clamp-2">{preset.description}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-100 text-purple-700">
                            {preset.type.replace('_', ' ')}
                          </span>
                          {preset.labels.map(l => (
                            <span key={l} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600">
                              {l}
                            </span>
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Show "preset applied" banner */}
      {!isEditMode && selectedPresetId && !showPresets && currentStep === 1 && (
        <div className="mx-8 mt-4 px-4 py-3 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-blue-800">
            <CheckCircle2 className="w-4 h-4 text-blue-600" />
            Preset applied: <strong>{CAMPAIGN_PRESETS.find(p => p.id === selectedPresetId)?.name}</strong>
            <span className="text-blue-600">— customize any field below</span>
          </div>
          <button
            onClick={() => { setShowPresets(true); }}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium underline"
          >
            Change Preset
          </button>
        </div>
      )}

      {/* Body */}
      <div className="min-h-[500px] p-8">
        {currentStep === 1 && <StepDetails campaignData={campaignData} setCampaignData={setCampaignData} />}
        {currentStep === 2 && (
          <StepAudience campaignData={campaignData} setCampaignData={setCampaignData} segments={segments} loadingSegments={loadingSegments} estimatedReach={estimatedReach} onCreateSegment={loadSegments} />
        )}
        {currentStep === 3 && <StepMessage campaignData={campaignData} setCampaignData={setCampaignData} TemplateSelector={TemplateSelector} />}
        {currentStep === 4 && <StepSchedule campaignData={campaignData} setCampaignData={setCampaignData} />}
        {currentStep === 5 && <StepReview campaignData={campaignData} estimatedReach={estimatedReach} selectedSegments={selectedSegments} />}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-8 py-6">
        <Button onClick={handleBack} type="button" variant="outline" size="lg">
          <ChevronLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <div className="flex items-center gap-2">
          {steps.map(step => (
            <span key={step.number} className={`h-2 rounded-full transition-all ${currentStep === step.number ? 'w-8 bg-blue-600' : currentStep > step.number ? 'w-4 bg-green-500' : 'w-2 bg-gray-300'}`} />
          ))}
        </div>
        <Button
          onClick={currentStep === steps.length ? handleLaunch : handleNext}
          size="lg"
          className="bg-blue-600 hover:bg-blue-700"
          disabled={loadingCampaign || (currentStep === 1 && !campaignData.name.trim()) || (currentStep === 2 && campaignData.segmentIds.length === 0) || (currentStep === 3 && !campaignData.messageContent.body.trim())}
        >
          {loadingCampaign ? 'Loading...' : currentStep === steps.length ? (isEditMode ? 'Update Campaign' : 'Launch Campaign') : (<>Continue <ChevronRight className="ml-2 h-4 w-4" /></>)}
        </Button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Step 1 — Campaign Details + Goal Tracking + Trigger Config
   ═══════════════════════════════════════════ */
function StepDetails({ campaignData, setCampaignData }: { campaignData: CampaignFormData; setCampaignData: React.Dispatch<React.SetStateAction<CampaignFormData>> }) {
  const [showGoalTracking, setShowGoalTracking] = useState(campaignData.goalTracking?.enabled ?? false);
  const showTriggerConfig = campaignData.type === 'TRIGGER_BASED';

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h3 className="text-xl font-bold text-gray-900">Campaign Details</h3>

      <div>
        <Label htmlFor="name" className="mb-2 block text-base font-semibold">Campaign Name *</Label>
        <Input id="name" value={campaignData.name} onChange={e => setCampaignData(p => ({ ...p, name: e.target.value }))} placeholder="e.g., Diwali Flash Sale 2024" className="text-base" />
      </div>

      <div>
        <Label htmlFor="description" className="mb-2 block text-base font-semibold">Description (Optional)</Label>
        <Textarea id="description" value={campaignData.description} onChange={e => setCampaignData(p => ({ ...p, description: e.target.value }))} placeholder="Describe the purpose of this campaign..." rows={3} className="text-base" />
      </div>

      <Label className="text-base font-semibold">Labels (Optional)</Label>
      <div className="space-y-2">
        {['Promotional', 'Transactional', 'Follow-up', 'Seasonal', 'Retention'].map(lbl => (
          <label key={lbl} className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={campaignData.labels.includes(lbl)} onChange={e => setCampaignData(p => ({ ...p, labels: e.target.checked ? [...p.labels, lbl] : p.labels.filter(l => l !== lbl) }))} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
            <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700">{lbl}</span>
          </label>
        ))}
      </div>

      <div>
        <Label className="mb-2 block text-base font-semibold">Campaign Type *</Label>
        <select value={campaignData.type} onChange={e => setCampaignData(p => ({ ...p, type: e.target.value as CampaignType }))} className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-transparent focus:ring-2 focus:ring-blue-500">
          <option value="ONE_TIME">One-Time Campaign</option>
          <option value="RECURRING">Recurring Campaign</option>
          <option value="DRIP">Drip Campaign</option>
          <option value="TRIGGER_BASED">Trigger-Based Campaign</option>
        </select>
        <p className="mt-2 text-sm text-gray-600">
          {campaignData.type === 'ONE_TIME' && 'Send a single message to your audience.'}
          {campaignData.type === 'RECURRING' && 'Send messages on a regular schedule.'}
          {campaignData.type === 'DRIP' && 'Send a series of messages over time.'}
          {campaignData.type === 'TRIGGER_BASED' && 'Send messages based on customer actions.'}
        </p>
      </div>

      {/* ─── Trigger-Based Configuration ─── */}
      {showTriggerConfig && (
        <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-5 space-y-4">
          <div className="flex items-center gap-2 text-amber-800">
            <Zap className="h-5 w-5" />
            <h4 className="font-semibold">Trigger Configuration</h4>
          </div>
          <div>
            <Label className="mb-2 block text-sm font-medium">Trigger Event *</Label>
            <select value={campaignData.triggerEvent ?? ''} onChange={e => setCampaignData(p => ({ ...p, triggerEvent: e.target.value as TriggerEvent }))} className="w-full rounded-lg border border-amber-300 bg-white px-4 py-2.5 text-sm focus:ring-2 focus:ring-amber-400">
              <option value="">Select a trigger event...</option>
              {TRIGGER_EVENTS.map(ev => <option key={ev.value} value={ev.value}>{ev.label}</option>)}
            </select>
            {campaignData.triggerEvent && (
              <p className="mt-1 text-xs text-amber-700">{TRIGGER_EVENTS.find(e => e.value === campaignData.triggerEvent)?.desc}</p>
            )}
          </div>
          <div>
            <Label className="mb-2 block text-sm font-medium">Delay After Trigger (minutes)</Label>
            <Input type="number" min={0} value={campaignData.triggerDelay ?? 0} onChange={e => setCampaignData(p => ({ ...p, triggerDelay: parseInt(e.target.value) || 0 }))} placeholder="0" className="w-32 border-amber-300" />
            <p className="mt-1 text-xs text-amber-700">Wait this many minutes after the trigger before sending.</p>
          </div>
        </div>
      )}

      {/* ─── Goal Tracking ─── */}
      <div className="rounded-xl border border-gray-200 bg-gray-50">
        <button type="button" onClick={() => {
          const next = !showGoalTracking;
          setShowGoalTracking(next);
          if (next && !campaignData.goalTracking) {
            setCampaignData(p => ({ ...p, goalTracking: { enabled: true, goalType: 'REVENUE', targetValue: 50000 } }));
          }
        }} className="flex w-full items-center justify-between p-4 text-left">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-green-600" />
            <span className="font-semibold text-gray-900">Campaign Goal Tracking</span>
            {campaignData.goalTracking?.enabled && <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Active</span>}
          </div>
          {showGoalTracking ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
        </button>
        {showGoalTracking && (
          <div className="border-t border-gray-200 p-4 space-y-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={campaignData.goalTracking?.enabled ?? false} onChange={e => setCampaignData(p => ({ ...p, goalTracking: { enabled: e.target.checked, goalType: p.goalTracking?.goalType ?? 'REVENUE', targetValue: p.goalTracking?.targetValue ?? 50000 } }))} className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500" />
              <span className="text-sm font-medium text-gray-700">Enable goal tracking</span>
            </label>
            {campaignData.goalTracking?.enabled && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="mb-1 block text-sm">Goal Type</Label>
                  <select value={campaignData.goalTracking.goalType} onChange={e => setCampaignData(p => ({ ...p, goalTracking: { ...p.goalTracking!, goalType: e.target.value as GoalTracking['goalType'] } }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-green-500">
                    <option value="REVENUE">Revenue (₹)</option>
                    <option value="CONVERSION">Conversions (Count)</option>
                    <option value="ENGAGEMENT">Engagement (Messages Read)</option>
                  </select>
                </div>
                <div>
                  <Label className="mb-1 block text-sm">Target Value</Label>
                  <Input type="number" min={1} value={campaignData.goalTracking.targetValue} onChange={e => setCampaignData(p => ({ ...p, goalTracking: { ...p.goalTracking!, targetValue: parseInt(e.target.value) || 0 } }))} className="text-sm" placeholder={campaignData.goalTracking.goalType === 'REVENUE' ? '₹50,000' : '100'} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Step 2 — Audience
   ═══════════════════════════════════════════ */
function StepAudience({ campaignData, setCampaignData, segments, loadingSegments, estimatedReach, onCreateSegment }: { campaignData: CampaignFormData; setCampaignData: React.Dispatch<React.SetStateAction<CampaignFormData>>; segments: CustomerSegment[]; loadingSegments: boolean; estimatedReach: number; onCreateSegment: () => void }) {
  const [createSegmentModalOpen, setCreateSegmentModalOpen] = useState(false);
  const handleSegmentCreated = (newSegment: Segment) => {
    setCampaignData(p => ({ ...p, segmentIds: [...p.segmentIds, newSegment.id] }));
    onCreateSegment();
    setCreateSegmentModalOpen(false);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-gray-900">Select Your Audience</h3>
        <Button type="button" variant="outline" onClick={() => setCreateSegmentModalOpen(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" /> Create New Segment
        </Button>
      </div>
      <div className="rounded-r-lg border-l-4 border-blue-500 bg-blue-50 p-4">
        <p className="text-sm text-blue-800">Choose one or more customer segments for this campaign.</p>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <AudienceStat label="Total Segments" value={segments.length.toLocaleString()} />
        <AudienceStat label="Selected" value={campaignData.segmentIds.length.toString()} accent />
        <AudienceStat label="Est. Reach" value={estimatedReach.toLocaleString()} accent />
      </div>
      {loadingSegments ? (
        <div className="flex flex-col items-center justify-center gap-4 py-12">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
          <p className="text-gray-600">Loading segments...</p>
        </div>
      ) : segments.length === 0 ? (
        <div className="rounded-xl bg-gray-50 py-12 text-center">
          <p className="mb-4 text-gray-600">No segments found. Create segments before launching a campaign.</p>
          <Button variant="outline" onClick={() => setCreateSegmentModalOpen(true)}><Users className="mr-2 h-4 w-4" /> Create New Segment</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {segments.map(segment => {
            const isSelected = campaignData.segmentIds.includes(segment.id);
            return (
              <button key={segment.id} onClick={() => setCampaignData(p => ({ ...p, segmentIds: isSelected ? p.segmentIds.filter(id => id !== segment.id) : [...p.segmentIds, segment.id] }))} className={`rounded-xl border-2 p-4 text-left transition-all ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="mb-1 font-semibold text-gray-900">{segment.name}</h4>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span>{(segment.customerCount ?? 0).toLocaleString()} customers</span>
                      <span>₹{Math.round((segment.totalRevenue ?? 0) / 1000)}k revenue</span>
                    </div>
                  </div>
                  {isSelected && <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600"><Check className="h-4 w-4 text-white" /></div>}
                </div>
              </button>
            );
          })}
        </div>
      )}
      {createSegmentModalOpen && <CreateSegmentModal segment={null} onClose={() => setCreateSegmentModalOpen(false)} onSave={handleSegmentCreated} />}
    </div>
  );
}

/* ═══════════════════════════════════════════
   Step 3 — Message + A/B Testing
   ═══════════════════════════════════════════ */
function StepMessage({ campaignData, setCampaignData, TemplateSelector: _TemplateSelector }: { campaignData: CampaignFormData; setCampaignData: React.Dispatch<React.SetStateAction<CampaignFormData>>; TemplateSelector: React.ComponentType<TemplateSelectorProps> }) {
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<WhatsAppTemplate | null>(null);
  const [bodyFields, setBodyFields] = useState<any[]>(campaignData.whatsappConfig?.bodyFields || []);
  const [variableMappings, setVariableMappings] = useState<any[]>(campaignData.whatsappConfig?.variableMappings || []);
  const [variablePreview, setVariablePreview] = useState<Record<string, string>>({});
  const [showABTest, setShowABTest] = useState(campaignData.abTest?.enabled ?? false);

  useEffect(() => {
    (async () => {
      setTemplatesLoading(true);
      try {
        const res = await fetch('/api/whatsapp/templates', { cache: 'no-store' });
        const data = await res.json();
        if (res.ok && data.templates) {
          setTemplates(data.templates);
          if (campaignData.templateId) {
            const t = data.templates.find((x: WhatsAppTemplate) => x.id === campaignData.templateId);
            if (t) setSelectedTemplate(t);
          }
        }
      } catch { /* silent */ } finally { setTemplatesLoading(false); }
    })();
  }, [campaignData.templateId]);

  useEffect(() => {
    const preview: Record<string, string> = {};
    variableMappings.forEach((m: any) => { preview[m.variable] = m.fallbackValue || m.dataSource || 'Sample'; });
    setVariablePreview(preview);
  }, [variableMappings]);

  const handleTemplateSelect = (template: WhatsAppTemplate) => {
    setSelectedTemplate(template);
    setCampaignData(p => ({ ...p, templateId: template.id, messageContent: { ...p.messageContent, body: template.body || template.content || '' } }));
  };
  const handleConfigChange = (updates: any) => setCampaignData(p => ({ ...p, whatsappConfig: { ...p.whatsappConfig, ...updates } }));
  const handleSendTest = async (phone: string) => {
    const res = await fetch('/api/whatsapp/send-test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ templateId: selectedTemplate?.id, phoneNumber: phone, variables: variablePreview }) });
    if (!res.ok) throw new Error('Failed to send test');
  };

  const whatsappConfig: any = {
    templateId: selectedTemplate?.id || '', templateName: selectedTemplate?.name || '', templateStatus: selectedTemplate?.status || 'APPROVED', templateLanguage: selectedTemplate?.language || '', templateCategory: selectedTemplate?.category || '',
    variableMappings, bodyFields,
    sendWindow: campaignData.whatsappConfig?.sendWindow || { daysOfWeek: [1, 2, 3, 4, 5], startTime: '09:00', endTime: '21:00', timezone: 'customer' },
    rateLimiting: campaignData.whatsappConfig?.rateLimiting || { maxPerDay: 3, maxPerWeek: 10 },
    failureHandling: campaignData.whatsappConfig?.failureHandling || { retryCount: 1, retryDelay: 15, fallbackAction: 'continue' },
    skipIfOptedOut: true, exitPaths: campaignData.whatsappConfig?.exitPaths || {},
    mediaUrl: campaignData.whatsappConfig?.mediaUrl, useDynamicMedia: campaignData.whatsappConfig?.useDynamicMedia || false,
  };

  const addVariant = () => {
    const variants = campaignData.abTest?.variants ?? [];
    if (variants.length >= 3) return;
    const count = variants.length + 1;
    const perEach = Math.floor(100 / count);
    const updated = variants.map(v => ({ ...v, percentage: perEach }));
    updated.push({ id: `variant_${Date.now()}`, name: `Variant ${String.fromCharCode(65 + variants.length)}`, percentage: 100 - perEach * variants.length, messageContent: { body: '' } });
    setCampaignData(p => ({ ...p, abTest: { enabled: true, variants: updated, winnerCriteria: p.abTest?.winnerCriteria ?? 'OPEN_RATE', testDuration: p.abTest?.testDuration ?? 24 } }));
  };
  const removeVariant = (id: string) => {
    const variants = (campaignData.abTest?.variants ?? []).filter(v => v.id !== id);
    if (variants.length === 0) { setCampaignData(p => ({ ...p, abTest: undefined })); setShowABTest(false); return; }
    const perEach = Math.floor(100 / variants.length);
    const updated = variants.map((v, i) => ({ ...v, percentage: i === variants.length - 1 ? 100 - perEach * (variants.length - 1) : perEach }));
    setCampaignData(p => ({ ...p, abTest: { ...p.abTest!, variants: updated } }));
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <h3 className="text-xl font-bold text-gray-900">Create Your WhatsApp Message</h3>

      <UnifiedWhatsAppConfig templates={templates} templatesLoading={templatesLoading} selectedTemplate={selectedTemplate} config={whatsappConfig} bodyFields={bodyFields} variableMappings={variableMappings} variablePreview={variablePreview} onTemplateSelect={handleTemplateSelect} onBodyFieldChange={(f) => { setBodyFields(f); handleConfigChange({ bodyFields: f }); }} onVariableMappingsChange={(m) => { setVariableMappings(m); handleConfigChange({ variableMappings: m }); }} onSendTest={handleSendTest} dataSources={[]} triggerContext="generic" validationErrors={[]} />

      <AdvancedWhatsAppSettings config={whatsappConfig} selectedTemplate={selectedTemplate} bodyFields={bodyFields} variableMappings={variableMappings} variablePreview={variablePreview} onConfigChange={handleConfigChange} onBodyFieldChange={(f) => { setBodyFields(f); handleConfigChange({ bodyFields: f }); }} onVariableMappingsChange={(m) => { setVariableMappings(m); handleConfigChange({ variableMappings: m }); }} onSendTest={handleSendTest} dataSources={[]} triggerContext="generic" />

      {/* ─── A/B Testing ─── */}
      <div className="rounded-xl border border-gray-200 bg-gray-50">
        <button type="button" onClick={() => {
          const next = !showABTest;
          setShowABTest(next);
          if (next && !campaignData.abTest) setCampaignData(p => ({ ...p, abTest: { enabled: true, variants: [{ id: 'variant_a', name: 'Variant A', percentage: 50, messageContent: { body: '' } }, { id: 'variant_b', name: 'Variant B', percentage: 50, messageContent: { body: '' } }], winnerCriteria: 'OPEN_RATE', testDuration: 24 } }));
        }} className="flex w-full items-center justify-between p-4 text-left">
          <div className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-purple-600" />
            <span className="font-semibold text-gray-900">A/B Testing</span>
            {campaignData.abTest?.enabled && <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">{campaignData.abTest.variants.length} variants</span>}
          </div>
          {showABTest ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
        </button>

        {showABTest && campaignData.abTest && (
          <div className="border-t border-gray-200 p-4 space-y-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={campaignData.abTest.enabled} onChange={e => setCampaignData(p => ({ ...p, abTest: { ...p.abTest!, enabled: e.target.checked } }))} className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500" />
              <span className="text-sm font-medium text-gray-700">Enable A/B testing</span>
            </label>

            {campaignData.abTest.enabled && (
              <>
                <div className="space-y-3">
                  {campaignData.abTest.variants.map((variant, idx) => (
                    <div key={variant.id} className="rounded-lg border border-gray-200 bg-white p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-900">{variant.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">{variant.percentage}% traffic</span>
                          {campaignData.abTest!.variants.length > 2 && <button type="button" onClick={() => removeVariant(variant.id)} className="text-red-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>}
                        </div>
                      </div>
                      <Textarea value={variant.messageContent.body} onChange={e => {
                        const updated = [...campaignData.abTest!.variants];
                        updated[idx] = { ...updated[idx], messageContent: { ...updated[idx].messageContent, body: e.target.value } };
                        setCampaignData(p => ({ ...p, abTest: { ...p.abTest!, variants: updated } }));
                      }} placeholder={`Message for ${variant.name}...`} rows={2} className="text-sm" />
                    </div>
                  ))}
                </div>

                {campaignData.abTest.variants.length < 3 && <Button type="button" variant="outline" size="sm" onClick={addVariant}><Plus className="mr-1 h-3.5 w-3.5" /> Add Variant</Button>}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label className="mb-1 block text-sm">Winner Criteria</Label>
                    <select value={campaignData.abTest.winnerCriteria} onChange={e => setCampaignData(p => ({ ...p, abTest: { ...p.abTest!, winnerCriteria: e.target.value as ABTestConfig['winnerCriteria'] } }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500">
                      <option value="OPEN_RATE">Open Rate</option>
                      <option value="CLICK_RATE">Click Rate</option>
                      <option value="CONVERSION_RATE">Conversion Rate</option>
                    </select>
                  </div>
                  <div>
                    <Label className="mb-1 block text-sm">Test Duration (hours)</Label>
                    <Input type="number" min={1} max={168} value={campaignData.abTest.testDuration} onChange={e => setCampaignData(p => ({ ...p, abTest: { ...p.abTest!, testDuration: parseInt(e.target.value) || 24 } }))} className="text-sm" />
                  </div>
                </div>
                <p className="text-xs text-gray-500">Traffic will be split among variants during the test period. The winning variant will be sent to remaining recipients.</p>
              </>
            )}
          </div>
        )}
      </div>

      {/* ─── Follow-Up Messages ─── */}
      <FollowUpSection campaignData={campaignData} setCampaignData={setCampaignData} />
    </div>
  );
}

/* ═══════════════════════════════════════════
   Step 4 — Schedule + Recurring + Smart Timing
   ═══════════════════════════════════════════ */
function StepSchedule({ campaignData, setCampaignData }: { campaignData: CampaignFormData; setCampaignData: React.Dispatch<React.SetStateAction<CampaignFormData>> }) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h3 className="text-xl font-bold text-gray-900">Schedule Your Campaign</h3>

      <div className="grid gap-4 text-sm">
        <div>
          <Label className="mb-2 block font-semibold">Schedule Type</Label>
          <select value={campaignData.scheduleType} onChange={e => setCampaignData(p => ({ ...p, scheduleType: e.target.value as ScheduleType }))} className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-transparent focus:ring-2 focus:ring-blue-500">
            <option value="IMMEDIATE">Send immediately</option>
            <option value="SCHEDULED">Schedule for later</option>
            <option value="RECURRING">Recurring schedule</option>
          </select>
        </div>

        {campaignData.scheduleType === 'SCHEDULED' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="scheduledAt" className="mb-2 block font-semibold">Scheduled Date &amp; Time</Label>
              <Input id="scheduledAt" type="datetime-local" value={campaignData.scheduledAt ? new Date(campaignData.scheduledAt).toISOString().slice(0, 16) : ''} onChange={e => setCampaignData(p => ({ ...p, scheduledAt: e.target.value ? Date.parse(e.target.value) : undefined }))} />
            </div>
            <div>
              <Label htmlFor="timezone" className="mb-2 block font-semibold">Timezone</Label>
              <select id="timezone" value={campaignData.timezone} onChange={e => setCampaignData(p => ({ ...p, timezone: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-blue-500">
                <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                <option value="America/New_York">America/New_York (EST)</option>
                <option value="Europe/London">Europe/London (GMT)</option>
                <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                <option value="Asia/Singapore">Asia/Singapore (SGT)</option>
              </select>
            </div>
          </div>
        )}

        {/* ─── Recurring Schedule ─── */}
        {campaignData.scheduleType === 'RECURRING' && (
          <div className="rounded-xl border-2 border-indigo-200 bg-indigo-50 p-5 space-y-4">
            <div className="flex items-center gap-2 text-indigo-800">
              <Repeat className="h-5 w-5" />
              <h4 className="font-semibold">Recurring Schedule</h4>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label className="mb-1 block text-sm font-medium">Frequency</Label>
                <select value={campaignData.recurringConfig?.frequency ?? 'WEEKLY'} onChange={e => setCampaignData(p => ({ ...p, recurringConfig: { frequency: e.target.value as RecurringConfig['frequency'], interval: p.recurringConfig?.interval ?? 1, daysOfWeek: p.recurringConfig?.daysOfWeek ?? [1, 3, 5], time: p.recurringConfig?.time ?? '10:00', endDate: p.recurringConfig?.endDate } }))} className="w-full rounded-lg border border-indigo-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400">
                  <option value="DAILY">Daily</option>
                  <option value="WEEKLY">Weekly</option>
                  <option value="MONTHLY">Monthly</option>
                </select>
              </div>
              <div>
                <Label className="mb-1 block text-sm font-medium">
                  Every X {(campaignData.recurringConfig?.frequency ?? 'WEEKLY') === 'DAILY' ? 'days' : (campaignData.recurringConfig?.frequency ?? 'WEEKLY') === 'WEEKLY' ? 'weeks' : 'months'}
                </Label>
                <Input type="number" min={1} max={12} value={campaignData.recurringConfig?.interval ?? 1} onChange={e => setCampaignData(p => ({ ...p, recurringConfig: { ...p.recurringConfig!, interval: parseInt(e.target.value) || 1 } }))} className="border-indigo-300 text-sm" />
              </div>
            </div>

            {(campaignData.recurringConfig?.frequency ?? 'WEEKLY') === 'WEEKLY' && (
              <div>
                <Label className="mb-2 block text-sm font-medium">Send on Days</Label>
                <div className="flex flex-wrap gap-2">
                  {DAY_NAMES.map((day, idx) => {
                    const isActive = (campaignData.recurringConfig?.daysOfWeek ?? []).includes(idx);
                    return (
                      <button key={day} type="button" onClick={() => setCampaignData(p => {
                        const current = p.recurringConfig?.daysOfWeek ?? [];
                        return { ...p, recurringConfig: { ...p.recurringConfig!, daysOfWeek: isActive ? current.filter(d => d !== idx) : [...current, idx] } };
                      })} className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${isActive ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 border border-indigo-200 hover:border-indigo-400'}`}>
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label className="mb-1 block text-sm font-medium">Send Time</Label>
                <Input type="time" value={campaignData.recurringConfig?.time ?? '10:00'} onChange={e => setCampaignData(p => ({ ...p, recurringConfig: { ...p.recurringConfig!, time: e.target.value } }))} className="border-indigo-300 text-sm" />
              </div>
              <div>
                <Label className="mb-1 block text-sm font-medium">End Date (Optional)</Label>
                <Input type="date" value={campaignData.recurringConfig?.endDate ? new Date(campaignData.recurringConfig.endDate).toISOString().slice(0, 10) : ''} onChange={e => setCampaignData(p => ({ ...p, recurringConfig: { ...p.recurringConfig!, endDate: e.target.value ? Date.parse(e.target.value) : undefined } }))} className="border-indigo-300 text-sm" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── Sending Speed ─── */}
      <div>
        <Label className="mb-3 block text-base font-semibold">Sending Speed</Label>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {speedOptions.map(opt => (
            <button key={opt.value} onClick={() => setCampaignData(p => ({ ...p, sendingSpeed: opt.value }))} className={`rounded-xl border-2 p-4 transition-all ${campaignData.sendingSpeed === opt.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}>
              <div className="text-sm font-semibold text-gray-900">{opt.label}</div>
              <div className="text-xs text-gray-600">{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* ─── Smart Timing Toggle ─── */}
      {campaignData.scheduleType !== 'IMMEDIATE' && (
        <div className="rounded-xl border border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50 p-5">
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={campaignData.useSmartTiming} onChange={e => setCampaignData(p => ({ ...p, useSmartTiming: e.target.checked }))} className="mt-1 h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500" />
            <div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-semibold text-gray-900">Smart Send Timing</span>
              </div>
              <p className="mt-1 text-xs text-gray-600">Automatically send at each customer&apos;s optimal engagement time based on past open times and order history.</p>
            </div>
          </label>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   Step 5 — Review
   ═══════════════════════════════════════════ */
function StepReview({ campaignData, selectedSegments, estimatedReach }: { campaignData: CampaignFormData; selectedSegments: CustomerSegment[]; estimatedReach: number }) {
  const typeLabel = (type: CampaignType) => ({ ONE_TIME: 'One-Time', RECURRING: 'Recurring', DRIP: 'Drip', TRIGGER_BASED: 'Trigger-Based' }[type] ?? type);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h3 className="text-xl font-bold text-gray-900">Review &amp; Launch Campaign</h3>

      <div className="rounded-xl border-2 border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-600 text-xl text-white">✓</div>
          <div>
            <h4 className="mb-2 text-lg font-bold text-gray-900">Campaign ready to launch</h4>
            <p className="text-gray-700">Review all details below and click &quot;Launch Campaign&quot;.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <ReviewCard title="Campaign Details" icon={<Sparkles className="h-5 w-5 text-blue-600" />} items={[
          { label: 'Name', value: campaignData.name || 'Untitled' },
          { label: 'Channel', value: 'WhatsApp' },
          { label: 'Type', value: typeLabel(campaignData.type) },
          ...(campaignData.labels.length > 0 ? [{ label: 'Labels', value: campaignData.labels.join(', ') }] : []),
        ]} />
        <ReviewCard title="Audience" icon={<Users className="h-5 w-5 text-purple-600" />} items={[
          { label: 'Segments', value: `${campaignData.segmentIds.length} selected` },
          { label: 'Est. Reach', value: `${estimatedReach.toLocaleString()} customers` },
        ]} />
        <ReviewCard title="Message" icon={<MessageSquare className="h-5 w-5 text-green-600" />} content={campaignData.messageContent.body || 'No message content'} />
        <ReviewCard title="Schedule" icon={<Calendar className="h-5 w-5 text-orange-600" />} items={[
          { label: 'Type', value: campaignData.scheduleType === 'IMMEDIATE' ? 'Send Now' : campaignData.scheduleType === 'SCHEDULED' ? 'Scheduled' : 'Recurring' },
          ...(campaignData.scheduledAt ? [{ label: 'Date & Time', value: new Date(campaignData.scheduledAt).toLocaleString() }] : []),
          { label: 'Speed', value: campaignData.sendingSpeed },
          ...(campaignData.useSmartTiming ? [{ label: 'Smart Timing', value: 'Enabled' }] : []),
        ]} />
      </div>

      {/* Trigger config review */}
      {campaignData.type === 'TRIGGER_BASED' && campaignData.triggerEvent && (
        <ReviewCard title="Trigger Configuration" icon={<Zap className="h-5 w-5 text-amber-600" />} items={[
          { label: 'Trigger Event', value: TRIGGER_EVENTS.find(e => e.value === campaignData.triggerEvent)?.label ?? campaignData.triggerEvent },
          { label: 'Delay', value: `${campaignData.triggerDelay ?? 0} minutes` },
        ]} />
      )}

      {/* Recurring config review */}
      {campaignData.scheduleType === 'RECURRING' && campaignData.recurringConfig && (
        <ReviewCard title="Recurring Schedule" icon={<Repeat className="h-5 w-5 text-indigo-600" />} items={[
          { label: 'Frequency', value: campaignData.recurringConfig.frequency },
          { label: 'Interval', value: `Every ${campaignData.recurringConfig.interval}` },
          { label: 'Time', value: campaignData.recurringConfig.time },
          ...(campaignData.recurringConfig.daysOfWeek?.length ? [{ label: 'Days', value: campaignData.recurringConfig.daysOfWeek.map(d => DAY_NAMES[d]).join(', ') }] : []),
          ...(campaignData.recurringConfig.endDate ? [{ label: 'End Date', value: new Date(campaignData.recurringConfig.endDate).toLocaleDateString() }] : []),
        ]} />
      )}

      {/* A/B Test review */}
      {campaignData.abTest?.enabled && (
        <ReviewCard title="A/B Testing" icon={<FlaskConical className="h-5 w-5 text-purple-600" />} items={[
          { label: 'Variants', value: `${campaignData.abTest.variants.length} variants` },
          { label: 'Winner Criteria', value: campaignData.abTest.winnerCriteria.replace(/_/g, ' ') },
          { label: 'Test Duration', value: `${campaignData.abTest.testDuration} hours` },
          ...campaignData.abTest.variants.map(v => ({ label: v.name, value: `${v.percentage}% — ${(v.messageContent.body || 'No content').slice(0, 40)}${(v.messageContent.body || '').length > 40 ? '...' : ''}` })),
        ]} />
      )}

      {/* Follow-up steps review */}
      {(campaignData.followUpSteps?.length ?? 0) > 0 && (
        <ReviewCard title="Follow-Up Messages" icon={<Zap className="h-5 w-5 text-amber-600" />} items={
          campaignData.followUpSteps!.map(step => ({
            label: `Step ${step.stepIndex}: ${step.name}`,
            value: `${step.condition.replace(/_/g, ' ')} → after ${step.delayMinutes < 60 ? `${step.delayMinutes}m` : `${Math.floor(step.delayMinutes / 60)}h`}${step.useSmartWindow ? ' · 🟢 Smart window' : ''}`,
          }))
        } />
      )}

      {/* Goal tracking review */}
      {campaignData.goalTracking?.enabled && (
        <ReviewCard title="Goal Tracking" icon={<Target className="h-5 w-5 text-green-600" />} items={[
          { label: 'Goal Type', value: campaignData.goalTracking.goalType },
          { label: 'Target', value: campaignData.goalTracking.goalType === 'REVENUE' ? `₹${campaignData.goalTracking.targetValue.toLocaleString()}` : campaignData.goalTracking.targetValue.toLocaleString() },
        ]} />
      )}

      {/* Segment list */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
        <h4 className="mb-2 font-semibold text-gray-900">Selected Segments</h4>
        <ul className="list-disc space-y-1 pl-5">
          {selectedSegments.map(seg => <li key={seg.id}>{seg.name} — {(seg.customerCount ?? 0).toLocaleString()} customers</li>)}
        </ul>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Follow-Up Section (collapsible in Step 3)
   ═══════════════════════════════════════════ */
function FollowUpSection({ campaignData, setCampaignData }: { campaignData: CampaignFormData; setCampaignData: React.Dispatch<React.SetStateAction<CampaignFormData>> }) {
  const [showFollowUps, setShowFollowUps] = useState((campaignData.followUpSteps?.length ?? 0) > 0);

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50">
      <button
        type="button"
        onClick={() => {
          setShowFollowUps(!showFollowUps);
          if (!showFollowUps && (!campaignData.followUpSteps || campaignData.followUpSteps.length === 0)) {
            // Initialize with empty array — user clicks "Add Step" to begin
          }
        }}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-amber-600" />
          <span className="font-semibold text-gray-900">Follow-Up Messages</span>
          {(campaignData.followUpSteps?.length ?? 0) > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
              {campaignData.followUpSteps!.length} step{campaignData.followUpSteps!.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {showFollowUps ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
      </button>

      {showFollowUps && (
        <div className="border-t border-gray-200 p-4 space-y-3">
          <p className="text-xs text-gray-500 mb-2">
            Add conditional follow-up messages based on customer engagement. Messages within the 24-hour window are sent as free text — outside the window, templates are used.
          </p>
          <FollowUpBuilder
            steps={campaignData.followUpSteps ?? []}
            onChange={(steps) => setCampaignData(p => ({ ...p, followUpSteps: steps }))}
          />
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   Template Selector
   ═══════════════════════════════════════════ */
function TemplateSelector({ onSelectTemplate }: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<WhatsAppTemplateWithComponents[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');

  const loadTemplates = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/templates/whatsapp', { cache: 'no-store' });
      const payload = (await res.json().catch(() => ({}))) as TemplateListResponse;
      if (!res.ok) throw new Error(payload.error ?? 'Failed to load templates');
      setTemplates(payload.templates ?? []);
    } catch (err) { setError(getErrorMessage(err, 'Failed to load templates')); } finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadTemplates(); }, [loadTemplates]);

  if (loading) return (<div className="rounded-xl border border-gray-200 bg-gray-50 p-6"><div className="flex items-center justify-center gap-3 py-8"><RefreshCw className="h-6 w-6 animate-spin text-blue-600" /><span className="text-gray-600">Loading approved templates...</span></div></div>);
  if (error) return (<div className="rounded-xl border border-red-200 bg-red-50 p-6"><p className="mb-4 text-red-800">{error}</p><Button variant="outline" size="sm" onClick={loadTemplates}><RefreshCw className="mr-2 h-4 w-4" /> Retry</Button></div>);
  if (templates.length === 0) return (<div className="rounded-xl border border-yellow-200 bg-yellow-50 p-6"><p className="mb-2 font-semibold text-yellow-800">No approved templates available.</p><p className="mb-4 text-sm text-yellow-700">Create and approve templates in WhatsApp Manager to use them here.</p><a href="https://business.facebook.com/wa/manage/message-templates/" target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">Open WhatsApp Manager →</a></div>);

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-6">
      <div className="mb-4 flex items-center justify-between">
        <Label className="text-base font-semibold">Select Approved Template (Optional)</Label>
        <Button variant="outline" size="sm" onClick={loadTemplates}><RefreshCw className="mr-2 h-4 w-4" /> Refresh</Button>
      </div>
      <select value={selectedTemplate} onChange={e => { setSelectedTemplate(e.target.value); const t = templates.find(x => x.id === e.target.value); if (t) onSelectTemplate(t); }} className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-transparent focus:ring-2 focus:ring-blue-500">
        <option value="">Select a template…</option>
        {templates.map(t => <option key={t.id} value={t.id}>{t.name} ({t.language}) — {t.category}</option>)}
      </select>
      {selectedTemplate && <div className="mt-3 flex items-center gap-2 text-sm text-green-700"><CheckCircle2 className="h-4 w-4" /><span>Template selected: {templates.find(x => x.id === selectedTemplate)?.name}</span></div>}
    </div>
  );
}

/* ═══════════════════════════════════════════
   Shared UI Components
   ═══════════════════════════════════════════ */
function AudienceStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border-2 p-4 ${accent ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-white'}`}>
      <div className="text-sm text-gray-600">{label}</div>
      <div className={`text-2xl font-bold ${accent ? 'text-blue-600' : 'text-gray-900'}`}>{value}</div>
    </div>
  );
}

function ReviewCard({ title, icon, items, content }: { title: string; icon: React.ReactNode; items?: Array<{ label: string; value: string }>; content?: string }) {
  return (
    <div className="rounded-xl border-2 border-gray-200 bg-white p-6">
      <h5 className="mb-4 flex items-center gap-2 font-semibold text-gray-900">{icon}{title}</h5>
      {items ? (
        <dl className="space-y-2 text-sm">
          {items.map(item => (
            <div key={`${item.label}-${item.value}`} className="flex justify-between">
              <dt className="text-gray-600">{item.label}</dt>
              <dd className="font-medium text-gray-900 text-right max-w-[60%] truncate">{item.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700 whitespace-pre-wrap break-words">{content ?? 'No details available.'}</div>
      )}
    </div>
  );
}

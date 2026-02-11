'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Plus,
  RefreshCw,
  Sparkles,
  Target,
  Users,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/lib/hooks/useToast';
import type { Campaign, CampaignMessageContent, CampaignType } from '@/lib/types/campaign';
import type { Segment } from '@/lib/types';
import type { CustomerSegment } from '@/lib/types/segment';
import type { WhatsAppTemplate } from '@/lib/types/whatsapp-config';
import { UnifiedWhatsAppConfig } from '@/components/journeys/nodes/whatsapp/UnifiedWhatsAppConfig';
import { AdvancedWhatsAppSettings } from '@/components/campaigns/AdvancedWhatsAppSettings';
import { CreateSegmentModal } from '@/components/segments/CreateSegmentModal';

interface CampaignWizardProps {
  campaignId?: string;
  onComplete: () => void;
}

type ScheduleType = 'IMMEDIATE' | 'SCHEDULED' | 'RECURRING';
type SendingSpeed = 'FAST' | 'MEDIUM' | 'SLOW';

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

type TemplateComponent =
  | {
      type: 'BODY' | 'body';
      text?: string;
      [key: string]: unknown;
    }
  | {
      type: string;
      [key: string]: unknown;
    };

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
      const response = await fetch('/api/segments', { cache: 'no-store' });
      const payload = (await response.json().catch(() => ({}))) as SegmentListResponse;

      if (!response.ok) {
        throw new Error(payload.error ?? 'Unable to load segments');
      }

      setSegments(payload.segments ?? []);
    } catch (error) {
      console.error('Failed to load segments', error);
      toast.error(getErrorMessage(error, 'Failed to load segments'));
    } finally {
      setLoadingSegments(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadSegments();
  }, [loadSegments]);

  useEffect(() => {
    if (campaignId) {
      void loadCampaign();
    } else {
      setCampaignData(defaultCampaignData);
    }
  }, [campaignId, loadCampaign]);

  const steps = useMemo(() => stepFlow, []);

  const selectedSegments = useMemo(
    () => segments.filter(segment => campaignData.segmentIds.includes(segment.id)),
    [segments, campaignData.segmentIds]
  );

  const estimatedReach = useMemo(
    () => selectedSegments.reduce((sum, segment) => sum + (segment.customerCount ?? 0), 0),
    [selectedSegments]
  );

  const handleNext = () => {
    setCurrentStep(prev => (prev < steps.length ? prev + 1 : prev));
  };

  const handleBack = (event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    setCurrentStep(prev => {
      if (prev > 1) return prev - 1;
      router.push('/campaigns');
      return prev;
    });
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

      if (!response.ok) {
        throw new Error(payload.error ?? payload.message ?? 'Unable to save campaign');
      }

      toast.success(isEditMode ? 'Campaign updated successfully' : 'Campaign launched successfully');
      onComplete();
    } catch (error) {
      console.error('Failed to launch campaign', error);
      toast.error(getErrorMessage(error, `Failed to ${isEditMode ? 'update' : 'create'} campaign`));
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
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
                <span
                  className={`mt-2 text-xs font-medium ${
                    currentStep >= step.number ? 'text-gray-900' : 'text-gray-400'
                  }`}
                >
                  {step.title}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`mx-4 h-1 flex-1 rounded-full transition-all ${
                    currentStep > step.number ? 'bg-green-500' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="min-h-[500px] p-8">
        {currentStep === 1 && (
          <StepDetails campaignData={campaignData} setCampaignData={setCampaignData} />
        )}

        {currentStep === 2 && (
          <StepAudience
            campaignData={campaignData}
            setCampaignData={setCampaignData}
            segments={segments}
            loadingSegments={loadingSegments}
            estimatedReach={estimatedReach}
            onCreateSegment={loadSegments}
          />
        )}

        {currentStep === 3 && (
          <StepMessage
            campaignData={campaignData}
            setCampaignData={setCampaignData}
            TemplateSelector={TemplateSelector}
          />
        )}

        {currentStep === 4 && (
          <StepSchedule campaignData={campaignData} setCampaignData={setCampaignData} />
        )}

        {currentStep === 5 && (
          <StepReview
            campaignData={campaignData}
            estimatedReach={estimatedReach}
            selectedSegments={selectedSegments}
          />
        )}
      </div>

      <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-8 py-6">
        <Button onClick={handleBack} type="button" variant="outline" size="lg">
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <div className="flex items-center gap-2">
          {steps.map(step => (
            <span
              key={step.number}
              className={`h-2 rounded-full transition-all ${
                currentStep === step.number
                  ? 'w-8 bg-blue-600'
                  : currentStep > step.number
                  ? 'w-4 bg-green-500'
                  : 'w-2 bg-gray-300'
              }`}
            />
          ))}
        </div>

        <Button
          onClick={currentStep === steps.length ? handleLaunch : handleNext}
          size="lg"
          className="bg-blue-600 hover:bg-blue-700"
          disabled={
            loadingCampaign ||
            (currentStep === 1 && !campaignData.name.trim()) ||
            (currentStep === 2 && campaignData.segmentIds.length === 0) ||
            (currentStep === 3 && !campaignData.messageContent.body.trim())
          }
        >
          {loadingCampaign
            ? 'Loading...'
            : currentStep === steps.length
            ? isEditMode
              ? 'Update Campaign'
              : 'Launch Campaign'
            : (
              <>
                Continue
                <ChevronRight className="ml-2 h-4 w-4" />
              </>
            )}
        </Button>
      </div>
    </div>
  );
}

function StepDetails({
  campaignData,
  setCampaignData,
}: {
  campaignData: CampaignFormData;
  setCampaignData: React.Dispatch<React.SetStateAction<CampaignFormData>>;
}) {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h3 className="text-xl font-bold text-gray-900">Campaign Details</h3>

      <div>
        <Label htmlFor="name" className="mb-2 block text-base font-semibold">
          Campaign Name *
        </Label>
        <Input
          id="name"
          value={campaignData.name}
          onChange={event => setCampaignData(prev => ({ ...prev, name: event.target.value }))}
          placeholder="e.g., Diwali Flash Sale 2024"
          className="text-base"
        />
      </div>

      <div>
        <Label htmlFor="description" className="mb-2 block text-base font-semibold">
          Description (Optional)
        </Label>
        <Textarea
          id="description"
          value={campaignData.description}
          onChange={event => setCampaignData(prev => ({ ...prev, description: event.target.value }))}
          placeholder="Describe the purpose of this campaign..."
          rows={3}
          className="text-base"
        />
      </div>

      <Label className="text-base font-semibold">Labels (Optional)</Label>
      <div className="space-y-2">
        {['Promotional', 'Transactional', 'Follow-up', 'Seasonal', 'Retention'].map(labelValue => (
          <label key={labelValue} className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={campaignData.labels.includes(labelValue)}
              onChange={event =>
                setCampaignData(prev => ({
                  ...prev,
                  labels: event.target.checked
                    ? [...prev.labels, labelValue]
                    : prev.labels.filter(label => label !== labelValue),
                }))
              }
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700">
              {labelValue}
            </span>
          </label>
        ))}
      </div>

      <div>
        <Label className="mb-2 block text-base font-semibold">Campaign Type *</Label>
        <select
          value={campaignData.type}
          onChange={event =>
            setCampaignData(prev => ({ ...prev, type: event.target.value as CampaignType }))
          }
          className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-transparent focus:ring-2 focus:ring-blue-500"
        >
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
    </div>
  );
}

function StepAudience({
  campaignData,
  setCampaignData,
  segments,
  loadingSegments,
  estimatedReach,
  onCreateSegment,
}: {
  campaignData: CampaignFormData;
  setCampaignData: React.Dispatch<React.SetStateAction<CampaignFormData>>;
  segments: CustomerSegment[];
  loadingSegments: boolean;
  estimatedReach: number;
  onCreateSegment: () => void;
}) {
  const [createSegmentModalOpen, setCreateSegmentModalOpen] = useState(false);

  const handleSegmentCreated = (newSegment: Segment) => {
    // Auto-select the newly created segment (CreateSegmentModal returns Segment)
    setCampaignData(prev => ({
      ...prev,
      segmentIds: [...prev.segmentIds, newSegment.id],
    }));
    // Refresh segments list
    onCreateSegment();
    setCreateSegmentModalOpen(false);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-gray-900">Select Your Audience</h3>
        <Button
          type="button"
          variant="outline"
          onClick={() => setCreateSegmentModalOpen(true)}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Create New Segment
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
          <Button variant="outline" onClick={() => setCreateSegmentModalOpen(true)}>
            <Users className="mr-2 h-4 w-4" />
            Create New Segment
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {segments.map(segment => {
            const isSelected = campaignData.segmentIds.includes(segment.id);
            return (
              <button
                key={segment.id}
                onClick={() =>
                  setCampaignData(prev => ({
                    ...prev,
                    segmentIds: isSelected
                      ? prev.segmentIds.filter(id => id !== segment.id)
                      : [...prev.segmentIds, segment.id],
                  }))
                }
                className={`rounded-xl border-2 p-4 text-left transition-all ${
                  isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="mb-1 font-semibold text-gray-900">{segment.name}</h4>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span>{(segment.customerCount ?? 0).toLocaleString()} customers</span>
                      <span>₹{Math.round((segment.totalRevenue ?? 0) / 1000)}k revenue</span>
                    </div>
                  </div>
                  {isSelected ? (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600">
                      <Check className="h-4 w-4 text-white" />
                    </div>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Create Segment Modal */}
      {createSegmentModalOpen && (
        <CreateSegmentModal
          segment={null}
          onClose={() => setCreateSegmentModalOpen(false)}
          onSave={handleSegmentCreated}
        />
      )}
    </div>
  );
}

function StepMessage({
  campaignData,
  setCampaignData,
  TemplateSelector,
}: {
  campaignData: CampaignFormData;
  setCampaignData: React.Dispatch<React.SetStateAction<CampaignFormData>>;
  TemplateSelector: React.ComponentType<TemplateSelectorProps>;
}) {
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<WhatsAppTemplate | null>(null);
  const [bodyFields, setBodyFields] = useState<any[]>(campaignData.whatsappConfig?.bodyFields || []);
  const [variableMappings, setVariableMappings] = useState<any[]>(campaignData.whatsappConfig?.variableMappings || []);
  const [variablePreview, setVariablePreview] = useState<Record<string, string>>({});

  // Load templates
  useEffect(() => {
    const loadTemplates = async () => {
      setTemplatesLoading(true);
      try {
        const response = await fetch('/api/whatsapp/templates', { cache: 'no-store' });
        const data = await response.json();
        if (response.ok && data.templates) {
          setTemplates(data.templates);
          // Find selected template if templateId exists
          if (campaignData.templateId) {
            const template = data.templates.find((t: WhatsAppTemplate) => t.id === campaignData.templateId);
            if (template) setSelectedTemplate(template);
          }
        }
      } catch (error) {
        console.error('Failed to load templates:', error);
      } finally {
        setTemplatesLoading(false);
      }
    };
    loadTemplates();
  }, [campaignData.templateId]);

  // Update variable preview when mappings change
  useEffect(() => {
    const preview: Record<string, string> = {};
    variableMappings.forEach(mapping => {
      preview[mapping.variable] = mapping.fallbackValue || mapping.dataSource || 'Sample';
    });
    setVariablePreview(preview);
  }, [variableMappings]);

  const handleTemplateSelect = (template: WhatsAppTemplate) => {
    setSelectedTemplate(template);
    setCampaignData(prev => ({
      ...prev,
      templateId: template.id,
      messageContent: { ...prev.messageContent, body: template.body || template.content || '' },
    }));
  };

  const handleConfigChange = (updates: any) => {
    setCampaignData(prev => ({
      ...prev,
      whatsappConfig: {
        ...prev.whatsappConfig,
        ...updates,
      },
    }));
  };

  const handleSendTest = async (phone: string) => {
    try {
      const response = await fetch('/api/whatsapp/send-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: selectedTemplate?.id,
          phoneNumber: phone,
          variables: variablePreview,
        }),
      });
      if (!response.ok) throw new Error('Failed to send test');
    } catch (error) {
      throw error;
    }
  };

  // Build WhatsApp config from campaign data
  const whatsappConfig: any = {
    templateId: selectedTemplate?.id || '',
    templateName: selectedTemplate?.name || '',
    templateStatus: selectedTemplate?.status || 'APPROVED',
    templateLanguage: selectedTemplate?.language || '',
    templateCategory: selectedTemplate?.category || '',
    variableMappings,
    bodyFields,
    sendWindow: campaignData.whatsappConfig?.sendWindow || {
      daysOfWeek: [1, 2, 3, 4, 5],
      startTime: '09:00',
      endTime: '21:00',
      timezone: 'customer',
    },
    rateLimiting: campaignData.whatsappConfig?.rateLimiting || {
      maxPerDay: 3,
      maxPerWeek: 10,
    },
    failureHandling: campaignData.whatsappConfig?.failureHandling || {
      retryCount: 1,
      retryDelay: 15,
      fallbackAction: 'continue',
    },
    skipIfOptedOut: true,
    exitPaths: campaignData.whatsappConfig?.exitPaths || {},
    mediaUrl: campaignData.whatsappConfig?.mediaUrl,
    useDynamicMedia: campaignData.whatsappConfig?.useDynamicMedia || false,
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <h3 className="text-xl font-bold text-gray-900">Create Your WhatsApp Message</h3>

      {/* Unified WhatsApp Configuration */}
      <UnifiedWhatsAppConfig
        templates={templates}
        templatesLoading={templatesLoading}
        selectedTemplate={selectedTemplate}
        config={whatsappConfig}
        bodyFields={bodyFields}
        variableMappings={variableMappings}
        variablePreview={variablePreview}
        onTemplateSelect={handleTemplateSelect}
        onBodyFieldChange={(fields) => {
          setBodyFields(fields);
          handleConfigChange({ bodyFields: fields });
        }}
        onVariableMappingsChange={(mappings) => {
          setVariableMappings(mappings);
          handleConfigChange({ variableMappings: mappings });
        }}
        onSendTest={handleSendTest}
        dataSources={[]}
        triggerContext="generic"
        validationErrors={[]}
      />

      {/* Advanced Settings */}
      <AdvancedWhatsAppSettings
        config={whatsappConfig}
        selectedTemplate={selectedTemplate}
        bodyFields={bodyFields}
        variableMappings={variableMappings}
        variablePreview={variablePreview}
        onConfigChange={handleConfigChange}
        onBodyFieldChange={(fields) => {
          setBodyFields(fields);
          handleConfigChange({ bodyFields: fields });
        }}
        onVariableMappingsChange={(mappings) => {
          setVariableMappings(mappings);
          handleConfigChange({ variableMappings: mappings });
        }}
        onSendTest={handleSendTest}
        dataSources={[]}
        triggerContext="generic"
      />
    </div>
  );
}

function StepSchedule({
  campaignData,
  setCampaignData,
}: {
  campaignData: CampaignFormData;
  setCampaignData: React.Dispatch<React.SetStateAction<CampaignFormData>>;
}) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h3 className="text-xl font-bold text-gray-900">Schedule Your Campaign</h3>

      <div className="grid gap-4 text-sm">
        <div>
          <Label className="mb-2 block font-semibold">Schedule Type</Label>
          <select
            value={campaignData.scheduleType}
            onChange={event =>
              setCampaignData(prev => ({
                ...prev,
                scheduleType: event.target.value as ScheduleType,
              }))
            }
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-transparent focus:ring-2 focus:ring-blue-500"
          >
            <option value="IMMEDIATE">Send immediately</option>
            <option value="SCHEDULED">Schedule for later</option>
            <option value="RECURRING">Recurring schedule</option>
          </select>
        </div>

        {campaignData.scheduleType === 'SCHEDULED' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="scheduledAt" className="mb-2 block font-semibold">
                Scheduled Date & Time
              </Label>
              <Input
                id="scheduledAt"
                type="datetime-local"
                value={
                  campaignData.scheduledAt
                    ? new Date(campaignData.scheduledAt).toISOString().slice(0, 16)
                    : ''
                }
                onChange={event =>
                  setCampaignData(prev => ({
                    ...prev,
                    scheduledAt: event.target.value ? Date.parse(event.target.value) : undefined,
                  }))
                }
              />
            </div>
            <div>
              <Label htmlFor="timezone" className="mb-2 block font-semibold">
                Timezone
              </Label>
              <select
                id="timezone"
                value={campaignData.timezone}
                onChange={event =>
                  setCampaignData(prev => ({
                    ...prev,
                    timezone: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-blue-500"
              >
                <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                <option value="America/New_York">America/New_York (EST)</option>
                <option value="Europe/London">Europe/London (GMT)</option>
              </select>
            </div>
          </div>
        )}
      </div>

      <div>
        <Label className="mb-3 block text-base font-semibold">Sending Speed</Label>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {speedOptions.map(option => (
            <button
              key={option.value}
              onClick={() =>
                setCampaignData(prev => ({
                  ...prev,
                  sendingSpeed: option.value,
                }))
              }
              className={`rounded-xl border-2 p-4 transition-all ${
                campaignData.sendingSpeed === option.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-blue-300'
              }`}
            >
              <div className="text-sm font-semibold text-gray-900">{option.label}</div>
              <div className="text-xs text-gray-600">{option.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function StepReview({
  campaignData,
  selectedSegments,
  estimatedReach,
}: {
  campaignData: CampaignFormData;
  selectedSegments: CustomerSegment[];
  estimatedReach: number;
}) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h3 className="text-xl font-bold text-gray-900">Review & Launch Campaign</h3>

      <div className="rounded-xl border-2 border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-600 text-xl text-white">
            ✓
          </div>
          <div>
            <h4 className="mb-2 text-lg font-bold text-gray-900">Campaign ready to launch</h4>
            <p className="text-gray-700">Review all details below and click “Launch Campaign”.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <ReviewCard
          title="Campaign Details"
          icon={<Sparkles className="h-5 w-5 text-blue-600" />}
          items={[
            { label: 'Name', value: campaignData.name || 'Untitled' },
            { label: 'Channel', value: 'WhatsApp' },
            { label: 'Type', value: campaignData.type.replace('_', ' ') },
          ]}
        />
        <ReviewCard
          title="Audience"
          icon={<Users className="h-5 w-5 text-purple-600" />}
          items={[
            { label: 'Segments', value: `${campaignData.segmentIds.length} selected` },
            { label: 'Est. Reach', value: `${estimatedReach.toLocaleString()} customers` },
          ]}
        />
        <ReviewCard
          title="Message"
          icon={<MessageSquare className="h-5 w-5 text-green-600" />}
          content={campaignData.messageContent.body || 'No message content'}
        />
        <ReviewCard
          title="Schedule"
          icon={<Calendar className="h-5 w-5 text-orange-600" />}
          items={[
            {
              label: 'Type',
              value:
                campaignData.scheduleType === 'IMMEDIATE'
                  ? 'Send Now'
                  : campaignData.scheduleType === 'SCHEDULED'
                  ? 'Scheduled'
                  : 'Recurring',
            },
            campaignData.scheduledAt
              ? {
                  label: 'Date & Time',
                  value: new Date(campaignData.scheduledAt).toLocaleString(),
                }
              : undefined,
          ].filter(Boolean) as Array<{ label: string; value: string }>}
        />
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
        <h4 className="mb-2 font-semibold text-gray-900">Selected Segments</h4>
        <ul className="list-disc space-y-1 pl-5">
          {selectedSegments.map(segment => (
            <li key={segment.id}>
              {segment.name} — {(segment.customerCount ?? 0).toLocaleString()} customers
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function TemplateSelector({ onSelectTemplate }: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<WhatsAppTemplateWithComponents[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/templates/whatsapp', { cache: 'no-store' });
      const payload = (await response.json().catch(() => ({}))) as TemplateListResponse;

      if (!response.ok) {
        throw new Error(payload.error ?? 'Failed to load templates');
      }

      setTemplates(payload.templates ?? []);
    } catch (err) {
      console.error('Failed to load templates', err);
      setError(getErrorMessage(err, 'Failed to load templates'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-6">
        <div className="flex items-center justify-center gap-3 py-8">
          <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
          <span className="text-gray-600">Loading approved templates...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <p className="mb-4 text-red-800">{error}</p>
        <Button variant="outline" size="sm" onClick={loadTemplates}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-6">
        <p className="mb-2 font-semibold text-yellow-800">No approved templates available.</p>
        <p className="mb-4 text-sm text-yellow-700">
          Create and approve templates in WhatsApp Manager to use them here.
        </p>
        <a
          href="https://business.facebook.com/wa/manage/message-templates/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-600 hover:underline"
        >
          Open WhatsApp Manager →
        </a>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-6">
      <div className="mb-4 flex items-center justify-between">
        <Label className="text-base font-semibold">Select Approved Template (Optional)</Label>
        <Button variant="outline" size="sm" onClick={loadTemplates}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>
      <select
        value={selectedTemplate}
        onChange={event => {
          const templateId = event.target.value;
          setSelectedTemplate(templateId);
          const template = templates.find(item => item.id === templateId);
          if (template) onSelectTemplate(template);
        }}
        className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-transparent focus:ring-2 focus:ring-blue-500"
      >
        <option value="">Select a template…</option>
        {templates.map(template => (
          <option key={template.id} value={template.id}>
            {template.name} ({template.language}) — {template.category}
          </option>
        ))}
      </select>
      {selectedTemplate && (
        <div className="mt-3 flex items-center gap-2 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4" />
          <span>Template selected: {templates.find(item => item.id === selectedTemplate)?.name}</span>
        </div>
      )}
    </div>
  );
}

function AudienceStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border-2 p-4 ${accent ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-white'}`}>
      <div className="text-sm text-gray-600">{label}</div>
      <div className={`text-2xl font-bold ${accent ? 'text-blue-600' : 'text-gray-900'}`}>{value}</div>
    </div>
  );
}

function ReviewCard({
  title,
  icon,
  items,
  content,
}: {
  title: string;
  icon: React.ReactNode;
  items?: Array<{ label: string; value: string }>;
  content?: string;
}) {
  return (
    <div className="rounded-xl border-2 border-gray-200 bg-white p-6">
      <h5 className="mb-4 flex items-center gap-2 font-semibold text-gray-900">
        {icon}
        {title}
      </h5>
      {items ? (
        <dl className="space-y-2 text-sm">
          {items.map(item => (
            <div key={`${item.label}-${item.value}`} className="flex justify-between">
              <dt className="text-gray-600">{item.label}</dt>
              <dd className="font-medium text-gray-900">{item.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <div className="bg-gray-50 text-sm text-gray-700">{content ?? 'No details available.'}</div>
      )}
    </div>
  );
}

function routerRedirect(path: string) {
  if (typeof window !== 'undefined') {
    window.location.href = path;
  }
}

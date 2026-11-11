"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Send, CheckCircle2, XCircle, Loader2, MessageSquare, Link2, LayoutGrid, LockKeyhole } from "lucide-react";
import { MobilePreview } from "@/components/journeys/MobilePreview";
import { WhatsAppMessageEditor } from "./WhatsAppMessageEditor";
import TemplatePickerModal from "@/components/campaigns/TemplatePickerModal";
import { UTMBuilder } from "@/components/journeys/builder/utm/UTMBuilder";
import TemplateRuntimeFields from '@/components/templates/TemplateRuntimeFields';
import type { WhatsAppTemplate, WhatsAppActionConfig, WhatsAppBodyField, VariableMapping } from "@/lib/types/whatsapp-config";
import { cn } from "@/lib/utils";
import { getJourneyEventFields } from '@/lib/journeys/event-schema';
import { dynamicUrlParameters } from '@/lib/whatsapp/template-runtime';

interface UnifiedWhatsAppConfigProps {
  templates: WhatsAppTemplate[];
  templatesLoading?: boolean;
  selectedTemplate: WhatsAppTemplate | null;
  config: WhatsAppActionConfig;
  bodyFields: WhatsAppBodyField[];
  variableMappings: VariableMapping[];
  variablePreview: Record<string, string>;
  onTemplateSelect: (template: WhatsAppTemplate) => void;
  onBodyFieldChange: (fields: WhatsAppBodyField[]) => void;
  onVariableMappingsChange: (mappings: VariableMapping[]) => void;
  onConfigChange?: (updates: Partial<WhatsAppActionConfig>) => void;
  onSendTest?: (phone: string) => Promise<void>;
  dataSources?: any[];
  triggerContext?: "generic" | "order" | "product";
  eventName?: string;
  validationErrors?: string[];
}

export function UnifiedWhatsAppConfig({
  templates,
  templatesLoading = false,
  selectedTemplate,
  config,
  bodyFields,
  variableMappings,
  variablePreview,
  onTemplateSelect,
  onBodyFieldChange,
  onVariableMappingsChange,
  onConfigChange = () => undefined,
  onSendTest,
  dataSources = [],
  triggerContext = "generic",
  eventName,
  validationErrors = [],
}: UnifiedWhatsAppConfigProps) {
  const handleBodyFieldChange = (fieldId: string, value: string) => {
    onBodyFieldChange(
      bodyFields.map(field => (field.id === fieldId ? { ...field, value } : field))
    );
  };

  const [testPhone, setTestPhone] = useState("");
  const [testStatus, setTestStatus] = useState<null | 'sending' | 'success' | 'error'>(null);
  const [testResult, setTestResult] = useState<{ messageId?: string; error?: string } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const layoutRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const defaultedRuntimeMapping = useRef<string>('');
  const dynamicLinks = useMemo(() => dynamicUrlParameters(selectedTemplate), [selectedTemplate]);
  const headerParameters = useMemo(
    () => (selectedTemplate?.runtimeParameters ?? []).filter(parameter => parameter.component === 'HEADER'),
    [selectedTemplate],
  );
  const eventUrlFields = useMemo(() => getJourneyEventFields(eventName, ['url']), [eventName]);

  useEffect(() => {
    if (!selectedTemplate || eventName !== 'custom:abandoned_cart' || dynamicLinks.length === 0) return;
    const key = `${selectedTemplate.id}:${eventName}`;
    if (defaultedRuntimeMapping.current === key) return;
    defaultedRuntimeMapping.current = key;
    const parameter = dynamicLinks[0];
    const existing = config.componentMappings?.find(mapping => mapping.parameterId === parameter.id);
    if (existing) return;
    onConfigChange({
      componentMappings: [
        ...(config.componentMappings ?? []).filter(mapping => mapping.parameterId !== parameter.id),
        {
          parameterId: parameter.id,
          component: parameter.component,
          componentIndex: parameter.componentIndex,
          parameterName: parameter.parameterName,
          dataSource: 'event',
          property: 'checkout_url',
        },
      ],
      useCheckoutRecoveryUrl: true,
    });
  }, [config.componentMappings, dynamicLinks, eventName, onConfigChange, selectedTemplate]);

  const updateDynamicLinkMapping = (parameterId: string, property: string) => {
    const parameter = dynamicLinks.find(item => item.id === parameterId);
    if (!parameter) return;
    onConfigChange({
      componentMappings: [
        ...(config.componentMappings ?? []).filter(mapping => mapping.parameterId !== parameterId),
        {
          parameterId,
          component: parameter.component,
          componentIndex: parameter.componentIndex,
          parameterName: parameter.parameterName,
          dataSource: 'event',
          property,
        },
      ],
      useCheckoutRecoveryUrl: property === 'checkout_url',
    });
  };

  const handleSendTest = async () => {
    if (!testPhone || !onSendTest) return;
    setTestStatus('sending');
    setTestResult(null);
    try {
      await onSendTest(testPhone);
      setTestStatus('success');
      setTestResult({ messageId: 'test-' + Date.now() });
    } catch (error) {
      setTestStatus('error');
      setTestResult({
        error: error instanceof Error ? error.message : 'Failed to send test message'
      });
    }
  };

  useEffect(() => {
    if (!layoutRef.current) return;
    const observer = new ResizeObserver(entries => {
      const entry = entries[0];
      if (entry) setContainerWidth(entry.contentRect.width);
    });
    observer.observe(layoutRef.current);
    return () => observer.disconnect();
  }, []);

  const shouldStack = containerWidth > 0 && containerWidth < 680;
  const previewScale = containerWidth < 400 ? 0.75 : containerWidth < 700 ? 0.82 : 0.9;

  return (
    <div
      ref={layoutRef}
      className={cn(
        "h-full min-h-0 gap-4",
        shouldStack ? "flex flex-col overflow-y-auto" : "grid grid-cols-[1fr_320px]",
      )}
    >
      {/* ── Left: Configuration ── */}
      <div className={cn("flex min-h-0 flex-col", shouldStack ? "" : "overflow-hidden")}>
        <div className={cn("space-y-4", shouldStack ? "" : "h-full overflow-y-auto pr-1")}>

          {/* Template Selection */}
          <section className="space-y-2.5">
            <label className="flex items-center gap-2 text-[13px] font-semibold text-[#4A4139]">
              <MessageSquare className="h-3.5 w-3.5 text-[#D4A574]" />
              Template
            </label>

            {selectedTemplate ? (
              /* Selected template info pill + Change */
              <div className="flex items-center gap-2 rounded-lg border border-[#E8E4DE] bg-[#FAF9F6] px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-[#4A4139] truncate">{selectedTemplate.name}</p>
                  <p className="text-[11px] text-[#8B7F76] line-clamp-2 leading-relaxed">
                    {selectedTemplate.body || selectedTemplate.content || "No preview available"}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    selectedTemplate.status === "APPROVED" && "bg-green-50 text-green-700",
                    selectedTemplate.status === "PENDING" && "bg-yellow-50 text-yellow-700",
                    selectedTemplate.status === "REJECTED" && "bg-red-50 text-red-700",
                  )}
                >
                  {selectedTemplate.status}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPickerOpen(true)}
                  className="h-8 shrink-0 border-[#E8E4DE] text-xs"
                >
                  Change
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                disabled={templatesLoading}
                className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[#E8E4DE] bg-[#FAF9F6] px-4 py-4 text-sm font-medium text-[#7D6248] transition-colors hover:border-[#D4A574] hover:bg-[#F3EDE6] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {templatesLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-[#D4A574]" /> Loading templates…
                  </>
                ) : (
                  <>
                    <LayoutGrid className="h-4 w-4 text-[#D4A574]" /> Choose Template
                  </>
                )}
              </button>
            )}

            <TemplatePickerModal
              key={pickerOpen ? `open-${selectedTemplate?.id ?? "none"}` : "closed"}
              open={pickerOpen}
              onClose={() => setPickerOpen(false)}
              templates={templates}
              templatesLoading={templatesLoading}
              selectedTemplateId={selectedTemplate?.id ?? null}
              onSelect={onTemplateSelect}
            />
          </section>

          {/* Variable Mapping */}
          {selectedTemplate ? (
            <section className="space-y-2.5">
              <label className="text-[13px] font-semibold text-[#4A4139]">Variables</label>
              <WhatsAppMessageEditor
                template={selectedTemplate}
                bodyFields={bodyFields}
                onBodyFieldChange={handleBodyFieldChange}
                onInsertVariable={() => undefined}
                variableMappings={variableMappings}
                onVariableMappingsChange={onVariableMappingsChange}
                variableErrors={{}}
                dataSources={dataSources}
                triggerContext={triggerContext}
                useEnhancedMapper={true}
                showPreview={false}
              />
            </section>
          ) : null}

          {selectedTemplate && headerParameters.some(parameter => parameter.parameterType === 'text') ? (
            <TemplateRuntimeFields
              template={{ ...selectedTemplate, buttons: [] }}
              config={config}
              onChange={onConfigChange}
            />
          ) : null}

          {selectedTemplate && headerParameters.some(parameter => ['image', 'video', 'document'].includes(parameter.parameterType)) ? (
            <section className="space-y-3 rounded-xl border border-[#E8E4DE] bg-white p-4">
              <div className="flex items-center gap-2">
                <LockKeyhole className="h-4 w-4 text-[#D4A574]" />
                <div>
                  <p className="text-[13px] font-semibold text-[#4A4139]">Required {selectedTemplate.mediaType?.toLowerCase()} header</p>
                  <p className="text-[11px] text-[#8B7F76]">This field is shown because the approved Meta template requires it.</p>
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-[#4A4139]">
                <input
                  type="checkbox"
                  checked={config.useDynamicMedia ?? false}
                  onChange={event => onConfigChange({ useDynamicMedia: event.target.checked, mediaUrl: event.target.checked ? undefined : config.mediaUrl })}
                />
                Use product image from the journey event
              </label>
              {!config.useDynamicMedia ? (
                <Input
                  type="url"
                  placeholder="https://…"
                  value={config.mediaUrl ?? ''}
                  onChange={event => onConfigChange({ mediaUrl: event.target.value })}
                />
              ) : null}
            </section>
          ) : null}

          {selectedTemplate && dynamicLinks.length > 0 ? (
            <section className="space-y-3 rounded-xl border border-[#E8E4DE] bg-white p-4">
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-[#D4A574]" />
                <div>
                  <p className="text-[13px] font-semibold text-[#4A4139]">Dynamic button link</p>
                  <p className="text-[11px] text-[#8B7F76]">Only the approved dynamic portion can be mapped.</p>
                </div>
              </div>
              {dynamicLinks.map(parameter => {
                const mapping = config.componentMappings?.find(item => item.parameterId === parameter.id);
                const selectedField = eventUrlFields.find(field => field.path === mapping?.property);
                const preview = selectedField?.sample ?? parameter.example;
                const suffix = preview && parameter.approvedPrefix && preview.startsWith(parameter.approvedPrefix)
                  ? preview.slice(parameter.approvedPrefix.length)
                  : preview;
                return (
                  <div key={parameter.id} className="space-y-2 rounded-lg bg-[#FAF9F6] p-3">
                    <label className="text-xs font-medium text-[#4A4139]">{parameter.label || `Button ${parameter.componentIndex + 1}`}</label>
                    <div className="flex items-center rounded-lg border border-[#E8E4DE] bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      <LockKeyhole className="mr-2 h-3.5 w-3.5" />
                      <span className="truncate">{parameter.approvedPrefix}</span>
                      <span className="font-mono text-[#B7791F]">{'{{dynamic}}'}</span>
                    </div>
                    <select
                      value={mapping?.property ?? ''}
                      onChange={event => updateDynamicLinkMapping(parameter.id, event.target.value)}
                      className="w-full rounded-lg border border-[#E8E4DE] bg-white px-3 py-2 text-sm text-[#4A4139]"
                    >
                      <option value="" disabled>Select event URL</option>
                      {eventUrlFields.map(field => <option key={field.path} value={field.path}>{field.label}</option>)}
                    </select>
                    {preview ? (
                      <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                        <span className="font-semibold">Preview data:</span> {parameter.approvedPrefix}{suffix}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </section>
          ) : selectedTemplate?.hasButtons ? (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">This template has only static buttons; no link mapping is required.</p>
          ) : null}

          {/* Test Send — compact inline */}
          {selectedTemplate && onSendTest ? (
            <section className="space-y-2">
              <label className="flex items-center gap-2 text-[13px] font-semibold text-[#4A4139]">
                <Send className="h-3.5 w-3.5 text-[#D4A574]" />
                Send Test
              </label>
              <div className="flex gap-2">
                <Input
                  placeholder="+91 98765 43210"
                  value={testPhone}
                  onChange={event => setTestPhone(event.target.value)}
                  className="h-9 flex-1 border-[#E8E4DE] text-sm focus-visible:ring-[#D4A574]"
                />
                <Button
                  onClick={handleSendTest}
                  disabled={!testPhone || testStatus === "sending"}
                  size="sm"
                  className="h-9 bg-[#D4A574] text-white hover:bg-[#B8835D]"
                >
                  {testStatus === "sending" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>

              {testStatus === "success" ? (
                <p className="flex items-center gap-1.5 text-[12px] text-green-700">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Sent successfully
                </p>
              ) : null}

              {testStatus === "error" && testResult?.error ? (
                <p className="flex items-center gap-1.5 text-[12px] text-red-600">
                  <XCircle className="h-3.5 w-3.5" /> {testResult.error}
                </p>
              ) : null}
            </section>
          ) : null}

          {/* UTM Builder */}
          <details className="group rounded-lg border border-[#E8E4DE]">
            <summary className="flex cursor-pointer items-center gap-2 px-3 py-2.5 text-[13px] font-semibold text-[#4A4139] hover:bg-[#FAF9F6] rounded-lg select-none">
              <Link2 className="h-3.5 w-3.5 text-[#D4A574]" />
              Link Tracking (UTM)
              <span className="ml-auto text-[11px] font-normal text-[#B9AA9F] group-open:hidden">expand</span>
            </summary>
            <div className="border-t border-[#E8E4DE] px-3 py-3">
              <UTMBuilder journeyName={config.templateName || undefined} />
            </div>
          </details>

          {/* Validation Errors */}
          {validationErrors.length ? (
            <Alert className="border-red-200 bg-red-50">
              <XCircle className="h-4 w-4 text-red-600" />
              <AlertDescription>
                <ul className="list-disc list-inside space-y-1">
                  {validationErrors.map((error, idx) => (
                    <li key={idx} className="text-sm text-red-800">{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          ) : null}
        </div>
      </div>

      {/* ── Right: Live Preview ── */}
      <div
        className={cn(
          "flex flex-col rounded-xl border border-[#E8E4DE] bg-[#FAF9F6]",
          shouldStack ? "mt-2" : "min-h-0",
        )}
      >
        <div className="flex items-center justify-between border-b border-[#E8E4DE] px-3 py-2">
          <span className="text-[12px] font-semibold text-[#8B7F76]">Preview</span>
          {selectedTemplate ? (
            <span className="text-[11px] text-[#B9AA9F]">{selectedTemplate.language?.toUpperCase()}</span>
          ) : null}
        </div>
        <div className={cn("flex-1 overflow-y-auto", shouldStack ? "py-4" : "py-3")}>
          <div className="flex justify-center px-2">
            {selectedTemplate ? (
              <div
                className="origin-top"
                style={{
                  transform: `scale(${previewScale})`,
                  transition: "transform 200ms ease",
                }}
              >
                <MobilePreview template={selectedTemplate} variableValues={variablePreview} />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#E8E4DE]">
                  <MessageSquare className="h-5 w-5 text-[#8B7F76]" />
                </div>
                <p className="text-[13px] font-medium text-[#8B7F76]">No template selected</p>
                <p className="mt-1 text-[11px] text-[#B9AA9F]">Choose a template to see the preview</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

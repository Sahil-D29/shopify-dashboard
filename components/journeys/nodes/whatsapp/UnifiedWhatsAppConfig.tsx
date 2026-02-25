"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Send, CheckCircle2, XCircle, Loader2, Search, MessageSquare, Link2 } from "lucide-react";
import { MobilePreview } from "@/components/journeys/MobilePreview";
import { WhatsAppMessageEditor } from "./WhatsAppMessageEditor";
import { UTMBuilder } from "@/components/journeys/builder/utm/UTMBuilder";
import type { WhatsAppTemplate, WhatsAppActionConfig, WhatsAppBodyField, VariableMapping } from "@/lib/types/whatsapp-config";
import { normalizeVariableToken } from "@/lib/whatsapp/template-utils";
import { cn } from "@/lib/utils";

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
  onSendTest?: (phone: string) => Promise<void>;
  dataSources?: any[];
  triggerContext?: "generic" | "order" | "product";
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
  onSendTest,
  dataSources = [],
  triggerContext = "generic",
  validationErrors = [],
}: UnifiedWhatsAppConfigProps) {
  const handleBodyFieldChange = (fieldId: string, value: string) => {
    onBodyFieldChange(
      bodyFields.map(field => (field.id === fieldId ? { ...field, value } : field))
    );
  };

  const [searchQuery, setSearchQuery] = useState("");
  const [testPhone, setTestPhone] = useState("");
  const [testStatus, setTestStatus] = useState<null | 'sending' | 'success' | 'error'>(null);
  const [testResult, setTestResult] = useState<{ messageId?: string; error?: string } | null>(null);
  const layoutRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  const filteredTemplates = useMemo(() => {
    if (!searchQuery.trim()) return templates;
    const query = searchQuery.toLowerCase();
    return templates.filter(t =>
      t.name.toLowerCase().includes(query) ||
      t.category.toLowerCase().includes(query) ||
      t.body?.toLowerCase().includes(query)
    );
  }, [templates, searchQuery]);

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
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#B9AA9F]" />
              <Input
                placeholder="Search templates..."
                value={searchQuery}
                onChange={event => setSearchQuery(event.target.value)}
                className="h-9 border-[#E8E4DE] pl-9 text-sm focus-visible:ring-[#D4A574]"
              />
            </div>
            <Select
              value={selectedTemplate?.id || ""}
              onValueChange={value => {
                const template = filteredTemplates.find(t => t.id === value);
                if (template) onTemplateSelect(template);
              }}
              disabled={templatesLoading}
            >
              <SelectTrigger className="h-9 w-full border-[#E8E4DE] text-sm focus:ring-[#D4A574]">
                <SelectValue placeholder={templatesLoading ? "Loading..." : "Choose a template"} />
              </SelectTrigger>
              <SelectContent className="max-h-[260px]">
                {filteredTemplates.length ? (
                  filteredTemplates.map(template => (
                    <SelectItem key={template.id} value={template.id} className="py-2">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium leading-tight">{template.name}</span>
                        <span className="text-[11px] text-[#8B7F76]">
                          {template.category} &middot; {template.language.toUpperCase()}
                        </span>
                      </div>
                    </SelectItem>
                  ))
                ) : (
                  <div className="px-2 py-6 text-center text-sm text-[#8B7F76]">
                    {templatesLoading ? "Loading templates..." : "No templates found"}
                  </div>
                )}
              </SelectContent>
            </Select>

            {/* Selected template info pill */}
            {selectedTemplate ? (
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
              </div>
            ) : null}
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
              />
            </section>
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

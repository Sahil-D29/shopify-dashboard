"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Send, CheckCircle2, XCircle, Loader2, Search } from "lucide-react";
import { MobilePreview } from "@/components/journeys/MobilePreview";
import { WhatsAppMessageEditor } from "./WhatsAppMessageEditor";
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

  // Filter templates based on search
  const filteredTemplates = useMemo(() => {
    if (!searchQuery.trim()) return templates;
    const query = searchQuery.toLowerCase();
    return templates.filter(t => 
      t.name.toLowerCase().includes(query) ||
      t.category.toLowerCase().includes(query) ||
      t.body?.toLowerCase().includes(query)
    );
  }, [templates, searchQuery]);

  // Handle test send
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
      if (entry) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(layoutRef.current);
    return () => observer.disconnect();
  }, []);

  const layoutMode = useMemo(() => {
    if (!containerWidth) return "desktop";
    if (containerWidth <= 400) return "xxs";
    if (containerWidth <= 600) return "xs";
    if (containerWidth <= 800) return "sm";
    if (containerWidth <= 1100) return "md";
    return "lg";
  }, [containerWidth]);

  const shouldStackPanels = layoutMode !== "lg";
  const previewScale =
    layoutMode === "xxs" ? 0.82 : layoutMode === "xs" ? 0.88 : layoutMode === "sm" ? 0.94 : layoutMode === "md" ? 0.97 : 1;

  return (
    <div
      ref={layoutRef}
      className={cn(
        "grid h-full min-h-0 gap-6 transition-all duration-300",
        shouldStackPanels ? "grid-cols-1" : "grid-cols-[minmax(300px,1fr)_minmax(280px,0.8fr)]",
      )}
    >
      {/* Left Column: Configuration */}
      <div
        className={cn(
          "min-w-[300px] rounded-2xl border border-[#E8E4DE] bg-white/95 shadow-sm transition-all duration-300",
          "flex min-h-0 flex-col",
        )}
      >
        <div className="flex items-center justify-between border-b border-[#F0EAE3] px-4 py-3 text-sm text-[#4A4139]">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-[#B9AA9F]">Template & Content</p>
            <p className="font-semibold">Configure Message</p>
          </div>
          {selectedTemplate ? (
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] font-semibold",
                selectedTemplate.status === "APPROVED" && "border-green-200 bg-green-50 text-green-700",
                selectedTemplate.status === "PENDING" && "border-yellow-200 bg-yellow-50 text-yellow-700",
                selectedTemplate.status === "REJECTED" && "border-red-200 bg-red-50 text-red-700",
              )}
            >
              {selectedTemplate.status}
            </Badge>
          ) : null}
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="space-y-5">
            {/* Template Selection */}
            <section className="space-y-3">
              <label className="text-sm font-semibold text-[#4A4139]">
                Select WhatsApp Template <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    placeholder="Search templates..."
                    value={searchQuery}
                    onChange={event => setSearchQuery(event.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <Select
                value={selectedTemplate?.id || ""}
                onValueChange={value => {
                  const template = filteredTemplates.find(t => t.id === value);
                  if (template) onTemplateSelect(template);
                }}
                disabled={templatesLoading}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={templatesLoading ? "Loading templates..." : "Select template"} />
                </SelectTrigger>
                <SelectContent className="max-h-[280px]">
                  {filteredTemplates.length ? (
                    filteredTemplates.map(template => (
                      <SelectItem key={template.id} value={template.id} className="py-2">
                        <div className="flex flex-col">
                          <span className="font-medium leading-tight">{template.name}</span>
                          <span className="text-xs text-gray-500">
                            {template.category} • {template.language.toUpperCase()}
                          </span>
                        </div>
                      </SelectItem>
                    ))
                  ) : (
                    <div className="px-2 py-6 text-center text-sm text-gray-500">
                      {templatesLoading ? "Loading templates..." : "No templates found"}
                    </div>
                  )}
                </SelectContent>
              </Select>

              {selectedTemplate ? (
                <div className="rounded-lg border border-[#E8E4DE] bg-[#FAF9F6] p-3 text-sm">
                  <p className="mb-1 text-[#4A4139] font-medium">{selectedTemplate.name}</p>
                  <p className="text-xs text-[#8B7F76] line-clamp-3">
                    {selectedTemplate.body || selectedTemplate.content || "No description"}
                  </p>
                </div>
              ) : null}
            </section>

            {/* Variable Mapping */}
            {selectedTemplate ? (
              <section className="space-y-3">
                <label className="text-sm font-semibold text-[#4A4139]">Configure Variables</label>
                <div className="rounded-2xl border border-[#E8E4DE] bg-white p-3">
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
                </div>
              </section>
            ) : null}

            {/* Test Send */}
            {selectedTemplate && onSendTest ? (
              <section className="space-y-3 rounded-2xl border border-[#E8E4DE] bg-white p-4">
                <label className="text-sm font-semibold text-[#4A4139]">Test Message</label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    placeholder="Enter phone number (e.g., +1234567890)"
                    value={testPhone}
                    onChange={event => setTestPhone(event.target.value)}
                    className="flex-1"
                  />
                  <Button onClick={handleSendTest} disabled={!testPhone || testStatus === "sending"} size="sm">
                    {testStatus === "sending" ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Send Test
                      </>
                    )}
                  </Button>
                </div>

                {testStatus === "success" ? (
                  <Alert className="border-green-200 bg-green-50">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">Test message sent successfully!</AlertDescription>
                  </Alert>
                ) : null}

                {testStatus === "error" && testResult?.error ? (
                  <Alert className="border-red-200 bg-red-50">
                    <XCircle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-800">{testResult.error}</AlertDescription>
                  </Alert>
                ) : null}
              </section>
            ) : null}

            {/* Validation Errors */}
            {validationErrors.length ? (
              <Alert className="border-red-200 bg-red-50">
                <XCircle className="h-4 w-4 text-red-600" />
                <AlertDescription>
                  <ul className="list-disc list-inside space-y-1">
                    {validationErrors.map((error, idx) => (
                      <li key={idx} className="text-sm text-red-800">
                        {error}
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            ) : null}
          </div>
        </div>
      </div>

      {/* Right Column: Mobile Preview */}
      <div
        className={cn(
          "min-w-[280px] rounded-2xl border border-[#E8E4DE] bg-white/95 shadow-sm transition-all duration-300",
          "flex min-h-0 flex-col",
        )}
      >
        <div className="flex items-center justify-between border-b border-[#F0EAE3] px-4 py-3">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-[#B9AA9F]">Live Preview</p>
            <p className="text-sm font-semibold text-[#4A4139]">Phone Mockup</p>
          </div>
          <span className="text-xs text-[#8B7F76]">
            {Math.round(previewScale * 100)}
            %
          </span>
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-4">
          <div className="flex justify-center">
            <div
              className="origin-top"
              style={{
                transform: `scale(${previewScale})`,
                transition: "transform 200ms ease",
              }}
            >
              <MobilePreview template={selectedTemplate} variableValues={variablePreview} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


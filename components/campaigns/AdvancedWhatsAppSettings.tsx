"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Settings, Clock, Route, TestTube } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WhatsAppMessageEditor } from "@/components/journeys/nodes/whatsapp/WhatsAppMessageEditor";
import { EnhancedDeliverySettings } from "@/components/journeys/nodes/whatsapp/EnhancedDeliverySettings";
import { ExitPathsConfig } from "@/components/journeys/nodes/whatsapp/ExitPathsConfig";
import { Step5TestValidate } from "@/components/journeys/nodes/whatsapp/Step5TestValidate";
import type { WhatsAppActionConfig, WhatsAppTemplate, WhatsAppBodyField, VariableMapping } from "@/lib/types/whatsapp-config";
import { cn } from "@/lib/utils";

interface AdvancedWhatsAppSettingsProps {
  config: WhatsAppActionConfig;
  selectedTemplate: WhatsAppTemplate | null;
  bodyFields: WhatsAppBodyField[];
  variableMappings: VariableMapping[];
  variablePreview: Record<string, string>;
  onConfigChange: (config: Partial<WhatsAppActionConfig>) => void;
  onBodyFieldChange: (fields: WhatsAppBodyField[]) => void;
  onVariableMappingsChange: (mappings: VariableMapping[]) => void;
  onSendTest?: (phone: string) => Promise<void>;
  dataSources?: any[];
  triggerContext?: "generic" | "order" | "product";
  className?: string;
  storageKey?: string;
}

export function AdvancedWhatsAppSettings({
  config,
  selectedTemplate,
  bodyFields,
  variableMappings,
  variablePreview,
  onConfigChange,
  onBodyFieldChange,
  onVariableMappingsChange,
  onSendTest,
  dataSources = [],
  triggerContext = "generic",
  className,
  storageKey = "whatsapp-advanced-settings-collapsed",
}: AdvancedWhatsAppSettingsProps) {
  const [isOpen, setIsOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const stored = window.localStorage.getItem(storageKey);
    if (stored === null) return false;
    return stored === "open";
  });
  const [activeTab, setActiveTab] = useState("variables");

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, isOpen ? "open" : "closed");
  }, [isOpen, storageKey]);

  const handleSendWindowChange = (sendWindow: WhatsAppActionConfig['sendWindow']) => {
    onConfigChange({ sendWindow });
  };

  const handleRateLimitingChange = (field: keyof NonNullable<WhatsAppActionConfig['rateLimiting']>, value: number | string) => {
    const next = { ...(config.rateLimiting ?? {}), [field]: value } as WhatsAppActionConfig['rateLimiting'];
    onConfigChange({ rateLimiting: next });
  };

  const handleFailureHandlingChange = (field: keyof NonNullable<WhatsAppActionConfig['failureHandling']>, value: number | string) => {
    const next = { ...(config.failureHandling ?? {}), [field]: value } as WhatsAppActionConfig['failureHandling'];
    onConfigChange({ failureHandling: next });
  };

  const handleBodyFieldChange = (fieldId: string, value: string) => {
    const next = bodyFields.map((f) => (f.id === fieldId ? { ...f, value } : f));
    onBodyFieldChange(next);
  };

  const availableBranches = ['default', 'reorder-flow', 'support-flow', 'reminder-path'];

  return (
    <div
      className={cn(
        "w-full min-w-0 max-w-full overflow-hidden rounded-2xl border border-[#E8E4DE] bg-white shadow-sm transition-all",
        className,
      )}
    >
      <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex w-full items-start gap-3 rounded-2xl px-3 py-4 text-left text-[#4A4139] transition-colors duration-300 sm:items-center sm:px-5",
              "hover:bg-[#FAF9F6]",
            )}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F3EDE6]">
              <Settings className="h-5 w-5" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold leading-tight sm:text-base">
                  Advanced WhatsApp Settings
                </h3>
                <span className="hidden shrink-0 rounded-full bg-[#F5F3EE] px-2 py-0.5 text-[11px] font-medium text-[#7D6248] sm:inline-block">
                  4 settings
                </span>
              </div>
              <p className="break-words text-xs leading-relaxed text-[#8B7F76] sm:text-sm">
                Configure delivery rules, exit paths, and validation settings
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="inline-block shrink-0 rounded-full bg-[#F5F3EE] px-2 py-0.5 text-[11px] font-medium text-[#7D6248] sm:hidden">
                4
              </span>
              {isOpen ? (
                <ChevronUp className="h-5 w-5 text-[#7D6248]" />
              ) : (
                <ChevronDown className="h-5 w-5 text-[#7D6248]" />
              )}
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3 border-t border-[#F0EBE3] pt-4">
          <div className="rounded-xl border border-[#E8E4DE] bg-[#FAF9F6] p-3 sm:p-4 md:p-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 gap-1 rounded-xl bg-white/70 p-1 lg:grid-cols-4">
                <TabsTrigger
                  value="variables"
                  className="flex flex-1 items-center justify-center gap-1.5 text-[11px] sm:gap-2 sm:text-xs lg:text-sm"
                  title="Variables & Media"
                >
                  <Settings className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
                  <span className="truncate">Variables & Media</span>
                </TabsTrigger>
                <TabsTrigger
                  value="delivery"
                  className="flex flex-1 items-center justify-center gap-1.5 text-[11px] sm:gap-2 sm:text-xs lg:text-sm"
                  title="Delivery Rules"
                >
                  <Clock className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
                  <span className="truncate">Delivery Rules</span>
                </TabsTrigger>
                <TabsTrigger
                  value="exitPaths"
                  className="flex flex-1 items-center justify-center gap-1.5 text-[11px] sm:gap-2 sm:text-xs lg:text-sm"
                  title="Exit Paths"
                >
                  <Route className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
                  <span className="truncate">Exit Paths</span>
                </TabsTrigger>
                <TabsTrigger
                  value="preview"
                  className="flex flex-1 items-center justify-center gap-1.5 text-[11px] sm:gap-2 sm:text-xs lg:text-sm"
                  title="Test & Validate"
                >
                  <TestTube className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
                  <span className="truncate">Test & Validate</span>
                </TabsTrigger>
              </TabsList>

              <div className="mt-5 max-h-[500px] overflow-y-auto overflow-x-hidden pr-1">
                <TabsContent value="variables" className="space-y-4">
                  <div className="space-y-4">
                    <div className="min-w-0">
                      <h4 className="mb-1 break-words text-sm font-semibold leading-tight text-[#4A4139] sm:text-base">
                        Variable Mapping & Personalization
                      </h4>
                      <p className="break-words text-xs leading-relaxed text-[#8B7F76] sm:text-sm">
                        Map template variables to customer data and configure media attachments.
                      </p>
                    </div>
                    {selectedTemplate ? (
                      <div className="min-w-0">
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
                    ) : (
                      <div className="rounded-lg border border-dashed border-[#E8E4DE] bg-white p-4 text-center">
                        <p className="break-words text-sm leading-relaxed text-[#8B7F76]">
                          Select a template first to configure variables
                        </p>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="delivery" className="space-y-4">
                  <EnhancedDeliverySettings
                    sendWindow={config.sendWindow}
                    rateLimiting={config.rateLimiting}
                    failureHandling={config.failureHandling}
                    onSendWindowChange={handleSendWindowChange}
                    onRateLimitingChange={handleRateLimitingChange}
                    onFailureHandlingChange={handleFailureHandlingChange}
                    skipIfOptedOut={config.skipIfOptedOut}
                    onOptOutChange={(value) => onConfigChange({ skipIfOptedOut: value })}
                    validationErrors={[]}
                  />
                </TabsContent>

                <TabsContent value="exitPaths" className="space-y-4">
                  <ExitPathsConfig
                    config={config.exitPaths || {}}
                    onChange={(exitPaths) => onConfigChange({ exitPaths })}
                    availableBranches={availableBranches}
                    templateButtons={(selectedTemplate?.buttons ?? []).map((b) => ({
                      id: b.id,
                      type: b.type,
                      text: b.text ?? b.label ?? '',
                    }))}
                    validationErrors={[]}
                  />
                </TabsContent>

                <TabsContent value="preview" className="space-y-4">
                  <Step5TestValidate
                    config={config}
                    selectedTemplate={selectedTemplate}
                    bodyFields={bodyFields}
                    variablePreview={variablePreview}
                    onSendTest={onSendTest}
                    validationErrors={[]}
                  />
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}


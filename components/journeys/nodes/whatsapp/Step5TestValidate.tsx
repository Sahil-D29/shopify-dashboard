"use client";

import { useState, useEffect, useMemo } from "react";
import { 
  Smartphone, 
  Send, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  RefreshCw,
  Calendar,
  Clock,
  MessageSquare,
  Settings,
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { WhatsAppPhonePreview } from "./WhatsAppPhonePreview";
import type { WhatsAppActionConfig, WhatsAppTemplate, WhatsAppBodyField } from "@/lib/types/whatsapp-config";
import { normalizeVariableToken } from "@/lib/whatsapp/template-utils";
import { extractTemplateVariables } from "@/lib/whatsapp/templateParser";
import { cn } from "@/lib/utils";

interface Step5TestValidateProps {
  config: WhatsAppActionConfig;
  selectedTemplate: WhatsAppTemplate | null;
  bodyFields: WhatsAppBodyField[];
  variablePreview: Record<string, string>;
  onSendTest?: (phone: string) => Promise<void>;
  validationErrors?: string[];
}

interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
  step: number;
}

export function Step5TestValidate({
  config,
  selectedTemplate,
  bodyFields,
  variablePreview,
  onSendTest,
  validationErrors = [],
}: Step5TestValidateProps) {
  const [testPhone, setTestPhone] = useState("");
  const [testStatus, setTestStatus] = useState<null | 'sending' | 'success' | 'error'>(null);
  const [testResult, setTestResult] = useState<{ messageId?: string; status?: string; timestamp?: string; error?: string } | null>(null);
  const [validationIssues, setValidationIssues] = useState<ValidationError[]>([]);

  // Validate configuration on mount and when config changes
  useEffect(() => {
    validateConfiguration();
  }, [config, selectedTemplate, bodyFields]);

  const validateConfiguration = () => {
    const issues: ValidationError[] = [];

    // Check template selected
    if (!selectedTemplate && !config.templateId) {
      issues.push({
        field: 'template',
        message: 'No template selected',
        severity: 'error',
        step: 1
      });
    }

    // Check variables are configured
    if (selectedTemplate?.variables && selectedTemplate.variables.length > 0) {
      selectedTemplate.variables.forEach(varName => {
        const normalizedVar = normalizeVariableToken(varName);
        const hasMapping = config.variableMappings?.some(m => 
          normalizeVariableToken(m.variable) === normalizedVar
        );
        const hasBodyField = bodyFields.some(f => {
          const bodyVars = extractTemplateVariables(f.value);
          return bodyVars.some(v => normalizeVariableToken(v.variable) === normalizedVar);
        });
        
        if (!hasMapping && !hasBodyField) {
          issues.push({
            field: `variable_${varName}`,
            message: `Variable "${varName}" is not configured`,
            severity: 'error',
            step: 2
          });
        }

        // Check for fallback value
        const mapping = config.variableMappings?.find(m => 
          normalizeVariableToken(m.variable) === normalizedVar
        );
        if (mapping && !mapping.fallbackValue) {
          issues.push({
            field: `variable_${varName}_fallback`,
            message: `Variable "${varName}" has no fallback value`,
            severity: 'warning',
            step: 2
          });
        }
      });
    }

    // Check media if template requires it
    if (selectedTemplate?.hasMediaHeader && !config.mediaUrl && !config.useDynamicMedia) {
      issues.push({
        field: 'media',
        message: 'Template requires media but none configured',
        severity: 'warning',
        step: 2
      });
    }

    // Check delivery rules
    if (!config.sendWindow?.daysOfWeek || config.sendWindow.daysOfWeek.length === 0) {
      issues.push({
        field: 'send_window',
        message: 'No delivery window configured',
        severity: 'warning',
        step: 3
      });
    }

    // Check exit paths
    if (!config.exitPaths || Object.keys(config.exitPaths).length === 0) {
      issues.push({
        field: 'exit_paths',
        message: 'No exit paths configured',
        severity: 'warning',
        step: 4
      });
    }

    // Add any form validation errors
    if (validationErrors.length > 0) {
      validationErrors.forEach(error => {
        issues.push({
          field: 'form',
          message: error,
          severity: 'error',
          step: 0
        });
      });
    }

    setValidationIssues(issues);
  };

  const handleSendTest = async () => {
    if (!testPhone) {
      setTestStatus('error');
      setTestResult({ error: 'Please enter a phone number' });
      return;
    }

    // Validate phone format (E.164)
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    const normalizedPhone = testPhone.replace(/\D/g, '');
    if (!phoneRegex.test(`+${normalizedPhone}`)) {
      setTestStatus('error');
      setTestResult({ error: 'Invalid phone number. Use format: +1234567890' });
      return;
    }

    // Check for blocking errors
    const blockingErrors = validationIssues.filter(e => e.severity === 'error');
    if (blockingErrors.length > 0) {
      setTestStatus('error');
      setTestResult({ error: 'Please fix all errors before sending test message' });
      return;
    }

    setTestStatus('sending');
    setTestResult(null);

    try {
      if (onSendTest) {
        await onSendTest(`+${normalizedPhone}`);
        setTestStatus('success');
        setTestResult({
          messageId: `test_${Date.now()}`,
          status: 'sent',
          timestamp: new Date().toLocaleTimeString()
        });

        // Auto-clear success message after 10 seconds
        setTimeout(() => {
          setTestStatus(null);
          setTestResult(null);
        }, 10000);
      } else {
        // Fallback: call API directly
        const response = await fetch('/api/whatsapp/send-test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            template_id: selectedTemplate?.id,
            template_name: selectedTemplate?.name || config.templateName,
            template_language: selectedTemplate?.language || config.templateLanguage,
            phone: `+${normalizedPhone}`,
            variables: variablePreview,
            body_fields: bodyFields,
            media: config.useDynamicMedia
              ? { type: selectedTemplate?.mediaType ?? "IMAGE", dynamic: true }
              : config.mediaUrl
                ? { type: selectedTemplate?.mediaType ?? "IMAGE", url: config.mediaUrl }
                : undefined,
          })
        });

        const result = await response.json();

        if (result.success) {
          setTestStatus('success');
          setTestResult({
            messageId: result.messageId || `test_${Date.now()}`,
            status: result.status || 'sent',
            timestamp: new Date().toLocaleTimeString()
          });
        } else {
          throw new Error(result.error || result.userMessage || 'Failed to send test message');
        }
      }
    } catch (error) {
      console.error('Test message error:', error);
      setTestStatus('error');
      setTestResult({
        error: error instanceof Error ? error.message : 'Network error. Please check your connection.'
      });
    }
  };

  const hasBlockingErrors = validationIssues.some(e => e.severity === 'error');
  const warnings = validationIssues.filter(e => e.severity === 'warning');

  // Generate sample data for preview
  const sampleData = useMemo(() => {
    const data: Record<string, string> = {};
    
    // Use variable preview if available, otherwise use sample values
    if (selectedTemplate?.variables) {
      selectedTemplate.variables.forEach(varName => {
        const normalizedVar = normalizeVariableToken(varName);
        data[varName] = variablePreview[normalizedVar] || 
                       variablePreview[varName] ||
                       selectedTemplate.sampleValues?.[varName] ||
                       `Sample ${varName}`;
      });
    }
    
    return data;
  }, [selectedTemplate, variablePreview]);

  return (
    <div className="space-y-6">
      {/* Validation Status */}
      {validationIssues.length > 0 && (
        <Alert
          variant={hasBlockingErrors ? "destructive" : "default"}
          className={cn(
            hasBlockingErrors 
              ? "border-red-200 bg-red-50" 
              : "border-yellow-200 bg-yellow-50"
          )}
        >
          <div className="flex items-start gap-2">
            {hasBlockingErrors ? (
              <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <div className={cn(
                "font-semibold mb-2",
                hasBlockingErrors ? "text-red-900" : "text-yellow-900"
              )}>
                {hasBlockingErrors 
                  ? `${validationIssues.filter(e => e.severity === 'error').length} Error(s) Found` 
                  : `${validationIssues.length} Warning(s)`}
              </div>
              <ul className="space-y-1">
                {validationIssues.map((issue, idx) => (
                  <li key={idx} className={cn(
                    "text-sm",
                    issue.severity === 'error' ? "text-red-700" : "text-yellow-700"
                  )}>
                    • {issue.message}
                    {issue.step > 0 && (
                      <span className="text-xs ml-2 opacity-75">
                        (Step {issue.step})
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Alert>
      )}

      {/* Main Content - Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Phone Preview */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-[#4A4139]" />
            <h3 className="text-lg font-semibold text-[#4A4139]">WhatsApp Preview</h3>
          </div>

          {selectedTemplate ? (
            <div className="rounded-2xl border border-[#E8E4DE] bg-[#F8F7F5] p-4">
              <WhatsAppPhonePreview
                template={selectedTemplate}
                bodyFields={bodyFields}
                variables={variablePreview}
              />
            </div>
          ) : (
            <div className="bg-gray-50 rounded-lg p-8 text-center">
              <Smartphone className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">No template selected</p>
            </div>
          )}

          {/* Sample Values Legend */}
          {selectedTemplate && Object.keys(sampleData).length > 0 && (
            <div className="bg-white rounded-lg border border-[#E8E4DE] p-3">
              <div className="text-xs font-semibold text-gray-700 mb-2">
                Sample Values Used:
              </div>
              <div className="space-y-1 text-xs text-gray-600">
                {Object.entries(sampleData).slice(0, 5).map(([key, value]) => (
                  <div key={key}>
                    • {key}: <span className="font-medium">{value}</span>
                  </div>
                ))}
                {Object.keys(sampleData).length > 5 && (
                  <div className="text-gray-500">
                    +{Object.keys(sampleData).length - 5} more
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Configuration Summary & Test */}
        <div className="space-y-6">
          {/* Configuration Summary */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Settings className="h-5 w-5 text-[#4A4139]" />
              <h3 className="text-lg font-semibold text-[#4A4139]">Configuration Summary</h3>
            </div>
            
            <div className="bg-[#FAF9F6] rounded-lg border border-[#E8E4DE] p-4 space-y-4">
              {/* Template Info */}
              <div>
                <div className="text-xs font-semibold text-[#B9AA9F] uppercase tracking-wide mb-1">
                  Template
                </div>
                <div className="text-sm text-[#4A4139]">
                  {selectedTemplate ? (
                    <>
                      <div className="font-semibold">{selectedTemplate.name}</div>
                      <div className="text-[#8B7F76] mt-1">
                        {selectedTemplate.category} • {selectedTemplate.language.toUpperCase()}
                      </div>
                    </>
                  ) : (
                    <span className="text-[#8B7F76]">Not selected</span>
                  )}
                </div>
              </div>

              {/* Variables */}
              {selectedTemplate?.variables && selectedTemplate.variables.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-[#B9AA9F] uppercase tracking-wide mb-1">
                    Variables ({selectedTemplate.variables.length})
                  </div>
                  <div className="space-y-1">
                    {selectedTemplate.variables.slice(0, 3).map(varName => {
                      const normalizedVar = normalizeVariableToken(varName);
                      const mapping = config.variableMappings?.find(m => 
                        normalizeVariableToken(m.variable) === normalizedVar
                      );
                      const bodyField = bodyFields.find(f => {
                        const bodyVars = extractTemplateVariables(f.value);
                        return bodyVars.some(v => normalizeVariableToken(v.variable) === normalizedVar);
                      });
                      
                      return (
                        <div key={varName} className="text-sm text-[#4A4139]">
                          <span className="font-medium">{varName}:</span>{' '}
                          <span className="text-[#8B7F76]">
                            {mapping?.dataSource || (bodyField ? 'In body field' : 'Not configured')}
                          </span>
                        </div>
                      );
                    })}
                    {selectedTemplate.variables.length > 3 && (
                      <div className="text-xs text-[#8B7F76]">
                        +{selectedTemplate.variables.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Media */}
              {(config.mediaUrl || config.useDynamicMedia) && (
                <div>
                  <div className="text-xs font-semibold text-[#B9AA9F] uppercase tracking-wide mb-1">
                    Media
                  </div>
                  <div className="text-sm text-[#8B7F76]">
                    {config.useDynamicMedia 
                      ? 'Dynamic: Product image'
                      : `Static: ${config.mediaUrl?.substring(0, 40)}...`}
                  </div>
                </div>
              )}

              {/* Delivery Rules */}
              {config.sendWindow && (
                <div>
                  <div className="text-xs font-semibold text-[#B9AA9F] uppercase tracking-wide mb-1">
                    Delivery Window
                  </div>
                  <div className="text-sm text-[#8B7F76]">
                    {config.sendWindow.daysOfWeek.length > 0 ? (
                      <>
                        {config.sendWindow.daysOfWeek.length} day(s), {config.sendWindow.startTime} – {config.sendWindow.endTime}
                      </>
                    ) : (
                      'Anytime'
                    )}
                  </div>
                </div>
              )}

              {/* Rate Limiting */}
              {config.rateLimiting && (
                <div>
                  <div className="text-xs font-semibold text-[#B9AA9F] uppercase tracking-wide mb-1">
                    Rate Limit
                  </div>
                  <div className="text-sm text-[#8B7F76]">
                    {config.rateLimiting.maxPerDay} per day, {config.rateLimiting.maxPerWeek} per week
                  </div>
                </div>
              )}

              {/* Exit Paths */}
              {config.exitPaths && Object.keys(config.exitPaths).length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-[#B9AA9F] uppercase tracking-wide mb-1">
                    Exit Paths ({Object.keys(config.exitPaths).length})
                  </div>
                  <div className="space-y-1">
                    {Object.entries(config.exitPaths).slice(0, 3).map(([path, action]: [string, any]) => (
                      <div key={path} className="text-sm text-[#4A4139]">
                        <span className="font-medium capitalize">{path}:</span>{' '}
                        <span className="text-[#8B7F76]">
                          {action?.action?.type || action?.type || 'Not configured'}
                        </span>
                      </div>
                    ))}
                    {Object.keys(config.exitPaths).length > 3 && (
                      <div className="text-xs text-[#8B7F76]">
                        +{Object.keys(config.exitPaths).length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Send Test Message */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Send className="h-5 w-5 text-[#4A4139]" />
              <h3 className="text-lg font-semibold text-[#4A4139]">Send Test Message</h3>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900 mb-4">
                Send a test message to verify your configuration before saving.
              </p>

              <div className="flex gap-2">
                <Input
                  type="tel"
                  placeholder="+1 234 567 8900"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  className="flex-1"
                  disabled={hasBlockingErrors}
                />
                <Button
                  onClick={handleSendTest}
                  disabled={!testPhone || testStatus === 'sending' || hasBlockingErrors}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {testStatus === 'sending' ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Send
                    </>
                  )}
                </Button>
              </div>

              {/* Test Result */}
              {testStatus === 'success' && testResult && (
                <Alert className="mt-4 bg-green-50 border-green-200">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <AlertDescription>
                    <div className="font-semibold text-green-900">
                      Test message sent successfully!
                    </div>
                    <div className="text-xs text-green-700 mt-1">
                      {testResult.messageId && `Message ID: ${testResult.messageId}`}
                      {testResult.timestamp && ` • Time: ${testResult.timestamp}`}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {testStatus === 'error' && testResult && (
                <Alert variant="destructive" className="mt-4">
                  <XCircle className="h-5 w-5" />
                  <AlertDescription>
                    <div className="font-semibold text-red-900">
                      Failed to send test message
                    </div>
                    <div className="text-xs text-red-700 mt-1">
                      {testResult.error}
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>

          {/* Ready to Save Indicator */}
          {!hasBlockingErrors && validationIssues.length === 0 && (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
              <AlertDescription>
                <div className="font-semibold text-green-900">
                  Configuration is valid!
                </div>
                <div className="text-sm text-green-700">
                  You can now save this WhatsApp action.
                </div>
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    </div>
  );
}




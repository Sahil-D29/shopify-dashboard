'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { extractTemplateVariables } from '@/lib/whatsapp/templateParser';
import { getAvailableDataSources, getPreviewValue, DATA_SOURCES, type DataSource } from '@/lib/whatsapp/dataSources';
import type { VariableMapping, WhatsAppTemplate } from '@/lib/types/whatsapp-config';

interface EnhancedVariableMapperProps {
  template: WhatsAppTemplate | null;
  mappings: VariableMapping[];
  onChange: (mappings: VariableMapping[]) => void;
  errors?: Record<string, string>;
  triggerContext?: 'generic' | 'order' | 'product';
}

export function EnhancedVariableMapper({
  template,
  mappings,
  onChange,
  errors = {},
  triggerContext = 'generic',
}: EnhancedVariableMapperProps) {
  const [localMappings, setLocalMappings] = useState<VariableMapping[]>(mappings);

  // Auto-extract variables when template changes
  useEffect(() => {
    if (!template) {
      setLocalMappings([]);
      onChange([]);
      return;
    }

    // Get template body (combine all body fields if multiple)
    const templateBody = template.body || template.content || '';
    
    // Extract variables from template
    const extractedVars = extractTemplateVariables(templateBody);

    if (extractedVars.length === 0) {
      setLocalMappings([]);
      onChange([]);
      return;
    }

    // Initialize mappings with smart suggestions
    const initialMappings: VariableMapping[] = extractedVars.map((v) => {
      // Check if mapping already exists in current mappings
      const existing = mappings.find((m) => m.variable === v.variable);

      if (existing) {
        return existing;
      }

      // Create new mapping with suggestions
      return {
        variable: v.variable,
        dataSource: v.suggestedSource as VariableMapping['dataSource'],
        property: v.suggestedProperty,
        fallbackValue: v.suggestedFallback,
      };
    });

    setLocalMappings(initialMappings);
    onChange(initialMappings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template?.id, template?.body, template?.content]);

  // Sync with external changes when mappings prop changes
  // Using a ref to track if we should sync
  const lastMappingsRef = useRef<string>('');
  useEffect(() => {
    const mappingsJson = JSON.stringify(mappings);
    if (mappings.length > 0 && mappingsJson !== lastMappingsRef.current) {
      lastMappingsRef.current = mappingsJson;
      setLocalMappings(mappings);
    }
  }, [mappings]);

  const availableSources = useMemo(
    () => getAvailableDataSources(triggerContext),
    [triggerContext],
  );

  const updateMapping = (index: number, updates: Partial<VariableMapping>) => {
    const updated = [...localMappings];
    updated[index] = { ...updated[index], ...updates };
    
    // Reset property if source changes
    if (updates.dataSource && updates.dataSource !== updated[index].dataSource) {
      updated[index].property = '';
    }

    setLocalMappings(updated);
    onChange(updated);
  };

  // Calculate character count of merged message
  const getCharacterCount = (): number => {
    if (!template) return 0;
    
    let body = template.body || template.content || '';
    
    localMappings.forEach((mapping) => {
      const preview = getPreviewValue(
        mapping.dataSource,
        mapping.property,
        mapping.fallbackValue,
      );
      body = body.replace(new RegExp(escapeRegex(mapping.variable), 'g'), preview);
    });

    return body.length;
  };

  const escapeRegex = (str: string): string => {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  const charCount = getCharacterCount();
  const isOverLimit = charCount > 1024;

  if (!template || localMappings.length === 0) {
    return (
      <div className="rounded-2xl border border-[#E8E4DE] bg-[#FAF9F6] p-6 text-center">
        <p className="text-sm text-[#8B7F76]">
          {!template
            ? 'Select a template to see variable mappings'
            : 'This template has no variables'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Character Counter */}
      <div
        className={cn(
          'rounded-lg p-3 border',
          isOverLimit
            ? 'bg-red-50 border-red-200'
            : 'bg-gray-50 border-gray-200',
        )}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Message Length</span>
          <span
            className={cn(
              'font-mono text-sm',
              isOverLimit ? 'text-red-600 font-bold' : 'text-gray-700',
            )}
          >
            {charCount} / 1024
          </span>
        </div>
        {isOverLimit && (
          <p className="text-xs text-red-600 mt-1">
            ⚠️ Message exceeds WhatsApp's limit. Shorten fallback values or use shorter properties.
          </p>
        )}
      </div>

      {/* Help Text */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex gap-2">
          <Info className="h-4 w-4 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-medium mb-1">Personalization Tips</p>
            <ul className="space-y-1 text-xs">
              <li>• We've pre-filled common mappings - adjust as needed</li>
              <li>• Fallback is used when property is empty</li>
              <li>• Preview shows sample data from your system</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Variable Mappings */}
      <div className="space-y-3">
        {localMappings.map((mapping, index) => {
          const errorKey = `mapping_${index}`;
          const hasError = !!errors[errorKey] || !!errors[mapping.variable];
          const errorMessage = errors[errorKey] || errors[mapping.variable];
          const dataSource = DATA_SOURCES[mapping.dataSource];
          const preview = getPreviewValue(
            mapping.dataSource,
            mapping.property,
            mapping.fallbackValue,
          );

          return (
            <div
              key={mapping.variable}
              className={cn(
                'border rounded-lg p-4 space-y-3 bg-white transition-all',
                hasError
                  ? 'border-red-300 bg-red-50'
                  : 'border-[#E8E4DE] hover:border-[#D4A574]',
              )}
            >
              {/* Variable Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-blue-600">
                    {mapping.variable}
                  </span>
                  <span className="text-xs text-gray-500">Variable {index + 1}</span>
                </div>
                {preview && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Preview:</span>
                    <span className="font-medium text-sm text-gray-700">{preview}</span>
                  </div>
                )}
              </div>

              {/* Data Source */}
              <div>
                <Label className="block text-xs font-medium text-gray-700 mb-1">
                  Data Source *
                </Label>
                <Select
                  value={mapping.dataSource}
                  onValueChange={(value) =>
                    updateMapping(index, {
                      dataSource: value as VariableMapping['dataSource'],
                    })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSources.map((source) => (
                      <SelectItem key={source.key} value={source.key}>
                        <div className="flex items-center gap-2">
                          <span>{source.icon}</span>
                          <span>{source.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {dataSource && (
                  <p className="text-xs text-gray-500 mt-1">{dataSource.description}</p>
                )}
              </div>

              {/* Property Selection */}
              {mapping.dataSource !== 'static' && (
                <div>
                  <Label className="block text-xs font-medium text-gray-700 mb-1">
                    Property *
                  </Label>

                  {mapping.dataSource === 'custom' ? (
                    // Manual input for custom event properties
                    <Input
                      type="text"
                      value={mapping.property}
                      onChange={(e) => updateMapping(index, { property: e.target.value })}
                      placeholder="Enter property name (e.g., discount_code)"
                      className="w-full"
                    />
                  ) : (
                    // Dropdown for predefined properties
                    <Select
                      value={mapping.property}
                      onValueChange={(value) => updateMapping(index, { property: value })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="-- Select property --" />
                      </SelectTrigger>
                      <SelectContent>
                        {dataSource?.properties.map((prop) => (
                          <SelectItem key={prop.value} value={prop.value}>
                            <div className="flex flex-col">
                              <span>{prop.label}</span>
                              {prop.example && (
                                <span className="text-xs text-gray-500">
                                  e.g., {prop.example}
                                </span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {mapping.property && (
                    <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Will use: {mapping.dataSource}.{mapping.property}
                    </p>
                  )}
                </div>
              )}

              {/* Fallback Value */}
              <div>
                <Label className="block text-xs font-medium text-gray-700 mb-1">
                  Fallback Value *
                </Label>
                <Input
                  type="text"
                  value={mapping.fallbackValue}
                  onChange={(e) => updateMapping(index, { fallbackValue: e.target.value })}
                  placeholder="Used when property is empty"
                  className="w-full"
                />
                <p className="text-xs text-gray-500 mt-1">
                  This value is shown if{' '}
                  {mapping.property || 'the property'} is empty or unavailable
                </p>
              </div>

              {/* Error Display */}
              {hasError && (
                <div className="bg-red-50 border border-red-200 rounded p-2 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-red-600">{errorMessage}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}


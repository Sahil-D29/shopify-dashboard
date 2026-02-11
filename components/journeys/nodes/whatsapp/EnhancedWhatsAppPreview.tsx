'use client';

import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { MobilePreview } from '@/components/journeys/MobilePreview';
import { cn } from '@/lib/utils';
import type { WhatsAppTemplate, VariableMapping } from '@/lib/types/whatsapp-config';
import { getPreviewValue } from '@/lib/whatsapp/dataSources';
import { escapeRegex } from '@/lib/whatsapp/templateParser';

interface EnhancedWhatsAppPreviewProps {
  template: WhatsAppTemplate | null;
  mappings: VariableMapping[];
}

export function EnhancedWhatsAppPreview({
  template,
  mappings,
}: EnhancedWhatsAppPreviewProps) {
  // Merge template body with preview values
  const mergedBody = useMemo(() => {
    if (!template) return '';

    let body = template.body || template.content || '';

    mappings.forEach((mapping) => {
      const preview = getPreviewValue(
        mapping.dataSource,
        mapping.property,
        mapping.fallbackValue,
      );
      const escaped = escapeRegex(mapping.variable);
      body = body.replace(new RegExp(escaped, 'g'), preview);
    });

    return body;
  }, [template, mappings]);

  const characterCount = mergedBody.length;
  const isOverLimit = characterCount > 1024;

  const previewTemplate = useMemo<WhatsAppTemplate | null>(() => {
    if (!template) return null;
    return {
      ...template,
      body: mergedBody,
      content: mergedBody,
    };
  }, [mergedBody, template]);

  // Convert mappings to variable values for MobilePreview
  const plainVariables = useMemo(() => {
    return mappings.reduce<Record<string, string>>((acc, mapping) => {
      const stripped = mapping.variable.replace(/^\{\{|\}\}$/g, '');
      const preview = getPreviewValue(
        mapping.dataSource,
        mapping.property,
        mapping.fallbackValue,
      );
      acc[stripped] = preview;
      return acc;
    }, {});
  }, [mappings]);

  if (!template) {
    return (
      <div className="rounded-2xl border border-dashed border-[#E8E4DE] bg-white px-3 py-4 text-center text-sm text-[#8B7F76]">
        Select a template and map variables to preview the WhatsApp experience.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-[#B9AA9F]">Live Preview</p>
          <h4 className="text-lg font-semibold text-[#3A3028]">{template.name}</h4>
          <p className="text-xs text-[#8B7F76]">
            {template.category} • {template.language.toUpperCase()}
          </p>
        </div>
        <Badge className="rounded-full bg-[#F5F3EE] text-[11px] font-semibold uppercase tracking-wide text-[#B7791F]">
          {template.status}
        </Badge>
      </div>

      {/* Phone Preview */}
      <div className="rounded-3xl border border-[#E8E4DE] bg-[#F8F7F5] p-4">
        <MobilePreview template={previewTemplate} variableValues={plainVariables} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white rounded-lg border border-[#E8E4DE] p-3 text-center">
          <p
            className={cn(
              'text-2xl font-bold',
              isOverLimit ? 'text-red-600' : 'text-gray-800',
            )}
          >
            {characterCount}
          </p>
          <p className="text-xs text-gray-600">Characters</p>
          {isOverLimit && (
            <p className="text-xs text-red-600 mt-1">Over limit!</p>
          )}
        </div>
        <div className="bg-white rounded-lg border border-[#E8E4DE] p-3 text-center">
          <p className="text-2xl font-bold text-gray-800">{mappings.length}</p>
          <p className="text-xs text-gray-600">Variables</p>
        </div>
      </div>
    </div>
  );
}


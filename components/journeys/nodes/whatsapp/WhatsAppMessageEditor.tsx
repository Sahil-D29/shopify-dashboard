"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, LockKeyhole } from "lucide-react";

import type {
  VariableMapping,
  WhatsAppTemplate,
  WhatsAppBodyField,
} from "@/lib/types/whatsapp-config";
import type { VariableDataSourceOption } from "./VariableMapper";
import { VariableMapper } from "./VariableMapper";
import { EnhancedVariableMapper } from "./EnhancedVariableMapper";
import { EnhancedWhatsAppPreview } from "./EnhancedWhatsAppPreview";
import { cn } from "@/lib/utils";

interface WhatsAppMessageEditorProps {
  template: WhatsAppTemplate | null;
  bodyFields: WhatsAppBodyField[];
  onBodyFieldChange: (fieldId: string, value: string) => void;
  onInsertVariable: (fieldId: string, variable: string) => void;
  variableMappings: VariableMapping[];
  onVariableMappingsChange: (mappings: VariableMapping[]) => void;
  variableErrors?: Record<string, string>;
  dataSources: VariableDataSourceOption[];
  disableStatic?: boolean;
  triggerContext?: 'generic' | 'order' | 'product';
  useEnhancedMapper?: boolean;
  showPreview?: boolean;
}

export function WhatsAppMessageEditor({
  template,
  bodyFields,
  variableMappings,
  onVariableMappingsChange,
  variableErrors,
  dataSources,
  disableStatic,
  triggerContext = 'generic',
  useEnhancedMapper = true,
  showPreview = true,
}: WhatsAppMessageEditorProps) {
  const templateDescription = useMemo(() => {
    if (!template) return null;
    return `${template.category} • ${template.language.toUpperCase()}`;
  }, [template]);
  const hasBodyVariables = Boolean(template?.variables?.length);

  return (
    <div className="space-y-6">
      <div className="space-y-3 rounded-2xl border border-[#E8E4DE] bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[#B9AA9F]">Selected Template</p>
            <h4 className="text-lg font-semibold text-[#3A3028]">{template?.name ?? "Select a template"}</h4>
            {templateDescription ? <p className="text-xs text-[#8B7F76]">{templateDescription}</p> : null}
          </div>
          {template?.status ? (
            <Badge className="rounded-full bg-[#F5F3EE] text-[11px] font-semibold uppercase tracking-wide text-[#B7791F]">
              {template.status}
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border border-[#E8E4DE] bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.3em] text-[#B9AA9F]">Approved body</p>
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
            <LockKeyhole className="h-3 w-3" /> Meta approved
          </span>
        </div>
        <div className="whitespace-pre-wrap rounded-xl border border-[#E8E4DE] bg-[#FAF9F6] p-4 text-sm leading-6 text-[#4A4139]">
          {template?.body || template?.content || bodyFields[0]?.value || 'No body copy supplied.'}
        </div>
        {template && !hasBodyVariables ? (
          <p className="flex items-center gap-2 text-xs text-emerald-700">
            <CheckCircle2 className="h-4 w-4" /> No body variables required.
          </p>
        ) : null}
      </div>

      {hasBodyVariables && useEnhancedMapper ? (
        <div className={cn("grid grid-cols-1 gap-6", showPreview && "lg:grid-cols-2")}>
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.3em] text-[#B9AA9F]">Variable Mapping</p>
            <EnhancedVariableMapper
              template={template}
              mappings={variableMappings}
              onChange={onVariableMappingsChange}
              errors={variableErrors}
              triggerContext={triggerContext}
            />
          </div>
          {showPreview ? (
            <div className="sticky top-0">
              <EnhancedWhatsAppPreview template={template} mappings={variableMappings} />
            </div>
          ) : null}
        </div>
      ) : hasBodyVariables ? (
        <VariableMapper
          variables={template?.variables ?? []}
          mappings={variableMappings}
          onChange={onVariableMappingsChange}
          dataSources={dataSources}
          errors={variableErrors}
          disableStatic={disableStatic}
        />
      ) : null}
    </div>
  );
}


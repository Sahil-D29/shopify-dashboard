"use client";

import { useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ChevronsUpDown, MessageCircle } from "lucide-react";

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
}

interface VariableInsertMenuProps {
  dataSources: VariableDataSourceOption[];
  onSelect: (variable: string) => void;
}

export function WhatsAppMessageEditor({
  template,
  bodyFields,
  onBodyFieldChange,
  onInsertVariable,
  variableMappings,
  onVariableMappingsChange,
  variableErrors,
  dataSources,
  disableStatic,
  triggerContext = 'generic',
  useEnhancedMapper = true,
}: WhatsAppMessageEditorProps) {
  const textareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const [openPickerFor, setOpenPickerFor] = useState<string | null>(null);

  const handleInsertVariable = (fieldId: string, variable: string) => {
    const formatted = variable.startsWith("{{") ? variable : `{{${variable}}}`;
    const target = textareaRefs.current[fieldId];
    const field = bodyFields.find(item => item.id === fieldId);
    const currentValue = field?.value ?? "";
    if (target) {
      const start = target.selectionStart ?? currentValue.length;
      const end = target.selectionEnd ?? currentValue.length;
      const nextValue = `${currentValue.slice(0, start)}${formatted}${currentValue.slice(end)}`;
      onBodyFieldChange(fieldId, nextValue);
      requestAnimationFrame(() => {
        target.focus();
        const cursor = start + formatted.length;
        target.setSelectionRange(cursor, cursor);
      });
      return;
    }
    onBodyFieldChange(fieldId, `${currentValue}${formatted}`);
  };

  const templateDescription = useMemo(() => {
    if (!template) return null;
    return `${template.category} • ${template.language.toUpperCase()}`;
  }, [template]);

  return (
    <div className="space-y-6">
      <div className="space-y-3 rounded-2xl border border-[#E8E4DE] bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[#B9AA9F]">Selected Template</p>
            <h4 className="text-lg font-semibold text-[#3A3028]">{template?.name ?? "Select a template"}</h4>
            {templateDescription ? (
              <p className="text-xs text-[#8B7F76]">{templateDescription}</p>
            ) : null}
          </div>
          {template?.status ? (
            <Badge className="rounded-full bg-[#F5F3EE] text-[11px] font-semibold uppercase tracking-wide text-[#B7791F]">
              {template.status}
            </Badge>
          ) : null}
        </div>
        {template?.description ? (
          <p className="text-sm text-[#8B7F76]">{template.description}</p>
        ) : null}
      </div>

      <div className="space-y-3 rounded-2xl border border-[#E8E4DE] bg-white p-4 shadow-sm">
        <p className="text-xs uppercase tracking-[0.3em] text-[#B9AA9F]">Body Content</p>
        {bodyFields.map(field => (
          <div key={field.id} className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label className="text-sm font-semibold text-[#4A4139]">{field.label}</Label>
              <Button
                type="button"
                variant="ghost"
                className="h-8 gap-2 rounded-full text-xs text-[#8B7F76]"
                onClick={() => {
                  setOpenPickerFor(field.id);
                }}
              >
                <MessageCircle className="h-4 w-4" />
                Insert variable
              </Button>
            </div>
            <Textarea
              ref={element => {
                textareaRefs.current[field.id] = element;
              }}
              rows={4}
              value={field.value}
              onChange={event => onBodyFieldChange(field.id, event.target.value)}
              className="min-h-[120px]"
            />
            <VariableInsertMenu
              dataSources={dataSources}
              onSelect={variable => {
                handleInsertVariable(field.id, variable);
                onInsertVariable(field.id, variable);
                setOpenPickerFor(null);
              }}
            />
            {openPickerFor === field.id ? (
              <div className="rounded-xl border border-[#E8E4DE] bg-[#FFFBF7] p-2 text-xs text-[#8B7F76]">
                Tip: type &quot;&#123;&#123;&quot; to insert variables, or use the button above.
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {useEnhancedMapper ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Variable Mapping */}
          <div className="space-y-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-[#B9AA9F] mb-3">
                Variable Mapping
              </p>
              <EnhancedVariableMapper
                template={template}
                mappings={variableMappings}
                onChange={onVariableMappingsChange}
                errors={variableErrors}
                triggerContext={triggerContext}
              />
            </div>
          </div>

          {/* Right: Live Preview */}
          <div className="sticky top-0">
            <EnhancedWhatsAppPreview template={template} mappings={variableMappings} />
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-[#B9AA9F]">Variable Mapping</p>
          <VariableMapper
            variables={template?.variables ?? []}
            mappings={variableMappings}
            onChange={onVariableMappingsChange}
            dataSources={dataSources}
            errors={variableErrors}
            disableStatic={disableStatic}
          />
        </div>
      )}
    </div>
  );
}

function VariableInsertMenu({ dataSources, onSelect }: VariableInsertMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="flex h-9 items-center justify-between gap-2 border-[#E8E4DE] text-xs text-[#4A4139]"
        >
          Insert variable
          <ChevronsUpDown className="h-3.5 w-3.5 text-[#C0B4A8]" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search variables..." className="h-9" />
          <CommandList>
            <CommandEmpty>No matches found.</CommandEmpty>
            {dataSources.map(source => (
              <CommandGroup key={source.id} heading={source.label}>
                {source.groups.flatMap(group =>
                  group.options.map(option => (
                    <CommandItem
                      key={`${source.id}-${option.value}`}
                      value={`${source.id} ${option.value}`}
                      onSelect={() => {
                        onSelect(option.value);
                        setOpen(false);
                      }}
                    >
                      <div className="flex flex-col">
                        <span className="text-sm text-[#3A3028]">{option.label}</span>
                        {option.sample ? (
                          <span className="text-xs text-[#8B7F76]">{option.sample}</span>
                        ) : option.description ? (
                          <span className="text-xs text-[#A8A29E]">{option.description}</span>
                        ) : null}
                      </div>
                    </CommandItem>
                  )),
                )}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}



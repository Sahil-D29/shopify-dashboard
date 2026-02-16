'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  Trash2,
  Plus,
  X,
  ChevronDown,
  ChevronUp,
  Type,
  AlignLeft,
  CircleDot,
  CheckSquare,
  List,
  Calendar,
  GripVertical,
} from 'lucide-react';

interface FlowElement {
  id: string;
  type: 'text-input' | 'textarea' | 'radio' | 'checkbox' | 'dropdown' | 'date-picker';
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
  validation?: { maxLength?: number; pattern?: string };
}

interface FlowElementConfigProps {
  element: FlowElement;
  onChange: (element: FlowElement) => void;
  onDelete: () => void;
}

const ELEMENT_TYPE_ICONS: Record<FlowElement['type'], React.ReactNode> = {
  'text-input': <Type className="h-4 w-4" />,
  textarea: <AlignLeft className="h-4 w-4" />,
  radio: <CircleDot className="h-4 w-4" />,
  checkbox: <CheckSquare className="h-4 w-4" />,
  dropdown: <List className="h-4 w-4" />,
  'date-picker': <Calendar className="h-4 w-4" />,
};

const ELEMENT_TYPE_LABELS: Record<FlowElement['type'], string> = {
  'text-input': 'Text Input',
  textarea: 'Text Area',
  radio: 'Radio Buttons',
  checkbox: 'Checkboxes',
  dropdown: 'Dropdown',
  'date-picker': 'Date Picker',
};

const hasOptions = (type: FlowElement['type']) =>
  type === 'radio' || type === 'checkbox' || type === 'dropdown';

export function FlowElementConfig({ element, onChange, onDelete }: FlowElementConfigProps) {
  const [expanded, setExpanded] = useState(false);

  const updateField = <K extends keyof FlowElement>(key: K, value: FlowElement[K]) => {
    onChange({ ...element, [key]: value });
  };

  const addOption = () => {
    const options = element.options || [];
    updateField('options', [...options, `Option ${options.length + 1}`]);
  };

  const updateOption = (index: number, value: string) => {
    const options = [...(element.options || [])];
    options[index] = value;
    updateField('options', options);
  };

  const removeOption = (index: number) => {
    const options = (element.options || []).filter((_, i) => i !== index);
    updateField('options', options);
  };

  return (
    <Card
      className={`transition-all duration-200 ${
        expanded ? 'border-indigo-200 shadow-sm' : 'border-gray-200'
      }`}
    >
      {/* Collapsed header */}
      <button
        className="flex w-full items-center gap-3 p-3 text-left hover:bg-gray-50/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <GripVertical className="h-4 w-4 text-gray-300 flex-shrink-0" />
        <span className="text-indigo-500 flex-shrink-0">{ELEMENT_TYPE_ICONS[element.type]}</span>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-gray-900 truncate block">
            {element.label || 'Untitled Element'}
          </span>
          <span className="text-xs text-muted-foreground">
            {ELEMENT_TYPE_LABELS[element.type]}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {element.required && (
            <span className="text-[10px] font-medium text-red-500 bg-red-50 px-1.5 py-0.5 rounded">
              Required
            </span>
          )}
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          )}
        </div>
      </button>

      {/* Expanded config */}
      {expanded && (
        <CardContent className="border-t pt-4 pb-4 space-y-4">
          <div className="space-y-2">
            <Label className="text-xs font-medium text-gray-700">Label</Label>
            <Input
              value={element.label}
              onChange={(e) => updateField('label', e.target.value)}
              placeholder="Enter field label"
              className="h-8 text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium text-gray-700">Placeholder</Label>
            <Input
              value={element.placeholder || ''}
              onChange={(e) => updateField('placeholder', e.target.value)}
              placeholder="Enter placeholder text"
              className="h-8 text-sm"
            />
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium text-gray-700">Required</Label>
            <Switch
              checked={element.required}
              onCheckedChange={(checked) => updateField('required', checked)}
            />
          </div>

          {hasOptions(element.type) && (
            <div className="space-y-2">
              <Label className="text-xs font-medium text-gray-700">Options</Label>
              <div className="space-y-1.5">
                {(element.options || []).map((option, index) => (
                  <div key={index} className="flex items-center gap-1.5">
                    <Input
                      value={option}
                      onChange={(e) => updateOption(index, e.target.value)}
                      className="h-7 text-xs flex-1"
                    />
                    <button
                      onClick={() => removeOption(index)}
                      className="p-1 rounded hover:bg-red-50 transition-colors"
                      disabled={(element.options || []).length <= 1}
                    >
                      <X className="h-3.5 w-3.5 text-red-400" />
                    </button>
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={addOption} className="h-7 text-xs gap-1">
                <Plus className="h-3 w-3" />
                Add Option
              </Button>
            </div>
          )}

          {element.validation && (
            <div className="space-y-2">
              <Label className="text-xs font-medium text-gray-700">Max Length</Label>
              <Input
                type="number"
                value={element.validation.maxLength || ''}
                onChange={(e) =>
                  updateField('validation', {
                    ...element.validation,
                    maxLength: e.target.value ? parseInt(e.target.value, 10) : undefined,
                  })
                }
                className="h-8 text-sm"
                placeholder="No limit"
              />
            </div>
          )}

          <div className="flex justify-end pt-2 border-t">
            <Button variant="destructive" size="sm" onClick={onDelete} className="h-7 text-xs gap-1">
              <Trash2 className="h-3 w-3" />
              Delete Element
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export { ELEMENT_TYPE_ICONS, ELEMENT_TYPE_LABELS };
export type { FlowElement };

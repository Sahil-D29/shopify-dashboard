'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Type,
  AlignLeft,
  CircleDot,
  CheckSquare,
  List,
  Calendar,
} from 'lucide-react';
import { FlowElementConfig } from './FlowElementConfig';

interface FlowElement {
  id: string;
  type: 'text-input' | 'textarea' | 'radio' | 'checkbox' | 'dropdown' | 'date-picker';
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
  validation?: { maxLength?: number; pattern?: string };
}

interface FlowScreen {
  id: string;
  title: string;
  description?: string;
  elements: FlowElement[];
  navigation: { type: 'next' | 'complete'; nextScreenId?: string };
}

interface FlowScreenEditorProps {
  screen: FlowScreen;
  onChange: (screen: FlowScreen) => void;
  allScreens: FlowScreen[];
}

const ELEMENT_TYPES: { value: FlowElement['type']; label: string; icon: React.ReactNode }[] = [
  { value: 'text-input', label: 'Text Input', icon: <Type className="h-4 w-4" /> },
  { value: 'textarea', label: 'Text Area', icon: <AlignLeft className="h-4 w-4" /> },
  { value: 'radio', label: 'Radio Buttons', icon: <CircleDot className="h-4 w-4" /> },
  { value: 'checkbox', label: 'Checkboxes', icon: <CheckSquare className="h-4 w-4" /> },
  { value: 'dropdown', label: 'Dropdown', icon: <List className="h-4 w-4" /> },
  { value: 'date-picker', label: 'Date Picker', icon: <Calendar className="h-4 w-4" /> },
];

export function FlowScreenEditor({ screen, onChange, allScreens }: FlowScreenEditorProps) {
  const [showElementPicker, setShowElementPicker] = useState(false);

  const updateScreen = <K extends keyof FlowScreen>(key: K, value: FlowScreen[K]) => {
    onChange({ ...screen, [key]: value });
  };

  const addElement = (type: FlowElement['type']) => {
    const hasOptions = type === 'radio' || type === 'checkbox' || type === 'dropdown';
    const newElement: FlowElement = {
      id: `el_${Date.now()}`,
      type,
      label: '',
      placeholder: '',
      required: false,
      ...(hasOptions ? { options: ['Option 1', 'Option 2'] } : {}),
    };
    updateScreen('elements', [...screen.elements, newElement]);
    setShowElementPicker(false);
  };

  const updateElement = (updatedElement: FlowElement) => {
    updateScreen(
      'elements',
      screen.elements.map((el) => (el.id === updatedElement.id ? updatedElement : el)),
    );
  };

  const deleteElement = (id: string) => {
    updateScreen(
      'elements',
      screen.elements.filter((el) => el.id !== id),
    );
  };

  const moveElement = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= screen.elements.length) return;
    const elements = [...screen.elements];
    [elements[index], elements[newIndex]] = [elements[newIndex], elements[index]];
    updateScreen('elements', elements);
  };

  const otherScreens = allScreens.filter((s) => s.id !== screen.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Screen Info */}
      <Card className="border-gray-100 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold text-gray-900">Screen Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">Screen Title</Label>
            <Input
              value={screen.title}
              onChange={(e) => updateScreen('title', e.target.value)}
              placeholder="Enter screen title"
              className="h-10"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">
              Description <span className="text-gray-400">(optional)</span>
            </Label>
            <Textarea
              value={screen.description || ''}
              onChange={(e) => updateScreen('description', e.target.value)}
              placeholder="Add a description for this screen"
              rows={2}
              className="resize-none text-sm"
            />
          </div>
        </CardContent>
      </Card>

      {/* Form Elements */}
      <Card className="border-gray-100 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold text-gray-900">Form Elements</CardTitle>
            <span className="text-xs text-muted-foreground">
              {screen.elements.length} element{screen.elements.length !== 1 ? 's' : ''}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {screen.elements.length === 0 && !showElementPicker && (
            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-10">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50">
                <Plus className="h-6 w-6 text-indigo-500" />
              </div>
              <p className="mt-3 text-sm font-medium text-gray-900">No elements yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Add form elements to capture data from users
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4 gap-1.5"
                onClick={() => setShowElementPicker(true)}
              >
                <Plus className="h-4 w-4" />
                Add Element
              </Button>
            </div>
          )}

          {screen.elements.map((element, index) => (
            <div key={element.id} className="group relative">
              {index > 0 && (
                <button
                  onClick={() => moveElement(index, 'up')}
                  className="absolute -top-1.5 left-1/2 z-10 -translate-x-1/2 rounded bg-white px-2 py-0.5 text-[10px] text-gray-400 opacity-0 shadow-sm border group-hover:opacity-100 hover:text-indigo-600 transition-all"
                >
                  Move up
                </button>
              )}
              <FlowElementConfig
                element={element}
                onChange={updateElement}
                onDelete={() => deleteElement(element.id)}
              />
            </div>
          ))}

          {/* Element picker */}
          {showElementPicker && (
            <div className="rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50/30 p-4">
              <p className="mb-3 text-xs font-medium text-gray-700">Choose element type</p>
              <div className="grid grid-cols-3 gap-2">
                {ELEMENT_TYPES.map((type) => (
                  <button
                    key={type.value}
                    onClick={() => addElement(type.value)}
                    className="flex flex-col items-center gap-1.5 rounded-lg border border-gray-200 bg-white p-3 text-center transition-all hover:border-indigo-300 hover:shadow-sm"
                  >
                    <span className="text-indigo-500">{type.icon}</span>
                    <span className="text-xs font-medium text-gray-700">{type.label}</span>
                  </button>
                ))}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 w-full text-xs text-gray-500"
                onClick={() => setShowElementPicker(false)}
              >
                Cancel
              </Button>
            </div>
          )}

          {screen.elements.length > 0 && !showElementPicker && (
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1.5 border-dashed"
              onClick={() => setShowElementPicker(true)}
            >
              <Plus className="h-4 w-4" />
              Add Element
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <Card className="border-gray-100 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold text-gray-900">Navigation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">After this screen</Label>
            <Select
              value={screen.navigation.type}
              onValueChange={(value: 'next' | 'complete') => {
                if (value === 'complete') {
                  updateScreen('navigation', { type: 'complete' });
                } else {
                  updateScreen('navigation', {
                    type: 'next',
                    nextScreenId: otherScreens[0]?.id || '',
                  });
                }
              }}
            >
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="next">Go to next screen</SelectItem>
                <SelectItem value="complete">Complete flow</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {screen.navigation.type === 'next' && otherScreens.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Next Screen</Label>
              <Select
                value={screen.navigation.nextScreenId || ''}
                onValueChange={(value) =>
                  updateScreen('navigation', { type: 'next', nextScreenId: value })
                }
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select screen" />
                </SelectTrigger>
                <SelectContent>
                  {otherScreens.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.title || 'Untitled Screen'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {screen.navigation.type === 'next' && otherScreens.length === 0 && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Add more screens to enable navigation between them.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

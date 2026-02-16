'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, X, GripVertical, ChevronUp, ChevronDown, Layout } from 'lucide-react';

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

interface FlowScreenListProps {
  screens: FlowScreen[];
  selectedId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
  onReorder: (screens: FlowScreen[]) => void;
}

export function FlowScreenList({
  screens,
  selectedId,
  onSelect,
  onAdd,
  onDelete,
  onReorder,
}: FlowScreenListProps) {
  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newScreens = [...screens];
    [newScreens[index - 1], newScreens[index]] = [newScreens[index], newScreens[index - 1]];
    onReorder(newScreens);
  };

  const handleMoveDown = (index: number) => {
    if (index >= screens.length - 1) return;
    const newScreens = [...screens];
    [newScreens[index], newScreens[index + 1]] = [newScreens[index + 1], newScreens[index]];
    onReorder(newScreens);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-900">Screens</h3>
        <p className="text-xs text-muted-foreground">{screens.length} screen{screens.length !== 1 ? 's' : ''}</p>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {screens.map((screen, index) => (
          <Card
            key={screen.id}
            className={`group relative cursor-pointer transition-all duration-150 ${
              selectedId === screen.id
                ? 'border-indigo-500 bg-indigo-50/50 shadow-sm ring-1 ring-indigo-500'
                : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
            }`}
            onClick={() => onSelect(screen.id)}
          >
            <div className="flex items-start gap-2 p-3">
              <div className="flex flex-col items-center gap-0.5 pt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <GripVertical className="h-3.5 w-3.5 text-gray-400" />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMoveUp(index);
                  }}
                  disabled={index === 0}
                  className="p-0.5 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronUp className="h-3 w-3 text-gray-500" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMoveDown(index);
                  }}
                  disabled={index >= screens.length - 1}
                  className="p-0.5 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronDown className="h-3 w-3 text-gray-500" />
                </button>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <Layout className="h-3.5 w-3.5 text-indigo-500 flex-shrink-0" />
                  <span className="text-sm font-medium text-gray-900 truncate">
                    {screen.title || 'Untitled Screen'}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                    {screen.elements.length} element{screen.elements.length !== 1 ? 's' : ''}
                  </Badge>
                  <Badge
                    variant="secondary"
                    className={`text-[10px] px-1.5 py-0 h-4 ${
                      screen.navigation.type === 'complete'
                        ? 'bg-emerald-50 text-emerald-600'
                        : 'bg-blue-50 text-blue-600'
                    }`}
                  >
                    {screen.navigation.type === 'complete' ? 'End' : 'Next'}
                  </Badge>
                </div>
              </div>

              {screens.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(screen.id);
                  }}
                  className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-100 transition-all"
                >
                  <X className="h-3.5 w-3.5 text-red-500" />
                </button>
              )}
            </div>
          </Card>
        ))}
      </div>

      <div className="border-t p-3">
        <Button onClick={onAdd} variant="outline" className="w-full gap-1.5" size="sm">
          <Plus className="h-4 w-4" />
          Add Screen
        </Button>
      </div>
    </div>
  );
}

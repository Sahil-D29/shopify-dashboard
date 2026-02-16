'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Save, Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { FlowScreenList } from './FlowScreenList';
import { FlowScreenEditor } from './FlowScreenEditor';
import { FlowScreenPreview } from './FlowScreenPreview';

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

interface FlowDefinition {
  screens: FlowScreen[];
}

interface Flow {
  id: string;
  name: string;
  status: string;
  definition: FlowDefinition;
  categories: string[];
  createdAt: string;
  updatedAt: string;
  _count?: { responses: number };
}

interface FlowBuilderProps {
  flowId: string;
}

export function FlowBuilder({ flowId }: FlowBuilderProps) {
  const [flow, setFlow] = useState<Flow | null>(null);
  const [definition, setDefinition] = useState<FlowDefinition>({ screens: [] });
  const [selectedScreenId, setSelectedScreenId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [flowName, setFlowName] = useState('');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch flow on mount
  useEffect(() => {
    async function fetchFlow() {
      try {
        const res = await fetch(`/api/flows/${flowId}`);
        const data = await res.json();
        if (data.success && data.flow) {
          setFlow(data.flow);
          setFlowName(data.flow.name);
          const def = data.flow.definition as FlowDefinition;
          setDefinition(def);
          if (def.screens.length > 0) {
            setSelectedScreenId(def.screens[0].id);
          }
        } else {
          toast.error('Failed to load flow');
        }
      } catch {
        toast.error('Error loading flow');
      } finally {
        setLoading(false);
      }
    }
    fetchFlow();
  }, [flowId]);

  // Auto-save debounced
  const saveFlow = useCallback(
    async (def: FlowDefinition, name?: string) => {
      setSaving(true);
      try {
        const body: Record<string, unknown> = { definition: def };
        if (name !== undefined) body.name = name;
        const res = await fetch(`/api/flows/${flowId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (data.success) {
          setFlow(data.flow);
        } else {
          toast.error('Failed to save flow');
        }
      } catch {
        toast.error('Error saving flow');
      } finally {
        setSaving(false);
      }
    },
    [flowId],
  );

  // Debounce auto-save on definition change
  useEffect(() => {
    if (loading || !flow) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveFlow(definition);
    }, 1500);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [definition, loading, flow, saveFlow]);

  const handleManualSave = async () => {
    await saveFlow(definition, flowName);
    toast.success('Flow saved successfully');
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const res = await fetch(`/api/flows/${flowId}/publish`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setFlow(data.flow);
        toast.success('Flow published successfully');
      } else if (data.validationErrors) {
        data.validationErrors.forEach((err: string) => toast.error(err));
      } else {
        toast.error(data.error || 'Failed to publish flow');
      }
    } catch {
      toast.error('Error publishing flow');
    } finally {
      setPublishing(false);
    }
  };

  const handleDefinitionChange = (newDef: FlowDefinition) => {
    setDefinition(newDef);
  };

  const handleScreenChange = (updatedScreen: FlowScreen) => {
    setDefinition((prev) => ({
      ...prev,
      screens: prev.screens.map((s) => (s.id === updatedScreen.id ? updatedScreen : s)),
    }));
  };

  const handleAddScreen = () => {
    const newId = `screen_${Date.now()}`;
    const newScreen: FlowScreen = {
      id: newId,
      title: `Screen ${definition.screens.length + 1}`,
      elements: [],
      navigation: { type: 'complete' },
    };

    // Update previous last screen navigation to point to new screen
    const screens = definition.screens.map((s, i) => {
      if (i === definition.screens.length - 1 && s.navigation.type === 'complete') {
        return { ...s, navigation: { type: 'next' as const, nextScreenId: newId } };
      }
      return s;
    });

    setDefinition({ screens: [...screens, newScreen] });
    setSelectedScreenId(newId);
  };

  const handleDeleteScreen = (id: string) => {
    if (definition.screens.length <= 1) return;
    const newScreens = definition.screens.filter((s) => s.id !== id);
    // Fix navigation references
    const fixedScreens = newScreens.map((s) => {
      if (s.navigation.nextScreenId === id) {
        return { ...s, navigation: { type: 'complete' as const } };
      }
      return s;
    });
    setDefinition({ screens: fixedScreens });
    if (selectedScreenId === id && fixedScreens.length > 0) {
      setSelectedScreenId(fixedScreens[0].id);
    }
  };

  const handleReorderScreens = (reorderedScreens: FlowScreen[]) => {
    setDefinition({ screens: reorderedScreens });
  };

  const handleNameBlur = () => {
    if (flowName !== flow?.name) {
      saveFlow(definition, flowName);
    }
  };

  const selectedScreen = definition.screens.find((s) => s.id === selectedScreenId);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#FAF9F6]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          <p className="text-sm text-muted-foreground">Loading flow builder...</p>
        </div>
      </div>
    );
  }

  if (!flow) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#FAF9F6]">
        <div className="text-center">
          <p className="text-lg font-medium text-gray-900">Flow not found</p>
          <Link href="/flows" className="mt-2 text-sm text-indigo-600 hover:underline">
            Back to flows
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-[#FAF9F6]">
      {/* Top toolbar */}
      <div className="flex items-center justify-between border-b bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <Link href="/flows">
            <Button variant="ghost" size="icon-sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Input
              value={flowName}
              onChange={(e) => setFlowName(e.target.value)}
              onBlur={handleNameBlur}
              className="h-8 w-64 border-transparent bg-transparent text-lg font-semibold hover:border-gray-300 focus:border-indigo-500"
            />
            <Badge
              variant={flow.status === 'PUBLISHED' ? 'default' : 'secondary'}
              className={
                flow.status === 'PUBLISHED'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-amber-100 text-amber-700'
              }
            >
              {flow.status}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {saving && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Saving...
            </span>
          )}
          <Button variant="outline" size="sm" onClick={handleManualSave} disabled={saving}>
            <Save className="h-4 w-4" />
            Save
          </Button>
          <Button
            size="sm"
            onClick={handlePublish}
            disabled={publishing || flow.status === 'PUBLISHED'}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {publishing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Publish
          </Button>
        </div>
      </div>

      {/* 3-panel layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar - Screen list */}
        <div className="w-64 flex-shrink-0 border-r bg-white">
          <FlowScreenList
            screens={definition.screens}
            selectedId={selectedScreenId}
            onSelect={setSelectedScreenId}
            onAdd={handleAddScreen}
            onDelete={handleDeleteScreen}
            onReorder={handleReorderScreens}
          />
        </div>

        {/* Center - Screen editor */}
        <div className="flex-1 overflow-y-auto p-6">
          {selectedScreen ? (
            <FlowScreenEditor
              screen={selectedScreen}
              onChange={handleScreenChange}
              allScreens={definition.screens}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-muted-foreground">Select a screen to edit</p>
            </div>
          )}
        </div>

        {/* Right - Preview */}
        <div className="w-80 flex-shrink-0 border-l bg-gray-50 p-4">
          {selectedScreen ? (
            <FlowScreenPreview screen={selectedScreen} flowName={flowName} />
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-muted-foreground">Select a screen to preview</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

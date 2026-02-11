"use client";

import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { JourneyDefinition } from '@/lib/types/journey';

export interface JourneySettingsDrawerProps {
  open: boolean;
  settings: JourneyDefinition['settings'] | undefined;
  onClose: () => void;
  onSave: (settings: JourneyDefinition['settings']) => void;
}

const defaultSettings = {
  entry: {
    frequency: 'once' as const,
  },
  exit: {
    onGoal: true,
  },
  allowReentry: false,
  reentryCooldownDays: undefined,
  testMode: false,
  testPhoneNumbers: [],
} satisfies JourneyDefinition['settings'];

function sanitizeSettings(settings?: JourneyDefinition['settings']): JourneyDefinition['settings'] {
  const base = { ...defaultSettings };
  if (!settings) return base;
  const { entry: _, exit: __, testPhoneNumbers: ___, ...restSettings } = settings;
  return {
    ...base,
    ...restSettings,
    entry: {
      ...(base.entry ?? { frequency: 'once' }),
      ...(settings.entry || {}),
      frequency: (settings.entry?.frequency ?? base.entry?.frequency) ?? 'once',
    },
    exit: {
      ...base.exit,
      ...(settings.exit || {}),
    },
    testPhoneNumbers: Array.isArray(settings.testPhoneNumbers) ? settings.testPhoneNumbers : base.testPhoneNumbers,
  };
}

export function JourneySettingsDrawer({ open, settings, onClose, onSave }: JourneySettingsDrawerProps) {
  const normalized = useMemo(() => sanitizeSettings(settings), [settings]);
  const [draft, setDraft] = useState<JourneyDefinition['settings']>(normalized);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      setDraft(normalized);
    });
    return () => cancelAnimationFrame(frame);
  }, [normalized, open]);

  const handleEntryFrequency = (frequency: 'once' | 'multiple') => {
    setDraft(prev => ({
      ...prev,
      entry: {
        ...(prev?.entry || { frequency: 'once' }),
        frequency,
      },
    }));
  };

  const handleEntryLimit = (value?: number) => {
    setDraft(prev => ({
      ...prev,
      entry: {
        ...(prev?.entry || { frequency: 'once' }),
        maxEntries: value,
      },
    }));
  };

  const handleSettingChange = (patch: Partial<JourneyDefinition['settings']>) => {
    setDraft(prev => {
      if (!prev) return sanitizeSettings(patch as JourneyDefinition['settings'] | undefined);
      const entryPatch = patch?.entry;
      const { entry: _, ...restPatch } = patch as any;
      return {
        ...prev,
        ...restPatch,
        entry: entryPatch
          ? {
              ...(prev.entry ?? { frequency: 'once' }),
              ...entryPatch,
              frequency: entryPatch.frequency ?? prev.entry?.frequency ?? 'once',
            }
          : prev.entry ?? { frequency: 'once' },
      };
    });
  };

  const handleSave = () => {
    onSave(sanitizeSettings(draft));
    onClose();
  };

  const handleCancel = () => {
    setDraft(normalized);
    onClose();
  };

  if (!open) return null;

  const phoneNumbersValue = (draft?.testPhoneNumbers || []).join(', ');

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-slate-900/40" onClick={handleCancel} />
      <aside className="relative ml-auto flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-slate-200 bg-white shadow-xl">
        <header className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Journey Settings</p>
            <h2 className="text-xl font-semibold text-slate-900">Automation Controls</h2>
          </div>
          <button
            type="button"
            className="rounded-full border border-transparent p-2 text-slate-400 transition hover:border-slate-200 hover:text-slate-600"
            onClick={handleCancel}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 space-y-6 px-6 py-6 text-sm text-slate-600">
          <section className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-slate-500">Entry Frequency</Label>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: 'Once per customer', value: 'once' as const },
                  { label: 'Multiple times', value: 'multiple' as const },
                ].map(option => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleEntryFrequency(option.value)}
                    className={
                      draft?.entry?.frequency === option.value
                        ? 'rounded-full border border-blue-400 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600 shadow-sm'
                        : 'rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:border-blue-200 hover:text-blue-600'
                    }
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            {draft?.entry?.frequency === 'multiple' ? (
              <div className="space-y-2">
                <Label htmlFor="maxEntries">Max entries per customer</Label>
                <Input
                  id="maxEntries"
                  type="number"
                  min={1}
                  placeholder="Unlimited"
                  value={draft?.entry?.maxEntries ?? ''}
                  onChange={event => handleEntryLimit(event.target.value ? Number(event.target.value) : undefined)}
                />
              </div>
            ) : null}
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase tracking-wide text-slate-500">Allow Re-entry</Label>
              <input
                type="checkbox"
                checked={Boolean(draft?.allowReentry)}
                onChange={event => handleSettingChange({ allowReentry: event.target.checked })}
              />
            </div>
            {draft?.allowReentry ? (
              <div className="space-y-2">
                <Label htmlFor="reentryCooldown">Cooldown (days)</Label>
                <Input
                  id="reentryCooldown"
                  type="number"
                  min={0}
                  value={draft?.reentryCooldownDays ?? ''}
                  onChange={event => handleSettingChange({ reentryCooldownDays: event.target.value ? Number(event.target.value) : undefined })}
                />
              </div>
            ) : null}
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase tracking-wide text-slate-500">Test Mode</Label>
              <input
                type="checkbox"
                checked={Boolean(draft?.testMode)}
                onChange={event => handleSettingChange({ testMode: event.target.checked })}
              />
            </div>
            {draft?.testMode ? (
              <div className="space-y-2">
                <Label htmlFor="testPhones">Test phone numbers</Label>
                <Textarea
                  id="testPhones"
                  rows={3}
                  placeholder="Comma separated phone numbers"
                  value={phoneNumbersValue}
                  onChange={event =>
                    handleSettingChange({
                      testPhoneNumbers: event.target.value
                        .split(',')
                        .map(entry => entry.trim())
                        .filter(Boolean),
                    })
                  }
                />
                <p className="text-xs text-slate-400">Only these numbers will receive messages while test mode is active.</p>
              </div>
            ) : null}
          </section>

          <section className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Input
                id="timezone"
                placeholder="e.g. Asia/Kolkata"
                value={draft?.timezone ?? ''}
                onChange={event => handleSettingChange({ timezone: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="autoExit">Auto exit after (days)</Label>
              <Input
                id="autoExit"
                type="number"
                min={0}
                value={draft?.exit?.autoExitAfterDays ?? ''}
                onChange={event =>
                  handleSettingChange({
                    exit: {
                      ...(draft?.exit || {}),
                      autoExitAfterDays: event.target.value ? Number(event.target.value) : undefined,
                      onGoal: draft?.exit?.onGoal ?? true,
                    },
                  })
                }
              />
            </div>
          </section>

          <section className="space-y-2">
            <Label htmlFor="goalDescription">Goal description</Label>
            <Textarea
              id="goalDescription"
              rows={3}
              placeholder="What success looks like for this journey"
              value={draft?.goalDescription ?? ''}
              onChange={event => handleSettingChange({ goalDescription: event.target.value })}
            />
          </section>
        </div>

        <footer className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4">
          <Button variant="outline" className="border-slate-200 text-slate-600" onClick={handleCancel}>
            Cancel
          </Button>
          <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={handleSave}>
            Save Settings
          </Button>
        </footer>
      </aside>
    </div>
  );
}



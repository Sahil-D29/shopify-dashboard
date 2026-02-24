"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Clock3,
  Cog,
  GitBranch,
  Loader2,
  MessageCircle,
  Pause,
  Play,
  Plus,
  Save,
  Settings2,
  ShieldCheck,
  ShieldAlert,
  Tag,
  Target,
  TestTube2,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export interface JourneyToolbarProps {
  name: string;
  status: 'draft' | 'active' | 'paused';
  testMode: boolean;
  viewMode?: 'builder' | 'analytics';
  lastSavedAt?: Date | null;
  validationSummary?: {
    status: 'pass' | 'needs_attention' | 'fail';
    errors: number;
    warnings: number;
    evaluatedAt?: Date | null;
  } | null;
  onNameChange?: (name: string) => void;
  onSave?: () => void;
  onToggleStatus?: () => void;
  onToggleTestMode?: () => void;
  onOpenSettings?: () => void;
  onAddTrigger?: () => void;
  onAddDelay?: () => void;
  onAddCondition?: () => void;
  onAddExperiment?: () => void;
  onAddAction?: (type: 'whatsapp' | 'add_tag' | 'update_property') => void;
  onAddGoal?: () => void;
  onBack?: () => void;
  isSaving?: boolean;
  onValidate?: () => void;
  isValidating?: boolean;
  isStatusUpdating?: boolean;
  onCreateSnapshot?: () => void;
  isSnapshotting?: boolean;
  onChangeView?: (view: 'builder' | 'analytics') => void;
}

const statusTokens: Record<JourneyToolbarProps['status'], { label: string; tone: string }> = {
  draft: { label: 'Draft', tone: '#8B7F76' },
  active: { label: 'Active', tone: '#2F7A3E' },
  paused: { label: 'Paused', tone: '#B3843B' },
};

const ACTION_MENU_OPTIONS: Array<{
  id: 'whatsapp' | 'add_tag' | 'update_property';
  label: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    id: 'whatsapp',
    label: 'Send WhatsApp',
    description: 'Pick an approved template and map variables.',
    icon: MessageCircle,
  },
  {
    id: 'add_tag',
    label: 'Add Tag',
    description: 'Attach a customer tag for future targeting.',
    icon: Tag,
  },
  {
    id: 'update_property',
    label: 'Update Property',
    description: 'Modify customer profile attributes.',
    icon: Settings2,
  },
];

export function JourneyToolbar({
  name,
  status,
  testMode,
  viewMode = 'builder',
  lastSavedAt,
  validationSummary,
  onNameChange,
  onSave,
  onToggleStatus,
  onToggleTestMode,
  onOpenSettings,
  onAddTrigger,
  onAddDelay,
  onAddCondition,
  onAddExperiment,
  onAddAction,
  onAddGoal,
  onBack,
  isSaving,
  onValidate,
  isValidating,
  isStatusUpdating,
  onCreateSnapshot,
  isSnapshotting,
  onChangeView,
}: JourneyToolbarProps) {
  const [localName, setLocalName] = useState(name);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const actionMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setLocalName(name);
  }, [name]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!actionMenuRef.current) return;
      if (!actionMenuRef.current.contains(event.target as Node)) {
        setActionMenuOpen(false);
      }
    };

    if (actionMenuOpen) {
      document.addEventListener('mousedown', handleClick);
    }

    return () => {
      document.removeEventListener('mousedown', handleClick);
    };
  }, [actionMenuOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActionMenuOpen(false);
      }
    };

    if (actionMenuOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [actionMenuOpen]);

  const handleNameBlur = () => {
    if (localName.trim() && localName !== name) {
      onNameChange?.(localName.trim());
    } else {
      setLocalName(name);
    }
  };

  const statusMeta = statusTokens[status];

  const savedAtLabel = useMemo(() => {
    if (isSaving) return 'Saving…';
    if (!lastSavedAt) return 'Not saved yet';
    const distance = formatDistanceToNow(lastSavedAt, { addSuffix: true }).replace('about ', '');
    return `Saved ${distance}`;
  }, [isSaving, lastSavedAt]);

  const validationMeta = useMemo(() => {
    if (!validationSummary) return null;
    const tone =
      validationSummary.status === 'pass'
        ? '#2F7A3E'
        : validationSummary.status === 'needs_attention'
          ? '#B3843B'
          : '#B45151';
    const Icon =
      validationSummary.status === 'pass' ? ShieldCheck : validationSummary.status === 'needs_attention' ? ShieldAlert : AlertTriangle;
    const label =
      validationSummary.status === 'pass'
        ? 'Validation passed'
        : validationSummary.status === 'needs_attention'
          ? `${validationSummary.warnings} warning${validationSummary.warnings === 1 ? '' : 's'}`
          : `${validationSummary.errors} blocker${validationSummary.errors === 1 ? '' : 's'}`;
    const evaluatedLabel =
      validationSummary.evaluatedAt instanceof Date
        ? formatDistanceToNow(validationSummary.evaluatedAt, { addSuffix: true }).replace('about ', '')
        : null;
    return {
      tone,
      Icon,
      label,
      evaluatedLabel,
    };
  }, [validationSummary]);

  const handleActionSelect = (id: 'whatsapp' | 'add_tag' | 'update_property') => {
    onAddAction?.(id);
    setActionMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-30 border-b border-[#E8E4DE] bg-white/85 px-2 sm:px-3 lg:px-4 py-2 sm:py-3 text-[#4A4139] backdrop-blur">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-2 lg:gap-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3 w-full lg:w-auto lg:max-w-[280px] xl:max-w-[320px]">
          <button
            type="button"
            onClick={() => (onBack ? onBack() : window.history.back())}
            className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg border border-[#E8E4DE] bg-[#F5F3EE] text-[#8B7F76] transition hover:scale-105 hover:text-[#4A4139] shrink-0"
            aria-label="Back to journeys"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex flex-1 flex-col gap-1 min-w-0">
            <input
              value={localName}
              onChange={event => setLocalName(event.target.value)}
              onBlur={handleNameBlur}
              placeholder="Untitled Journey"
              className="w-full rounded-md border border-[#E8E4DE] bg-white px-2 sm:px-3 py-1 sm:py-1.5 text-sm sm:text-base font-semibold tracking-tight text-[#4A4139] placeholder:text-[#C1B7AF] focus:border-[#D4A574] focus:outline-none focus:ring-2 focus:ring-[#D4A574]/30"
            />
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs font-medium text-[#8B7F76]">
              <span
                className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full bg-[#F5F3EE] px-2 sm:px-3 py-0.5 sm:py-1 uppercase tracking-wide text-[10px] sm:text-xs"
                style={{ color: statusMeta.tone }}
              >
                <span
                  className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full"
                  style={{ backgroundColor: statusMeta.tone }}
                />
                {statusMeta.label}
              </span>
              <span className="flex items-center gap-1 text-[10px] sm:text-xs">
                <Clock3 className="h-3 w-3" />
                <span className="hidden sm:inline">{savedAtLabel}</span>
                <span className="sm:hidden">{isSaving ? 'Saving…' : lastSavedAt ? 'Saved' : 'Unsaved'}</span>
              </span>
              {validationMeta ? (
                <button
                  type="button"
                  onClick={() => onValidate?.()}
                  className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full bg-[#F5F3EE] px-2 sm:px-3 py-0.5 sm:py-1 uppercase tracking-wide text-left transition hover:bg-[#E8E4DE] text-[10px] sm:text-xs"
                  style={{ color: validationMeta.tone }}
                >
                  <validationMeta.Icon className="h-3 w-3" style={{ color: validationMeta.tone }} />
                  <span className="hidden sm:inline">{validationMeta.label}</span>
                  <span className="sm:hidden">{validationSummary?.errors || validationSummary?.warnings || 'OK'}</span>
                  {validationMeta.evaluatedLabel ? (
                    <span className="hidden sm:inline text-[10px] lowercase text-[#8B7F76]">({validationMeta.evaluatedLabel})</span>
                  ) : null}
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 pt-0.5 lg:justify-center w-full lg:w-auto scrollbar-thin">
          <button
            type="button"
            onClick={() => onAddTrigger?.()}
            className="group flex shrink-0 items-center gap-1 sm:gap-1.5 rounded-md bg-[#F5F3EE] px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs font-semibold text-[#4A4139] transition hover:bg-[#D4A574] hover:text-white min-h-[36px]"
          >
            <Zap className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Trigger</span>
            <span className="sm:hidden">Trg</span>
          </button>
          <button
            type="button"
            onClick={() => onAddDelay?.()}
            className="group flex shrink-0 items-center gap-1 sm:gap-1.5 rounded-md bg-[#F5F3EE] px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs font-semibold text-[#4A4139] transition hover:bg-[#D4A574] hover:text-white min-h-[36px]"
          >
            <Clock3 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Delay</span>
            <span className="sm:hidden">Dly</span>
          </button>
          <button
            type="button"
            onClick={() => onAddCondition?.()}
            className="group flex shrink-0 items-center gap-1 sm:gap-1.5 rounded-md bg-[#F5F3EE] px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs font-semibold text-[#4A4139] transition hover:bg-[#D4A574] hover:text-white min-h-[36px]"
          >
            <GitBranch className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Condition</span>
            <span className="sm:hidden">Cnd</span>
          </button>
          <button
            type="button"
            onClick={() => onAddExperiment?.()}
            className="group flex shrink-0 items-center gap-1 sm:gap-1.5 rounded-md bg-[#F5F3EE] px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs font-semibold text-[#4A4139] transition hover:bg-[#D4A574] hover:text-white min-h-[36px]"
          >
            <TestTube2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">A/B Test</span>
            <span className="sm:hidden">A/B</span>
          </button>
          <div className="relative" ref={actionMenuRef}>
            <button
              type="button"
              onClick={() => setActionMenuOpen(prev => !prev)}
              className={cn(
                'group flex shrink-0 items-center gap-1 sm:gap-1.5 rounded-md bg-[#F5F3EE] px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs font-semibold text-[#4A4139] transition hover:bg-[#D4A574] hover:text-white min-h-[36px]',
                actionMenuOpen && 'bg-[#D4A574] text-white'
              )}
              aria-expanded={actionMenuOpen}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Action</span>
              <span className="sm:hidden">Act</span>
            </button>
            {actionMenuOpen ? (
              <div className="absolute right-0 z-50 mt-3 w-56 sm:w-64 rounded-xl border border-[#E8E4DE] bg-white p-2 shadow-xl">
                {ACTION_MENU_OPTIONS.map(option => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleActionSelect(option.id)}
                      className="flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left text-sm text-[#4A4139] transition hover:bg-[#F5F3EE]"
                    >
                      <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-[#F5F3EE] text-[#8B7F76]">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="flex flex-col">
                        <span className="font-semibold">{option.label}</span>
                        <span className="text-xs text-[#8B7F76]">{option.description}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => onAddGoal?.()}
            className="group flex shrink-0 items-center gap-1 sm:gap-1.5 rounded-md bg-[#F5F3EE] px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs font-semibold text-[#4A4139] transition hover:bg-[#D4A574] hover:text-white min-h-[36px]"
          >
            <Target className="h-3.5 w-3.5" />
            <span>Goal</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2 w-full lg:w-auto">
          <div className="flex items-center gap-0.5 rounded-full border border-[#E8E4DE] bg-white p-0.5">
            <button
              type="button"
              onClick={() => onChangeView?.('builder')}
              className={cn(
                'rounded-full px-2 sm:px-2.5 py-1 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide transition min-h-[32px]',
                viewMode === 'builder' ? 'bg-[#4A4139] text-white' : 'text-[#8B7F76] hover:bg-[#F5F3EE]'
              )}
            >
              Build
            </button>
            <button
              type="button"
              onClick={() => onChangeView?.('analytics')}
              className={cn(
                'rounded-full px-2 sm:px-2.5 py-1 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide transition min-h-[32px]',
                viewMode === 'analytics' ? 'bg-[#4A4139] text-white' : 'text-[#8B7F76] hover:bg-[#F5F3EE]'
              )}
            >
              Stats
            </button>
          </div>
          <button
            type="button"
            onClick={() => onToggleTestMode?.()}
            className={cn(
              'hidden lg:flex items-center gap-1.5 rounded-full border border-[#E8E4DE] px-2.5 py-1.5 text-[11px] font-semibold transition min-h-[32px]',
              testMode ? 'bg-[#D4A574] text-white' : 'bg-white text-[#8B7F76] hover:bg-[#F5F3EE]'
            )}
            aria-pressed={testMode}
          >
            <span className="relative inline-flex h-4 w-8 items-center rounded-full bg-[#F5F3EE]">
              <span
                className={cn(
                  'absolute inline-flex h-3 w-3 rounded-full bg-white shadow transition-transform',
                  testMode ? 'translate-x-4' : 'translate-x-0.5'
                )}
              />
            </span>
            Test
          </button>
          <button
            type="button"
            onClick={() => onToggleStatus?.()}
            className={cn(
              'flex items-center gap-1 rounded-full border border-[#E8E4DE] bg-white px-2 py-1.5 text-[11px] font-semibold text-[#4A4139] transition hover:bg-[#F5F3EE] min-h-[32px]',
              (isStatusUpdating || isValidating) && 'cursor-not-allowed opacity-60'
            )}
            aria-pressed={status === 'active'}
            disabled={isStatusUpdating || isValidating}
          >
            {isStatusUpdating ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : status === 'active' ? (
              <Pause className="h-3 w-3 text-[#8B7F76]" />
            ) : (
              <Play className="h-3 w-3 text-[#8B7F76]" />
            )}
            <span className="hidden sm:inline">{isStatusUpdating ? '...' : status === 'active' ? 'Pause' : 'Activate'}</span>
          </button>
          <button
            type="button"
            onClick={() => onValidate?.()}
            disabled={isValidating}
            className={cn(
              'hidden sm:flex items-center gap-1 rounded-md border border-[#E8E4DE] bg-white px-2 py-1.5 text-[11px] font-semibold text-[#4A4139] transition hover:bg-[#F5F3EE] min-h-[32px]',
              isValidating && 'cursor-progress opacity-60'
            )}
          >
            {isValidating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5 text-[#2F7A3E]" />}
            <span className="hidden lg:inline">{isValidating ? '...' : 'Check'}</span>
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-[#E8E4DE] bg-white text-[#8B7F76] transition hover:bg-[#F5F3EE] min-h-[32px] min-w-[32px]"
            aria-label="Journey settings"
          >
            <Cog className="h-3.5 w-3.5" />
          </button>
          {onCreateSnapshot ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="hidden xl:flex border-[#E8E4DE] bg-white text-[#4A4139] hover:bg-[#F5F3EE] text-[11px] h-8"
              onClick={onCreateSnapshot}
              disabled={isSnapshotting}
            >
              {isSnapshotting ? '...' : 'Snapshot'}
            </Button>
          ) : null}
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="rounded-md bg-[#D4A574] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#B8835D] disabled:cursor-not-allowed disabled:opacity-60 min-h-[32px]"
          >
            <div className="flex items-center gap-1.5">
              <Save className="h-3.5 w-3.5" />
              <span>{isSaving ? '...' : 'Save'}</span>
            </div>
          </button>
        </div>
      </div>
    </header>
  );
}



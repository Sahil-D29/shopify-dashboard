'use client';

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type Dispatch,
} from 'react';

import type {
  TriggerConfigState,
  TriggerReachPreview,
  TriggerType,
  EventFilter,
  Rule,
  UserPropertyFilter,
  PreviewRequestPayload,
} from './types';
import { TriggerHeaderSummary } from './TriggerHeaderSummary';
import { TriggerTypeSelector } from './TriggerTypeSelector';
import { EventSelector } from './EventSelector';
import { EventPropertiesFilters } from './EventPropertiesFilters';
import { RulesFrequency } from './RulesFrequency';
import { UserPropertyFilters } from './UserPropertyFilters';
import { ReachPreviewSummary } from './ReachPreviewSummary';
import { fetchReachPreview } from './api';
import { useDebouncedValue } from './useDebouncedValue';
import { ValidationSummary } from './ValidationSummary';

export interface TriggerConfigProps {
  initialState?: Partial<TriggerConfigState>;
  onChange?: (state: TriggerConfigState) => void;
  onSave?: (state: TriggerConfigState) => void;
  onStatusChange?: (status: 'draft' | 'active', state: TriggerConfigState) => void;
  disabled?: boolean;
}

type TriggerConfigAction =
  | { type: 'SET_NAME'; payload: { name: string; description?: string } }
  | { type: 'SET_STATUS'; payload: 'draft' | 'active' }
  | { type: 'SET_TRIGGER_TYPE'; payload: TriggerType }
  | { type: 'SET_EVENTS'; payload: string[] }
  | { type: 'SET_EVENT_FILTERS'; payload: EventFilter[] }
  | { type: 'SET_RULES'; payload: Rule[] }
  | { type: 'SET_USER_FILTERS'; payload: UserPropertyFilter[] }
  | { type: 'TOGGLE_USER_FILTERS'; payload: boolean }
  | { type: 'SET_PREVIEW'; payload: TriggerReachPreview | null }
  | { type: 'SET_VALIDITY'; payload: boolean }
  | { type: 'RESET'; payload?: Partial<TriggerConfigState> };

export const initialTriggerConfigState: TriggerConfigState = {
  name: 'New Trigger',
  description: '',
  status: 'draft',
  triggerType: 'event',
  events: [],
  eventFilters: [],
  rules: [],
  userFilters: [],
  preview: null,
  isValid: false,
  showUserFilters: false,
};

export function triggerConfigReducer(
  state: TriggerConfigState,
  action: TriggerConfigAction,
): TriggerConfigState {
  switch (action.type) {
    case 'SET_NAME':
      return {
        ...state,
        name: action.payload.name,
        description: action.payload.description ?? state.description,
      };
    case 'SET_STATUS':
      return {
        ...state,
        status: action.payload,
      };
    case 'SET_TRIGGER_TYPE':
      return {
        ...state,
        triggerType: action.payload,
        ...(action.payload !== 'event'
          ? {
              events: [],
              eventFilters: [],
              rules: [],
            }
          : {}),
      };
    case 'SET_EVENTS':
      return {
        ...state,
        events: action.payload,
      };
    case 'SET_EVENT_FILTERS':
      return {
        ...state,
        eventFilters: action.payload,
      };
    case 'SET_RULES':
      return {
        ...state,
        rules: action.payload,
      };
    case 'SET_USER_FILTERS':
      return {
        ...state,
        userFilters: action.payload,
      };
    case 'TOGGLE_USER_FILTERS':
      return {
        ...state,
        showUserFilters: action.payload,
        userFilters: action.payload ? state.userFilters : [],
      };
    case 'SET_PREVIEW':
      return {
        ...state,
        preview: action.payload,
      };
    case 'SET_VALIDITY':
      return {
        ...state,
        isValid: action.payload,
      };
    case 'RESET':
      return {
        ...initialTriggerConfigState,
        ...action.payload,
      };
    default:
      return state;
  }
}

export const TriggerConfigStateContext = createContext<TriggerConfigState | undefined>(undefined);
export const TriggerConfigDispatchContext =
  createContext<Dispatch<TriggerConfigAction> | undefined>(undefined);

export function TriggerConfig({ initialState, onChange, onSave, onStatusChange, disabled }: TriggerConfigProps) {
  const [state, dispatch] = useReducer(
    triggerConfigReducer,
    initialState,
    (payload?: Partial<TriggerConfigState>) => ({
      ...initialTriggerConfigState,
      ...payload,
    }),
  );
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPreviewLoading, setPreviewLoading] = useState(false);
  const latestPayloadRef = useRef<PreviewRequestPayload | null>(null);
  const [showValidation, setShowValidation] = useState(false);

  useEffect(() => {
    onChange?.(state);
  }, [state, onChange]);

  const previewPayload = useMemo<PreviewRequestPayload>(() => {
    return {
      events: state.events,
      eventFilters: state.eventFilters,
      rules: state.rules,
      userFilters: state.showUserFilters ? state.userFilters : [],
    };
  }, [state.events, state.eventFilters, state.rules, state.userFilters, state.showUserFilters]);

  const debouncedPayload = useDebouncedValue(previewPayload, 750);

  const previewEligible = state.triggerType === 'event' && state.events.length > 0;

  const validation = useMemo(() => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (state.triggerType === 'event' && state.events.length === 0) {
      errors.push('Select at least one event to trigger this journey.');
    }

    if (state.triggerType === 'event') {
      state.eventFilters.forEach((filter, index) => {
        if (!filter.property) {
          errors.push(`Filter ${index + 1}: choose a property.`);
        }
        if (!filter.operator) {
          errors.push(`Filter ${index + 1}: choose an operator.`);
        }
        if (filter.operator !== 'exists') {
          const hasValue =
            filter.value !== undefined &&
            filter.value !== null &&
            String(filter.value).trim().length > 0;
          if (!hasValue) {
            errors.push(`Filter ${index + 1}: enter a value.`);
          }
        }
      });
    }

    state.rules.forEach(rule => {
      if (rule.type === 'count') {
        const count = rule.count ?? 0;
        if (count <= 0) {
          errors.push('Rule: occurrence count must be at least 1.');
        }
      }
      if (rule.type === 'withinWindow') {
        const windowValue = rule.window?.value ?? 0;
        if (windowValue <= 0) {
          errors.push('Rule: time window must be greater than zero.');
        }
      }
    });

    const hasFirstTimeRule = state.rules.some(rule => rule.type === 'firstTime');
    const countRule = state.rules.find(rule => rule.type === 'count');
    if (hasFirstTimeRule && countRule && (countRule.count ?? 1) > 1) {
      warnings.push('First-time users combined with multiple occurrences may never match.');
    }

    if (state.showUserFilters) {
      state.userFilters.forEach((filter, index) => {
        if (!filter.property) {
          errors.push(`User filter ${index + 1}: choose a property.`);
        }
        if (!filter.operator) {
          errors.push(`User filter ${index + 1}: choose an operator.`);
        }
        if (filter.operator !== 'exists') {
          const hasValue =
            filter.value !== undefined &&
            filter.value !== null &&
            String(filter.value).trim().length > 0;
          if (!hasValue) {
            errors.push(`User filter ${index + 1}: enter a value.`);
          }
        }
      });
    }

    return { errors, warnings };
  }, [state]);

  const runPreview = useCallback(
    async (payload: PreviewRequestPayload) => {
      if (!previewEligible || validation.errors.length > 0) return;
      try {
        setPreviewError(null);
        setPreviewLoading(true);
        const response = await fetchReachPreview(payload);
        dispatch({
          type: 'SET_PREVIEW',
          payload: {
            estimatedCount: response.estimatedCount,
            lastUpdated: new Date().toISOString(),
            breakdown: response.breakdown,
          },
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unable to calculate reach preview';
        setPreviewError(message);
        dispatch({ type: 'SET_PREVIEW', payload: null });
      } finally {
        setPreviewLoading(false);
      }
    },
    [previewEligible, validation.errors.length],
  );

  useEffect(() => {
    latestPayloadRef.current = previewPayload;
  }, [previewPayload]);

  useEffect(() => {
    if (!previewEligible || validation.errors.length > 0) {
      dispatch({ type: 'SET_PREVIEW', payload: null });
      setPreviewError(null);
      setPreviewLoading(false);
      return;
    }
    latestPayloadRef.current = debouncedPayload;
    void runPreview(debouncedPayload);
  }, [debouncedPayload, previewEligible, validation.errors.length, runPreview]);

  useEffect(() => {
    const computedValidity = validation.errors.length === 0;
    if (computedValidity !== state.isValid) {
      dispatch({ type: 'SET_VALIDITY', payload: computedValidity });
    }
  }, [validation.errors.length, state.isValid]);

  useEffect(() => {
    if (validation.errors.length === 0) {
      setShowValidation(false);
    }
  }, [validation.errors.length]);

  const handleStatusChange = (nextStatus: 'draft' | 'active') => {
    if (nextStatus === state.status) return;
    if (nextStatus === 'active' && validation.errors.length > 0) {
      setShowValidation(true);
      return;
    }
    const nextState = { ...state, status: nextStatus };
    dispatch({ type: 'SET_STATUS', payload: nextStatus });
    onStatusChange?.(nextStatus, nextState);
  };

  const handleSave = () => {
    if (validation.errors.length > 0) {
      setShowValidation(true);
      return;
    }
    onSave?.(state);
  };

  const contextValue = useMemo(() => state, [state]);

  return (
    <TriggerConfigStateContext.Provider value={contextValue}>
      <TriggerConfigDispatchContext.Provider value={dispatch}>
        <div className="flex flex-col gap-6">
          <TriggerHeaderSummary
            state={state}
            errors={validation.errors}
            warnings={validation.warnings}
            onReset={() => {
              dispatch({ type: 'RESET' });
              setShowValidation(false);
            }}
            onNameChange={(name, description) =>
              dispatch({ type: 'SET_NAME', payload: { name, description } })
            }
            onStatusChange={handleStatusChange}
            onSave={handleSave}
          />
          <ValidationSummary
            errors={validation.errors}
            warnings={validation.warnings}
            visible={showValidation}
          />
          <TriggerTypeSelector
            value={state.triggerType}
            onChange={payload => dispatch({ type: 'SET_TRIGGER_TYPE', payload })}
            disabled={disabled}
          />
          {state.triggerType === 'event' ? (
            <>
              <EventSelector
                selectedEvents={state.events}
                onChange={events => dispatch({ type: 'SET_EVENTS', payload: events })}
                disabled={disabled}
              />
              <EventPropertiesFilters
                events={state.events}
                filters={state.eventFilters}
                onChange={filters => dispatch({ type: 'SET_EVENT_FILTERS', payload: filters })}
                disabled={disabled}
              />
              <RulesFrequency
                rules={state.rules}
                onChange={rules => dispatch({ type: 'SET_RULES', payload: rules })}
                disabled={disabled}
              />
            </>
          ) : null}
          <UserPropertyFilters
            enabled={state.showUserFilters}
            filters={state.userFilters}
            onToggle={value => dispatch({ type: 'TOGGLE_USER_FILTERS', payload: value })}
            onChange={filters => dispatch({ type: 'SET_USER_FILTERS', payload: filters })}
            disabled={disabled}
          />
          <ReachPreviewSummary
            preview={state.preview}
            isLoading={isPreviewLoading}
            error={previewError}
            isEligible={previewEligible && validation.errors.length === 0}
            onManualRefresh={() => {
              if (previewEligible && latestPayloadRef.current) {
                void runPreview(latestPayloadRef.current);
              }
            }}
          />
        </div>
      </TriggerConfigDispatchContext.Provider>
    </TriggerConfigStateContext.Provider>
  );
}

TriggerConfig.displayName = 'TriggerConfig';


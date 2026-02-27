'use client';

import { useState, useCallback } from 'react';
import {
  Plus,
  Trash2,
  Clock,
  Eye,
  EyeOff,
  MousePointerClick,
  ShoppingCart,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  Zap,
  ArrowDown,
  GripVertical,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────

export interface FollowUpStep {
  id: string;
  stepIndex: number;
  name: string;
  condition: FollowUpCondition;
  delayMinutes: number;
  messageBody: string;
  templateName?: string;
  useSmartWindow: boolean;
}

export type FollowUpCondition =
  | 'NOT_READ'
  | 'READ'
  | 'NOT_CLICKED'
  | 'CLICKED'
  | 'NOT_CONVERTED'
  | 'CONVERTED'
  | 'REPLIED'
  | 'NOT_REPLIED';

// ─── Constants ─────────────────────────────────────────────────────

const CONDITION_OPTIONS: Array<{
  value: FollowUpCondition;
  label: string;
  emoji: string;
  description: string;
  color: string;
}> = [
  { value: 'NOT_READ', label: 'Not Opened', emoji: '🔕', description: 'Customer didn\'t read the message', color: '#E8685A' },
  { value: 'READ', label: 'Opened', emoji: '👁️', description: 'Customer read/opened the message', color: '#4CAF50' },
  { value: 'NOT_CLICKED', label: 'Opened but No Click', emoji: '🔗', description: 'Read but didn\'t click any button', color: '#FF9800' },
  { value: 'CLICKED', label: 'Clicked', emoji: '🖱️', description: 'Customer clicked a button/link', color: '#2196F3' },
  { value: 'NOT_CONVERTED', label: 'Clicked but No Purchase', emoji: '🛒', description: 'Clicked but didn\'t place an order', color: '#FF5722' },
  { value: 'CONVERTED', label: 'Purchased', emoji: '✅', description: 'Customer placed an order', color: '#4CAF50' },
  { value: 'REPLIED', label: 'Replied', emoji: '💬', description: 'Customer sent a reply message', color: '#9C27B0' },
  { value: 'NOT_REPLIED', label: 'No Reply', emoji: '🤫', description: 'Customer didn\'t reply', color: '#795548' },
];

const DELAY_PRESETS = [
  { label: '30 min', value: 30 },
  { label: '1 hour', value: 60 },
  { label: '2 hours', value: 120 },
  { label: '4 hours', value: 240 },
  { label: '12 hours', value: 720 },
  { label: '24 hours', value: 1440 },
  { label: '48 hours', value: 2880 },
  { label: '72 hours', value: 4320 },
];

const MAX_FOLLOW_UPS = 5;

// ─── Component ─────────────────────────────────────────────────────

interface FollowUpBuilderProps {
  steps: FollowUpStep[];
  onChange: (steps: FollowUpStep[]) => void;
}

export default function FollowUpBuilder({ steps, onChange }: FollowUpBuilderProps) {
  const [expandedStep, setExpandedStep] = useState<string | null>(
    steps.length > 0 ? steps[0].id : null,
  );

  const addStep = useCallback(() => {
    if (steps.length >= MAX_FOLLOW_UPS) return;
    const newStep: FollowUpStep = {
      id: `step_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      stepIndex: steps.length + 1,
      name: `Follow-Up ${steps.length + 1}`,
      condition: 'NOT_READ',
      delayMinutes: 120, // 2 hours default
      messageBody: '',
      useSmartWindow: true,
    };
    const updated = [...steps, newStep];
    onChange(updated);
    setExpandedStep(newStep.id);
  }, [steps, onChange]);

  const removeStep = useCallback((id: string) => {
    const updated = steps
      .filter(s => s.id !== id)
      .map((s, i) => ({ ...s, stepIndex: i + 1 }));
    onChange(updated);
    if (expandedStep === id) {
      setExpandedStep(updated.length > 0 ? updated[0].id : null);
    }
  }, [steps, onChange, expandedStep]);

  const updateStep = useCallback((id: string, updates: Partial<FollowUpStep>) => {
    const updated = steps.map(s => (s.id === id ? { ...s, ...updates } : s));
    onChange(updated);
  }, [steps, onChange]);

  const getConditionInfo = (condition: FollowUpCondition) =>
    CONDITION_OPTIONS.find(c => c.value === condition) ?? CONDITION_OPTIONS[0];

  const formatDelay = (minutes: number): string => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      const remainHours = hours % 24;
      return remainHours > 0 ? `${days}d ${remainHours}h` : `${days}d`;
    }
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Flow visualization header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '12px 16px',
        background: 'linear-gradient(135deg, #F5F0EB 0%, #E8E4DE 100%)',
        borderRadius: '10px',
        border: '1px solid #D4A574',
      }}>
        <Zap size={18} color="#D4A574" />
        <span style={{ fontSize: '14px', fontWeight: 600, color: '#4A4139' }}>
          Follow-Up Flow
        </span>
        <span style={{ fontSize: '12px', color: '#8B7F76', marginLeft: 'auto' }}>
          {steps.length} of {MAX_FOLLOW_UPS} steps
        </span>
      </div>

      {/* Initial message indicator */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 16px',
        background: '#FAF9F6',
        borderRadius: '8px',
        border: '1px dashed #D4A574',
      }}>
        <div style={{
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          background: '#D4A574',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: '12px', color: 'white', fontWeight: 700 }}>0</span>
        </div>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#4A4139' }}>Initial Message</div>
          <div style={{ fontSize: '11px', color: '#8B7F76' }}>Your main campaign message (configured above)</div>
        </div>
      </div>

      {/* Follow-up steps */}
      {steps.map((step, index) => {
        const conditionInfo = getConditionInfo(step.condition);
        const isExpanded = expandedStep === step.id;

        return (
          <div key={step.id}>
            {/* Connector arrow */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '2px',
              padding: '4px 0',
            }}>
              <div style={{ width: '2px', height: '12px', background: '#D4A574' }} />
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '2px 10px',
                background: '#FFF8F0',
                borderRadius: '12px',
                border: '1px solid #E8D5C4',
              }}>
                <Clock size={12} color="#D4A574" />
                <span style={{ fontSize: '11px', color: '#8B7F76', fontWeight: 500 }}>
                  Wait {formatDelay(step.delayMinutes)}
                </span>
              </div>
              <ArrowDown size={14} color="#D4A574" />
            </div>

            {/* Step card */}
            <div style={{
              borderRadius: '10px',
              border: `1px solid ${isExpanded ? '#D4A574' : '#E8E4DE'}`,
              background: isExpanded ? '#FFFDF9' : '#FAF9F6',
              overflow: 'hidden',
              transition: 'all 0.2s ease',
            }}>
              {/* Step header */}
              <div
                onClick={() => setExpandedStep(isExpanded ? null : step.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px 16px',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <GripVertical size={14} color="#B8AFA6" />
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: conditionInfo.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <span style={{ fontSize: '12px', color: 'white', fontWeight: 700 }}>{step.stepIndex}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#4A4139' }}>
                    {step.name || `Follow-Up ${step.stepIndex}`}
                  </div>
                  <div style={{ fontSize: '11px', color: '#8B7F76', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>{conditionInfo.emoji}</span>
                    <span>If {conditionInfo.label.toLowerCase()}</span>
                    <span style={{ color: '#B8AFA6' }}>·</span>
                    <span>After {formatDelay(step.delayMinutes)}</span>
                    {step.useSmartWindow && (
                      <>
                        <span style={{ color: '#B8AFA6' }}>·</span>
                        <span style={{ color: '#4CAF50', fontSize: '10px' }}>🟢 Smart window</span>
                      </>
                    )}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeStep(step.id);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    borderRadius: '4px',
                    color: '#B8AFA6',
                  }}
                  title="Remove step"
                >
                  <Trash2 size={14} />
                </button>
                {isExpanded ? <ChevronUp size={16} color="#8B7F76" /> : <ChevronDown size={16} color="#8B7F76" />}
              </div>

              {/* Expanded content */}
              {isExpanded && (
                <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ height: '1px', background: '#E8E4DE' }} />

                  {/* Step name */}
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#4A4139', marginBottom: '4px', display: 'block' }}>
                      Step Name
                    </label>
                    <input
                      type="text"
                      value={step.name}
                      onChange={e => updateStep(step.id, { name: e.target.value })}
                      placeholder="e.g., Nudge: Not Read"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #E8E4DE',
                        borderRadius: '8px',
                        fontSize: '13px',
                        color: '#4A4139',
                        background: '#FAF9F6',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  {/* Condition selector */}
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#4A4139', marginBottom: '6px', display: 'block' }}>
                      Trigger Condition
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                      {CONDITION_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => updateStep(step.id, { condition: opt.value })}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 10px',
                            border: `1.5px solid ${step.condition === opt.value ? opt.color : '#E8E4DE'}`,
                            borderRadius: '8px',
                            background: step.condition === opt.value ? `${opt.color}10` : '#FAF9F6',
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <span style={{ fontSize: '14px' }}>{opt.emoji}</span>
                          <div>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: '#4A4139' }}>{opt.label}</div>
                            <div style={{ fontSize: '10px', color: '#8B7F76' }}>{opt.description}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Delay selector */}
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#4A4139', marginBottom: '6px', display: 'block' }}>
                      Wait Before Checking ({formatDelay(step.delayMinutes)})
                    </label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {DELAY_PRESETS.map(preset => (
                        <button
                          key={preset.value}
                          onClick={() => updateStep(step.id, { delayMinutes: preset.value })}
                          style={{
                            padding: '6px 12px',
                            border: `1.5px solid ${step.delayMinutes === preset.value ? '#D4A574' : '#E8E4DE'}`,
                            borderRadius: '16px',
                            background: step.delayMinutes === preset.value ? '#FFF8F0' : '#FAF9F6',
                            fontSize: '12px',
                            fontWeight: step.delayMinutes === preset.value ? 600 : 400,
                            color: step.delayMinutes === preset.value ? '#D4A574' : '#8B7F76',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Message body */}
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#4A4139', marginBottom: '4px', display: 'block' }}>
                      Follow-Up Message
                    </label>
                    <textarea
                      value={step.messageBody}
                      onChange={e => updateStep(step.id, { messageBody: e.target.value })}
                      placeholder="Hi {{first_name}}, just checking in..."
                      rows={4}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #E8E4DE',
                        borderRadius: '8px',
                        fontSize: '13px',
                        color: '#4A4139',
                        background: '#FAF9F6',
                        resize: 'vertical',
                        outline: 'none',
                        fontFamily: 'inherit',
                        lineHeight: 1.5,
                        boxSizing: 'border-box',
                      }}
                    />
                    <div style={{ fontSize: '10px', color: '#B8AFA6', marginTop: '4px' }}>
                      Supports: {'{{first_name}}'}, {'{{last_name}}'}, {'{{name}}'}, {'{{email}}'}
                    </div>
                  </div>

                  {/* Template fallback */}
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#4A4139', marginBottom: '4px', display: 'block' }}>
                      Template Name (for out-of-window sends)
                    </label>
                    <input
                      type="text"
                      value={step.templateName || ''}
                      onChange={e => updateStep(step.id, { templateName: e.target.value || undefined })}
                      placeholder="e.g., cart_reminder_nudge (optional)"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #E8E4DE',
                        borderRadius: '8px',
                        fontSize: '13px',
                        color: '#4A4139',
                        background: '#FAF9F6',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                    <div style={{ fontSize: '10px', color: '#B8AFA6', marginTop: '4px' }}>
                      If customer is outside the 24hr window, this Meta-approved template will be used instead.
                    </div>
                  </div>

                  {/* Smart window toggle */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 12px',
                    background: step.useSmartWindow ? '#F0FFF4' : '#FAF9F6',
                    borderRadius: '8px',
                    border: `1px solid ${step.useSmartWindow ? '#C6F6D5' : '#E8E4DE'}`,
                  }}>
                    <button
                      onClick={() => updateStep(step.id, { useSmartWindow: !step.useSmartWindow })}
                      style={{
                        width: '36px',
                        height: '20px',
                        borderRadius: '10px',
                        border: 'none',
                        background: step.useSmartWindow ? '#4CAF50' : '#B8AFA6',
                        cursor: 'pointer',
                        position: 'relative',
                        transition: 'background 0.2s ease',
                        flexShrink: 0,
                      }}
                    >
                      <div style={{
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        background: 'white',
                        position: 'absolute',
                        top: '2px',
                        left: step.useSmartWindow ? '18px' : '2px',
                        transition: 'left 0.2s ease',
                      }} />
                    </button>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#4A4139' }}>
                        Smart 24hr Window
                      </div>
                      <div style={{ fontSize: '10px', color: '#8B7F76' }}>
                        {step.useSmartWindow
                          ? '🟢 Will use free-form text when customer is in 24hr window (saves template costs)'
                          : '🔴 Always uses template (even when free messaging is available)'
                        }
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Add step button */}
      {steps.length < MAX_FOLLOW_UPS && (
        <button
          onClick={addStep}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '12px',
            border: '2px dashed #D4A574',
            borderRadius: '10px',
            background: 'transparent',
            cursor: 'pointer',
            color: '#D4A574',
            fontSize: '13px',
            fontWeight: 600,
            transition: 'all 0.2s ease',
          }}
        >
          <Plus size={16} />
          Add Follow-Up Step
        </button>
      )}

      {steps.length >= MAX_FOLLOW_UPS && (
        <div style={{
          textAlign: 'center',
          padding: '8px',
          fontSize: '11px',
          color: '#B8AFA6',
        }}>
          Maximum {MAX_FOLLOW_UPS} follow-up steps reached
        </div>
      )}
    </div>
  );
}

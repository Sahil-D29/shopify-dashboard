'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Send, 
  CheckCircle2, 
  Eye, 
  MessageSquare, 
  MousePointerClick, 
  XCircle, 
  UserX,
  Clock,
  AlertCircle,
  Info
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type ExitPathType = 
  | 'sent' 
  | 'delivered' 
  | 'read' 
  | 'replied' 
  | 'button_clicked' 
  | 'failed' 
  | 'unreachable' 
  | 'timeout';

export type ExitActionType = 'continue' | 'branch' | 'exit' | 'wait';

export interface ExitPath {
  type: ExitPathType;
  enabled: boolean;
  action: {
    type: ExitActionType;
    branchId?: string;
    nextNodeId?: string;
    waitDuration?: number; // minutes
    timeoutPath?: string; // branch for timeout
  };
  tracking: {
    enabled: boolean;
    eventName: string;
    eventProperties?: Record<string, any>;
  };
  profileUpdates?: Array<{
    property: string;
    value: any;
    operation: 'set' | 'increment' | 'append';
  }>;
  buttonConfig?: {
    buttonId: string;
    buttonText: string;
    customPayload?: Record<string, any>;
  };
  conditions?: Array<{
    field: string;
    operator: 'equals' | 'contains' | 'regex';
    value: string;
    thenPath: string;
    elsePath: string;
  }>;
}

export interface ExitPathsConfig {
  sent: ExitPath;
  delivered: ExitPath;
  read: ExitPath;
  replied: ExitPath;
  buttonClicked: ExitPath[];
  failed: ExitPath;
  unreachable: ExitPath;
  timeout: ExitPath;
}

interface ExitPathsConfigProps {
  config: Partial<ExitPathsConfig>;
  onChange: (config: Partial<ExitPathsConfig>) => void;
  availableBranches: string[];
  templateButtons?: Array<{ id: string; type: string; text: string }>;
  validationErrors?: string[];
}

const EXIT_PATH_DEFINITIONS: Array<{
  type: ExitPathType;
  icon: any;
  title: string;
  description: string;
  defaultEnabled: boolean;
}> = [
  {
    type: 'sent',
    icon: Send,
    title: 'Message Sent',
    description: 'Triggered when message successfully sent to provider',
    defaultEnabled: true,
  },
  {
    type: 'delivered',
    icon: CheckCircle2,
    title: 'Message Delivered',
    description: 'Triggered when user receives message (DLR received)',
    defaultEnabled: true,
  },
  {
    type: 'read',
    icon: Eye,
    title: 'Message Read',
    description: 'Triggered when user opens message (read receipt)',
    defaultEnabled: false,
  },
  {
    type: 'replied',
    icon: MessageSquare,
    title: 'User Replied',
    description: 'Triggered when user sends any message back',
    defaultEnabled: false,
  },
  {
    type: 'button_clicked',
    icon: MousePointerClick,
    title: 'Button Clicked',
    description: 'Triggered when user clicks a template button',
    defaultEnabled: false,
  },
  {
    type: 'failed',
    icon: XCircle,
    title: 'Message Failed',
    description: 'Triggered when message delivery fails permanently',
    defaultEnabled: true,
  },
  {
    type: 'unreachable',
    icon: UserX,
    title: 'User Unreachable',
    description: 'Triggered when user opted out or invalid number',
    defaultEnabled: true,
  },
  {
    type: 'timeout',
    icon: Clock,
    title: 'Timeout',
    description: 'Triggered when wait duration expires without action',
    defaultEnabled: false,
  },
];

export function ExitPathsConfig({
  config,
  onChange,
  availableBranches,
  templateButtons = [],
  validationErrors = [],
}: ExitPathsConfigProps) {
  const updateExitPath = (type: ExitPathType, updates: Partial<ExitPath>) => {
    const configKey = type === 'button_clicked' ? 'buttonClicked' : type;
    const current = (config as any)[configKey] as ExitPath | undefined;
    const updated = {
      ...current,
      type,
      enabled: current?.enabled ?? EXIT_PATH_DEFINITIONS.find(d => d.type === type)?.defaultEnabled ?? false,
      ...updates,
    } as ExitPath;

    if (type === 'button_clicked') {
      onChange({
        ...config,
        buttonClicked: config.buttonClicked || [],
      });
    } else {
      onChange({
        ...config,
        [type]: updated,
      });
    }
  };

  const updateButtonExitPath = (buttonId: string, updates: Partial<ExitPath>) => {
    const buttonPaths = config.buttonClicked || [];
    const existingIndex = buttonPaths.findIndex(p => p.buttonConfig?.buttonId === buttonId);
    
    const button = templateButtons.find(b => b.id === buttonId);
    const updatedPath: ExitPath = {
      type: 'button_clicked',
      enabled: true,
      action: {
        type: 'continue',
        ...updates.action,
      },
      tracking: {
        enabled: true,
        eventName: `Button Clicked: ${button?.text || buttonId}`,
        ...updates.tracking,
      },
      buttonConfig: {
        buttonId,
        buttonText: button?.text || '',
        ...updates.buttonConfig,
      },
      ...updates,
    };

    if (existingIndex >= 0) {
      const newPaths = [...buttonPaths];
      newPaths[existingIndex] = updatedPath;
      onChange({ ...config, buttonClicked: newPaths });
    } else {
      onChange({ ...config, buttonClicked: [...buttonPaths, updatedPath] });
    }
  };

  const renderExitPath = (def: typeof EXIT_PATH_DEFINITIONS[0]) => {
    const configKey = def.type === 'button_clicked' ? 'buttonClicked' : def.type;
    const path = (config as any)[configKey] as ExitPath | undefined;
    const Icon = def.icon;
    const isEnabled = path?.enabled ?? def.defaultEnabled;

    return (
      <Card key={def.type} className={cn(!isEnabled && 'opacity-60')}>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                'p-2 rounded-lg',
                isEnabled ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'
              )}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">{def.title}</CardTitle>
                <CardDescription className="text-sm">{def.description}</CardDescription>
              </div>
            </div>
            <Checkbox
              checked={isEnabled}
              onCheckedChange={(checked) => updateExitPath(def.type, { enabled: checked as boolean })}
            />
          </div>
        </CardHeader>

        {isEnabled && (
          <CardContent className="space-y-4">
            {/* Next Action */}
            <div>
              <Label>Next Action</Label>
              <Select
                value={path?.action?.type || 'continue'}
                onValueChange={(value: ExitActionType) => updateExitPath(def.type, {
                  action: {
                    ...path?.action,
                    type: value,
                  },
                })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="continue">Continue to next node</SelectItem>
                  <SelectItem value="branch">Branch to specific path</SelectItem>
                  <SelectItem value="exit">Exit journey</SelectItem>
                  <SelectItem value="wait">Wait for action</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Branch Selection */}
            {path?.action?.type === 'branch' && (
              <div className="space-y-2">
                <div>
                  <Label>
                    Branch Identifier <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    placeholder="e.g., interested, not-interested, claim-offer"
                    value={path.action.branchId || ''}
                    onChange={(e) => updateExitPath(def.type, {
                      action: {
                        ...path.action,
                        branchId: e.target.value,
                      },
                    })}
                    className={!path.action.branchId ? 'border-red-500' : ''}
                  />
                  {!path.action.branchId && (
                    <p className="text-xs text-red-500 mt-1">
                      ⚠️ Branch identifier is required when action is "Go to specific branch"
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    This identifier will be used to connect to the next node in the journey
                  </p>
                </div>
                <div>
                  <Label>Branch Label (Optional)</Label>
                  <Input
                    placeholder="e.g., Interested Path, Opt-Out Path"
                    value={path.action.branchId || ''}
                    onChange={(e) => {
                      // Store branch label separately if needed, for now use branchId
                      // In future, you might want to add a separate branchLabel field
                      updateExitPath(def.type, {
                        action: {
                          ...path.action,
                          branchId: e.target.value,
                        },
                      });
                    }}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Human-readable name for this branch (for your reference)
                  </p>
                </div>
              </div>
            )}

            {/* Wait Duration */}
            {path?.action?.type === 'wait' && (
              <div className="space-y-2">
                <Label>Wait Duration</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min="1"
                    value={path.action.waitDuration || 60}
                    onChange={(e) => updateExitPath(def.type, {
                      action: {
                        ...path.action,
                        waitDuration: parseInt(e.target.value) || 60,
                      },
                    })}
                    className="w-24"
                  />
                  <Select
                    value="minutes"
                    disabled
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                  </Select>
                </div>
                <div>
                  <Label>Timeout Path</Label>
                  <Select
                    value={path.action.timeoutPath || ''}
                    onValueChange={(value) => updateExitPath(def.type, {
                      action: {
                        ...path.action,
                        timeoutPath: value,
                      },
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select timeout branch..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableBranches.map((branch) => (
                        <SelectItem key={branch} value={branch}>
                          {branch}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Event Tracking */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={path?.tracking?.enabled ?? true}
                  onCheckedChange={(checked) => updateExitPath(def.type, {
                    tracking: {
                      ...path?.tracking,
                      enabled: checked as boolean,
                      eventName: path?.tracking?.eventName || `${def.title} Event`,
                    },
                  })}
                />
                <Label>Track Event</Label>
              </div>
              {path?.tracking?.enabled && (
                <Input
                  placeholder="Event name"
                  value={path.tracking.eventName || ''}
                  onChange={(e) => updateExitPath(def.type, {
                    tracking: {
                      ...path.tracking,
                      eventName: e.target.value,
                    },
                  })}
                />
              )}
            </div>

            {/* Profile Updates */}
            {(def.type === 'read' || def.type === 'replied' || def.type === 'button_clicked') && (
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-blue-600 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium">Profile Updates</p>
                    <p className="text-xs mt-1">
                      Profile updates can be configured in the journey engine settings.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        )}
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-medium text-blue-900 mb-1">What are Exit Paths?</h4>
            <p className="text-sm text-blue-800">
              Exit paths determine what happens after sending a WhatsApp message. Configure different
              actions for Sent, Delivered, Read, Replied, Button Clicked, Failed, and Unreachable events.
              This enables complex routing logic based on user interactions.
            </p>
          </div>
        </div>
      </div>

      {validationErrors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-red-900 mb-1">Validation Errors</h4>
              <ul className="list-disc list-inside text-sm text-red-800">
                {validationErrors.map((error, idx) => (
                  <li key={idx}>{error}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Standard Exit Paths */}
      <div className="space-y-4">
        {EXIT_PATH_DEFINITIONS.filter(def => def.type !== 'button_clicked').map(renderExitPath)}
      </div>

      {/* Button-Specific Exit Paths */}
      {templateButtons.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium flex items-center gap-2">
                <MousePointerClick className="h-4 w-4" />
                Button Click Actions
              </h4>
              <p className="text-sm text-gray-600">
                Configure what happens when users click each button
              </p>
            </div>
            <Badge variant="secondary">
              {templateButtons.length} button{templateButtons.length !== 1 ? 's' : ''}
            </Badge>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Each button must have an action configured. Branch identifiers are required for buttons
              that route to specific paths.
            </AlertDescription>
          </Alert>
          {templateButtons.map((button) => {
            const buttonPath = config.buttonClicked?.find(p => p.buttonConfig?.buttonId === button.id);
            const buttonText = button.text || button.id;
            const actionType = buttonPath?.action?.type || 'branch';
            const isConfigured = buttonPath?.enabled && 
              (actionType !== 'branch' || (buttonPath.action?.branchId && buttonPath.action.branchId.trim() !== ''));
            
            return (
              <Card key={button.id} className={!isConfigured && buttonPath?.enabled ? 'border-red-200' : ''}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">"{buttonText}"</CardTitle>
                      <CardDescription className="text-xs text-gray-500 capitalize">
                        {button.type.replace('_', ' ')} button
                      </CardDescription>
                    </div>
                    <Badge variant={isConfigured ? 'default' : 'destructive'}>
                      {isConfigured ? 'Configured' : 'Not Configured'}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div>
                    <Label>Action *</Label>
                    <Select
                      value={actionType}
                      onValueChange={(value: ExitActionType) => {
                        const newAction = {
                          type: value,
                          branchId: value === 'branch' ? buttonPath?.action?.branchId : undefined,
                        };
                        updateButtonExitPath(button.id, { 
                          enabled: true,
                          action: newAction 
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="continue">Continue journey</SelectItem>
                        <SelectItem value="branch">Go to specific branch</SelectItem>
                        <SelectItem value="exit">Exit journey</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                    {actionType === 'branch' && (
                      <div className="space-y-2">
                        <div>
                          <Label>
                            Branch Identifier <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            placeholder={`e.g., ${buttonText.toLowerCase().replace(/\s+/g, '-')}`}
                            value={buttonPath?.action?.branchId || ''}
                            onChange={(e) => updateButtonExitPath(button.id, {
                              enabled: true,
                              action: {
                                type: 'branch',
                                branchId: e.target.value,
                              },
                            })}
                            className={!buttonPath?.action?.branchId ? 'border-red-500' : ''}
                          />
                          {!buttonPath?.action?.branchId && (
                            <p className="text-xs text-red-500 mt-1">
                              ⚠️ Branch identifier is required for this button
                            </p>
                          )}
                          <p className="text-xs text-gray-500 mt-1">
                            This identifier will be used to connect to the next node in the journey
                          </p>
                        </div>
                        <div>
                          <Label>Branch Label (Optional)</Label>
                          <Input
                            placeholder="e.g., Interested Users, Claim Offer Path"
                            value={buttonPath?.buttonConfig?.buttonText || buttonText}
                            onChange={(e) => updateButtonExitPath(button.id, {
                              enabled: true,
                              buttonConfig: {
                                buttonId: button.id,
                                buttonText: e.target.value,
                              },
                            })}
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Human-readable name for this branch (for your reference)
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={buttonPath?.tracking?.enabled ?? true}
                          onCheckedChange={(checked) => updateButtonExitPath(button.id, {
                            enabled: true,
                            tracking: {
                              enabled: checked as boolean,
                              eventName: buttonPath?.tracking?.eventName || `Button Clicked: ${buttonText}`,
                            },
                          })}
                        />
                        <Label>Track Event</Label>
                      </div>
                      {buttonPath?.tracking?.enabled !== false && (
                        <Input
                          placeholder="Event name (e.g., Button Clicked: Track Order)"
                          value={buttonPath?.tracking?.eventName || `Button Clicked: ${buttonText}`}
                          onChange={(e) => updateButtonExitPath(button.id, {
                            enabled: true,
                            tracking: {
                              enabled: true,
                              eventName: e.target.value,
                            },
                          })}
                        />
                      )}
                    </div>

                    {button.type === 'quick_reply' && (
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <Label className="text-xs text-muted-foreground">Custom Payload (Optional)</Label>
                        <Input
                          placeholder='{"intent": "reorder", "source": "whatsapp"}'
                          value={JSON.stringify(buttonPath?.buttonConfig?.customPayload || {})}
                          onChange={(e) => {
                            try {
                              const payload = JSON.parse(e.target.value);
                              updateButtonExitPath(button.id, {
                                enabled: true,
                                buttonConfig: {
                                  buttonId: button.id,
                                  buttonText: buttonText,
                                  customPayload: payload,
                                },
                              });
                            } catch {
                              // Invalid JSON, ignore
                            }
                          }}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Custom payload sent with button click for tracking
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
        </div>
      )}
    </div>
  );
}


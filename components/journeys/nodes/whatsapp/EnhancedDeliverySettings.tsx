'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, AlertCircle, Info } from 'lucide-react';
import { SendWindowPicker } from './SendWindowPicker';
import type { SendWindowConfig, RateLimitingConfig, FailureHandlingConfig } from '@/lib/types/whatsapp-config';

interface EnhancedDeliverySettingsProps {
  sendWindow: SendWindowConfig;
  rateLimiting: RateLimitingConfig;
  failureHandling: FailureHandlingConfig;
  onSendWindowChange: (config: SendWindowConfig) => void;
  onRateLimitingChange: (field: keyof RateLimitingConfig, value: number | string) => void;
  onFailureHandlingChange: (field: keyof FailureHandlingConfig, value: number | string) => void;
  skipIfOptedOut: boolean;
  onOptOutChange: (value: boolean) => void;
  validationErrors?: string[];
}

export function EnhancedDeliverySettings({
  sendWindow,
  rateLimiting,
  failureHandling,
  onSendWindowChange,
  onRateLimitingChange,
  onFailureHandlingChange,
  skipIfOptedOut,
  onOptOutChange,
  validationErrors = [],
}: EnhancedDeliverySettingsProps) {
  const [dndEnabled, setDndEnabled] = useState(true);
  const [timezoneMode, setTimezoneMode] = useState<'customer' | 'fixed'>('customer');
  const [outsideDndBehavior, setOutsideDndBehavior] = useState<'queue_next_window' | 'discard' | 'wait'>('queue_next_window');
  const [rateLimitScope, setRateLimitScope] = useState<'this_journey' | 'all_journeys'>('all_journeys');
  const [rateLimitExceededBehavior, setRateLimitExceededBehavior] = useState<'skip_continue' | 'exit_journey' | 'fallback_path'>('skip_continue');

  return (
    <div className="space-y-6">
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

      {/* DND Schedule */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                DND (Do Not Disturb) Schedule
              </CardTitle>
              <CardDescription>
                Only send messages during specific hours
              </CardDescription>
            </div>
            <Checkbox
              checked={dndEnabled}
              onCheckedChange={(checked) => setDndEnabled(checked === true)}
            />
          </div>
        </CardHeader>
        {dndEnabled && (
          <CardContent className="space-y-4">
            <SendWindowPicker
              value={sendWindow}
              onChange={onSendWindowChange}
            />

            <div>
              <Label>Timezone</Label>
              <div className="space-y-2 mt-2">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={timezoneMode === 'customer'}
                    onChange={() => setTimezoneMode('customer')}
                  />
                  <span className="text-sm">Customer's timezone (recommended)</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={timezoneMode === 'fixed'}
                    onChange={() => setTimezoneMode('fixed')}
                  />
                  <span className="text-sm">Fixed timezone</span>
                  {timezoneMode === 'fixed' && (
                    <Select defaultValue={sendWindow.timezone || 'UTC'}>
                      <SelectTrigger className="ml-2 w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UTC">UTC</SelectItem>
                        <SelectItem value="America/New_York">Eastern Time</SelectItem>
                        <SelectItem value="America/Chicago">Central Time</SelectItem>
                        <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                        <SelectItem value="Europe/London">London</SelectItem>
                        <SelectItem value="Asia/Kolkata">India Standard Time</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </label>
              </div>
            </div>

            <div>
              <Label>If message falls outside DND</Label>
              <Select
                value={outsideDndBehavior}
                onValueChange={(value: any) => setOutsideDndBehavior(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="queue_next_window">Send at next available window</SelectItem>
                  <SelectItem value="discard">Discard message</SelectItem>
                  <SelectItem value="wait">Wait for user to be in window</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Rate Limiting */}
      <Card>
        <CardHeader>
          <CardTitle>Rate Limiting</CardTitle>
          <CardDescription>
            Control how many messages can be sent per user
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Per Day</Label>
              <Input
                type="number"
                min="1"
                value={rateLimiting.maxPerDay}
                onChange={(e) => onRateLimitingChange('maxPerDay', parseInt(e.target.value) || 1)}
              />
            </div>
            <div>
              <Label>Per Week</Label>
              <Input
                type="number"
                min="1"
                value={rateLimiting.maxPerWeek}
                onChange={(e) => onRateLimitingChange('maxPerWeek', parseInt(e.target.value) || 1)}
              />
            </div>
            <div>
              <Label>Per Month</Label>
              <Input
                type="number"
                min="1"
                value={(rateLimiting as any).maxPerMonth || 40}
                onChange={(e) => onRateLimitingChange('maxPerMonth' as any, parseInt(e.target.value) || 40)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={rateLimitScope === 'all_journeys'}
                onCheckedChange={(checked) => setRateLimitScope(checked ? 'all_journeys' : 'this_journey')}
              />
              <Label>Apply limits across ALL journeys (recommended)</Label>
            </div>
            <p className="text-xs text-muted-foreground ml-6">
              Prevents users from receiving too many messages across all your campaigns
            </p>
          </div>

          <div>
            <Label>If limit exceeded</Label>
            <Select
              value={rateLimitExceededBehavior}
              onValueChange={(value: any) => setRateLimitExceededBehavior(value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="skip_continue">Skip message and continue journey</SelectItem>
                <SelectItem value="exit_journey">Exit journey</SelectItem>
                <SelectItem value="fallback_path">Move to fallback path</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Retry Strategy */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Retry Strategy</CardTitle>
              <CardDescription>
                Automatically retry failed messages
              </CardDescription>
            </div>
            <Checkbox
              checked={failureHandling.retryCount > 0}
              onCheckedChange={(checked) => onFailureHandlingChange('retryCount', checked ? 2 : 0)}
            />
          </div>
        </CardHeader>
        {failureHandling.retryCount > 0 && (
          <CardContent className="space-y-4">
            <div>
              <Label>Maximum attempts</Label>
              <Input
                type="number"
                min="1"
                max="5"
                value={failureHandling.retryCount}
                onChange={(e) => onFailureHandlingChange('retryCount', parseInt(e.target.value) || 1)}
              />
            </div>

            <div>
              <Label>Retry delays (minutes)</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  type="number"
                  value="15"
                  disabled
                  className="w-20"
                />
                <Input
                  type="number"
                  value="30"
                  disabled
                  className="w-20"
                />
                <Input
                  type="number"
                  value="60"
                  disabled
                  className="w-20"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Progressive backoff: Wait longer between each retry
              </p>
            </div>

            <div className="space-y-2">
              <Label>Retry on these errors</Label>
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <Checkbox defaultChecked />
                  <span className="text-sm">Network timeout</span>
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox defaultChecked />
                  <span className="text-sm">Rate limit hit</span>
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox defaultChecked />
                  <span className="text-sm">Temporary provider error</span>
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox />
                  <span className="text-sm">Invalid phone number (can't be retried)</span>
                </label>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Opt-Out Handling */}
      <Card>
        <CardHeader>
          <CardTitle>Opt-Out Handling</CardTitle>
          <CardDescription>
            Respect user preferences and opt-out settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={skipIfOptedOut}
              onCheckedChange={onOptOutChange}
            />
            <Label>Skip if user opted out of WhatsApp messages</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox defaultChecked />
            <Label>Skip if user opted out of this category (Marketing)</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox />
            <Label>Allow opt-out button in this message</Label>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


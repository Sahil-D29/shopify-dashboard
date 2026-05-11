# WhatsApp CleverTap-Style Implementation Guide

## ✅ Completed Components

### 1. Template Library Page
**Location:** `/app/settings/whatsapp/templates/page.tsx`

- ✅ Template listing with filters (status, category, language, search)
- ✅ Import from Meta functionality
- ✅ Auto-sync every 15 minutes
- ✅ Status badges (APPROVED, PENDING, REJECTED)
- ✅ Quality rating display (GREEN, YELLOW, RED)
- ✅ Template card UI with metadata

### 2. Exit Paths Configuration Component
**Location:** `/components/journeys/nodes/whatsapp/ExitPathsConfig.tsx`

- ✅ All 8 exit path types (Sent, Delivered, Read, Replied, Button Clicked, Failed, Unreachable, Timeout)
- ✅ Action types (Continue, Branch, Exit, Wait)
- ✅ Event tracking configuration
- ✅ Button-specific exit paths
- ✅ Timeout path configuration
- ✅ Branch selection from available journey branches
- ✅ Profile updates placeholder

### 3. API Endpoints
- ✅ `/api/settings/whatsapp/templates/import` - Import templates from Meta
- ✅ `/api/settings/whatsapp/templates/sync` - Sync template status

---

## 🔄 Required Changes to WhatsAppActionModal

### Current Structure (6 Steps)
1. Template Selection
2. Variable Mapping
3. Media Attachments
4. Action Buttons
5. Send Settings
6. Preview & Test

### New Structure (5 Steps - CleverTap Style)
1. **Select Template** - Only approved templates, context-aware filtering
2. **Configure Variables & Personalization** - Includes media configuration
3. **Delivery Rules & Timing** - Enhanced with DND, cross-journey rate limiting
4. **Exit Paths & Actions** - NEW: Multiple exit paths, button routing
5. **Test & Validate** - Real-time delivery status, configuration summary

---

## 📝 Step-by-Step Integration Guide

### Step 1: Update STEP_DEFINITIONS

**File:** `components/journeys/modals/WhatsAppActionModal.tsx`

**Change:**
```typescript
const STEP_DEFINITIONS: Array<{ id: StepId; title: string; description: string }> = [
  {
    id: "template",
    title: "Select Template",
    description: "Choose an approved WhatsApp template for this action.",
  },
  {
    id: "variables",
    title: "Configure Variables & Personalization",
    description: "Map template variables and configure media attachments.",
  },
  {
    id: "delivery",
    title: "Delivery Rules & Timing",
    description: "Set DND schedules, rate limits, and retry behavior.",
  },
  {
    id: "exitPaths",
    title: "Exit Paths & Actions",
    description: "Configure what happens after sending (Delivered, Read, Replied, Button Clicked, etc.).",
  },
  {
    id: "preview",
    title: "Test & Validate",
    description: "Review the final message and send a test before saving.",
  },
];
```

### Step 2: Update Step Rendering Logic

**File:** `components/journeys/modals/WhatsAppActionModal.tsx`

**Find the step rendering section and update:**

```typescript
// Around line 800-900, find the step content rendering
{currentStep.id === "template" && (
  <TemplateGallery
    // ... existing props
    // ADD: Only show APPROVED templates
    statusFilter="APPROVED"
    // ADD: Context-aware filtering
    suggestedCategories={triggerContext === 'order' ? ['TRANSACTIONAL', 'ORDER'] : undefined}
  />
)}

{currentStep.id === "variables" && (
  <div className="space-y-6">
    {/* Existing variable mapping */}
    <WhatsAppMessageEditor
      // ... existing props
    />
    
    {/* ADD: Media configuration here (moved from step 3) */}
    {templateSupportsMedia && (
      <Card>
        <CardHeader>
          <CardTitle>Media Attachments</CardTitle>
          <CardDescription>
            Configure header media for this template
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Media configuration UI */}
        </CardContent>
      </Card>
    )}
  </div>
)}

{currentStep.id === "delivery" && (
  <div className="space-y-6">
    {/* ENHANCE: Add DND schedule with weekday/weekend */}
    <SendWindowPicker
      // ... existing props
      // ADD: DND schedule options
      enableDNDSchedule={true}
      timezoneMode="customer" | "fixed"
      outsideDndBehavior="queue_next_window" | "discard" | "wait"
    />
    
    {/* ENHANCE: Add per-month rate limit */}
    <RateLimitingConfig
      perDay={config.rateLimiting?.perDay}
      perWeek={config.rateLimiting?.perWeek}
      perMonth={config.rateLimiting?.perMonth} // NEW
      scope="this_journey" | "all_journeys" // NEW
      exceededBehavior="skip_continue" | "exit_journey" | "fallback_path" // NEW
    />
    
    {/* ENHANCE: Progressive retry delays */}
    <RetryStrategyConfig
      maxAttempts={config.failureHandling?.maxRetries}
      delays={[15, 30, 60]} // Progressive backoff
      retryOnErrors={['network_timeout', 'rate_limit', 'temporary_error']}
    />
  </div>
)}

{currentStep.id === "exitPaths" && (
  <ExitPathsConfig
    config={config.exitPaths}
    onChange={(exitPaths) => setConfig({ ...config, exitPaths })}
    availableBranches={journeyBranches} // Get from journey context
    templateButtons={selectedTemplate?.buttons}
    validationErrors={formErrors.exitPaths || []}
  />
)}

{currentStep.id === "preview" && (
  <div className="space-y-6">
    {/* Existing preview */}
    <WhatsAppPhonePreview />
    
    {/* ADD: Configuration summary */}
    <ConfigurationSummary config={config} />
    
    {/* ADD: Pre-send validation checklist */}
    <ValidationChecklist config={config} />
    
    {/* ADD: Test history */}
    <TestHistory journeyId={journeyId} nodeId={nodeId} />
  </div>
)}
```

### Step 3: Update Type Definitions

**File:** `lib/types/whatsapp-config.ts`

**Add Exit Paths types:**

```typescript
export interface ExitPath {
  type: 'sent' | 'delivered' | 'read' | 'replied' | 'button_clicked' | 'failed' | 'unreachable' | 'timeout';
  enabled: boolean;
  action: {
    type: 'continue' | 'branch' | 'exit' | 'wait';
    branchId?: string;
    nextNodeId?: string;
    waitDuration?: number;
    timeoutPath?: string;
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

export interface WhatsAppActionConfig {
  // ... existing fields
  exitPaths?: ExitPathsConfig; // NEW
  rateLimiting?: {
    perDay: number;
    perWeek: number;
    perMonth: number; // NEW
    scope: 'this_journey' | 'all_journeys'; // NEW
    exceededBehavior: 'skip_continue' | 'exit_journey' | 'fallback_path'; // NEW
  };
  delivery?: {
    dnd: {
      enabled: boolean;
      schedule: {
        weekdays: Array<{ start: string; end: string; enabled: boolean }>;
        weekends: Array<{ start: string; end: string; enabled: boolean }>;
      };
      timezone: 'customer' | 'fixed';
      fixedTimezone?: string;
      outsideDndBehavior: 'queue_next_window' | 'discard' | 'wait';
    };
  };
}
```

### Step 4: Update Validation Logic

**File:** `components/journeys/modals/WhatsAppActionModal.tsx`

**Add validation for exit paths:**

```typescript
function validateStep(stepId: StepId, config: WhatsAppActionConfig): string[] {
  const errors: string[] = [];
  
  switch (stepId) {
    case 'template':
      if (!config.templateId) {
        errors.push('Please select a template');
      } else if (config.templateStatus !== 'APPROVED') {
        errors.push('Only approved templates can be used');
      }
      break;
      
    case 'variables':
      // Existing variable validation
      if (config.variableMappings.some(m => !m.fallbackValue)) {
        errors.push('All variables must have fallback values');
      }
      break;
      
    case 'delivery':
      // Enhanced validation
      if (config.delivery?.dnd?.enabled) {
        const hasEnabledDay = 
          config.delivery.dnd.schedule.weekdays.some(d => d.enabled) ||
          config.delivery.dnd.schedule.weekends.some(d => d.enabled);
        if (!hasEnabledDay) {
          errors.push('At least one day must be enabled in DND schedule');
        }
      }
      if (config.rateLimiting?.perDay > config.rateLimiting?.perWeek) {
        errors.push('Daily limit cannot exceed weekly limit');
      }
      break;
      
    case 'exitPaths': // NEW
      const enabledPaths = Object.values(config.exitPaths || {}).filter(
        (p: ExitPath) => p.enabled
      );
      if (enabledPaths.length === 0) {
        errors.push('At least one exit path must be configured');
      }
      
      // Validate button exit paths match template buttons
      if (config.exitPaths?.buttonClicked) {
        const templateButtonIds = selectedTemplate?.buttons?.map(b => b.id) || [];
        const configuredButtonIds = config.exitPaths.buttonClicked.map(p => p.buttonConfig?.buttonId);
        const missingButtons = templateButtonIds.filter(id => !configuredButtonIds.includes(id));
        if (missingButtons.length > 0) {
          errors.push(`Configure exit paths for all buttons: ${missingButtons.join(', ')}`);
        }
      }
      
      // Validate timeout paths for wait actions
      const waitPaths = Object.values(config.exitPaths || {}).filter(
        (p: ExitPath) => p.action?.type === 'wait'
      );
      for (const waitPath of waitPaths) {
        if (!waitPath.action.timeoutPath) {
          errors.push(`Timeout path required for "${waitPath.type}" exit path`);
        }
      }
      break;
      
    case 'preview':
      // Final validation - check all steps
      break;
  }
  
  return errors;
}
```

### Step 5: Update Save Handler

**File:** `components/journeys/modals/WhatsAppActionModal.tsx`

**Update handleSave to include exit paths:**

```typescript
const handleSave = async () => {
  // Validate all steps
  const allErrors: Record<StepId, string[]> = {};
  for (const step of steps) {
    const errors = validateStep(step.id, config);
    if (errors.length > 0) {
      allErrors[step.id] = errors;
    }
  }
  
  if (Object.keys(allErrors).length > 0) {
    setFormErrors(allErrors);
    // Jump to first error step
    const firstErrorStep = steps.findIndex(s => allErrors[s.id]?.length > 0);
    if (firstErrorStep >= 0) {
      setActiveStepIndex(firstErrorStep);
    }
    toast({
      title: 'Validation Errors',
      description: 'Please fix errors before saving',
      variant: 'destructive',
    });
    return;
  }
  
  setSaving(true);
  try {
    // Call server-side validation
    const validateResponse = await fetch('/api/whatsapp/validate-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    
    const validation = await validateResponse.json();
    if (!validation.valid) {
      // Handle firstInvalidStep
      if (validation.firstInvalidStep) {
        const stepIndex = steps.findIndex(s => s.id === validation.firstInvalidStep);
        if (stepIndex >= 0) {
          setActiveStepIndex(stepIndex);
        }
      }
      setFormErrors(validation.errors.reduce((acc: any, err: any) => {
        if (!acc[err.step]) acc[err.step] = [];
        acc[err.step].push(err.message);
        return acc;
      }, {}));
      return;
    }
    
    // Save configuration
    const response = await fetch(
      `/api/journeys/${journeyId}/nodes/${nodeId}/whatsapp-config`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      }
    );
    
    if (!response.ok) throw new Error('Failed to save');
    
    toast({
      title: 'Configuration Saved',
      description: 'WhatsApp action configuration saved successfully',
    });
    
    onSave(config);
    onClose();
  } catch (error) {
    toast({
      title: 'Save Failed',
      description: error instanceof Error ? error.message : 'Failed to save configuration',
      variant: 'destructive',
    });
  } finally {
    setSaving(false);
  }
};
```

---

## 🎯 Next Steps

### 1. Update Sidebar Navigation
Add link to template library in settings:

**File:** `components/layout/Sidebar.tsx`

```typescript
// Add under Settings section
{pathname?.startsWith('/settings') && (
  <div className="ml-4 space-y-1">
    <Link href="/settings">Store Settings</Link>
    <Link href="/settings/whatsapp">WhatsApp Provider</Link>
    <Link href="/settings/whatsapp/templates">Template Library</Link>
  </div>
)}
```

### 2. Create Enhanced Delivery Settings Component
**File:** `components/journeys/nodes/whatsapp/EnhancedDeliverySettings.tsx`

- DND schedule with weekday/weekend
- Per-month rate limiting
- Cross-journey rate limiting option
- Progressive retry delays
- Category-based opt-out

### 3. Create Configuration Summary Component
**File:** `components/journeys/nodes/whatsapp/ConfigurationSummary.tsx`

- Template details
- Variable mapping summary
- Exit paths summary
- Delivery settings summary
- Validation checklist

### 4. Update Journey Canvas
Show multiple exit connectors from WhatsApp nodes:

**File:** `components/journeys/builder/nodes.tsx`

```typescript
// When rendering WhatsApp node
{config.exitPaths && (
  <>
    {config.exitPaths.delivered?.enabled && (
      <ExitConnector
        type="delivered"
        to={config.exitPaths.delivered.action.branchId}
      />
    )}
    {config.exitPaths.buttonClicked?.map(btnPath => (
      <ExitConnector
        key={btnPath.buttonConfig?.buttonId}
        type="button_clicked"
        buttonId={btnPath.buttonConfig?.buttonId}
        to={btnPath.action.branchId}
      />
    ))}
  </>
)}
```

### 5. Create Webhook Handlers
**Files:**
- `/app/api/webhooks/whatsapp/dlr/route.ts` - Delivery reports
- `/app/api/webhooks/whatsapp/inbound/route.ts` - Incoming messages
- `/app/api/webhooks/whatsapp/button-click/route.ts` - Button clicks

These handlers should:
- Process DLR and update message status
- Route users based on exit path configuration
- Track events and update profiles
- Handle opt-out keywords

---

## 📊 Testing Checklist

- [ ] Template library loads and filters correctly
- [ ] Only APPROVED templates visible in journey modal
- [ ] Exit paths can be configured for all 8 types
- [ ] Button-specific exit paths work correctly
- [ ] Timeout paths validate correctly
- [ ] DND schedule saves and validates
- [ ] Cross-journey rate limiting works
- [ ] Progressive retry delays configured
- [ ] Server-side validation returns firstInvalidStep
- [ ] Configuration summary displays correctly
- [ ] Test messages track delivery status
- [ ] Webhooks route users correctly

---

## 🚀 Deployment Notes

1. **Database Migration:** Add `exitPaths` column to WhatsApp node configurations
2. **API Versioning:** Consider versioning the WhatsApp config API
3. **Backward Compatibility:** Existing configurations should default exit paths to "continue"
4. **Webhook Setup:** Configure Meta webhooks to point to new endpoints
5. **Analytics:** Track exit path usage for optimization

---

## 📚 Reference

- CleverTap WhatsApp Documentation: [User Docs](https://docs.clevertap.com/docs/whatsapp)
- Meta WhatsApp Business API: [Developer Docs](https://developers.facebook.com/docs/whatsapp)
- Exit Paths Implementation: See `ExitPathsConfig.tsx`
- Template Management: See `/app/settings/whatsapp/templates/page.tsx`


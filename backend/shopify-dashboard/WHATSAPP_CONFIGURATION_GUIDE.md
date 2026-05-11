# WhatsApp Template Configuration Guide

## Overview

The WhatsApp Template Configuration wizard provides a 6-step guided experience for configuring WhatsApp message actions in Journey nodes. It follows CleverTap-style UX patterns with server-side validation, template authority enforcement, and comprehensive error handling.

## Architecture

### Frontend Components

- **WhatsAppActionModal** (`components/journeys/modals/WhatsAppActionModal.tsx`)
  - Main wizard container with 6 steps
  - Handles state management, validation, and draft auto-save
  - Integrates with server-side validation

- **TemplateGallery** (`components/journeys/nodes/whatsapp/TemplateGallery.tsx`)
  - Template selection with filtering and search
  - Enforces APPROVED template requirement
  - Shows preview with sample variables

- **WhatsAppMessageEditor** (`components/journeys/nodes/whatsapp/WhatsAppMessageEditor.tsx`)
  - Body content editing
  - Variable mapping interface

- **PreviewTestModal** (`components/journeys/nodes/whatsapp/PreviewTestModal.tsx`)
  - Test message sending interface
  - Preview rendering

### Backend Endpoints

#### Validation & Configuration

- `POST /api/whatsapp/validate-config`
  - Validates complete configuration
  - Returns `firstInvalidStep` for UI navigation
  - Enforces template approval and all step validations

- `POST /api/journeys/{jid}/nodes/{nid}/whatsapp-config`
  - Saves configuration with server-side validation
  - Includes audit trail (savedBy, savedAt, changes)
  - Returns `firstInvalidStep` on validation failure

- `POST /api/journeys/{jid}/nodes/{nid}/whatsapp-config/draft`
  - Auto-saves drafts (debounced, 2 seconds)
  - Loads drafts on modal open

#### Template & Media

- `GET /api/whatsapp/templates/{id}`
  - Returns authoritative template metadata
  - Used for template selection and validation

- `POST /api/whatsapp/media/validate`
  - Validates media URL reachability
  - Checks HTTPS and content-type compatibility

- `POST /api/whatsapp/preview-render`
  - Server-side template rendering
  - Returns rendered message and character count

#### Testing & Capabilities

- `POST /api/whatsapp/send-test`
  - Sends test messages to sandbox
  - Rate limited (10 per hour per phone)
  - Includes audit logging

- `GET /api/providers/whatsapp/capabilities`
  - Returns provider limits and features
  - Used for UI constraint enforcement

- `GET /api/journeys/{jid}/nodes/{nid}/context-schema`
  - Returns available data sources based on journey trigger
  - Provides property suggestions for variable mapping

## Step-by-Step Flow

### Step 1: Template Selection

**Requirements:**
- Template must be selected
- Template must be APPROVED for production use
- Template metadata is authoritative from server

**Features:**
- Status filtering (All, Approved, Pending, Rejected)
- Search by name, content, or category
- Category and language filters
- Real-time preview with sample variables
- Auto-advance to Step 2 on selection

**Validation:**
- Client: Template selected and APPROVED
- Server: Template exists and is APPROVED

### Step 2: Variable Mapping

**Requirements:**
- All template variables must be mapped
- Each mapping requires:
  - Data source (Customer/Order/Product/Custom/Static)
  - Property (if not Static)
  - Fallback value (required)

**Features:**
- Body content editing (split by double newlines)
- Variable insertion helper
- Auto-suggest mappings based on name matching
- Real-time preview with sample values
- Context-aware data sources

**Validation:**
- Client: All variables mapped with fallbacks
- Server: Complete mappings for all template variables

### Step 3: Media Attachments

**Requirements:**
- If template supports media:
  - Static URL: Valid HTTPS URL (validated via server)
  - Dynamic: Only for product-triggered journeys
- Media type must match template header type

**Features:**
- URL format validation
- Server-side reachability check
- Dynamic media toggle (context-aware)
- Media type compatibility validation

**Validation:**
- Client: URL format check
- Server: URL reachability and content-type validation

### Step 4: Action Buttons

**Requirements:**
- Quick Reply: Branch identifier required
- URL: Valid URL format (with placeholder support)
- Phone: Valid phone number (E.164-like, 8+ digits)
- Provider limits enforced (max buttons, button types)

**Features:**
- Button type detection from template
- URL placeholder support for dynamic values
- Phone number formatting
- Provider capability checks

**Validation:**
- Client: Button-specific format validation
- Server: Provider limit enforcement

### Step 5: Send Settings

**Requirements:**
- At least one day selected
- Start time < end time
- Rate limits > 0
- Retry values ≥ 0

**Features:**
- Day of week selection
- Time picker (HH:mm format)
- Timezone mode (Customer or Fixed)
- Rate limiting (per day/week)
- Retry configuration
- Opt-out handling

**Validation:**
- Client: Time and limit validation
- Server: Schedule validation and normalization

### Step 6: Preview & Test

**Requirements:**
- Template selected and approved
- All variables mapped
- Valid phone number for test

**Features:**
- Final phone preview
- Character count
- Summary card
- Test send to sandbox
- Test profile selection
- Variable override for testing

**Validation:**
- Client: Phone format and variable completeness
- Server: Full validation before test send

## Validation Flow

### Client-Side Validation

Performed on each step:
- Immediate feedback
- Prevents navigation to next step if invalid
- Shows inline errors

### Server-Side Validation

Performed before save:
- Complete configuration validation
- Returns `firstInvalidStep` for UI navigation
- Defense-in-depth (even if client passes)

### Validation Response Format

```typescript
{
  valid: boolean;
  firstInvalidStep?: StepId; // 'template' | 'variables' | 'media' | 'buttons' | 'send' | 'preview'
  errors: Array<{
    step: StepId;
    field?: string;
    message: string;
  }>;
}
```

## Draft Auto-Save

- **Frequency**: Debounced, 2 seconds after last change
- **Storage**: Server-side JSON file
- **Loading**: Automatic on modal open
- **Metadata**: Includes savedBy, savedAt, changes

## Audit Trail

### Save Events

Logged with:
- `savedBy`: User ID (from header or 'anonymous')
- `savedAt`: ISO timestamp
- `changes`: Array of change descriptions

### Test Send Events

Logged with:
- Template name
- Masked phone number (first 4 + last 4 digits)
- User ID
- Journey ID

## Template Authority

### Enforcement Points

1. **UI Level** (TemplateGallery)
   - Disables "Use" button for non-APPROVED templates
   - Shows status message

2. **Validation Level** (validate-config)
   - Rejects non-APPROVED templates
   - Returns error with step navigation

3. **Save Level** (whatsapp-config POST)
   - Re-validates template status
   - Blocks save if not APPROVED

### Sandbox Mode

For testing with non-approved templates:
- UI allows selection (with warning)
- Server validation can be bypassed in test mode
- Test sends work with PENDING templates

## Error Handling

### Client Errors

- Inline validation errors per step
- Toast notifications for save/test failures
- Auto-navigation to first invalid step

### Server Errors

- Consistent error response format
- `firstInvalidStep` for UI navigation
- Detailed error messages with solutions

## Rate Limiting

### Test Sends

- **Limit**: 10 sends per hour per phone number
- **Storage**: In-memory (use Redis in production)
- **Response**: 429 with resetAt timestamp

## Provider Capabilities

Default WhatsApp Business API limits:
- Max buttons: 3
- Max quick replies: 3
- Max URL buttons: 2
- Max phone buttons: 1
- Supported media: IMAGE, VIDEO, DOCUMENT
- Max media size: 16MB

## Best Practices

1. **Always validate server-side** - Client validation is for UX, not security
2. **Use drafts** - Auto-save prevents data loss
3. **Test before save** - Use preview & test to verify configuration
4. **Check provider limits** - Query capabilities before configuring buttons
5. **Validate media URLs** - Use media/validate endpoint before save
6. **Monitor audit logs** - Track configuration changes and test sends

## Troubleshooting

### Template Not Found
- Refresh templates list
- Check template ID/name spelling
- Verify template exists in provider

### Validation Fails on Save
- Check `firstInvalidStep` in response
- Review `errors` array for details
- Navigate to indicated step

### Test Send Fails
- Verify phone number format (E.164)
- Check all variables are filled
- Ensure template is APPROVED
- Check rate limit (429 response)

### Draft Not Loading
- Verify journeyId and nodeId are correct
- Check draft endpoint response
- Drafts are optional - missing draft is not an error

## API Examples

### Validate Configuration

```typescript
const response = await fetch('/api/whatsapp/validate-config', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(config),
});

const validation = await response.json();
if (!validation.valid) {
  // Navigate to validation.firstInvalidStep
  // Show validation.errors
}
```

### Save Configuration

```typescript
const response = await fetch(`/api/journeys/${journeyId}/nodes/${nodeId}/whatsapp-config`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(config),
});

if (!response.ok) {
  const error = await response.json();
  // Check error.firstInvalidStep
}
```

### Send Test

```typescript
const response = await fetch('/api/whatsapp/send-test', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    template_id: 'tmpl_123',
    template_language: 'en',
    phone: '+14155552671',
    variables: { name: 'John', order_number: '#1234' },
  }),
});
```

## Future Enhancements

- [ ] Redis-based rate limiting
- [ ] Provider capability caching
- [ ] Real-time preview updates
- [ ] Batch template validation
- [ ] Template versioning support
- [ ] Advanced variable mapping (nested properties, arrays)
- [ ] Multi-language template support
- [ ] Template A/B testing


# CleverTap-Style Trigger System

## Overview

This trigger system provides a comprehensive, rule-based interface for configuring journey triggers, inspired by CleverTap's trigger configuration UI.

## Architecture

### Core Components

1. **TriggerConfigPanel** – Main configuration interface
   - Orchestrates all sub-components
   - Manages trigger state, validation, and persistence
   - Handles save/cancel operations and status changes

2. **RuleSelectionModal** – Rule type selection dialog
   - Three-tab interface (User Property, User Behavior, User Interests)
   - Searchable rule catalog
   - Returns selected rule type to the panel

3. **EventSelector** – Shopify event picker
   - Grouped by category (Product, Cart, Order, etc.)
   - Searchable dropdown with descriptions
   - Exposes event properties to condition builder

4. **ConditionBuilder** – Individual condition editor
   - Property / Operator / Value triplet
   - Type-aware operators (string, number, boolean, date)
   - Supports drag-to-reorder via parent sortable list

5. **TargetSegmentSection** – "Who" section wrapper
   - Collapsible purple-header section
   - Manages rules, rule groups, and segment type
   - Provides empty state CTA for new triggers

### Data Model

The system uses `EnhancedUnifiedTriggerConfig` which contains:

```ts
{
  // Legacy unified fields (for backwards compatibility)
  targetSegment: { ... },
  subscriptionGroups: string[],
  entryFrequency: { ... },
  entryWindow?: { ... },
  estimate?: { ... },

  // New CleverTap-style fields
  cleverTapStyle: {
    name: 'My Trigger',
    targetSegment: {
      type: 'new_segment' | 'existing_segment',
      rules: CleverTapStyleRule[],
      ruleGroups: CleverTapStyleRuleGroup[],
    },
    subscriptionGroups: string[],
    estimatedUserCount: number,
  }
}
```

#### Rule Structure

```ts
interface CleverTapStyleRule {
  id: string;
  ruleType: 'user_property' | 'user_behavior' | 'user_interests';
  subcategory: string; // e.g., 'event_dot', 'geography'
  eventName?: string;
  eventDisplayName?: string;
  action?: 'did' | 'did_not' | 'charged';
  timeFrame?: {
    period: 'last_24_hours' | 'last_7_days' | 'last_30_days' | 'last_90_days' | 'custom';
    customDays?: number;
  };
  conditions: EventCondition[];
}
```

## Usage

### Creating a New Trigger

1. Drag the **Trigger** block from the sidebar onto the canvas
2. Click the trigger node to open the configuration panel
3. In the "Who" section, click **Add Rule**
4. Select a rule type from the modal (e.g., *Event (Dot)*)
5. Choose a Shopify event (e.g., *Product Viewed*)
6. Set a timeframe (e.g., *Last 30 days*)
7. Optionally add property conditions
8. Click **Save & Continue**

### Editing an Existing Trigger

1. Click the trigger node on the canvas
2. The panel opens with current configuration
3. Modify rules, events, or conditions as needed
4. Click **Save & Continue** to persist changes

### Rule Groups (OR Logic)

- Top-level rules are combined with **AND** logic
- Use **Add Rule Group** to create an **OR** bucket
- Rules inside a group are OR'd together, groups are AND'd against main rules

## Validation Rules

Triggers must pass the following checks before activation or save:

- Trigger name is required
- At least one rule or rule group must be defined
- Event rules must have an event selected
- Event rules must have a timeframe selected
- Conditions must specify a property, operator, and (when required) a value

## Feature Flag

The system is controlled by `USE_UNIFIED_TRIGGER`:

```ts
// featureFlags.ts
export const USE_UNIFIED_TRIGGER = true; // enable CleverTap-style triggers
```

When `false`, the legacy trigger system and modals remain in use.

## Backwards Compatibility

- Legacy journeys continue to load and use the old configuration modal
- Only nodes with `meta.unified = true` use the new UI
- Sidebar palette switches between old/new trigger sets based on the feature flag

## Testing Checklist

1. **Smoke Test** – Create trigger, add rule, save → should succeed
2. **Validation Test** – Attempt to save with missing event → should block
3. **Edit Test** – Reopen saved trigger → form prepopulated
4. **Status Test** – Toggle draft/active → validates before activation
5. **Legacy Test** – Load older journey → renders with legacy modal

## Future Enhancements

- Real-time audience estimation
- Rule templates / presets
- Import/export of rule sets
- Visual rule dependency graphs
- Advanced temporal operators (within X minutes)
- Support for A/B testing inside triggers

## Quick Start Guide

### 1. Create Your First Trigger (2 minutes)

**Step 1: Add Trigger to Canvas**
- Drag the "Trigger" block from the left sidebar onto the canvas
- The trigger node appears with default name "My Trigger"

**Step 2: Configure the Trigger**
- Click the trigger node to open the configuration panel
- The "Who" section opens automatically

**Step 3: Add an Event Rule**
- Click the "+ Add rule" button
- In the modal, select "USER BEHAVIOR" tab
- Click "Event (Dot)"
- Search for and select "Product Viewed"
- Set timeframe to "Last 30 days"

**Step 4: Add Conditions (Optional)**
- Click "+ Add filter" to add property conditions
- Select property: "product_price"
- Select operator: "greater than"
- Enter value: "50"

**Step 5: Save**
- Click "Save & Continue"
- Your trigger is now configured!

### 2. Common Use Cases

**Abandoned Cart Recovery**
```
Rule: Cart Abandoned
Timeframe: Last 24 hours
Conditions:
  - cart_value > 50
  - items_count >= 2
```

**High-Value Customer Orders**
```
Rule: Order Placed
Timeframe: Last 7 days
Conditions:
  - order_total > 200
  - payment_method = "Credit Card"
```

**Product Interest**
```
Rule: Product Viewed
Timeframe: Last 30 days
Conditions:
  - product_category = "Electronics"
  - product_price > 100
```

### 3. Keyboard Shortcuts

- `Esc` – Close configuration panel
- `⌘ + S` / `Ctrl + S` – Save trigger configuration
- `⌘ + Enter` / `Ctrl + Enter` – Save and close

### 4. Tips & Tricks

✅ Use descriptive trigger names – Makes it easier to identify in complex journeys

✅ Start with broad rules – Narrow down with conditions

✅ Test with Draft status – Activate only when ready

✅ Use Rule Groups for OR logic – When users can match multiple criteria

✅ Check validation messages – They guide you to complete required fields

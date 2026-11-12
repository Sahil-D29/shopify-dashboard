import test from 'node:test';
import assert from 'node:assert/strict';

import { canonicalEventTriggerConfig, normalizeTriggerNode, selectedTriggerEvent } from '../trigger-config';

test('canonical event triggers are live and contain no historical timeframe', () => {
  const config = canonicalEventTriggerConfig('custom:abandoned_cart');
  assert.equal(config.targetSegment?.rules?.[0].timeFrame, undefined);
  assert.equal(config.cleverTapStyle?.targetSegment.rules[0].timeFrame, undefined);
});

test('normalizing an old abandoned checkout trigger removes historical window and manual conflicts', () => {
  const node = normalizeTriggerNode({
    id: 'trigger',
    type: 'trigger',
    subtype: 'manual_entry',
    position: { x: 0, y: 0 },
    trigger: { type: 'webhook', webhookEvent: 'custom:abandoned_cart' },
    data: {
      manual: true,
      manualTrigger: true,
      triggerType: 'manual_entry',
      triggerConfig: {
        targetSegment: {
          rules: [{ ruleType: 'user_behavior', category: 'Shiprocket', eventName: 'custom:abandoned_cart', conditions: [], timeFrame: { period: 'last_30_days' } }],
        },
      },
    },
  } as any);
  assert.equal(node.subtype, 'event_trigger');
  assert.equal(selectedTriggerEvent(node), 'custom:abandoned_cart');
  assert.equal((node.data as any).manual, undefined);
  assert.equal((node.data as any).triggerConfig.targetSegment.rules[0].timeFrame, undefined);
  assert.equal((node.data as any).entryFrequency.allowReentry, true);
  assert.equal((node.data as any).conditions[0], undefined);
});

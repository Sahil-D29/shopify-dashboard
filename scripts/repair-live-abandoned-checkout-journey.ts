import { prisma } from '@/lib/prisma';
import { normalizeTriggerNode } from '@/lib/journey-engine/trigger-config';
import { updateJourney } from '@/lib/journey-engine/storage';
import { validateJourney } from '@/lib/journey-engine/validation';
import { resolveTemplate } from '@/lib/whatsapp/template-send';
import { templateView } from '@/lib/whatsapp/template-view';
import { dynamicUrlParameters } from '@/lib/whatsapp/template-runtime';
import { isWhatsAppNode, whatsappNodeConfig } from '@/lib/whatsapp/node-config';
import type { JourneyDefinition, JourneyNode } from '@/lib/types/journey';
import type { WhatsAppActionConfig } from '@/lib/types/whatsapp-config';

const JOURNEY_ID = 'journey_live_abandoned_checkout_20261106';
const STORE_ID = '11e83b88-2378-4180-b8ee-3c87afef459a';
const TEMPLATE_NAME = 'abondoned_ch2';
const TEMPLATE_LANGUAGE = 'en_US';

const jsonRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

async function safetyCounts() {
  const [enrollments, schedules, claims] = await Promise.all([
    prisma.journeyEnrollmentDoc.count({ where: { journeyId: JOURNEY_ID } }),
    prisma.journeyScheduleDoc.count({ where: { journeyId: JOURNEY_ID } }),
    prisma.journeyEntryClaim.count({ where: { journeyId: JOURNEY_ID, storeId: STORE_ID } }),
  ]);
  return { enrollments, schedules, claims };
}

function repairActionNode(node: JourneyNode, config: WhatsAppActionConfig): JourneyNode {
  if (!isWhatsAppNode(node)) return node;
  const data = jsonRecord(node.data);
  const meta = jsonRecord(data.meta);
  const nextMeta: Record<string, unknown> = {
    ...meta,
    actionType: 'whatsapp',
    templateId: config.templateId,
    templateName: config.templateName,
    templateStatus: config.templateStatus,
    templateLanguage: config.templateLanguage,
    templateCategory: config.templateCategory,
    variableMappings: config.variableMappings,
    bodyFields: config.bodyFields,
    buttonActions: config.buttonActions,
    componentMappings: config.componentMappings,
    useCheckoutRecoveryUrl: true,
    skipIfOptedOut: true,
    whatsappActionConfig: config,
    isConfigured: true,
  };
  delete nextMeta.whatsappActionDraft;
  const nextData: Record<string, unknown> = { ...data, ...nextMeta, meta: nextMeta };
  delete nextData.whatsappActionDraft;
  return { ...node, subtype: 'send_whatsapp', data: nextData } as JourneyNode;
}

function repairEditableNodeState(node: JourneyNode): JourneyNode {
  const data = jsonRecord(node.data);
  const meta = jsonRecord(data.meta);
  const nextMeta: Record<string, unknown> = { ...meta, status: 'active', isConfigured: true };
  if (node.type === 'delay' && node.delay) {
    const { value, unit } = node.delay;
    Object.assign(nextMeta, {
      duration: value,
      unit,
      delayType: 'fixed_time',
      delaySummary: `Wait ${value} ${unit}`,
      delayConfig: {
        delayType: 'fixed_time',
        specificConfig: { type: 'fixed_time', duration: { value, unit }, description: '' },
        quietHours: { enabled: false, startTime: { hour: 21, minute: 0 }, endTime: { hour: 9, minute: 0 }, timezone: 'customer' },
        holidaySettings: { skipWeekends: false, skipHolidays: false, holidayCalendar: 'us', customHolidayDates: [] },
        throttling: { enabled: false },
        nodeName: node.name ?? `Wait ${value} ${unit}`,
        description: node.description ?? '',
      },
    });
  }
  return { ...node, data: { ...data, ...nextMeta, meta: nextMeta, status: 'active' } } as JourneyNode;
}

async function main() {
  const doc = await prisma.journeyDoc.findFirst({ where: { id: JOURNEY_ID, storeId: STORE_ID } });
  if (!doc) throw new Error(`Journey ${JOURNEY_ID} was not found in store ${STORE_ID}.`);
  const before = await safetyCounts();
  const existing = doc.data as unknown as JourneyDefinition;

  const definition = await resolveTemplate(STORE_ID, {
    templateName: TEMPLATE_NAME,
    templateLanguage: TEMPLATE_LANGUAGE,
  });
  const template = templateView(definition);
  const dynamicLinks = dynamicUrlParameters(template);
  if (dynamicLinks.length !== 1 || dynamicLinks[0].approvedPrefix !== 'https://mymaatram.com/') {
    throw new Error('The approved template does not expose the expected mymaatram.com dynamic URL button.');
  }
  const parameter = dynamicLinks[0];
  const currentAction = existing.nodes.find(isWhatsAppNode);
  const current = currentAction ? whatsappNodeConfig(currentAction) : {};
  const config: WhatsAppActionConfig = {
    ...current,
    templateId: `meta_${definition.id}`,
    templateName: definition.name,
    templateStatus: 'APPROVED',
    templateLanguage: definition.language,
    templateCategory: template.category,
    variableMappings: [],
    bodyFields: [{ id: 'approved-body', label: 'Approved body', value: template.body ?? template.content }],
    sendWindow: current.sendWindow ?? { daysOfWeek: [0, 1, 2, 3, 4, 5, 6], startTime: '00:00', endTime: '23:59', timezone: 'customer' },
    rateLimiting: current.rateLimiting ?? { maxPerDay: 1, maxPerWeek: 2 },
    failureHandling: current.failureHandling ?? { retryCount: 1, retryDelay: 15, fallbackAction: 'exit' },
    skipIfOptedOut: true,
    buttonActions: {},
    componentMappings: [{
      parameterId: parameter.id,
      component: parameter.component,
      componentIndex: parameter.componentIndex,
      parameterName: parameter.parameterName,
      dataSource: 'event',
      property: 'checkout_url',
    }],
    useCheckoutRecoveryUrl: true,
    templateDefinition: template,
    previewBody: template.body ?? template.content,
    previewVariables: {},
    previewPlainVariables: {},
    finalRenderedMessage: template.body ?? template.content,
  };

  const repaired: JourneyDefinition = {
    ...existing,
    id: JOURNEY_ID,
    storeId: STORE_ID,
    status: 'PAUSED',
    settings: {
      ...(existing.settings ?? {}),
      entry: existing.settings?.entry ?? { frequency: 'once' },
      checkoutReminder: true,
    },
    nodes: existing.nodes
      .map(normalizeTriggerNode)
      .map(repairEditableNodeState)
      .map(node => repairActionNode(node, config)),
    updatedAt: new Date().toISOString(),
  };

  await updateJourney(repaired);
  const validation = await validateJourney(repaired, STORE_ID);
  if (validation.errors.length) {
    console.error(JSON.stringify({ status: 'PAUSED', validation }, null, 2));
    throw new Error(`Journey repair validation failed with ${validation.errors.length} error(s).`);
  }

  await updateJourney({ ...repaired, status: 'ACTIVE', updatedAt: new Date().toISOString() });
  const after = await safetyCounts();
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    throw new Error(`Safety assertion failed: execution records changed during migration (${JSON.stringify({ before, after })}).`);
  }
  console.log(JSON.stringify({
    repaired: true,
    journeyId: JOURNEY_ID,
    storeId: STORE_ID,
    status: 'ACTIVE',
    event: 'custom:abandoned_cart',
    recoveryMapping: 'event.checkout_url',
    historicalReplay: false,
    counts: after,
    validation: validation.status,
  }, null, 2));
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

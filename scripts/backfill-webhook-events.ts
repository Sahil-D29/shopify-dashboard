import { prisma } from '../lib/prisma';
import { processInboundWebhook, type IngestPayload } from '../lib/webhooks/ingest';
import { isShiprocketAbandonedCartPayload } from '../lib/webhooks/shiprocket';

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const selector = argument('--integration');
  const apply = process.argv.includes('--apply');
  if (!selector) throw new Error('Usage: tsx scripts/backfill-webhook-events.ts --integration <public-id-or-name> [--apply]');

  const integration = await prisma.webhookIntegration.findFirst({
    where: { OR: [{ publicId: selector }, { name: selector }] },
    select: { id: true, name: true, storeId: true, dataTypes: true, events: true },
  });
  if (!integration) throw new Error('Webhook integration not found');

  const deliveries = await prisma.webhookEvent.findMany({
    where: { integrationId: integration.id },
    orderBy: { createdAt: 'asc' },
    select: { id: true, payload: true },
  });
  const recognized = deliveries.filter(delivery => isShiprocketAbandonedCartPayload(delivery.payload));

  if (!apply) {
    console.log(JSON.stringify({ mode: 'dry-run', scanned: deliveries.length, recognized: recognized.length, skipped: deliveries.length - recognized.length }));
    return;
  }

  let processed = 0;
  let failed = 0;
  let duplicates = 0;
  for (const delivery of recognized) {
    const result = await processInboundWebhook(integration, delivery.payload as IngestPayload, { skipJourneys: true });
    if (result.duplicate) duplicates += 1;
    if (result.ok) processed += 1;
    else failed += 1;
    await prisma.webhookEvent.update({
      where: { id: delivery.id },
      data: {
        eventType: result.eventType,
        contactId: result.contactId ?? null,
        status: result.status,
        error: result.error ?? null,
      },
    });
  }

  console.log(JSON.stringify({ mode: 'apply', scanned: deliveries.length, recognized: recognized.length, processed, duplicates, failed }));
}

main()
  .catch(error => {
    console.error(error instanceof Error ? error.message : 'Backfill failed');
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());

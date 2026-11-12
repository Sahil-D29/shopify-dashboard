import { prisma } from '../lib/prisma';

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const storeId = arg('store');
  const journeyId = arg('journey');
  if (!storeId || !journeyId) throw new Error('Usage: --store <storeId> --journey <journeyId>');
  const doc = await prisma.journeyDoc.findFirst({ where: { id: journeyId, storeId } });
  if (!doc) throw new Error('Store-scoped journey not found');
  const data = doc.data as Record<string, any>;
  const updated = {
    ...data,
    settings: {
      ...(data.settings ?? {}),
      checkoutReminder: true,
      allowReentry: true,
      enrollmentAudience: 'all_live_events',
    },
    updatedAt: new Date().toISOString(),
  };
  await prisma.journeyDoc.update({ where: { id: doc.id }, data: { data: updated } });
  console.log(JSON.stringify({ journeyId, storeId, enrollmentAudience: 'all_live_events', enrollmentsCreated: 0 }));
}

main().finally(() => prisma.$disconnect());

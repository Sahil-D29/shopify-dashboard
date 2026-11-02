import { prisma } from '@/lib/prisma';
import { providerIssue } from './issues';
import { nextDeliveryStatus } from './delivery-status';

export async function applyDeliveryReceipt(status: any, phoneNumberId: string) {
  if (!status.id || !phoneNumberId) return;
  const connection = await prisma.whatsAppConfig.findFirst({ where: { phoneNumberId }, select: { storeId: true } });
  if (!connection) return;
  const storeId = connection.storeId;
  const failure = status.status === 'failed' ? providerIssue(status.errors?.[0]) : undefined;
  const seconds = Number(status.timestamp);
  const at = Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000) : new Date();
  await prisma.$transaction(async tx => {
    const messages = await tx.message.findMany({ where: { storeId, whatsappMessageId: status.id } });
    for (const message of messages) {
      const next = nextDeliveryStatus(message.status, status.status);
      if (next) await tx.message.updateMany({ where: { id: message.id, status: message.status }, data: { status: next as any,
        ...(failure ? { errorMessage: failure.message, templateData: JSON.parse(JSON.stringify({ ...(message.templateData as any ?? {}), issues: [failure] })) } : {}) } });
    }
    const logs = await tx.campaignLog.findMany({ where: { whatsappMessageId: status.id, campaign: { storeId } } });
    for (const log of logs) {
      const engaged = ['CLICKED', 'REPLIED', 'CONVERTED'].includes(log.status);
      if (engaged && status.status === 'failed') continue;
      const current = log.readAt ? 'READ' : log.deliveredAt ? 'DELIVERED' : log.status === 'SUCCESS' || engaged ? 'SENT' : log.status;
      const next = nextDeliveryStatus(current, status.status);
      if (!next) continue;
      const claim = await tx.campaignLog.updateMany({ where: { id: log.id, status: log.status, deliveredAt: log.deliveredAt, readAt: log.readAt }, data: {
        status: (engaged ? log.status : next) as any,
        ...(['DELIVERED', 'READ'].includes(next) && !log.deliveredAt ? { deliveredAt: at } : {}),
        ...(next === 'READ' ? { readAt: at } : {}),
        ...(failure ? { error: failure.message, metadata: JSON.parse(JSON.stringify({ ...(log.metadata as any ?? {}), issues: [failure] })) } : {}),
      } });
      if (claim.count) {
        await tx.campaign.update({ where: { id: log.campaignId }, data: {
          ...(['DELIVERED', 'READ'].includes(next) && !log.deliveredAt ? { totalDelivered: { increment: 1 } } : {}),
          ...(next === 'READ' && !log.readAt ? { totalOpened: { increment: 1 } } : {}),
          ...(next === 'FAILED' ? { totalFailed: { increment: 1 } } : {}),
        } });
        if (next === 'FAILED') {
          const remaining = await tx.campaignLog.count({ where: { campaignId: log.campaignId, stepIndex: 0, status: { not: 'FAILED' } } });
          if (!remaining) await tx.campaign.updateMany({ where: { id: log.campaignId, status: 'COMPLETED' }, data: { status: 'FAILED' } });
        }
      }
    }
    // The journey engine persists correlation in its activity documents, not legacy JSON files.
    const sent = await tx.journeyActivityDoc.findFirst({ where: { data: { path: ['data', 'result', 'messageId'], equals: status.id } } });
    if (sent) {
      const enrollment = await tx.journeyEnrollmentDoc.findUnique({ where: { id: sent.enrollmentId } });
      const journey = enrollment && await tx.journeyDoc.findFirst({ where: { id: enrollment.journeyId, storeId } });
      if (!journey) return;
      const receiptId = `receipt:${status.id}`;
      const existing = await tx.journeyActivityDoc.findUnique({ where: { id: receiptId } });
      const next = nextDeliveryStatus((existing?.data as any)?.data?.status ?? 'SENT', status.status);
      if (!next) return;
      const source = sent.data as any;
      const data = { id: receiptId, enrollmentId: sent.enrollmentId, timestamp: at.toISOString(),
        eventType: failure ? 'delivery_failed' : 'whatsapp_status', data: { status: next, messageId: status.id,
          nodeId: source.data?.nodeId, templateName: source.data?.template, ...(failure ? { error: failure.message, issues: [failure] } : {}) } };
      await tx.journeyActivityDoc.upsert({ where: { id: receiptId }, create: { id: receiptId, enrollmentId: sent.enrollmentId, data: JSON.parse(JSON.stringify(data)) }, update: { data: JSON.parse(JSON.stringify(data)) } });
    }
  });
}

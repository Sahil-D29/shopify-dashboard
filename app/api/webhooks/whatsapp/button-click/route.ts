export const dynamic = 'force-dynamic';

import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { normalizePhone } from '@/lib/whatsapp/normalize-phone';
import { matchAndExecuteJourneys } from '@/lib/journey-engine/trigger-matcher';

interface ButtonClickPayload {
  entry?: Array<{ changes?: Array<{ value?: {
    metadata?: { phone_number_id?: string };
    messages?: Array<{
      from?: string;
      interactive?: {
        button_reply?: { id?: string; title?: string };
        list_reply?: { id?: string; title?: string };
      };
      context?: { id?: string };
    }>;
  } }> }>;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as ButtonClickPayload;
    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const phoneNumberId = change.value?.metadata?.phone_number_id;
        const connection = phoneNumberId
          ? await prisma.whatsAppConfig.findFirst({ where: { phoneNumberId }, select: { storeId: true } })
          : null;
        for (const message of change.value?.messages ?? []) {
          const originalMessageId = message.context?.id;
          const buttonId = message.interactive?.button_reply?.id ?? message.interactive?.list_reply?.id;
          const buttonText = message.interactive?.button_reply?.title ?? message.interactive?.list_reply?.title;
          if (!originalMessageId || !buttonId) continue;

          const campaignLog = await prisma.campaignLog.findFirst({
            where: { whatsappMessageId: originalMessageId, ...(connection ? { campaign: { storeId: connection.storeId } } : {}) },
          });
          if (campaignLog && !campaignLog.clickedAt) {
            const claimed = await prisma.campaignLog.updateMany({
              where: { id: campaignLog.id, clickedAt: null },
              data: { status: 'CLICKED', clickedAt: new Date(), metadata: { ...(campaignLog.metadata as any ?? {}), buttonId, buttonText } },
            });
            if (claimed.count) await prisma.campaign.update({ where: { id: campaignLog.campaignId }, data: { totalClicked: { increment: 1 } } });
          }

          const sent = await prisma.journeyActivityDoc.findFirst({
            where: { data: { path: ['data', 'result', 'messageId'], equals: originalMessageId } },
          });
          if (!sent) continue;
          const enrollment = await prisma.journeyEnrollmentDoc.findUnique({ where: { id: sent.enrollmentId } });
          const journey = enrollment
            ? await prisma.journeyDoc.findUnique({ where: { id: enrollment.journeyId }, select: { storeId: true } })
            : null;
          if (!journey || (connection && connection.storeId !== journey.storeId)) continue;
          const clickId = `button:${originalMessageId}:${crypto.createHash('sha256').update(buttonId).digest('hex').slice(0, 16)}`;
          await prisma.journeyActivityDoc.upsert({
            where: { id: clickId },
            create: {
              id: clickId,
              enrollmentId: sent.enrollmentId,
              data: {
                id: clickId,
                enrollmentId: sent.enrollmentId,
                timestamp: new Date().toISOString(),
                eventType: 'button_clicked',
                data: { messageId: originalMessageId, buttonId, buttonText },
              },
            },
            update: {},
          });
          await matchAndExecuteJourneys('whatsapp_button_clicked', {
            storeId: journey.storeId,
            shop: null,
            payload: { phone: normalizePhone(message.from ?? ''), buttonId, buttonText: buttonText ?? '', text: buttonText ?? '' },
            receivedAt: new Date().toISOString(),
          }).catch(error => console.error('[Button Click] Journey dispatch failed', error));
        }
      }
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Button Click webhook]', error);
    return NextResponse.json({ error: 'Failed to process button click' }, { status: 500 });
  }
}

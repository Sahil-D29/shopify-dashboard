import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export async function handleFlowResponse(params: {
  flowId: string;
  phone: string;
  screenId: string;
  responseData: Record<string, unknown>;
  contactId?: string;
  completed?: boolean;
}) {
  const response = await prisma.whatsAppFlowResponse.create({
    data: {
      flowId: params.flowId,
      phone: params.phone,
      screenId: params.screenId,
      responseData: params.responseData as Prisma.InputJsonValue,
      contactId: params.contactId || null,
      completedAt: params.completed ? new Date() : null,
    },
  });

  if (params.completed) {
    await prisma.whatsAppFlow.update({
      where: { id: params.flowId },
      data: { totalCompleted: { increment: 1 } },
    });
  }

  return response;
}

export async function sendFlowMessage(params: {
  storeId: string;
  phone: string;
  flowId: string;
  headerText: string;
  bodyText: string;
  ctaText: string;
}) {
  const config = await prisma.whatsAppConfig.findUnique({
    where: { storeId: params.storeId },
  });

  if (!config) throw new Error('WhatsApp not configured for this store');

  const flow = await prisma.whatsAppFlow.findUnique({
    where: { id: params.flowId },
  });

  if (!flow || flow.status !== 'PUBLISHED') throw new Error('Flow is not published');

  const response = await fetch(
    `https://graph.facebook.com/v18.0/${config.phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: params.phone,
        type: 'interactive',
        interactive: {
          type: 'flow',
          header: { type: 'text', text: params.headerText },
          body: { text: params.bodyText },
          footer: { text: 'Powered by DOREC.IN' },
          action: {
            name: 'flow',
            parameters: {
              flow_message_version: '3',
              flow_id: flow.metaFlowId || flow.id,
              flow_cta: params.ctaText,
              mode: flow.metaFlowId ? 'published' : 'draft',
            },
          },
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error('Failed to send flow message: ' + JSON.stringify(error));
  }

  await prisma.whatsAppFlow.update({
    where: { id: params.flowId },
    data: { totalSent: { increment: 1 } },
  });

  return response.json();
}

/**
 * Centralized WhatsApp message sender.
 * Sends messages via Meta Graph API AND creates Message records in Prisma.
 * Used by: chat, campaigns, journeys, auto-replies.
 */

import { prisma } from '@/lib/prisma';
import { validateWhatsAppConfig } from '@/lib/config/whatsapp-env';
import { normalizePhone } from './normalize-phone';

export type SendMessageType = 'text' | 'template' | 'image' | 'video' | 'document' | 'audio';

export interface SendMessageOptions {
  storeId: string;
  contactId: string;
  conversationId: string;
  phone: string;
  type: SendMessageType;
  // Text message
  content?: string;
  // Template message
  templateName?: string;
  templateLanguage?: string;
  templateComponents?: unknown[];
  // Media message
  mediaUrl?: string;
  mediaType?: string;
  caption?: string;
  // Who sent it (user ID, null for system/auto)
  sentBy?: string | null;
}

export interface SendMessageResult {
  success: boolean;
  whatsappMessageId?: string;
  dbMessageId?: string;
  error?: string;
}

/**
 * Send a WhatsApp message and record it in the database.
 */
export async function sendWhatsAppMessage(opts: SendMessageOptions): Promise<SendMessageResult> {
  const validation = validateWhatsAppConfig();
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const { config } = validation;
  const formattedPhone = normalizePhone(opts.phone);

  if (!formattedPhone) {
    return { success: false, error: 'Invalid phone number' };
  }

  try {
    // Build the message payload based on type
    const payload = buildMessagePayload(opts, formattedPhone);

    // Send via Meta Graph API
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${config.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      const errorMsg = result?.error?.message || 'Failed to send message';

      // Still create message record with FAILED status
      const dbMessage = await prisma.message.create({
        data: {
          conversationId: opts.conversationId,
          contactId: opts.contactId,
          storeId: opts.storeId,
          direction: 'OUTBOUND',
          type: mapSendTypeToMessageType(opts.type),
          content: opts.content || opts.caption || '',
          mediaUrl: opts.mediaUrl || null,
          mediaType: opts.mediaType || null,
          templateName: opts.templateName || null,
          templateData: opts.templateComponents ? (opts.templateComponents as any) : null,
          status: 'FAILED',
          sentBy: opts.sentBy || null,
          errorMessage: errorMsg,
        },
      });

      return { success: false, error: errorMsg, dbMessageId: dbMessage.id };
    }

    const whatsappMessageId = result?.messages?.[0]?.id || null;
    const messageContent = opts.content || opts.caption || opts.templateName || '';
    const preview = messageContent.substring(0, 100);

    // Create message record in DB
    const dbMessage = await prisma.message.create({
      data: {
        conversationId: opts.conversationId,
        contactId: opts.contactId,
        storeId: opts.storeId,
        direction: 'OUTBOUND',
        type: mapSendTypeToMessageType(opts.type),
        content: messageContent,
        mediaUrl: opts.mediaUrl || null,
        mediaType: opts.mediaType || null,
        templateName: opts.templateName || null,
        templateData: opts.templateComponents ? (opts.templateComponents as any) : null,
        whatsappMessageId,
        status: 'SENT',
        sentBy: opts.sentBy || null,
      },
    });

    // Update conversation
    await prisma.conversation.update({
      where: { id: opts.conversationId },
      data: {
        lastMessageAt: new Date(),
        lastMessagePreview: preview,
        status: 'OPEN',
      },
    });

    // Update contact
    await prisma.contact.update({
      where: { id: opts.contactId },
      data: { lastMessageAt: new Date() },
    });

    return {
      success: true,
      whatsappMessageId: whatsappMessageId || undefined,
      dbMessageId: dbMessage.id,
    };
  } catch (error) {
    console.error('[sendWhatsAppMessage] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error sending message',
    };
  }
}

/**
 * Build Meta Graph API message payload
 */
function buildMessagePayload(opts: SendMessageOptions, formattedPhone: string): Record<string, unknown> {
  const base = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: formattedPhone,
  };

  switch (opts.type) {
    case 'text':
      return {
        ...base,
        type: 'text',
        text: {
          preview_url: true,
          body: opts.content || '',
        },
      };

    case 'template':
      return {
        ...base,
        type: 'template',
        template: {
          name: opts.templateName,
          language: { code: opts.templateLanguage || 'en' },
          components: opts.templateComponents || [],
        },
      };

    case 'image':
      return {
        ...base,
        type: 'image',
        image: {
          link: opts.mediaUrl,
          caption: opts.caption || undefined,
        },
      };

    case 'video':
      return {
        ...base,
        type: 'video',
        video: {
          link: opts.mediaUrl,
          caption: opts.caption || undefined,
        },
      };

    case 'document':
      return {
        ...base,
        type: 'document',
        document: {
          link: opts.mediaUrl,
          caption: opts.caption || undefined,
        },
      };

    case 'audio':
      return {
        ...base,
        type: 'audio',
        audio: {
          link: opts.mediaUrl,
        },
      };

    default:
      return {
        ...base,
        type: 'text',
        text: { body: opts.content || '' },
      };
  }
}

/**
 * Map send type string to Prisma MessageType enum
 */
function mapSendTypeToMessageType(type: SendMessageType): 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'AUDIO' | 'TEMPLATE' {
  const map: Record<SendMessageType, 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'AUDIO' | 'TEMPLATE'> = {
    text: 'TEXT',
    template: 'TEMPLATE',
    image: 'IMAGE',
    video: 'VIDEO',
    document: 'DOCUMENT',
    audio: 'AUDIO',
  };
  return map[type] || 'TEXT';
}

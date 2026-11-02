import { NextRequest, NextResponse } from 'next/server';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { prisma } from '@/lib/prisma';
import { normalizePhone, isValidPhone } from './normalize-phone';
import { prepareTemplate } from './template-send';
import { errorIssues, issue, SendValidationError } from './issues';
import { sendWhatsAppMessage } from './send-message';

/** Compatibility adapter for the three existing test-send request formats. */
export async function handleTemplateTest(request: NextRequest) {
  try {
    const storeId = await getCurrentStoreId(request);
    if (!storeId) return NextResponse.json({ error: 'Authorized store required' }, { status: 401 });
    const body = await request.json();
    const input = {
      templateId: body.template_id ?? body.templateId,
      templateName: body.template_name ?? body.templateName,
      templateLanguage: body.template_language ?? body.language ?? body.templateLanguage,
      variables: body.variables ?? (!Array.isArray(body.variableMappings) ? body.variableMappings : undefined),
      variableMappings: Array.isArray(body.variableMappings) ? body.variableMappings : undefined,
      mediaUrl: body.media?.url ?? body.mediaUrl,
      buttonActions: body.button_actions ?? body.buttonActions,
      components: body.components,
    };
    const phone = normalizePhone(body.phone ?? body.phoneNumber ?? '');
    if (!/^[1-9]\d{7,14}$/.test(phone) || !isValidPhone(phone)) throw new SendValidationError([issue('INVALID_PHONE', 'Enter a valid WhatsApp number with country code.', 'phone')]);
    const template = await prepareTemplate(storeId, input);
    const contact = await prisma.contact.upsert({
      where: { storeId_phone: { storeId, phone } },
      update: {}, create: { storeId, phone, source: 'MANUAL', optInStatus: 'NOT_SET', tags: [], customFields: {} },
    });
    const conversation = await prisma.conversation.upsert({
      where: { storeId_contactId: { storeId, contactId: contact.id } }, update: {},
      create: { storeId, contactId: contact.id, status: 'OPEN' },
    });
    const result = await sendWhatsAppMessage({
      storeId, contactId: contact.id, conversationId: conversation.id, phone, type: 'template',
      templateName: template.name, templateLanguage: template.language.code, templateInput: input,
    });
    return NextResponse.json({ ...result, messageId: result.whatsappMessageId, phoneNumber: phone,
      deliveryStatus: result.success ? 'ACCEPTED' : 'FAILED', userMessage: result.error,
      message: result.success ? 'Accepted by WhatsApp. Delivery is confirmed by the delivery receipt.' : undefined,
    }, { status: result.success ? 200 : 422 });
  } catch (error) {
    const issues = errorIssues(error);
    return NextResponse.json({ success: false, error: issues[0].message, userMessage: issues[0].message, issues }, { status: 422 });
  }
}

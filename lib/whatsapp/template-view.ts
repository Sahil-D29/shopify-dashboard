import type { WhatsAppTemplate } from '@/lib/types/whatsapp-config';
import type { MetaTemplateDefinition } from './template-payload';

/** Convert an account-owned Meta definition to the existing editor response shape. */
export function templateView(template: MetaTemplateDefinition): WhatsAppTemplate {
  const body = template.components.find(c => c.type === 'BODY')?.text ?? '';
  const header = template.components.find(c => c.type === 'HEADER');
  const buttons = template.components.find(c => c.type === 'BUTTONS')?.buttons;
  return {
    id: `meta_${template.id}`, metaTemplateId: template.id, name: template.name, language: template.language,
    category: (template as any).category ?? '', status: template.status as WhatsAppTemplate['status'],
    content: body, body, variables: [...new Set(Array.from(body.matchAll(/\{\{([^{}]+)\}\}/g), match => match[1].trim()))],
    header: header ? { type: (header.format ?? 'TEXT') as any, content: header.text ?? '' } : undefined,
    hasMediaHeader: !!header && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(header.format ?? ''),
    mediaType: header?.format as WhatsAppTemplate['mediaType'], hasButtons: !!buttons?.length,
    buttons: buttons?.map(button => ({ id: `${button.type.toLowerCase()}_${button.text}`, type: button.type as any,
      text: button.text, url: button.url, phoneNumber: (button as any).phone_number })),
    footer: template.components.find(c => c.type === 'FOOTER')?.text, sampleValues: {},
  };
}

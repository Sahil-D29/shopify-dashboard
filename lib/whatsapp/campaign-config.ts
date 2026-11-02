import type { TemplateInput } from './template-payload';
export function campaignTemplateInput(campaign: any): TemplateInput {
  const message = campaign.messageTemplate ?? {};
  const config = campaign.whatsappConfig ?? {};
  return { ...config,
    templateId: config.templateId ?? campaign.templateId ?? undefined,
    templateName: config.templateName ?? message.templateName,
    templateLanguage: config.templateLanguage ?? message.language,
    variables: config.variables ?? message.variables,
    mediaUrl: config.mediaUrl ?? message.media?.url ?? message.messageContent?.media?.url,
  };
}

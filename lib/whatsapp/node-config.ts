/** Read the current editor shape as well as older flat journey configurations. */
export function whatsappNodeConfig(node: any): any {
  const data = node.data ?? {};
  return { ...data, ...data.meta, ...data.config, ...data.whatsappConfig,
    ...data.meta?.whatsappActionConfig, ...data.config?.whatsappActionConfig };
}
export function isWhatsAppNode(node: any): boolean {
  const config = whatsappNodeConfig(node);
  return node.type === 'action' && ((node.subtype ?? config.subtype ?? config.type) === 'send_whatsapp' || config.actionType === 'whatsapp');
}

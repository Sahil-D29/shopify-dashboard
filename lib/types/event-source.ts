export interface EventSource {
  kind: 'webhook';
  id: string;
  name: string;
}

export interface ContactWebhookSource {
  integrationId: string;
  name: string;
  firstSeenAt: string;
  lastSeenAt: string;
}

export type ContactWebhookSources = Record<string, ContactWebhookSource>;

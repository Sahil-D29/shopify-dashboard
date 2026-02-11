export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

import type { TemplateButton, WhatsAppTemplate, WhatsAppTemplateStatus } from '@/lib/types/whatsapp-config';
import { getTemplates, setTemplates } from '@/lib/whatsapp/templates-store';

function matchesStatus(template: WhatsAppTemplate, status: string | null): boolean {
  if (!status || status === 'ALL') return true;
  // Case-insensitive status matching to handle variations like "Approved" vs "APPROVED"
  return template.status.toUpperCase() === status.toUpperCase();
}

function matchesSearch(template: WhatsAppTemplate, query: string | null): boolean {
  if (!query) return true;
  const lower = query.toLowerCase();
  const candidates = [
    template.name,
    template.category,
    template.content,
    template.description ?? '',
  ];
  return candidates.some(value => value.toLowerCase().includes(lower));
}

interface CreateTemplatePayload {
  id?: string;
  name?: string;
  category?: string;
  language?: string;
  description?: string;
  content?: string;
  body?: string;
  footer?: string;
  hasMediaHeader?: boolean;
  mediaType?: WhatsAppTemplate['mediaType'];
  mediaUrl?: string;
  buttons?: TemplateButton[];
  sampleValues?: Record<string, string>;
  status?: WhatsAppTemplateStatus;
}

function normaliseStatus(status: WhatsAppTemplateStatus | string | undefined): WhatsAppTemplateStatus {
  if (status === 'APPROVED' || status === 'PENDING' || status === 'REJECTED') {
    return status;
  }
  const upper = typeof status === 'string' ? status.toUpperCase() : '';
  if (upper === 'APPROVED' || upper === 'PENDING' || upper === 'REJECTED') {
    return upper;
  }
  return 'PENDING';
}

function parseVariables(content: string): string[] {
  return Array.from(content.matchAll(/\{\{(.*?)\}\}/g))
    .map(match => match[1]?.trim())
    .filter((value): value is string => Boolean(value));
}

function normaliseButtons(buttons: TemplateButton[] | undefined): TemplateButton[] | undefined {
  if (!buttons) return undefined;
  if (buttons.length === 0) return undefined;
  return buttons.map(button => ({
    ...button,
    text: button.text ?? button.label ?? '',
  }));
}

interface MetaComponentType {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  text?: string;
  format?: string;
  example?: {
    header_handle?: string[];
    header_text?: string[][];
    body_text?: string[][];
  };
  buttons?: Array<{
    type: 'URL' | 'PHONE_NUMBER' | 'QUICK_REPLY';
    text: string;
    url?: string;
    phone_number?: string;
  }>;
}

interface MetaTemplate {
  id: string;
  name: string;
  category: string;
  language: string;
  status: string;
  components?: MetaComponentType[];
  rejected_reason?: string;
}

interface MetaTemplatesResponse {
  data?: MetaTemplate[];
  paging?: {
    next?: string;
    previous?: string;
  };
  error?: {
    message?: string;
    type?: string;
    code?: number;
  };
}

function extractVariables(text: string): string[] {
  const matches = text.match(/\{\{(\d+)\}\}/g);
  if (!matches) return [];
  return Array.from(new Set(matches.map(match => match.replace(/\{\{|\}\}/g, ''))));
}

function mapButtons(metaButtons: MetaComponentType['buttons']): TemplateButton[] | undefined {
  if (!metaButtons || metaButtons.length === 0) return undefined;
  return metaButtons.map(button => ({
    id: `${button.type.toLowerCase()}_${button.text}`,
    type:
      button.type === 'URL'
        ? 'URL'
        : button.type === 'PHONE_NUMBER'
        ? 'PHONE_NUMBER'
        : 'QUICK_REPLY',
    text: button.text,
    url: button.url,
    phoneNumber: button.phone_number,
  }));
}

function mapHeader(metaComponent: MetaComponentType | undefined): WhatsAppTemplate['header'] {
  if (!metaComponent) return undefined;
  const format = metaComponent.format ?? 'TEXT';
  if (format === 'TEXT') {
    const headerText = metaComponent.text ?? metaComponent.example?.header_text?.[0]?.[0] ?? '';
    return { type: 'TEXT', content: headerText };
  }
  return {
    type: format === 'IMAGE' || format === 'VIDEO' || format === 'DOCUMENT' ? format : 'TEXT',
    content: metaComponent.text ?? metaComponent.example?.header_handle?.[0] ?? '',
  };
}

function toWhatsAppTemplate(metaTemplate: MetaTemplate): WhatsAppTemplate {
  const components = metaTemplate.components ?? [];
  const bodyComponent = components.find(component => component.type === 'BODY');
  const headerComponent = components.find(component => component.type === 'HEADER');
  const footerComponent = components.find(component => component.type === 'FOOTER');
  const buttonsComponent = components.find(component => component.type === 'BUTTONS');

  const bodyText = bodyComponent?.text ?? '';

  return {
    id: `meta_${metaTemplate.id}`,
    metaTemplateId: metaTemplate.id,
    name: metaTemplate.name,
    category: metaTemplate.category,
    language: metaTemplate.language,
    status: metaTemplate.status.toUpperCase() as WhatsAppTemplate['status'],
    body: bodyText,
    content: bodyText,
    header: mapHeader(headerComponent),
    footer: footerComponent?.text,
    buttons: mapButtons(buttonsComponent?.buttons),
    variables: extractVariables(bodyText),
    sampleValues: {},
    rejectionReason: metaTemplate.rejected_reason,
    messagesSent: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    approvedAt: metaTemplate.status === 'APPROVED' ? Date.now() : undefined,
    hasMediaHeader: Boolean(headerComponent && headerComponent.format && headerComponent.format !== 'TEXT'),
    hasButtons: Boolean(buttonsComponent?.buttons?.length),
    mediaType: headerComponent?.format as WhatsAppTemplate['mediaType'],
  };
}

async function fetchTemplatesFromWhatsApp(wabaId: string, accessToken: string): Promise<WhatsAppTemplate[]> {
  let allMetaTemplates: MetaTemplate[] = [];
  let nextPageUrl: string | null = `https://graph.facebook.com/v18.0/${wabaId}/message_templates?limit=100`;

  while (nextPageUrl) {
    const response = await fetch(nextPageUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    const data = (await response.json()) as MetaTemplatesResponse;

    if (!response.ok) {
      const errorMessage = data.error?.message ?? `HTTP ${response.status}`;
      throw new Error(`Failed to fetch templates from WhatsApp API: ${errorMessage}`);
    }

    const metaTemplates = data.data ?? [];
    allMetaTemplates = [...allMetaTemplates, ...metaTemplates];

    // Check for next page
    nextPageUrl = data.paging?.next || null;
  }

  return allMetaTemplates.map(template => {
    const converted = toWhatsAppTemplate(template);
    return {
      ...converted,
      status: converted.status.toUpperCase() as WhatsAppTemplate['status'],
    };
  });
}

export async function GET(request: NextRequest) {
  try {
    // Try to get credentials from request body (for client-side config)
    let wabaId: string | undefined;
    let accessToken: string | undefined;

    try {
      const configHeader = request.headers.get('X-WhatsApp-Config');
      if (configHeader) {
        const config = JSON.parse(configHeader) as { wabaId?: string; accessToken?: string };
        wabaId = config.wabaId;
        accessToken = config.accessToken;
      }
    } catch {
      // Ignore parse errors
    }

    // Fallback to environment variables
    wabaId = wabaId ?? process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
    accessToken = accessToken ?? process.env.WHATSAPP_ACCESS_TOKEN ?? process.env.META_ACCESS_TOKEN;

    // If credentials are available, fetch from WhatsApp API
    if (wabaId && accessToken) {
      try {
        console.log('📥 Fetching templates from WhatsApp Business API...');
        const templates = await fetchTemplatesFromWhatsApp(wabaId, accessToken);
        console.log(`✅ Fetched ${templates.length} templates from WhatsApp API`);

        const searchParams = request.nextUrl.searchParams;
        const status = searchParams.get('status');
        const search = searchParams.get('search');
        const pageParam = Number.parseInt(searchParams.get('page') ?? '1', 10);
        const pageSizeParam = Number.parseInt(searchParams.get('pageSize') ?? '12', 10);

        const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
        const pageSize = Number.isFinite(pageSizeParam) && pageSizeParam > 0 ? pageSizeParam : 12;

        const filtered = templates.filter(
          template => matchesStatus(template, status) && matchesSearch(template, search)
        );

        const total = filtered.length;
        const start = (page - 1) * pageSize;
        const end = start + pageSize;
        const paginated = filtered.slice(start, end);

        return NextResponse.json({
          templates: paginated,
          total,
          page,
          pageSize,
        });
      } catch (apiError) {
        console.error('❌ Error fetching from WhatsApp API:', apiError);
        // Fall through to return local templates as fallback
      }
    }

    // Fallback to local templates if API fetch fails or credentials not available
    console.log('📦 Using local templates (fallback)');
    const list = getTemplates();

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const pageParam = Number.parseInt(searchParams.get('page') ?? '1', 10);
    const pageSizeParam = Number.parseInt(searchParams.get('pageSize') ?? '12', 10);

    const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
    const pageSize = Number.isFinite(pageSizeParam) && pageSizeParam > 0 ? pageSizeParam : 12;

    const filtered = list.filter(template => matchesStatus(template, status) && matchesSearch(template, search));

    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginated = filtered.slice(start, end);

    return NextResponse.json({
      templates: paginated,
      total,
      page,
      pageSize,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch templates';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as CreateTemplatePayload;
    const now = new Date().toISOString();

    const content = payload.content ?? payload.body ?? '';

    if (!payload.name || !payload.category || !payload.language || !content) {
      return NextResponse.json(
        { error: 'Template name, content, category, and language are required.' },
        { status: 400 },
      );
    }

    const variables = parseVariables(content);
    const status = normaliseStatus(payload.status);
    const buttons = normaliseButtons(payload.buttons);

    const newTemplate: WhatsAppTemplate = {
      id: payload.id ?? `tmpl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      name: payload.name,
      category: payload.category,
      language: payload.language,
      status,
      description: payload.description,
      content,
      body: content,
      footer: payload.footer,
      variables,
      hasMediaHeader: Boolean(payload.hasMediaHeader),
      mediaType: payload.mediaType,
      mediaUrl: payload.mediaUrl,
      hasButtons: Boolean(buttons?.length),
      buttons,
      sampleValues: payload.sampleValues,
      createdAt: now,
      updatedAt: now,
      lastUsed: undefined,
    };

    const nextTemplates = [...getTemplates(), newTemplate];
    setTemplates(nextTemplates);

    return NextResponse.json({ template: newTemplate });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create template';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}



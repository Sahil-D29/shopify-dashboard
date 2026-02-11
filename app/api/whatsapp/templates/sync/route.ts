export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getTemplates, setTemplates } from '@/lib/whatsapp/templates-store';
import type { TemplateButton, WhatsAppTemplate } from '@/lib/types/whatsapp-config';
import fs from 'fs/promises';
import path from 'path';

interface SyncRequestBody {
  wabaId?: string;
  accessToken?: string;
}

type MetaComponentType = 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';

interface MetaButton {
  type: 'URL' | 'PHONE_NUMBER' | 'QUICK_REPLY';
  text: string;
  url?: string;
  phone_number?: string;
}

interface MetaComponent {
  type: MetaComponentType;
  text?: string;
  format?: string;
  example?: {
    header_handle?: string[];
    header_text?: string[][];
    body_text?: string[][];
  };
  buttons?: MetaButton[];
}

interface MetaTemplate {
  id: string;
  name: string;
  category: string;
  language: string;
  status: string;
  components?: MetaComponent[];
  rejected_reason?: string;
}

interface MetaTemplatesResponse {
  data?: MetaTemplate[];
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
  };
}

interface ServerConfig {
  wabaId?: string;
  accessToken?: string;
}

function parseRequestBody(body: unknown): SyncRequestBody {
  if (!body || typeof body !== 'object') {
    return {};
  }
  const payload = body as SyncRequestBody;
  return {
    wabaId: payload.wabaId,
    accessToken: payload.accessToken,
  };
}

// Read WhatsApp config from server-side JSON file
async function getServerConfig(): Promise<ServerConfig | null> {
  try {
    const configPath = path.join(process.cwd(), 'data', 'whatsapp-config.json');
    const data = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

function extractVariables(text: string): string[] {
  const matches = text.match(/\{\{(\d+)\}\}/g);
  if (!matches) return [];
  return Array.from(new Set(matches.map(match => match.replace(/\{\{|\}\}/g, ''))));
}

function mapButtons(metaButtons: MetaButton[] | undefined): TemplateButton[] | undefined {
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

function mapHeader(metaComponent: MetaComponent | undefined): WhatsAppTemplate['header'] {
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

function toSyncedTemplate(metaTemplate: MetaTemplate): WhatsAppTemplate {
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
    content: bodyText,
    category: metaTemplate.category,
    language: metaTemplate.language,
    status: metaTemplate.status.toUpperCase() as WhatsAppTemplate['status'],
    body: bodyText,
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

export async function POST(request: NextRequest) {
  try {
    // Try to get credentials from multiple sources
    let wabaId: string | undefined;
    let accessToken: string | undefined;

    // 1. Try request body first (from frontend config)
    const payload = parseRequestBody(await request.json().catch(() => ({})));
    wabaId = payload.wabaId;
    accessToken = payload.accessToken;

    // 2. Try headers (X-WhatsApp-Config)
    if ((!wabaId || !accessToken) && request.headers.get('X-WhatsApp-Config')) {
      try {
        const configHeader = request.headers.get('X-WhatsApp-Config');
        if (configHeader) {
          const config = JSON.parse(configHeader) as { wabaId?: string; accessToken?: string };
          wabaId = wabaId ?? config.wabaId;
          accessToken = accessToken ?? config.accessToken;
        }
      } catch {
        // Ignore parse errors
      }
    }

    // 3. Try server-side config file
    if (!wabaId || !accessToken) {
      const serverConfig = await getServerConfig();
      if (serverConfig) {
        wabaId = wabaId ?? serverConfig.wabaId;
        accessToken = accessToken ?? serverConfig.accessToken;
        console.log('📁 Using server-side WhatsApp config');
      }
    }

    // 4. Fallback to environment variables
    wabaId = wabaId ?? process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
    accessToken = accessToken ?? process.env.WHATSAPP_ACCESS_TOKEN ?? process.env.META_ACCESS_TOKEN;

    console.log('🔍 Sync credentials check:', {
      fromBody: Boolean(payload.wabaId && payload.accessToken),
      fromHeader: Boolean(request.headers.get('X-WhatsApp-Config')),
      fromServerConfig: Boolean(await getServerConfig()),
      fromEnv: Boolean(process.env.WHATSAPP_BUSINESS_ACCOUNT_ID && (process.env.WHATSAPP_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN)),
      hasWabaId: Boolean(wabaId),
      hasAccessToken: Boolean(accessToken),
    });

    if (!wabaId || !accessToken) {
      return NextResponse.json(
        {
          error: 'WhatsApp credentials not configured',
          message: 'Please configure WhatsApp credentials in Settings → WhatsApp tab',
          details: {
            wabaId: Boolean(wabaId),
            accessToken: Boolean(accessToken),
          },
        },
        { status: 400 },
      );
    }

    // Fetch all templates with pagination
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

      const data = (await response.json()) as MetaTemplatesResponse & { paging?: { next?: string } };

      if (!response.ok) {
        return NextResponse.json(
          {
            error: 'Failed to fetch templates from Meta',
            details: data.error,
          },
          { status: response.status },
        );
      }

      const metaTemplates = data.data ?? [];
      allMetaTemplates = [...allMetaTemplates, ...metaTemplates];
      
      // Check for next page
      nextPageUrl = data.paging?.next || null;
    }

    console.log(`✅ [Template Sync] Fetched ${allMetaTemplates.length} templates from WhatsApp API`);
    
    // Transform all templates with UPPERCASE status
    const syncedTemplates = allMetaTemplates.map(template => {
      const synced = toSyncedTemplate(template);
      return {
        ...synced,
        status: synced.status.toUpperCase() as WhatsAppTemplate['status'],
      };
    });

    const localTemplates = getTemplates();

    const mergedTemplates = new Map<string, WhatsAppTemplate>();

    localTemplates.forEach(template => {
      if (!template.metaTemplateId) {
        mergedTemplates.set(template.id, template);
      }
    });

    let updated = 0;
    let added = 0;

    syncedTemplates.forEach(template => {
      const existing = localTemplates.find(item => item.metaTemplateId === template.metaTemplateId);

      if (existing) {
        const previousStatus = existing.status;
        const nextTemplate: WhatsAppTemplate = {
          ...existing,
          ...template,
          id: existing.id,
          updatedAt: new Date().toISOString(),
        };

        mergedTemplates.set(nextTemplate.id, nextTemplate);

        if (previousStatus !== template.status) {
          updated += 1;
        }
      } else {
        mergedTemplates.set(template.id, template);
        added += 1;
      }
    });

    const finalTemplates = Array.from(mergedTemplates.values());
    setTemplates(finalTemplates);

    console.log(`✅ [Template Sync] Merged templates: ${finalTemplates.length} total (${added} added, ${updated} updated)`);
    
    return NextResponse.json({
      success: true,
      syncedCount: syncedTemplates.length,
      updated,
      added,
      total: finalTemplates.length,
      templates: syncedTemplates,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to sync templates';
    console.error('❌ [Template Sync] Error:', message);
    return NextResponse.json(
      {
        error: message,
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    );
  }
}

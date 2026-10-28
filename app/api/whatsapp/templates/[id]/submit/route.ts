export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { META_GRAPH_API_VERSION, resolveWhatsAppConfig } from '@/lib/config/whatsapp-config-resolver';
import { graphUrl } from '@/lib/whatsapp/graph';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { auth } from '@/lib/auth';
import { validateTenantAccess } from '@/lib/tenant/tenant-middleware';
import { TemplateValidator } from '@/lib/utils/template-validator';
import { getDraftById, deleteDraft } from '@/lib/whatsapp/template-drafts';
import { buildMetaPayload } from '@/lib/whatsapp/template-submission';
import type { WhatsAppTemplate } from '@/lib/types/whatsapp-config';

interface SubmitRequestBody {
  storeId?: string;
}

interface MetaSubmitError {
  message?: string;
  error_user_msg?: string;
  code?: number;
  error_subcode?: number;
}

interface MetaSubmitResponse {
  id?: string;
  status?: string;
  error?: MetaSubmitError;
}

function withDefault<T>(value: T | undefined, fallback: T): T {
  return value === undefined || value === null ? fallback : value;
}

function parseRequestBody(body: unknown): SubmitRequestBody {
  if (!body || typeof body !== 'object') {
    return {};
  }

  const payload = body as SubmitRequestBody;
  return {
    storeId: payload.storeId,
  };
}

function buildUserMessage(error: MetaSubmitError | undefined, fallback: string): string {
  if (!error) return fallback;
  if (error.error_subcode === 2388293) {
    return 'Your template has too many variables for the amount of text. Add more words to your message or reduce the number of variables.';
  }
  if (error.code === 100) {
    return 'Invalid template format. Please check all fields.';
  }
  if (error.code === 190) {
    return 'Authentication failed. Your access token may have expired.';
  }
  if (error.message && error.message.includes('already exists')) {
    return 'A template with this name already exists. Please use a different name.';
  }
  return error.error_user_msg ?? error.message ?? fallback;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const requestBody = parseRequestBody(await request.json().catch(() => ({})));
    let storeId = await getCurrentStoreId(request);

    if (requestBody.storeId) {
      const session = await auth();
      if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const hasAccess = await validateTenantAccess(session.user.id, requestBody.storeId);
      if (!hasAccess) {
        return NextResponse.json({ error: 'Access denied to this store' }, { status: 403 });
      }
      storeId = requestBody.storeId;
    }

    const template = await getDraftById(storeId, id);
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const validation = TemplateValidator.validateTemplate({
      name: template.name,
      body: template.body ?? '',
      variables: template.variables ?? [],
      header: template.header ? { type: template.header.type, content: template.header.content ?? '' } : undefined,
      footer: template.footer,
      buttons: template.buttons?.map(button => ({
        type: String(button.type).toUpperCase() as 'URL' | 'PHONE_NUMBER' | 'QUICK_REPLY',
        text: button.text ?? button.label ?? '',
        url: button.url,
        urlExample: button.urlExample,
        phoneNumber: button.phoneNumber ?? button.phone,
      })),
    });

    if (!validation.valid) {
      return NextResponse.json(
        {
          error: 'Template validation failed',
          validationErrors: validation.errors,
          validationWarnings: validation.warnings,
          suggestion: TemplateValidator.getSuggestion({
            body: template.body ?? '',
            variables: template.variables ?? [],
          }),
        },
        { status: 400 },
      );
    }

    // Resolve credentials from the saved WhatsApp connection (Embedded Signup,
    // stored encrypted in the DB) for the current store, falling back to any
    // values passed in the request body.
    const resolved = await resolveWhatsAppConfig(storeId);

    const wabaId = resolved.valid ? resolved.config.wabaId : undefined;
    const accessToken = resolved.valid ? resolved.config.accessToken : undefined;

    if (!wabaId || !accessToken) {
      return NextResponse.json(
        {
          error: 'WhatsApp not configured. Connect with Facebook in Settings → WhatsApp first.',
        },
        { status: 400 },
      );
    }

    const metaPayload = buildMetaPayload(template);

    const response = await fetch(graphUrl(`${META_GRAPH_API_VERSION}/${wabaId}/message_templates`, accessToken), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(metaPayload),
    });

    const result = (await response.json()) as MetaSubmitResponse;

    if (!response.ok) {
      const errorMessage = withDefault(result.error?.message, 'Failed to submit template to Meta');
      const userFriendlyMessage = buildUserMessage(result.error, errorMessage);

      return NextResponse.json(
        {
          error: errorMessage,
          userMessage: userFriendlyMessage,
          details: result.error,
          payload: metaPayload,
          errorCode: result.error?.code,
          errorSubcode: result.error?.error_subcode,
        },
        { status: response.status },
      );
    }

    const nextTemplate: WhatsAppTemplate = {
      ...template,
      status: String(result.status ?? template.status).toUpperCase() as WhatsAppTemplate['status'],
      metaTemplateId: result.id ?? template.metaTemplateId,
      submittedAt: Date.now(),
      updatedAt: new Date().toISOString(),
    };

    // Once submitted, the template lives in Meta (and will appear via live sync
    // as PENDING). Remove the local draft to avoid a duplicate.
    if (storeId) {
      await deleteDraft(storeId, id).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      template: nextTemplate,
      metaId: result.id,
      metaStatus: result.status,
      message: 'Template submitted successfully! It will be reviewed by Meta within 24 hours.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to submit template';
    return NextResponse.json(
      {
        error: message,
        details: error instanceof Error ? error.stack : String(error),
      },
      { status: 500 },
    );
  }
}

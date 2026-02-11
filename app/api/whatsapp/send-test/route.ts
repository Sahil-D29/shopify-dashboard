import { NextRequest, NextResponse } from "next/server";

import { validateWhatsAppConfig } from "@/lib/config/whatsapp-env";
import type {
  WhatsAppTemplate,
  WhatsAppTemplateBodyParameter,
  WhatsAppTemplateComponent,
  WhatsAppBodyField,
} from "@/lib/types/whatsapp-config";
import { normalizeVariableToken, renderTemplateWithVariables } from "@/lib/whatsapp/template-utils";

import { getTemplates } from '@/lib/whatsapp/templates-store';

interface SendTestRequestBody {
  template_id?: string;
  template_name?: string;
  template_language?: string;
  template_category?: string;
  phone?: string;
  variables?: Record<string, string>;
  button_actions?: Record<string, string>;
  body_fields?: WhatsAppBodyField[];
  media?: {
    type?: "IMAGE" | "VIDEO" | "DOCUMENT" | "TEXT";
    url?: string;
    dynamic?: boolean;
  };
  render_preview?: boolean;
  metadata?: Record<string, unknown>;
}

interface WhatsAppApiError {
  message?: string;
  code?: number;
  type?: string;
  error_subcode?: number;
  fbtrace_id?: string;
}

interface WhatsAppApiResponse {
  messages?: Array<{ id?: string }>;
  error?: WhatsAppApiError;
}

const ERROR_MESSAGES: Record<
  string,
  { user: string; technical: string; solution: string }
> = {
  INVALID_PHONE: {
    user: "Please enter a valid WhatsApp phone number with country code",
    technical: "Phone number validation failed",
    solution: "Verify the number format: +[country_code][number]",
  },
  NOT_OPTED_IN: {
    user: "This number has not opted in to receive WhatsApp messages",
    technical: "Recipient opt-in not found",
    solution: "User must initiate a conversation or opt-in first",
  },
  TEMPLATE_NOT_APPROVED: {
    user: "This template is not yet approved by WhatsApp",
    technical: "Template status is not APPROVED",
    solution: "Wait for template approval or select a different template",
  },
  RATE_LIMIT: {
    user: "You've sent too many test messages. Please wait a few minutes.",
    technical: "Rate limit exceeded for test messages",
    solution: "Wait 5 minutes before sending another test",
  },
  PROVIDER_ERROR: {
    user: "Unable to send message. Please try again.",
    technical: "WhatsApp provider API error",
    solution: "Check provider credentials and status",
  },
  INVALID_VARIABLES: {
    user: "Some variables are missing or invalid",
    technical: "Variable validation failed",
    solution: "Ensure all required variables are filled correctly",
  },
  MEDIA_UPLOAD_FAILED: {
    user: "Failed to upload media. Please try a different file.",
    technical: "Media upload failed",
    solution: "Check file size and format requirements",
  },
  TEMPLATE_NOT_FOUND: {
    user: "This template no longer exists",
    technical: "Template ID not found",
    solution: "Refresh templates and select a valid one",
  },
};

function formatPhoneNumber(input: string): string {
  return input.replace(/[\s\-()]/g, "");
}

function resolveVariableValue(variable: string, values: Record<string, string>): string {
  const normalized = normalizeVariableToken(variable);
  const plain = normalized.replace(/^\{\{|\}\}$/g, "");
  return values[normalized] ?? values[plain] ?? values[variable] ?? "";
}

function buildComponents(
  template: WhatsAppTemplate,
  variableValues: Record<string, string>,
): WhatsAppTemplateComponent[] | undefined {
  if (!template.variables?.length) return undefined;
  const parameters: WhatsAppTemplateBodyParameter[] = template.variables.map(variable => ({
    type: "text",
    text: String(resolveVariableValue(variable, variableValues)).trim(),
  }));
  return [{ type: "body", parameters }];
}

function buildUserFriendlyMessage(error: WhatsAppApiError | undefined, fallback: string): string {
  if (!error) return fallback;
  const code = error.code;
  if (code === 131047) return "Template not approved yet. Use an approved template.";
  if (code === 131026) return ERROR_MESSAGES.INVALID_PHONE.user;
  if (code === 133016) return "This phone number is not registered on WhatsApp.";
  if (code === 100) return "Invalid parameter. Check template variables.";
  if (code === 190) return "Access token expired. Update WhatsApp credentials.";
  if (error.message && error.message.toLowerCase().includes("rate limit")) {
    return ERROR_MESSAGES.RATE_LIMIT.user;
  }
  return error.message ?? fallback;
}

function ensureTemplate(
  templates: WhatsAppTemplate[],
  templateId?: string,
  templateName?: string,
): WhatsAppTemplate | undefined {
  if (templateId) {
    const match = templates.find(template => template.id === templateId);
    if (match) return match;
  }
  if (templateName) {
    return templates.find(template => template.name === templateName);
  }
  return undefined;
}

function collectMissingVariables(
  template: WhatsAppTemplate,
  values: Record<string, string>,
): string[] {
  if (!template.variables?.length) return [];
  return template.variables.filter(variable => {
    const raw = resolveVariableValue(variable, values);
    return !raw || !String(raw).trim();
  });
}

// Simple in-memory rate limiter (in production, use Redis or similar)
const testSendRateLimiter = new Map<string, { count: number; resetAt: number }>();
const TEST_SEND_LIMIT = 10; // Max 10 test sends per hour per phone
const TEST_SEND_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkRateLimit(phone: string): { allowed: boolean; resetAt?: number } {
  const now = Date.now();
  const key = phone.replace(/[^\d+]/g, '');
  const record = testSendRateLimiter.get(key);

  if (!record || now > record.resetAt) {
    testSendRateLimiter.set(key, { count: 1, resetAt: now + TEST_SEND_WINDOW_MS });
    return { allowed: true };
  }

  if (record.count >= TEST_SEND_LIMIT) {
    return { allowed: false, resetAt: record.resetAt };
  }

  record.count++;
  testSendRateLimiter.set(key, record);
  return { allowed: true };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SendTestRequestBody;
    const {
      template_id,
      template_name,
      template_language,
      phone,
      variables = {},
      body_fields = [],
      render_preview = false,
      metadata,
    } = body;

    if (!template_id && !template_name) {
      return NextResponse.json({ error: "template_id or template_name is required." }, { status: 400 });
    }
    if (!template_language) {
      return NextResponse.json({ error: "template_language is required." }, { status: 400 });
    }
    if (!phone) {
      return NextResponse.json({ error: "phone is required." }, { status: 400 });
    }

    // Rate limiting for test sends
    const formattedPhone = formatPhoneNumber(phone);
    const rateLimitCheck = checkRateLimit(formattedPhone);
    if (!rateLimitCheck.allowed) {
      const resetTime = rateLimitCheck.resetAt
        ? new Date(rateLimitCheck.resetAt).toISOString()
        : 'soon';
      return NextResponse.json(
        {
          error: "RATE_LIMIT",
          userMessage: ERROR_MESSAGES.RATE_LIMIT.user,
          technicalMessage: ERROR_MESSAGES.RATE_LIMIT.technical,
          solution: ERROR_MESSAGES.RATE_LIMIT.solution,
          resetAt: resetTime,
        },
        { status: 429 },
      );
    }

    if (!/^\+?[1-9]\d{7,14}$/.test(formattedPhone)) {
      const message = ERROR_MESSAGES.INVALID_PHONE;
      return NextResponse.json(
        {
          error: "INVALID_PHONE",
          userMessage: message.user,
          technicalMessage: message.technical,
          solution: message.solution,
        },
        { status: 400 },
      );
    }

    const templates = getTemplates();
    const template = ensureTemplate(templates, template_id, template_name);

    if (!template) {
      const message = ERROR_MESSAGES.TEMPLATE_NOT_FOUND;
      return NextResponse.json(
        {
          error: "TEMPLATE_NOT_FOUND",
          userMessage: message.user,
          technicalMessage: message.technical,
          solution: message.solution,
        },
        { status: 404 },
      );
    }

    if (template.status !== "APPROVED") {
      const message = ERROR_MESSAGES.TEMPLATE_NOT_APPROVED;
      return NextResponse.json(
        {
          error: "TEMPLATE_NOT_APPROVED",
          userMessage: message.user,
          technicalMessage: message.technical,
          solution: message.solution,
        },
        { status: 409 },
      );
    }

    const missingVariables = collectMissingVariables(template, variables);
    if (missingVariables.length) {
      const message = ERROR_MESSAGES.INVALID_VARIABLES;
      return NextResponse.json(
        {
          error: "INVALID_VARIABLES",
          userMessage: message.user,
          technicalMessage: message.technical,
          solution: message.solution,
          missingVariables,
        },
        { status: 422 },
      );
    }

    const validation = validateWhatsAppConfig();
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: "CONFIG_NOT_SET",
          userMessage: "WhatsApp credentials are not configured.",
          details: validation.error,
          missing: validation.missing,
        },
        { status: 500 },
      );
    }

    const bodyFromFields =
      Array.isArray(body_fields) && body_fields.length
        ? body_fields.map(field => field.value?.trim()).filter(Boolean).join("\n\n")
        : null;

    const templateForSend: WhatsAppTemplate = bodyFromFields
      ? {
          ...template,
          content: bodyFromFields,
          body: bodyFromFields,
        }
      : template;

    const components = buildComponents(templateForSend, variables);

    const payload = {
      messaging_product: "whatsapp",
      to: formattedPhone,
      type: "template",
      template: {
        name: template.name,
        language: { code: template_language },
        components,
      },
    };

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${validation.config.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${validation.config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );

    const result = (await response.json()) as WhatsAppApiResponse;

    if (!response.ok || result.error) {
      const message = buildUserFriendlyMessage(result.error, "Unable to send test message.");
      return NextResponse.json(
        {
          success: false,
          error: "PROVIDER_ERROR",
          userMessage: message,
          details: result.error,
          payload,
        },
        { status: response.status || 500 },
      );
    }

    const renderedPreview = render_preview ? renderTemplateWithVariables(templateForSend, variables) : undefined;

    // Audit logging (mask sensitive data)
    const maskedPhone = formattedPhone.replace(/(\d{4})\d+(\d{4})/, '$1****$2');
    const userId = request.headers.get('x-user-id') || 'anonymous';
    console.log(
      `[AUDIT] Test message sent: template=${template.name}, phone=${maskedPhone}, by=${userId}, journey=${metadata?.journey_id || 'N/A'}`,
    );

    return NextResponse.json({
      success: true,
      message: "Test message sent successfully",
      data: {
        message_id: result.messages?.[0]?.id,
        template_id: template.id,
        template_name: template.name,
        template_language,
        phone: formattedPhone,
        variables,
        body_fields,
        metadata,
        preview: render_preview
          ? {
              body: renderedPreview,
              character_count: renderedPreview?.length ?? 0,
            }
          : undefined,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send test message.";
    return NextResponse.json(
      {
        success: false,
        error: "PROVIDER_ERROR",
        userMessage: message,
      },
      { status: 500 },
    );
  }
}



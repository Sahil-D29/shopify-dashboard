/**
 * Thin wrapper around the Resend REST API.
 * Reads RESEND_API_KEY from env at call time so the same code works
 * across server runtimes (Render env vars are set at process start).
 *
 * If RESEND_API_KEY is not set, every call throws ResendNotConfiguredError
 * — callers should catch this and return a clear 400 to the user.
 */

const RESEND_BASE = 'https://api.resend.com';

export class ResendNotConfiguredError extends Error {
  constructor() {
    super('Resend is not configured. Set RESEND_API_KEY in environment variables.');
    this.name = 'ResendNotConfiguredError';
  }
}

export class ResendApiError extends Error {
  status: number;
  resendCode?: string;
  body: unknown;
  constructor(status: number, body: any) {
    const message =
      body?.message || body?.error?.message || `Resend API error (${status})`;
    super(message);
    this.name = 'ResendApiError';
    this.status = status;
    this.resendCode = body?.name || body?.error?.name;
    this.body = body;
  }
}

function getApiKey(): string {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new ResendNotConfiguredError();
  return key;
}

export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

async function resendRequest<T>(
  method: 'GET' | 'POST' | 'DELETE' | 'PATCH',
  path: string,
  body?: unknown,
): Promise<T> {
  const apiKey = getApiKey();
  const res = await fetch(`${RESEND_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });

  const text = await res.text();
  let parsed: any;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { raw: text };
  }

  if (!res.ok) {
    throw new ResendApiError(res.status, parsed);
  }
  return parsed as T;
}

// =====================================================================
// Domains
// =====================================================================

export interface ResendDnsRecord {
  record: string; // SPF | DKIM | MX | DMARC
  name: string; // hostname to set
  type: string; // TXT | CNAME | MX
  value: string;
  ttl?: string;
  priority?: number;
  status?: string;
}

export interface ResendDomain {
  id: string;
  name: string;
  status: 'not_started' | 'pending' | 'verified' | 'failed' | string;
  region?: string;
  created_at?: string;
  records?: ResendDnsRecord[];
}

export interface CreateDomainPayload {
  name: string;
  region?: 'us-east-1' | 'eu-west-1' | 'sa-east-1' | 'ap-northeast-1';
}

export function createDomain(payload: CreateDomainPayload): Promise<ResendDomain> {
  return resendRequest<ResendDomain>('POST', '/domains', payload);
}

export function getDomain(resendDomainId: string): Promise<ResendDomain> {
  return resendRequest<ResendDomain>('GET', `/domains/${resendDomainId}`);
}

export function verifyDomain(resendDomainId: string): Promise<{ id: string; name: string; status: string }> {
  return resendRequest('POST', `/domains/${resendDomainId}/verify`);
}

export function deleteDomain(resendDomainId: string): Promise<{ id: string; deleted: boolean }> {
  return resendRequest('DELETE', `/domains/${resendDomainId}`);
}

// =====================================================================
// Email send
// =====================================================================

export interface SendEmailPayload {
  from: string; // "Sender Name <sender@yourdomain.com>"
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  reply_to?: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  headers?: Record<string, string>;
  tags?: Array<{ name: string; value: string }>;
}

export interface SendEmailResult {
  id: string;
}

export function sendEmail(payload: SendEmailPayload): Promise<SendEmailResult> {
  return resendRequest<SendEmailResult>('POST', '/emails', payload);
}

export interface SendBatchEmailResult {
  data: Array<{ id: string }>;
}

export function sendBatchEmails(payloads: SendEmailPayload[]): Promise<SendBatchEmailResult> {
  return resendRequest<SendBatchEmailResult>('POST', '/emails/batch', payloads);
}

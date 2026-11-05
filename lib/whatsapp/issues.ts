export interface SendIssue {
  code: string;
  message: string;
  field?: string;
  nodeId?: string;
  action: string;
  href?: string;
  retryable: boolean;
  customerFixable: boolean;
  referenceId?: string;
  details?: string;
}

export function issue(code: string, message: string, field?: string): SendIssue {
  return { code, message, field, action: 'Open the message settings and complete this field.', retryable: false, customerFixable: true };
}

export class SendValidationError extends Error {
  constructor(public issues: SendIssue[]) {
    super(issues.map(item => item.message).join(' '));
    this.name = 'SendValidationError';
  }
}

export function providerIssue(error: any): SendIssue {
  const code = String(error?.code ?? 'INTERNAL_ERROR');
  const known: Record<string, [string, string, string?]> = {
    '131008': ['A required template parameter is missing.', 'Check the template header, variables, media and dynamic buttons.'],
    '132000': ['Template variables do not match the approved template.', 'Refresh the template and complete its variable mappings.'],
    '132012': ['Template parameter format does not match.', 'Check header media type and variable formats.'],
    '132001': ['Template or language is unavailable.', 'Refresh templates and select an approved template in the correct language.'],
    '132015': ['This template is paused.', 'Select another approved template or review its status in Meta.'],
    '132016': ['This template is disabled.', 'Select another approved template.'],
    '131047': ['The customer service window is closed.', 'Use an approved template to contact this recipient.'],
    '131049': ['Meta restricted delivery of this marketing message.', 'Avoid immediate retries. Wait before trying again. For a service test, ask the recipient to message your business first, then reply within the customer service window.'],
    '131050': ['This recipient has stopped receiving marketing messages from your business.', 'Respect the recipient’s marketing preference. Do not retry this marketing message.'],
    '131026': ['WhatsApp could not deliver this message.', 'Check the recipient number and WhatsApp availability. Meta may also restrict delivery to this recipient.'],
    '131021': ['The recipient is the sending business number.', 'Use a different WhatsApp number for the test.'],
    '190': ['WhatsApp access has expired or is invalid.', 'Reconnect WhatsApp in Settings.', '/settings'],
    '133010': ['The sending number is not registered.', 'Register your number for sending in WhatsApp settings.', '/settings'],
    '131042': ['WhatsApp account payment or eligibility needs attention.', 'Review your WhatsApp business billing and account eligibility in Meta.', '/settings'],
    '131031': ['Your WhatsApp business account is restricted.', 'Review your account status in Meta.', '/settings'],
  };
  const mapped = known[code];
  const details = error?.error_data?.details ?? error?.message;
  if (code === '131042' && /currency is not configured/i.test(details ?? '')) {
    const link = String(details).match(/https:\/\/business\.facebook\.com\/billing_hub\/[^\s]+/)?.[0];
    return { code, message: 'WhatsApp Business account currency is not configured.',
      action: 'Choose your business country and currency in Meta WhatsApp billing settings, then send a new test.',
      href: link ?? 'https://business.facebook.com/billing_hub', customerFixable: true, retryable: false,
      referenceId: error?.fbtrace_id ?? globalThis.crypto.randomUUID(), details };
  }
  const transient = ['1', '2', '4', '80007', '130429', '131000', '131048', '131056', 'NETWORK_ERROR'].includes(code);
  return {
    code, message: mapped?.[0] ?? (transient ? 'WhatsApp is temporarily unable to send this message.' : 'Message sending needs technical attention.'),
    action: mapped?.[1] ?? (transient ? 'Wait and try again. Delivery is not guaranteed.' : 'Contact support with the reference below.'),
    href: mapped?.[2], customerFixable: !!mapped, retryable: transient,
    referenceId: error?.fbtrace_id ?? globalThis.crypto.randomUUID(),
    details,
  };
}

export function errorIssues(error: unknown): SendIssue[] {
  if (error instanceof SendValidationError) return error.issues;
  const failure = providerIssue(undefined);
  console.error('[WhatsApp send issue]', failure.referenceId, error instanceof Error ? error.name : 'UnknownError');
  return [failure];
}

export function configurationIssue(result: { error: string; code?: string }): SendIssue {
  if (result.code === 'CREDENTIAL_DECRYPTION_FAILED') return { ...providerIssue({ code: result.code }), message: result.error };
  return { ...issue('CONFIG_NOT_SET', result.error, 'whatsapp'), action: 'Connect WhatsApp in Settings.', href: '/settings' };
}

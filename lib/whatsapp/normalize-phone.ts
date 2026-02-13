/**
 * Normalize phone numbers to a consistent format for database lookups.
 * Strips non-digit characters and handles common Indian phone number formats.
 * Returns digits-only format (e.g., "919876543210").
 */

export function normalizePhone(raw: string | number): string {
  // Convert to string and strip all non-digit characters
  let phone = String(raw).replace(/[^\d]/g, '');

  // Handle empty
  if (!phone) return '';

  // Handle Indian phone numbers
  // If starts with 0 and is 11 digits (0XXXXXXXXXX), remove leading 0 and add 91
  if (phone.startsWith('0') && phone.length === 11) {
    phone = '91' + phone.substring(1);
  }

  // If 10 digits (no country code), assume India (+91)
  if (phone.length === 10) {
    phone = '91' + phone;
  }

  // If starts with 91 and is 12 digits, it's already correct
  // If starts with other country codes, keep as is

  return phone;
}

/**
 * Format phone for display (e.g., "+91 98765 43210")
 */
export function formatPhoneDisplay(phone: string): string {
  const normalized = normalizePhone(phone);
  if (!normalized) return '';

  // Indian format
  if (normalized.startsWith('91') && normalized.length === 12) {
    const local = normalized.substring(2);
    return `+91 ${local.substring(0, 5)} ${local.substring(5)}`;
  }

  // US/Canada format
  if ((normalized.startsWith('1')) && normalized.length === 11) {
    const area = normalized.substring(1, 4);
    const prefix = normalized.substring(4, 7);
    const line = normalized.substring(7);
    return `+1 (${area}) ${prefix}-${line}`;
  }

  // Default: add + prefix
  return `+${normalized}`;
}

/**
 * Validate phone number (basic validation)
 */
export function isValidPhone(phone: string): boolean {
  const normalized = normalizePhone(phone);
  // Must be at least 10 digits and at most 15 (E.164 max)
  return normalized.length >= 10 && normalized.length <= 15;
}

import { encrypt, decrypt, isEncrypted } from '@/lib/encryption';

/**
 * Encrypt a Shopify access token for secure DB storage.
 * Returns the encrypted string in "iv:ciphertext" format.
 */
export function encryptToken(plainToken: string): string {
  if (!plainToken) return plainToken;
  if (isEncrypted(plainToken)) return plainToken; // already encrypted
  return encrypt(plainToken);
}

/**
 * Decrypt a Shopify access token from DB storage.
 * Handles migration: if the token is still plain text (not yet encrypted),
 * it returns it as-is so existing data keeps working.
 */
export function getDecryptedToken(store: { accessToken: string }): string {
  if (!store.accessToken) return '';
  let token: string;
  if (isEncrypted(store.accessToken)) {
    token = decrypt(store.accessToken);
  } else {
    // Plain text token (legacy / not yet migrated)
    token = store.accessToken;
  }
  // Strip common prefixes like "token " or "Bearer " (user may have pasted with prefix)
  return token.trim().replace(/^(token|bearer)\s+/i, '');
}

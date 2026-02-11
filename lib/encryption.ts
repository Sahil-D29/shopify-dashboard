import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
  throw new Error(
    'ENCRYPTION_KEY must be 64 characters (32 bytes in hex). ' +
    'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))" ' +
    'or run: node scripts/generate-secrets.js'
  );
}

const KEY = Buffer.from(ENCRYPTION_KEY, 'hex');

/**
 * Encrypt sensitive data (e.g., Shopify access tokens)
 * @param text - Plain text to encrypt
 * @returns Encrypted string in format "iv:encryptedData"
 */
export function encrypt(text: string): string {
  if (!text) {
    throw new Error('Cannot encrypt empty string');
  }
  
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return iv.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt encrypted data
 * @param encryptedText - Encrypted string in format "iv:encryptedData"
 * @returns Decrypted plain text
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) {
    throw new Error('Cannot decrypt empty string');
  }
  
  const parts = encryptedText.split(':');
  
  if (parts.length !== 2) {
    throw new Error('Invalid encrypted data format. Expected format: "iv:encryptedData"');
  }
  
  const [ivHex, encryptedHex] = parts;
  
  try {
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Check if a string is already encrypted
 */
export function isEncrypted(text: string): boolean {
  if (!text || typeof text !== 'string') {
    return false;
  }
  
  // Check if it matches the encrypted format: hex:hex
  const parts = text.split(':');
  if (parts.length !== 2) {
    return false;
  }
  
  // Both parts should be valid hex strings
  const hexPattern = /^[0-9a-f]+$/i;
  return hexPattern.test(parts[0]) && hexPattern.test(parts[1]);
}



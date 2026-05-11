// backend/utils/encrypt.js
import crypto from 'crypto';

const KEY = process.env.TOKEN_ENCRYPTION_KEY 
  ? Buffer.from(process.env.TOKEN_ENCRYPTION_KEY, 'base64')
  : null;

const IV_SECRET = process.env.TOKEN_ENCRYPTION_IV_SECRET || '';

if (!KEY || KEY.length !== 32) {
  console.warn('⚠️  TOKEN_ENCRYPTION_KEY should be 32 bytes base64. Tokens will not be encrypted.');
}

export function encrypt(text) {
  if (!KEY || KEY.length !== 32) {
    // Fallback: return base64 encoded (not secure, but better than plain text)
    return Buffer.from(text).toString('base64');
  }
  
  try {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
    const encrypted = Buffer.concat([
      cipher.update(text, 'utf8'),
      cipher.final()
    ]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString('base64');
  } catch (e) {
    console.error('Encryption error:', e.message);
    // Fallback to base64
    return Buffer.from(text).toString('base64');
  }
}

export function decrypt(b64) {
  if (!KEY || KEY.length !== 32) {
    // Fallback: decode base64
    try {
      return Buffer.from(b64, 'base64').toString('utf8');
    } catch (e) {
      return b64; // Return as-is if not base64
    }
  }
  
  try {
    const data = Buffer.from(b64, 'base64');
    const iv = data.slice(0, 12);
    const tag = data.slice(12, 28);
    const encrypted = data.slice(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
    decipher.setAuthTag(tag);
    const decoded = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]).toString('utf8');
    return decoded;
  } catch (e) {
    console.error('Decryption error:', e.message);
    // Try fallback base64 decode
    try {
      return Buffer.from(b64, 'base64').toString('utf8');
    } catch (e2) {
      return b64; // Return as-is
    }
  }
}



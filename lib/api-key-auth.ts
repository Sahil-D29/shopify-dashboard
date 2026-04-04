import { createHash, randomBytes } from 'crypto';
import prisma from '@/lib/prisma';

const KEY_PREFIX = 'sk_live_';

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

export async function generateApiKey(
  storeId: string,
  name: string
): Promise<{ key: string; record: { id: string; name: string; keyPrefix: string; createdAt: Date } }> {
  const rawKey = KEY_PREFIX + randomBytes(32).toString('hex');
  const keyHash = hashApiKey(rawKey);
  const keyPrefix = rawKey.substring(0, 12) + '...';

  const record = await prisma.apiKey.create({
    data: {
      storeId,
      name,
      keyPrefix,
      keyHash,
    },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      createdAt: true,
    },
  });

  return { key: rawKey, record };
}

export async function validateApiKey(
  bearerToken: string
): Promise<{ storeId: string; keyId: string } | null> {
  if (!bearerToken || !bearerToken.startsWith(KEY_PREFIX)) {
    return null;
  }

  const keyHash = hashApiKey(bearerToken);

  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
    select: { id: true, storeId: true, isActive: true, expiresAt: true },
  });

  if (!apiKey || !apiKey.isActive) {
    return null;
  }

  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    return null;
  }

  // Update lastUsedAt (non-blocking)
  prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  }).catch(() => {});

  return { storeId: apiKey.storeId, keyId: apiKey.id };
}

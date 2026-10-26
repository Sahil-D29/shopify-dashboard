/** Facebook Embedded Signup support for WhatsApp Cloud API. */
import { prisma } from '@/lib/prisma';
import { META_GRAPH_API_VERSION } from '@/lib/config/whatsapp-config-resolver';
import { graphUrl } from '@/lib/whatsapp/graph';
import { extractWabaIdsFromTokenDebug } from '@/lib/whatsapp/embedded-signup-data';

export { extractWabaIdsFromTokenDebug } from '@/lib/whatsapp/embedded-signup-data';

const META_APP_ID = process.env.META_APP_ID;
const META_APP_SECRET = process.env.META_APP_SECRET;

/** Build the legacy redirect-based Facebook Login URL. */
export function getEmbeddedSignupUrl(storeId: string, redirectUri: string): string {
  const scopes = [
    'whatsapp_business_management',
    'whatsapp_business_messaging',
    'business_management',
  ].join(',');

  const params = new URLSearchParams({
    client_id: META_APP_ID || '',
    redirect_uri: redirectUri,
    scope: scopes,
    response_type: 'code',
    state: storeId,
  });

  return `https://www.facebook.com/${META_GRAPH_API_VERSION}/dialog/oauth?${params.toString()}`;
}

/** Exchange an Embedded Signup authorization code for a business token. */
export async function exchangeCodeForToken(code: string, redirectUri?: string): Promise<{
  accessToken: string;
  expiresIn?: number;
}> {
  const params = new URLSearchParams({
    client_id: META_APP_ID || '',
    client_secret: META_APP_SECRET || '',
    code,
  });
  if (redirectUri) params.set('redirect_uri', redirectUri);

  const response = await fetch(
    `https://graph.facebook.com/${META_GRAPH_API_VERSION}/oauth/access_token?${params.toString()}`,
  );
  const data = await response.json();
  if (!response.ok || data.error) {
    throw new Error(data.error?.message || 'Failed to exchange code');
  }
  if (!data.access_token) throw new Error('Meta returned no access token');

  return { accessToken: data.access_token, expiresIn: data.expires_in };
}

/**
 * Fetch WABAs and phone numbers granted by the token.
 *
 * Embedded Signup tokens expose shared WABAs in debug_token.granular_scopes,
 * while older OAuth tokens expose owned WABAs through /me/businesses. We merge
 * both paths because /me/businesses is often empty for Embedded Signup tokens.
 */
export async function fetchWABAInfo(accessToken: string): Promise<{
  businesses: Array<{
    id: string;
    name: string;
    wabaId?: string;
    phoneNumbers: Array<{ id: string; displayPhoneNumber: string; verifiedName: string }>;
  }>;
}> {
  type Phone = { id: string; displayPhoneNumber: string; verifiedName: string };
  type Business = { id: string; name: string; wabaId?: string; phoneNumbers: Phone[] };
  const discovered = new Map<string, Business>();

  const graphGet = async (
    path: string,
    token: string,
    search?: Record<string, string>,
  ): Promise<any> => {
    const response = await fetch(graphUrl(`${META_GRAPH_API_VERSION}/${path}`, token, search), {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    if (!response.ok || data?.error) {
      throw new Error(data?.error?.message || `Meta Graph request failed (${response.status})`);
    }
    return data;
  };

  const addWaba = async (wabaId: string, fallbackName?: string, businessId?: string) => {
    if (!wabaId || discovered.has(wabaId)) return;
    const [details, phones] = await Promise.all([
      graphGet(wabaId, accessToken, { fields: 'id,name' }).catch(() => ({})),
      graphGet(`${wabaId}/phone_numbers`, accessToken, {
        fields: 'id,display_phone_number,verified_name',
      }),
    ]);
    discovered.set(wabaId, {
      id: businessId || wabaId,
      name: details?.name || fallbackName || 'WhatsApp Business Account',
      wabaId,
      phoneNumbers: (phones?.data || []).map((phone: any) => ({
        id: String(phone.id),
        displayPhoneNumber: phone.display_phone_number || '',
        verifiedName: phone.verified_name || phone.display_phone_number || '',
      })),
    });
  };

  if (META_APP_ID && META_APP_SECRET) {
    try {
      const appToken = `${META_APP_ID}|${META_APP_SECRET}`;
      const debug = await graphGet('debug_token', appToken, { input_token: accessToken });
      for (const wabaId of extractWabaIdsFromTokenDebug(debug)) {
        await addWaba(wabaId).catch(() => undefined);
      }
    } catch {
      // Continue to the business-management compatibility path.
    }
  }

  try {
    const businessData = await graphGet('me/businesses', accessToken, { fields: 'id,name' });
    for (const business of businessData?.data || []) {
      const wabaData = await graphGet(
        `${business.id}/owned_whatsapp_business_accounts`,
        accessToken,
        { fields: 'id,name' },
      );
      for (const waba of wabaData?.data || []) {
        await addWaba(String(waba.id), waba.name || business.name, String(business.id)).catch(
          () => undefined,
        );
      }
    }
  } catch {
    // Embedded Signup tokens do not always include business_management.
  }

  return { businesses: Array.from(discovered.values()) };
}

/** Persist the selected WhatsApp account for a DorZa store. */
export async function saveWhatsAppConfig(
  storeId: string,
  wabaId: string,
  phoneNumberId: string,
  accessToken: string,
  businessName?: string,
): Promise<void> {
  let encryptedToken = accessToken;
  try {
    const { encrypt } = await import('@/lib/encryption');
    encryptedToken = encrypt(accessToken);
  } catch {
    console.warn('[embedded-signup] Encryption unavailable, storing token as-is');
  }

  const settings = {
    businessName,
    connectedVia: 'embedded_signup',
    connectedAt: new Date().toISOString(),
  };
  await prisma.whatsAppConfig.upsert({
    where: { storeId },
    create: {
      storeId,
      businessAccountId: wabaId,
      phoneNumberId,
      accessToken: encryptedToken,
      isConfigured: true,
      settings,
    },
    update: {
      businessAccountId: wabaId,
      phoneNumberId,
      accessToken: encryptedToken,
      isConfigured: true,
      settings,
    },
  });
}

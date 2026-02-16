/**
 * Facebook Embedded Signup for WhatsApp Cloud API
 * Allows clients to connect their own WhatsApp Business Account
 */
import { prisma } from '@/lib/prisma';

const META_APP_ID = process.env.META_APP_ID;
const META_APP_SECRET = process.env.META_APP_SECRET;
const META_GRAPH_VERSION = 'v18.0';

/** Build Facebook Login URL for embedded signup */
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
    state: storeId, // Pass storeId through state param
  });

  return `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
}

/** Exchange OAuth code for access token */
export async function exchangeCodeForToken(code: string, redirectUri: string): Promise<{
  accessToken: string;
  expiresIn?: number;
}> {
  const response = await fetch(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token?` +
    new URLSearchParams({
      client_id: META_APP_ID || '',
      client_secret: META_APP_SECRET || '',
      code,
      redirect_uri: redirectUri,
    }).toString()
  );

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.message || 'Failed to exchange code');
  }

  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
  };
}

/** Fetch WhatsApp Business Accounts for the user */
export async function fetchWABAInfo(accessToken: string): Promise<{
  businesses: Array<{
    id: string;
    name: string;
    wabaId?: string;
    phoneNumbers: Array<{ id: string; displayPhoneNumber: string; verifiedName: string }>;
  }>;
}> {
  // First get shared WABAs (from embedded signup flow)
  const sharedWabaRes = await fetch(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/debug_token?input_token=${accessToken}&access_token=${META_APP_ID}|${META_APP_SECRET}`
  );
  const debugData = await sharedWabaRes.json();

  // Get the user's WABA through the business management API
  const businessRes = await fetch(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/me/businesses?access_token=${accessToken}`
  );
  const businessData = await businessRes.json();

  const businesses = [];

  if (businessData.data) {
    for (const biz of businessData.data) {
      // Get WABAs for each business
      const wabaRes = await fetch(
        `https://graph.facebook.com/${META_GRAPH_VERSION}/${biz.id}/owned_whatsapp_business_accounts?access_token=${accessToken}`
      );
      const wabaData = await wabaRes.json();

      for (const waba of wabaData.data || []) {
        // Get phone numbers for each WABA
        const phoneRes = await fetch(
          `https://graph.facebook.com/${META_GRAPH_VERSION}/${waba.id}/phone_numbers?access_token=${accessToken}`
        );
        const phoneData = await phoneRes.json();

        businesses.push({
          id: biz.id,
          name: biz.name,
          wabaId: waba.id,
          phoneNumbers: (phoneData.data || []).map((p: any) => ({
            id: p.id,
            displayPhoneNumber: p.display_phone_number,
            verifiedName: p.verified_name || p.display_phone_number,
          })),
        });
      }
    }
  }

  return { businesses };
}

/** Save WhatsApp config after embedded signup */
export async function saveWhatsAppConfig(
  storeId: string,
  wabaId: string,
  phoneNumberId: string,
  accessToken: string,
  businessName?: string
): Promise<void> {
  await prisma.whatsAppConfig.upsert({
    where: { storeId },
    create: {
      storeId,
      businessAccountId: wabaId,
      phoneNumberId,
      accessToken, // Should be encrypted in production
      isConfigured: true,
      settings: { businessName, connectedVia: 'embedded_signup', connectedAt: new Date().toISOString() },
    },
    update: {
      businessAccountId: wabaId,
      phoneNumberId,
      accessToken,
      isConfigured: true,
      settings: { businessName, connectedVia: 'embedded_signup', connectedAt: new Date().toISOString() },
    },
  });
}

export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getWhatsAppConfig } from '@/lib/config/whatsapp-env';
import { resolveWhatsAppConfig } from '@/lib/config/whatsapp-config-resolver';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';

export async function GET(request: NextRequest) {
  const storeId = await getCurrentStoreId(request);
  const resolved = await resolveWhatsAppConfig(storeId);
  const envConfig = getWhatsAppConfig();

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV,
    resolved: resolved.valid
      ? { isValid: true, source: resolved.config.source }
      : { isValid: false, error: resolved.error },
    envVariables: {
      WHATSAPP_PHONE_NUMBER_ID: envConfig.phoneNumberId ? 'Set' : 'Missing',
      WHATSAPP_BUSINESS_ACCOUNT_ID: envConfig.wabaId ? 'Set' : 'Missing',
      WHATSAPP_ACCESS_TOKEN: envConfig.accessToken ? 'Set' : 'Missing',
      META_APP_ID: envConfig.appId ? 'Set' : 'Missing',
      META_APP_SECRET: envConfig.appSecret ? 'Set' : 'Missing',
    },
    dbConfigStoreId: storeId || null,
    hints: !resolved.valid
      ? [
          'Option A: Connect via Settings > WhatsApp (Embedded Signup)',
          'Option B: Set env vars in .env.local and restart dev server',
        ]
      : [],
  });
}



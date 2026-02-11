export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getWhatsAppConfig, validateWhatsAppConfig } from '@/lib/config/whatsapp-env';

interface DebugResponse {
  timestamp: string;
  nodeEnv: string | undefined;
  validation: {
    isValid: boolean;
    error?: string;
    missing?: string[];
  };
  variables: Record<string, string>;
  hints: string[];
}

export async function GET() {
  const validation = validateWhatsAppConfig();
  const config = getWhatsAppConfig();

  const response: DebugResponse = {
    timestamp: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV,
    validation: validation.valid
      ? { isValid: true }
      : { isValid: false, error: validation.error, missing: validation.missing },
    variables: {
      WHATSAPP_PHONE_NUMBER_ID: config.phoneNumberId ? '✅ Set' : '❌ Missing',
      WHATSAPP_BUSINESS_ACCOUNT_ID: config.wabaId ? '✅ Set' : '❌ Missing',
      WHATSAPP_ACCESS_TOKEN: config.accessToken ? `✅ Set (${config.accessToken.substring(0, 20)}...)` : '❌ Missing',
      META_APP_ID: config.appId ? '✅ Set' : '❌ Missing',
      META_APP_SECRET: config.appSecret ? '✅ Set' : '❌ Missing',
    },
    hints: [],
  };

  if (!validation.valid) {
    response.hints.push(
      '1. Ensure .env.local exists at project root (same level as package.json)',
      '2. Variable names must match exactly (case-sensitive)',
      '3. No spaces around = in .env.local',
      '4. No quotes around values in .env.local',
      '5. Restart dev server after changes',
    );
  }

  return NextResponse.json(response);
}



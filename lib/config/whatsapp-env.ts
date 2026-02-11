// Server-side only - loads and validates WhatsApp environment variables

export function getWhatsAppConfig() {
  const config = {
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    wabaId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
    appId: process.env.META_APP_ID,
    appSecret: process.env.META_APP_SECRET,
  } as const;

  // Debug logging (safe)
  console.log('🔍 Loading WhatsApp Config:');
  console.log('- Phone Number ID:', config.phoneNumberId ? '✅ Set' : '❌ Missing');
  console.log('- WABA ID:', config.wabaId ? '✅ Set' : '❌ Missing');
  console.log('- Access Token:', config.accessToken ? `✅ Set (${String(config.accessToken).substring(0, 20)}...)` : '❌ Missing');
  console.log('- App ID:', config.appId ? '✅ Set' : '❌ Missing');
  console.log('- App Secret:', config.appSecret ? '✅ Set' : '❌ Missing');

  return config;
}

export function validateWhatsAppConfig(): { valid: true; config: ReturnType<typeof getWhatsAppConfig> } | { valid: false; error: string; missing: string[] } {
  const config = getWhatsAppConfig();

  const missing: string[] = [];

  if (!config.phoneNumberId) missing.push('WHATSAPP_PHONE_NUMBER_ID');
  if (!config.wabaId) missing.push('WHATSAPP_BUSINESS_ACCOUNT_ID');
  if (!config.accessToken) missing.push('WHATSAPP_ACCESS_TOKEN');
  if (!config.appId) missing.push('META_APP_ID');
  if (!config.appSecret) missing.push('META_APP_SECRET');

  if (missing.length > 0) {
    const error = `Missing environment variables: ${missing.join(', ')}. Please check your .env.local file.`;
    console.error('❌', error);
    return { valid: false, error, missing };
  }

  console.log('✅ All WhatsApp environment variables are configured');
  return { valid: true, config };
}



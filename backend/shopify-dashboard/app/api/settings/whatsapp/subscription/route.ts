import { NextRequest, NextResponse } from 'next/server';
import { readJsonFile, writeJsonFile } from '@/lib/utils/json-storage';

interface SubscriptionSettings {
  defaultSubscription: 'explicit_optin' | 'auto_optin';
  optOutKeywords: string[];
  optOutMessage: string;
  optInKeywords: string[];
  optInMessage: string;
}

const SETTINGS_FILE = 'whatsapp-subscription-settings.json';

export async function GET() {
  try {
    const settings = readJsonFile<SubscriptionSettings>(SETTINGS_FILE);
    return NextResponse.json({ settings });
  } catch {
    // Return defaults if file doesn't exist
    return NextResponse.json({
      settings: {
        defaultSubscription: 'explicit_optin',
        optOutKeywords: ['STOP', 'UNSUBSCRIBE', 'OPTOUT', 'QUIT'],
        optOutMessage: 'You have been unsubscribed from our WhatsApp messages. Reply START to resubscribe.',
        optInKeywords: ['START', 'SUBSCRIBE', 'YES'],
        optInMessage: 'Welcome! You\'re now subscribed to WhatsApp updates. Reply STOP to unsubscribe.',
      },
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const settings = (await request.json()) as SubscriptionSettings;
    writeJsonFile(SETTINGS_FILE, settings);
    return NextResponse.json({ success: true, settings });
  } catch (error) {
    console.error('[subscription-settings]', error);
    return NextResponse.json(
      { error: 'Failed to save subscription settings' },
      { status: 500 }
    );
  }
}


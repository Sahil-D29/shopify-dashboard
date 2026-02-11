import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

interface SubscriptionSettings {
  defaultSubscription: 'explicit_optin' | 'auto_optin';
  optOutKeywords: string[];
  optOutMessage: string;
  optInKeywords: string[];
  optInMessage: string;
}

const SETTINGS_FILE = 'whatsapp-subscription-settings.json';

function getDataDir(): string {
  const projectRoot = process.cwd();
  const dataDir = path.join(projectRoot, 'data');
  if (process.env.VERCEL !== '1') {
    try {
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
    } catch (error) {
      console.error('Error creating data directory:', error);
    }
  }
  return dataDir;
}

function readSettingsFile(): SubscriptionSettings | null {
  try {
    if (process.env.VERCEL === '1') {
      return null;
    }
    const dataDir = getDataDir();
    const filePath = path.join(dataDir, SETTINGS_FILE);
    
    if (!fs.existsSync(filePath)) {
      return null;
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    if (!content.trim()) {
      return null;
    }
    
    return JSON.parse(content) as SubscriptionSettings;
  } catch {
    return null;
  }
}

function writeSettingsFile(settings: SubscriptionSettings): void {
  if (process.env.VERCEL === '1') {
    return;
  }
  
  try {
    const dataDir = getDataDir();
    const filePath = path.join(dataDir, SETTINGS_FILE);
    const tempPath = path.join(dataDir, `${SETTINGS_FILE}.tmp`);
    
    const jsonContent = JSON.stringify(settings, null, 2);
    fs.writeFileSync(tempPath, jsonContent, 'utf-8');
    fs.renameSync(tempPath, filePath);
  } catch (error) {
    console.error(`Error writing ${SETTINGS_FILE}:`, error);
    throw error;
  }
}

export async function GET() {
  try {
    const settings = readSettingsFile();
    if (settings) {
      return NextResponse.json({ settings });
    }
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
  } catch (error) {
    console.error('[subscription-settings][GET]', error);
    return NextResponse.json(
      { error: 'Failed to load subscription settings' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const settings = (await request.json()) as SubscriptionSettings;
    writeSettingsFile(settings);
    return NextResponse.json({ success: true, settings });
  } catch (error) {
    console.error('[subscription-settings][POST]', error);
    return NextResponse.json(
      { error: 'Failed to save subscription settings' },
      { status: 500 }
    );
  }
}


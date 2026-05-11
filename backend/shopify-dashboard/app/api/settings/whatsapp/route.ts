import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const CONFIG_FILE = path.join(process.cwd(), 'data', 'whatsapp-config.json');

export interface WhatsAppServerConfig {
  wabaId: string;
  phoneNumberId: string;
  accessToken: string;
  appId: string;
  appSecret: string;
  webhookVerifyToken?: string;
  contactEmail?: string;
  connectedPhoneNumber?: string;
  isVerified: boolean;
  configuredAt: number;
}

async function ensureDataDir() {
  const dataDir = path.join(process.cwd(), 'data');
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
}

async function readConfig(): Promise<WhatsAppServerConfig | null> {
  try {
    await ensureDataDir();
    const data = await fs.readFile(CONFIG_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.log('[WhatsApp Config] No config file found or error reading:', error);
    return null;
  }
}

async function writeConfig(config: WhatsAppServerConfig): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
  console.log('[WhatsApp Config] Saved successfully');
}

// GET - Retrieve WhatsApp configuration
export async function GET() {
  try {
    const config = await readConfig();
    
    if (!config) {
      return NextResponse.json({
        success: false,
        message: 'WhatsApp not configured',
        config: null,
      });
    }

    // Return config without sensitive data for display
    const safeConfig = {
      ...config,
      accessToken: config.accessToken ? '••••••••' + config.accessToken.slice(-8) : '',
      appSecret: config.appSecret ? '••••••••' : '',
    };

    return NextResponse.json({
      success: true,
      config: safeConfig,
      isConfigured: !!(config.wabaId && config.phoneNumberId && config.accessToken),
    });
  } catch (error) {
    console.error('[WhatsApp Config] GET error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to read configuration' },
      { status: 500 }
    );
  }
}

// POST - Save WhatsApp configuration
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const config: WhatsAppServerConfig = {
      wabaId: body.wabaId || '',
      phoneNumberId: body.phoneNumberId || '',
      accessToken: body.accessToken || '',
      appId: body.appId || '',
      appSecret: body.appSecret || '',
      webhookVerifyToken: body.webhookVerifyToken || '',
      contactEmail: body.contactEmail || '',
      connectedPhoneNumber: body.connectedPhoneNumber || '',
      isVerified: body.isVerified || false,
      configuredAt: Date.now(),
    };

    // Validate required fields
    if (!config.wabaId || !config.phoneNumberId || !config.accessToken) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields: wabaId, phoneNumberId, accessToken' },
        { status: 400 }
      );
    }

    await writeConfig(config);

    return NextResponse.json({
      success: true,
      message: 'WhatsApp configuration saved successfully',
    });
  } catch (error) {
    console.error('[WhatsApp Config] POST error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to save configuration' },
      { status: 500 }
    );
  }
}

// DELETE - Clear WhatsApp configuration
export async function DELETE() {
  try {
    await ensureDataDir();
    
    try {
      await fs.unlink(CONFIG_FILE);
    } catch {
      // File might not exist
    }

    return NextResponse.json({
      success: true,
      message: 'WhatsApp configuration cleared',
    });
  } catch (error) {
    console.error('[WhatsApp Config] DELETE error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to clear configuration' },
      { status: 500 }
    );
  }
}


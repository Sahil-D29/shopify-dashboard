import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const CONFIG_FILE = path.join(process.cwd(), 'data', 'whatsapp-config.json');

// GET - Retrieve FULL WhatsApp configuration (for internal API use)
// This returns the actual tokens for use by other API endpoints
export async function GET() {
  try {
    const data = await fs.readFile(CONFIG_FILE, 'utf-8');
    const config = JSON.parse(data);
    
    return NextResponse.json({
      success: true,
      config,
      isConfigured: !!(config.wabaId && config.phoneNumberId && config.accessToken),
    });
  } catch (error) {
    console.log('[WhatsApp Config Full] No config found:', error);
    return NextResponse.json({
      success: false,
      message: 'WhatsApp not configured',
      config: null,
      isConfigured: false,
    });
  }
}


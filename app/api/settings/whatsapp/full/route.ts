import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Retrieve FULL WhatsApp configuration (for internal API use)
// This returns the actual tokens for use by other API endpoints
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId');

    if (!storeId) {
      return NextResponse.json(
        { success: false, message: 'Store ID is required' },
        { status: 400 }
      );
    }

    const config = await prisma.whatsAppConfig.findUnique({
      where: { storeId }
    });
    
    if (!config) {
      return NextResponse.json({
        success: false,
        message: 'WhatsApp not configured',
        config: null,
        isConfigured: false,
      });
    }

    return NextResponse.json({
      success: true,
      config: {
        wabaId: config.businessAccountId,
        phoneNumberId: config.phoneNumberId,
        accessToken: config.accessToken,
        webhookVerifyToken: config.webhookVerifyToken,
        isVerified: config.isConfigured,
        templates: config.templates,
        settings: config.settings
      },
      isConfigured: config.isConfigured,
    });
  } catch (error) {
    console.log('[WhatsApp Config Full] Error:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to retrieve configuration',
      config: null,
      isConfigured: false,
    }, { status: 500 });
  }
}


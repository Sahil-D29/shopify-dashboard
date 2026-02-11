export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

export interface ProviderCapabilities {
  providerId: string;
  providerName: string;
  maxButtons: number;
  maxQuickReplies: number;
  maxUrlButtons: number;
  maxPhoneButtons: number;
  supportedMediaTypes: ('IMAGE' | 'VIDEO' | 'DOCUMENT')[];
  maxMediaSizeMB: number;
  supportsDynamicMedia: boolean;
  maxVariablesPerTemplate: number;
  rateLimitPerDay: number;
  rateLimitPerWeek: number;
  features: {
    sandboxTesting: boolean;
    templateApproval: boolean;
    optOutHandling: boolean;
    timezoneSupport: boolean;
  };
}

// Default WhatsApp Business API capabilities
const DEFAULT_CAPABILITIES: ProviderCapabilities = {
  providerId: 'whatsapp',
  providerName: 'WhatsApp Business API',
  maxButtons: 3,
  maxQuickReplies: 3,
  maxUrlButtons: 2,
  maxPhoneButtons: 1,
  supportedMediaTypes: ['IMAGE', 'VIDEO', 'DOCUMENT'],
  maxMediaSizeMB: 16,
  supportsDynamicMedia: true,
  maxVariablesPerTemplate: 20,
  rateLimitPerDay: 1000,
  rateLimitPerWeek: 10000,
  features: {
    sandboxTesting: true,
    templateApproval: true,
    optOutHandling: true,
    timezoneSupport: true,
  },
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const providerId = searchParams.get('providerId') || 'whatsapp';

    // In a real implementation, this would fetch from a provider registry
    // For now, return default WhatsApp capabilities
    const capabilities: ProviderCapabilities = {
      ...DEFAULT_CAPABILITIES,
      providerId,
    };

    return NextResponse.json({ capabilities });
  } catch (error) {
    console.error('[providers/capabilities]', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch provider capabilities.',
      },
      { status: 500 },
    );
  }
}


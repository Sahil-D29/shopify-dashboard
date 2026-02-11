import { NextRequest, NextResponse } from 'next/server';

import type { WhatsAppActionConfig } from '@/lib/types/whatsapp-config';
import { validateWhatsAppConfig } from '@/lib/whatsapp/validate-config';

export async function POST(request: NextRequest) {
  try {
    const config = (await request.json()) as WhatsAppActionConfig;
    const validation = validateWhatsAppConfig(config);
    return NextResponse.json(validation);
  } catch (error) {
    console.error('[validate-config]', error);
    return NextResponse.json(
      {
        valid: false,
        errors: [
          {
            step: 'template',
            message: error instanceof Error ? error.message : 'Validation failed.',
          },
        ],
      },
      { status: 500 },
    );
  }
}

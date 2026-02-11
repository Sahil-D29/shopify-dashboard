import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get store from query params
    const { searchParams } = new URL(req.url);
    const store = searchParams.get('store') || 'default';

    console.log('[Features API] Request for store:', store);

    // Return enabled features
    const features = {
      teamManagement: true,
      shopIntegration: true,
      whatsappIntegration: true,
      notifications: true,
      payments: true,
      webhooks: true,
    };

    return NextResponse.json({
      success: true,
      features,
      store
    });

  } catch (error) {
    console.error('[Features API] Error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}


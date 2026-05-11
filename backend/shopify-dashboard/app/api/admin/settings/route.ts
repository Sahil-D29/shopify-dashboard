import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin-auth';
import { readSystemSettings, writeSystemSettings } from '@/lib/system-settings';

// GET /api/admin/settings - Get system settings
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const settings = await readSystemSettings();

    return NextResponse.json({
      success: true,
      settings,
    });
  } catch (error: any) {
    if (error.message === 'Admin authentication required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.error('Get settings error:', error);
    return NextResponse.json({ error: 'An error occurred' }, { status: 500 });
  }
}

// PATCH /api/admin/settings - Update system settings
export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin(request);

    const body = await request.json();
    const updates = body.settings || body;

    const updatedSettings = await writeSystemSettings(updates);

    // Log action
    const adminSession = await requireAdmin(request);
    await import('@/lib/auth/admin-auth').then(({ logAdminAction }) =>
      logAdminAction(
        adminSession.userId,
        'settings_updated',
        { updates },
        request.headers.get('x-forwarded-for') || null,
        'success'
      )
    );

    return NextResponse.json({
      success: true,
      settings: updatedSettings,
    });
  } catch (error: any) {
    if (error.message === 'Admin authentication required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.error('Update settings error:', error);
    return NextResponse.json({ error: 'An error occurred' }, { status: 500 });
  }
}


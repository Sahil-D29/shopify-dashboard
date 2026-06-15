export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin-auth';
import { getAppSettings, saveAppSettings, type AppSettingsValue } from '@/lib/app-config';

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const settings = await getAppSettings();
    return NextResponse.json({ success: true, settings });
  } catch (error: any) {
    if (error?.message === 'Admin authentication required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[admin/app-settings][GET]', error);
    return NextResponse.json(
      { error: 'Failed to load app settings', details: getErrorMessage(error) },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireAdmin(request);
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    // Pull only the fields we manage; ignore unknown keys
    const allowedKeys = [
      'appName',
      'tagline',
      'logoUrl',
      'faviconUrl',
      'supportEmail',
      'supportPhone',
      'supportUrl',
      'helpDocsUrl',
      'primaryColor',
      'accentColor',
    ];
    const patch: Partial<AppSettingsValue> = {};
    for (const key of allowedKeys) {
      if (typeof body?.[key] === 'string') {
        (patch as Record<string, string>)[key] = body[key].trim();
      }
    }
    if (typeof body?.couponsEnabled === 'boolean') patch.couponsEnabled = body.couponsEnabled;
    if (patch.appName === '') patch.appName = 'dorza.io';

    const settings = await saveAppSettings(patch, session.userId);
    return NextResponse.json({ success: true, settings });
  } catch (error: any) {
    if (error?.message === 'Admin authentication required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[admin/app-settings][PATCH]', error);
    return NextResponse.json(
      { error: 'Failed to save app settings', details: getErrorMessage(error) },
      { status: 500 },
    );
  }
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getAppSettings } from '@/lib/app-config';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { getStoreFeatureFlags } from '@/lib/app-config';

/**
 * Public app config + per-store feature flags for the current session.
 *
 * Returned to the Sidebar / layout components on every page so:
 *  - The product name and support links are dynamic (super admin
 *    controls them in /admin/settings).
 *  - The sidebar hides items disabled for the current store
 *    (super admin controls them in /admin/stores/[id]/features).
 *
 * Auth note: this is intentionally not session-gated. AppSettings are
 * branding constants (not secrets), and feature flags only narrow what
 * a user sees — they cannot widen access.
 */
export async function GET(request: NextRequest) {
  try {
    const [settings, storeId] = await Promise.all([
      getAppSettings(),
      getCurrentStoreId(request).catch(() => null),
    ]);
    const flags = storeId
      ? await getStoreFeatureFlags(storeId).catch(() => ({
          storeId,
          disabledItems: [],
          notes: '',
        }))
      : { storeId: null, disabledItems: [] as string[], notes: '' };

    return NextResponse.json({
      success: true,
      settings,
      featureFlags: flags,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load app config',
        // Always return defaults so the UI can render something
        settings: (await getAppSettings().catch(() => null)) ?? {
          appName: 'dorza.io',
          tagline: '',
          logoUrl: '',
          faviconUrl: '',
          supportEmail: '',
          supportPhone: '',
          supportUrl: '',
          helpDocsUrl: '',
          primaryColor: '#1a1a2e',
          accentColor: '#e94560',
        },
        featureFlags: { storeId: null, disabledItems: [], notes: '' },
      },
      { status: 200 },
    );
  }
}

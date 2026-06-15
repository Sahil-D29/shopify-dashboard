/**
 * Centralised app branding + per-store sidebar feature flags.
 *
 * Two records persisted in Postgres:
 *   - AppSettings (id="singleton")  → global product name, support info
 *   - StoreFeatureFlags             → per-store disabled sidebar items
 *
 * The defaults below are returned when the row doesn't exist yet (first
 * deploy, before the admin has saved anything). All callers should
 * tolerate the defaults and not block rendering on the DB call failing.
 */

import { prisma } from '@/lib/prisma';

export interface AppSettingsValue {
  appName: string;
  tagline: string;
  logoUrl: string;
  faviconUrl: string;
  supportEmail: string;
  supportPhone: string;
  supportUrl: string;
  helpDocsUrl: string;
  primaryColor: string;
  accentColor: string;
  couponsEnabled: boolean;
}

export const DEFAULT_APP_SETTINGS: AppSettingsValue = {
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
  couponsEnabled: true,
};

export async function getAppSettings(): Promise<AppSettingsValue> {
  try {
    const row = await prisma.appSettings.findUnique({ where: { id: 'singleton' } });
    if (!row) return DEFAULT_APP_SETTINGS;
    return {
      appName: row.appName || DEFAULT_APP_SETTINGS.appName,
      tagline: row.tagline ?? '',
      logoUrl: row.logoUrl ?? '',
      faviconUrl: row.faviconUrl ?? '',
      supportEmail: row.supportEmail ?? '',
      supportPhone: row.supportPhone ?? '',
      supportUrl: row.supportUrl ?? '',
      helpDocsUrl: row.helpDocsUrl ?? '',
      primaryColor: row.primaryColor || DEFAULT_APP_SETTINGS.primaryColor,
      accentColor: row.accentColor || DEFAULT_APP_SETTINGS.accentColor,
      couponsEnabled: row.couponsEnabled ?? DEFAULT_APP_SETTINGS.couponsEnabled,
    };
  } catch (error) {
    console.warn('[app-config] Failed to load AppSettings, using defaults:', error);
    return DEFAULT_APP_SETTINGS;
  }
}

export async function saveAppSettings(
  patch: Partial<AppSettingsValue>,
  updatedBy?: string | null,
): Promise<AppSettingsValue> {
  const data: any = {};
  for (const key of Object.keys(patch) as Array<keyof AppSettingsValue>) {
    const value = patch[key];
    if (typeof value === 'string' || typeof value === 'boolean') data[key] = value;
  }
  if (updatedBy) data.updatedBy = updatedBy;

  await prisma.appSettings.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', ...data },
    update: data,
  });
  return getAppSettings();
}

// ─── Sidebar feature flags ─────────────────────────────────────────────

export const SIDEBAR_ITEMS = {
  dashboard: 'Dashboard',
  chat: 'Live Chat',
  customers: 'Customers',
  segments: 'Segments',
  contacts: 'Contacts',
  templates: 'Templates',
  campaigns: 'Campaigns',
  email_marketing: 'Email Marketing (parent)',
  email_campaigns: '— Email · Campaigns',
  email_templates: '— Email · Templates',
  email_analytics: '— Email · Analytics',
  email_subscribers: '— Email · Subscribers',
  email_domains: '— Email · Domains',
  email_ab_tests: '— Email · A/B Tests',
  email_back_in_stock: '— Email · Back-in-Stock',
  email_cross_sell: '— Email · Cross-Sell',
  journeys: 'Journeys',
  flows: 'Flows',
  analytics: 'Analytics',
  orders: 'Orders',
  products: 'Products',
  abandoned_carts: 'Abandoned Carts',
  settings: 'Settings',
  billing: 'Billing',
} as const;

export type SidebarItemKey = keyof typeof SIDEBAR_ITEMS;
export const ALL_SIDEBAR_KEYS = Object.keys(SIDEBAR_ITEMS) as SidebarItemKey[];

export interface StoreFeatureFlagsValue {
  storeId: string;
  disabledItems: SidebarItemKey[];
  notes: string;
}

export async function getStoreFeatureFlags(storeId: string): Promise<StoreFeatureFlagsValue> {
  try {
    const row = await prisma.storeFeatureFlags.findUnique({ where: { storeId } });
    if (!row) return { storeId, disabledItems: [], notes: '' };
    return {
      storeId,
      disabledItems: (row.disabledItems ?? []).filter((k): k is SidebarItemKey =>
        (ALL_SIDEBAR_KEYS as readonly string[]).includes(k),
      ),
      notes: row.notes ?? '',
    };
  } catch (error) {
    console.warn('[app-config] Failed to load StoreFeatureFlags, defaulting to none:', error);
    return { storeId, disabledItems: [], notes: '' };
  }
}

export async function saveStoreFeatureFlags(
  storeId: string,
  patch: { disabledItems?: string[]; notes?: string | null },
  updatedBy?: string | null,
): Promise<StoreFeatureFlagsValue> {
  const disabledItems = Array.isArray(patch.disabledItems)
    ? patch.disabledItems.filter((k): k is SidebarItemKey =>
        (ALL_SIDEBAR_KEYS as readonly string[]).includes(k),
      )
    : undefined;
  const data: any = {};
  if (disabledItems !== undefined) data.disabledItems = disabledItems;
  if (patch.notes !== undefined) data.notes = patch.notes ?? null;
  if (updatedBy) data.updatedBy = updatedBy;

  await prisma.storeFeatureFlags.upsert({
    where: { storeId },
    create: { storeId, disabledItems: disabledItems ?? [], notes: patch.notes ?? null, updatedBy },
    update: data,
  });
  return getStoreFeatureFlags(storeId);
}

// ─── Plan-based gating ─────────────────────────────────────────────────

// Items never hidden by plan gating, so a restricted plan can't lock a user
// out of upgrading or managing their store.
const PLAN_GATING_ALWAYS_ON: SidebarItemKey[] = ['dashboard', 'settings', 'billing'];

/**
 * Sidebar items disabled by the store's PLAN (vs. per-store admin overrides).
 * If the active plan's `enabledFeatures` is non-empty, every key not in that
 * list (minus the always-on items) is disabled. Empty list / no plan / inactive
 * subscription = no plan gating (backward compatible).
 */
async function getPlanDisabledItems(storeId: string): Promise<SidebarItemKey[]> {
  try {
    const sub = await prisma.subscription.findUnique({
      where: { storeId },
      select: { planId: true, status: true },
    });
    // Only gate while the plan is actually active; otherwise don't hide anything
    // (the user needs full nav to re-subscribe).
    if (!sub || sub.status !== 'ACTIVE') return [];

    const plan = await prisma.planFeature.findUnique({
      where: { planId: sub.planId },
      select: { enabledFeatures: true },
    });
    const enabled = (plan?.enabledFeatures ?? []).filter((k): k is SidebarItemKey =>
      (ALL_SIDEBAR_KEYS as readonly string[]).includes(k),
    );
    if (enabled.length === 0) return []; // empty = all allowed

    const allowed = new Set<SidebarItemKey>([...enabled, ...PLAN_GATING_ALWAYS_ON]);
    return ALL_SIDEBAR_KEYS.filter(k => !allowed.has(k));
  } catch (error) {
    console.warn('[app-config] plan gating lookup failed, no plan gating:', error);
    return [];
  }
}

/**
 * Effective disabled sidebar items for a store = plan gating ∪ per-store admin
 * overrides. This is what the runtime sidebar should consume. The admin feature
 * editor continues to use {@link getStoreFeatureFlags} (raw per-store overrides).
 */
export async function getEffectiveDisabledItems(storeId: string): Promise<SidebarItemKey[]> {
  const [storeFlags, planGated] = await Promise.all([
    getStoreFeatureFlags(storeId),
    getPlanDisabledItems(storeId),
  ]);
  return Array.from(new Set<SidebarItemKey>([...storeFlags.disabledItems, ...planGated]));
}

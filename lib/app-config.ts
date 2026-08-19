/**
 * Centralized app branding, per-store sidebar feature flags, and global
 * super-admin sidebar visibility rules.
 *
 * Defaults are intentionally permissive: missing rows show all sidebar items.
 * Runtime callers should tolerate DB failures and keep rendering.
 */

import { prisma } from '@/lib/prisma';
import {
  ALL_SIDEBAR_KEYS,
  SIDEBAR_CATALOG,
  SIDEBAR_ITEMS,
  expandDisabledSidebarItems,
  isSidebarItemKey,
  normalizeSidebarKeys,
  type SidebarItemKey,
} from '@/lib/sidebar-catalog';

export {
  ALL_SIDEBAR_KEYS,
  SIDEBAR_CATALOG,
  SIDEBAR_ITEMS,
  expandDisabledSidebarItems,
  getFirstVisibleSidebarHref,
  getSidebarKeyForPath,
  isSidebarItemKey,
  normalizeSidebarKeys,
  type SidebarCatalogItem,
  type SidebarGroup,
  type SidebarItemKey,
} from '@/lib/sidebar-catalog';

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

export interface StoreFeatureFlagsValue {
  storeId: string;
  disabledItems: SidebarItemKey[];
  notes: string;
  /** Super-admin override: full app access without a paid subscription. */
  fullAccess: boolean;
}

export async function getStoreFeatureFlags(storeId: string): Promise<StoreFeatureFlagsValue> {
  try {
    const row = await prisma.storeFeatureFlags.findUnique({ where: { storeId } });
    if (!row) return { storeId, disabledItems: [], notes: '', fullAccess: false };
    return {
      storeId,
      disabledItems: normalizeSidebarKeys(row.disabledItems),
      notes: row.notes ?? '',
      fullAccess: row.fullAccess ?? false,
    };
  } catch (error) {
    console.warn('[app-config] Failed to load StoreFeatureFlags, defaulting to none:', error);
    return { storeId, disabledItems: [], notes: '', fullAccess: false };
  }
}

export async function saveStoreFeatureFlags(
  storeId: string,
  patch: { disabledItems?: string[]; notes?: string | null; fullAccess?: boolean },
  updatedBy?: string | null,
): Promise<StoreFeatureFlagsValue> {
  const disabledItems = Array.isArray(patch.disabledItems)
    ? normalizeSidebarKeys(patch.disabledItems)
    : undefined;
  const data: any = {};
  if (disabledItems !== undefined) data.disabledItems = disabledItems;
  if (patch.notes !== undefined) data.notes = patch.notes ?? null;
  if (typeof patch.fullAccess === 'boolean') data.fullAccess = patch.fullAccess;
  if (updatedBy) data.updatedBy = updatedBy;

  await prisma.storeFeatureFlags.upsert({
    where: { storeId },
    create: {
      storeId,
      disabledItems: disabledItems ?? [],
      notes: patch.notes ?? null,
      fullAccess: patch.fullAccess ?? false,
      updatedBy,
    },
    update: data,
  });
  return getStoreFeatureFlags(storeId);
}

export type SidebarVisibilityModeValue = 'EVERYONE' | 'HIDDEN' | 'SELECTED';

export interface SidebarVisibilityRuleValue {
  itemKey: SidebarItemKey;
  mode: SidebarVisibilityModeValue;
  allowedStoreIds: string[];
  allowedUserIds: string[];
  notes: string;
  updatedBy: string | null;
  createdAt?: string;
  updatedAt?: string;
}

const SIDEBAR_VISIBILITY_MODES = new Set<SidebarVisibilityModeValue>([
  'EVERYONE',
  'HIDDEN',
  'SELECTED',
]);

export function isSidebarVisibilityMode(value: unknown): value is SidebarVisibilityModeValue {
  return typeof value === 'string' && SIDEBAR_VISIBILITY_MODES.has(value as SidebarVisibilityModeValue);
}

export async function getSidebarVisibilityRules(): Promise<SidebarVisibilityRuleValue[]> {
  try {
    const rows = await prisma.sidebarVisibilityRule.findMany({
      orderBy: { itemKey: 'asc' },
    });

    return rows
      .filter(row => isSidebarItemKey(row.itemKey))
      .map(row => ({
        itemKey: row.itemKey as SidebarItemKey,
        mode: row.mode as SidebarVisibilityModeValue,
        allowedStoreIds: row.allowedStoreIds ?? [],
        allowedUserIds: row.allowedUserIds ?? [],
        notes: row.notes ?? '',
        updatedBy: row.updatedBy ?? null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }));
  } catch (error) {
    console.warn('[app-config] Failed to load SidebarVisibilityRule, defaulting to everyone:', error);
    return [];
  }
}

export async function saveSidebarVisibilityRules(
  rules: Array<Partial<SidebarVisibilityRuleValue> & { itemKey?: string; mode?: string }>,
  updatedBy?: string | null,
): Promise<SidebarVisibilityRuleValue[]> {
  const validRules = rules
    .filter(rule => typeof rule.itemKey === 'string' && isSidebarItemKey(rule.itemKey))
    .map(rule => ({
      itemKey: rule.itemKey as SidebarItemKey,
      mode: isSidebarVisibilityMode(rule.mode) ? rule.mode : 'EVERYONE',
      allowedStoreIds: Array.isArray(rule.allowedStoreIds)
        ? rule.allowedStoreIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
        : [],
      allowedUserIds: Array.isArray(rule.allowedUserIds)
        ? rule.allowedUserIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
        : [],
      notes: typeof rule.notes === 'string' ? rule.notes : '',
    }));

  const uniqueRules = new Map<SidebarItemKey, (typeof validRules)[number]>();
  for (const rule of validRules) uniqueRules.set(rule.itemKey, rule);

  const operations = Array.from(uniqueRules.values()).map(rule =>
    prisma.sidebarVisibilityRule.upsert({
      where: { itemKey: rule.itemKey },
      create: {
        itemKey: rule.itemKey,
        mode: rule.mode,
        allowedStoreIds: rule.allowedStoreIds,
        allowedUserIds: rule.allowedUserIds,
        notes: rule.notes || null,
        updatedBy: updatedBy ?? null,
      },
      update: {
        mode: rule.mode,
        allowedStoreIds: rule.allowedStoreIds,
        allowedUserIds: rule.allowedUserIds,
        notes: rule.notes || null,
        updatedBy: updatedBy ?? null,
      },
    }),
  );

  if (operations.length > 0) {
    await prisma.$transaction(operations);
  }

  return getSidebarVisibilityRules();
}

export async function getGlobalVisibilityDisabledItems(
  storeId?: string | null,
  userId?: string | null,
): Promise<SidebarItemKey[]> {
  const rules = await getSidebarVisibilityRules();
  const disabled = new Set<SidebarItemKey>();

  for (const rule of rules) {
    if (rule.mode === 'EVERYONE') continue;
    if (rule.mode === 'HIDDEN') {
      disabled.add(rule.itemKey);
      continue;
    }

    const storeAllowed = Boolean(storeId && rule.allowedStoreIds.includes(storeId));
    const userAllowed = Boolean(userId && rule.allowedUserIds.includes(userId));
    if (!storeAllowed && !userAllowed) disabled.add(rule.itemKey);
  }

  return expandDisabledSidebarItems(disabled);
}

// Items never hidden by plan gating, so a restricted plan cannot lock a user
// out of upgrading or managing their store.
const PLAN_GATING_ALWAYS_ON: SidebarItemKey[] = ['dashboard', 'settings', 'billing'];

/**
 * Sidebar items disabled by the store's active plan feature list. Empty list,
 * no plan, or inactive subscription means no plan-based hiding.
 */
async function getPlanDisabledItems(storeId: string): Promise<SidebarItemKey[]> {
  try {
    const sub = await prisma.subscription.findUnique({
      where: { storeId },
      select: { planId: true, status: true },
    });
    if (!sub || sub.status !== 'ACTIVE') return [];

    const plan = await prisma.planFeature.findUnique({
      where: { planId: sub.planId },
      select: { enabledFeatures: true },
    });
    const enabled = normalizeSidebarKeys(plan?.enabledFeatures ?? []);
    if (enabled.length === 0) return [];

    const allowed = new Set<SidebarItemKey>([...enabled, ...PLAN_GATING_ALWAYS_ON]);
    return ALL_SIDEBAR_KEYS.filter(key => !allowed.has(key));
  } catch (error) {
    console.warn('[app-config] plan gating lookup failed, no plan gating:', error);
    return [];
  }
}

/**
 * Effective disabled sidebar items for a store/user = global visibility rules,
 * per-store admin overrides, and active-plan feature gating.
 */
export async function getEffectiveDisabledItems(
  storeId: string,
  userId?: string | null,
): Promise<SidebarItemKey[]> {
  const [storeFlags, planGated, globalHidden] = await Promise.all([
    getStoreFeatureFlags(storeId),
    getPlanDisabledItems(storeId),
    getGlobalVisibilityDisabledItems(storeId, userId),
  ]);

  return expandDisabledSidebarItems([
    ...storeFlags.disabledItems,
    ...planGated,
    ...globalHidden,
  ]);
}

/**
 * Sidebar items that are locked because the store has no valid active
 * subscription. Hidden items are removed earlier by disabledItems.
 */
export async function getLockedItems(storeId: string): Promise<SidebarItemKey[]> {
  try {
    const flags = await getStoreFeatureFlags(storeId);
    if (flags.fullAccess) return [];
    const { hasValidActiveSubscription } = await import('@/lib/subscription');
    if (await hasValidActiveSubscription(storeId)) return [];
    return expandDisabledSidebarItems(
      ALL_SIDEBAR_KEYS.filter(key => !PLAN_GATING_ALWAYS_ON.includes(key)),
    );
  } catch (error) {
    console.warn('[app-config] lock computation failed, nothing locked:', error);
    return [];
  }
}

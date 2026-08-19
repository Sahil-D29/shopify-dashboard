export const SIDEBAR_CATALOG = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    group: 'main',
    href: '/',
    routePrefixes: ['/', '/dashboard'],
  },
  {
    key: 'chat',
    label: 'Live Chat',
    group: 'main',
    href: '/chat',
    routePrefixes: ['/chat'],
  },
  {
    key: 'customers',
    label: 'Customers',
    group: 'main',
    href: '/customers',
    routePrefixes: ['/customers'],
  },
  {
    key: 'segments',
    label: 'Segments',
    group: 'main',
    parentKey: 'customers',
    href: '/segments',
    routePrefixes: ['/segments'],
  },
  {
    key: 'contacts',
    label: 'Contacts',
    group: 'main',
    href: '/contacts',
    routePrefixes: ['/contacts'],
  },
  {
    key: 'templates',
    label: 'Templates',
    group: 'main',
    href: '/templates',
    routePrefixes: ['/templates'],
  },
  {
    key: 'campaigns',
    label: 'Campaigns',
    group: 'main',
    href: '/campaigns',
    routePrefixes: ['/campaigns'],
  },
  {
    key: 'email_marketing',
    label: 'Email Marketing',
    group: 'email',
    href: '/email/campaigns',
    routePrefixes: ['/email'],
  },
  {
    key: 'email_campaigns',
    label: 'Email - Campaigns',
    group: 'email',
    parentKey: 'email_marketing',
    href: '/email/campaigns',
    routePrefixes: ['/email/campaigns'],
  },
  {
    key: 'email_templates',
    label: 'Email - Templates',
    group: 'email',
    parentKey: 'email_marketing',
    href: '/email/templates',
    routePrefixes: ['/email/templates'],
  },
  {
    key: 'email_analytics',
    label: 'Email - Analytics',
    group: 'email',
    parentKey: 'email_marketing',
    href: '/email/analytics',
    routePrefixes: ['/email/analytics'],
  },
  {
    key: 'email_subscribers',
    label: 'Email - Subscribers',
    group: 'email',
    parentKey: 'email_marketing',
    href: '/email/subscribers',
    routePrefixes: ['/email/subscribers'],
  },
  {
    key: 'email_domains',
    label: 'Email - Domains',
    group: 'email',
    parentKey: 'email_marketing',
    href: '/email/domains',
    routePrefixes: ['/email/domains'],
  },
  {
    key: 'email_ab_tests',
    label: 'Email - A/B Tests',
    group: 'email',
    parentKey: 'email_marketing',
    href: '/email/ab-tests',
    routePrefixes: ['/email/ab-tests'],
  },
  {
    key: 'email_back_in_stock',
    label: 'Email - Back-in-Stock',
    group: 'email',
    parentKey: 'email_marketing',
    href: '/email/back-in-stock',
    routePrefixes: ['/email/back-in-stock'],
  },
  {
    key: 'email_cross_sell',
    label: 'Email - Cross-Sell',
    group: 'email',
    parentKey: 'email_marketing',
    href: '/email/cross-sell',
    routePrefixes: ['/email/cross-sell'],
  },
  {
    key: 'journeys',
    label: 'Journeys',
    group: 'main',
    href: '/journeys',
    routePrefixes: ['/journeys'],
  },
  {
    key: 'flows',
    label: 'Flows',
    group: 'main',
    href: '/flows',
    routePrefixes: ['/flows'],
  },
  {
    key: 'analytics',
    label: 'Analytics',
    group: 'main',
    href: '/analytics',
    routePrefixes: ['/analytics'],
  },
  {
    key: 'orders',
    label: 'Orders',
    group: 'main',
    href: '/orders',
    routePrefixes: ['/orders'],
  },
  {
    key: 'products',
    label: 'Products',
    group: 'main',
    href: '/products',
    routePrefixes: ['/products'],
  },
  {
    key: 'abandoned_carts',
    label: 'Abandoned Carts',
    group: 'main',
    href: '/abandoned-carts',
    routePrefixes: ['/abandoned-carts'],
  },
  {
    key: 'settings',
    label: 'Settings',
    group: 'main',
    href: '/settings',
    routePrefixes: ['/settings'],
  },
  {
    key: 'billing',
    label: 'Billing',
    group: 'main',
    href: '/billing',
    routePrefixes: ['/billing'],
  },
] as const;

export type SidebarCatalogItem = (typeof SIDEBAR_CATALOG)[number];
export type SidebarItemKey = SidebarCatalogItem['key'];
export type SidebarGroup = SidebarCatalogItem['group'];

export const ALL_SIDEBAR_KEYS = SIDEBAR_CATALOG.map(item => item.key) as SidebarItemKey[];

export const SIDEBAR_ITEMS = SIDEBAR_CATALOG.reduce(
  (acc, item) => {
    acc[item.key] = item.label;
    return acc;
  },
  {} as Record<SidebarItemKey, string>,
);

export const SIDEBAR_KEY_SET = new Set<string>(ALL_SIDEBAR_KEYS);

export function isSidebarItemKey(value: string): value is SidebarItemKey {
  return SIDEBAR_KEY_SET.has(value);
}

export function normalizeSidebarKeys(values: unknown): SidebarItemKey[] {
  if (!Array.isArray(values)) return [];
  return values.filter((value): value is SidebarItemKey =>
    typeof value === 'string' && isSidebarItemKey(value),
  );
}

export function expandDisabledSidebarItems(keys: Iterable<string>): SidebarItemKey[] {
  const disabled = new Set<SidebarItemKey>();

  for (const key of keys) {
    if (isSidebarItemKey(key)) disabled.add(key);
  }

  for (const item of SIDEBAR_CATALOG) {
    if ('parentKey' in item && item.parentKey && disabled.has(item.parentKey)) {
      disabled.add(item.key);
    }
  }

  return ALL_SIDEBAR_KEYS.filter(key => disabled.has(key));
}

export function getSidebarKeyForPath(pathname: string | null | undefined): SidebarItemKey | null {
  if (!pathname) return null;

  const matches = SIDEBAR_CATALOG
    .filter(item =>
      item.routePrefixes.some(prefix =>
        prefix === '/'
          ? pathname === '/'
          : pathname === prefix || pathname.startsWith(prefix + '/'),
      ),
    )
    .sort((a, b) => {
      const aLength = Math.max(...a.routePrefixes.map(prefix => prefix.length));
      const bLength = Math.max(...b.routePrefixes.map(prefix => prefix.length));
      return bLength - aLength;
    });

  return matches[0]?.key ?? null;
}

export function getFirstVisibleSidebarHref(disabledItems: Iterable<string>): string | null {
  const disabled = new Set(disabledItems);
  const item = SIDEBAR_CATALOG.find(entry =>
    entry.href && !('parentKey' in entry && entry.parentKey) && !disabled.has(entry.key),
  );
  return item?.href ?? null;
}

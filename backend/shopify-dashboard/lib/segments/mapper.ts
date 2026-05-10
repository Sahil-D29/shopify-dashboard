import type { ShopifyCustomer } from '@/lib/types/shopify-customer';

export interface UiCustomer {
  id: string;
  email: string | null;
  firstName: string;
  lastName: string;
  phone?: string;
  totalOrders: number;
  totalSpent: number;
  averageOrderValue: number;
  lastOrderDate?: number;
  firstOrderDate?: number;
  tags: string[];
  acceptsMarketing: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
  country?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  customerSince: number;
  lifetimeValue: number;
  orderFrequency?: 'first-time' | 'repeat' | 'loyal';
  riskLevel?: 'low' | 'medium' | 'high';
  createdAt: number;
  updatedAt: number;
  lastSeenAt?: number;
}

function primaryAddress(c: ShopifyCustomer) {
  return c.addresses?.find(a => a.default) || c.addresses?.[0];
}

export function mapShopifyToUiCustomer(c: ShopifyCustomer): UiCustomer {
  const orders = Number(c.orders_count || 0);
  const spent = Number(c.total_spent || 0);
  const aov = orders > 0 ? spent / orders : 0;
  const addr = primaryAddress(c);
  const updated = new Date(c.updated_at).getTime();
  const created = new Date(c.created_at).getTime();
  const daysSince = Math.floor((Date.now() - updated) / 86400000);
  const orderFrequency: 'first-time' | 'repeat' | 'loyal' = orders <= 1 ? 'first-time' : orders <= 3 ? 'repeat' : 'loyal';
  const riskLevel: 'low' | 'medium' | 'high' = daysSince <= 30 ? 'low' : daysSince <= 90 ? 'medium' : 'high';

  return {
    id: String(c.id),
    email: c.email,
    firstName: c.first_name || '',
    lastName: c.last_name || '',
    phone: c.phone || undefined,
    totalOrders: orders,
    totalSpent: spent,
    averageOrderValue: aov,
    lastOrderDate: updated,
    firstOrderDate: created,
    tags: (c.tags || '').split(',').map(t => t.trim()).filter(Boolean),
    acceptsMarketing: !!c.verified_email, // proxy
    emailVerified: !!c.verified_email,
    phoneVerified: !!c.phone,
    country: addr?.country || undefined,
    city: addr?.city || undefined,
    state: addr?.province || undefined,
    zipCode: addr?.zip || undefined,
    customerSince: created,
    lifetimeValue: spent,
    orderFrequency,
    riskLevel,
    createdAt: created,
    updatedAt: updated,
    lastSeenAt: updated,
  };
}



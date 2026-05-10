import type { ShopifyCustomer } from './shopify-customer';
import type { ShopifyOrderLineItem } from './shopify-order';

export interface ShopifyCheckout {
  id: number | string;
  token?: string;
  abandoned_checkout_url?: string;
  email?: string | null;
  phone?: string | null;
  created_at?: string | null;
  completed_at?: string | null;
  total_price?: string | number | null;
  currency?: string | null;
  line_items?: ShopifyOrderLineItem[];
  customer?: ShopifyCustomer | null;
}

export interface ShopifyCheckoutListResponse {
  checkouts?: ShopifyCheckout[];
  lastSynced?: number;
  error?: string;
}



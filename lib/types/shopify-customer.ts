export interface ShopifyCustomer {
  id: number;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
  orders_count: number;
  total_spent: string; // Shopify returns string currency
  state: string;
  verified_email: boolean;
  tags: string;
  addresses?: Array<{
    city?: string | null;
    province?: string | null;
    country?: string | null;
    zip?: string | null;
    default?: boolean;
  }>;
  default_address?: {
    phone?: string | null;
  } | null;
  last_order_id?: number | null;
  last_order_name?: string | null;
}

export interface ShopifyCustomerListResponse {
  customers?: ShopifyCustomer[];
  lastSynced?: number;
  error?: string;
}



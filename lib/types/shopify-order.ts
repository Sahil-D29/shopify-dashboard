export interface ShopifyOrderCustomer {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}

export interface ShopifyOrderLineItem {
  id?: number | string;
  title?: string;
  name?: string;
  quantity?: number;
  price?: string | number;
}

export interface ShopifyOrder {
  id: number | string;
  order_number?: number;
  name?: string;
  email?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  processed_at?: string | null;
  currency?: string | null;
  subtotal_price?: string | number | null;
  total_tax?: string | number | null;
  total_discounts?: string | number | null;
  total_price?: string | number | null;
  total_weight?: number | null;
  financial_status?: string | null;
  fulfillment_status?: string | null;
  gateway?: string | null;
  payment_gateway_names?: string[];
  source_name?: string | null;
  test?: boolean;
  tags?: string;
  customer?: ShopifyOrderCustomer | null;
  line_items?: ShopifyOrderLineItem[];
}

export interface ShopifyOrderListResponse {
  orders?: ShopifyOrder[];
  lastSynced?: number;
  error?: string;
}



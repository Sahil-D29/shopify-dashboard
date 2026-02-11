export interface ShopifyProductVariant {
  id: number | string;
  price?: string | number | null;
  inventory_quantity?: number | string | null;
}

export interface ShopifyImage {
  id?: number | string;
  src?: string;
  alt?: string | null;
}

export interface ShopifyProduct {
  id: number | string;
  title: string;
  vendor?: string | null;
  product_type?: string | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  tags?: string | null;
  images?: ShopifyImage[];
  variants?: ShopifyProductVariant[];
}

export interface ShopifyProductListResponse {
  products?: ShopifyProduct[];
  lastSynced?: number;
  error?: string;
}



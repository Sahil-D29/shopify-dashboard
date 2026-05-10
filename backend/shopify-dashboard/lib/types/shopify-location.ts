export interface ShopifyLocation {
  id: number | string;
  name?: string | null;
  active?: boolean;
  address1?: string | null;
  city?: string | null;
  zip?: string | null;
  country_code?: string | null;
}

export interface ShopifyLocationListResponse {
  locations?: ShopifyLocation[];
  lastSynced?: number;
  error?: string;
}



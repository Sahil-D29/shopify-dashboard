import type { ShopifyCustomer } from '@/lib/types/shopify-customer';

const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || '2024-10';

interface ShopifyConfig {
  shop: string;
  accessToken: string;
}

export interface ShopifyCheckout {
  id?: number | string;
  updated_at?: string;
  created_at?: string;
  customer?: ShopifyCustomer | null;
  email?: string | null;
  total_price?: string | number | null;
}

export interface ShopifyCheckoutResponse {
  checkouts?: ShopifyCheckout[];
}

export interface ShopifyOrderLineItem {
  product_id?: number | string | null;
  title?: string;
  name?: string;
  quantity?: number | string;
  price?: string | number | null;
}

export interface ShopifyOrder {
  id: number;
  created_at: string;
  processed_at?: string | null;
  total_price?: string | number | null;
  customer?: ShopifyCustomer | null;
  line_items?: ShopifyOrderLineItem[];
}

export interface ShopifyOrderListResponse {
  orders?: ShopifyOrder[];
  lastSynced?: number;
}

export interface ShopifyCustomerResponse {
  customer?: ShopifyCustomer | null;
}

export interface ShopifyCustomerListResponse {
  customers?: ShopifyCustomer[];
}

class ShopifyClient {
  private config: ShopifyConfig;
  private baseUrl: string;

  constructor(config?: ShopifyConfig) {
    this.config = config || {
      shop: process.env.SHOPIFY_STORE_URL || process.env.SHOPIFY_SHOP_URL || '',
      accessToken: process.env.SHOPIFY_ACCESS_TOKEN || '',
    };
    
    // Remove https:// and .myshopify.com if present
    let shop = this.config.shop.replace(/^https?:\/\//, '').replace(/\.myshopify\.com$/, '');
    if (!shop.includes('.')) {
      shop = `${shop}.myshopify.com`;
    }
    
    this.config.shop = shop;
    this.baseUrl = `https://${this.config.shop}/admin/api/${SHOPIFY_API_VERSION}`;
  }

  async requestRaw(endpoint: string, options: RequestInit = {}) {
    // Validate configuration before making request
    if (!this.config || !this.config.shop || !this.config.accessToken) {
      const error = 'Shopify configuration not found. Please configure your store in Settings.';
      console.error('❌ Shopify Client Error:', error, {
        hasConfig: !!this.config,
        hasShop: !!this.config?.shop,
        hasAccessToken: !!this.config?.accessToken,
      });
      throw new Error(error);
    }

    const url = `${this.baseUrl}${endpoint}`;
    console.log('🔗 Shopify API Request:', {
      method: options.method || 'GET',
      url,
      shop: this.config.shop,
      hasAccessToken: !!this.config.accessToken,
    });
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'X-Shopify-Access-Token': this.config.accessToken,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      console.log('📡 Shopify API Response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        url,
      });

      if (!response.ok) {
        let errorText = '';
        let errorData = null;
        
        try {
          errorText = await response.text();
          console.error('❌ Shopify API Error Response:', {
            status: response.status,
            statusText: response.statusText,
            url,
            body: errorText,
          });
          
          // Try to parse as JSON
          try {
            errorData = JSON.parse(errorText);
            console.error('❌ Parsed Shopify error:', errorData);
          } catch {
            // Not JSON, use text as is
          }
        } catch (textError) {
          console.error('❌ Failed to read Shopify error response:', textError);
        }
        
        // Handle rate limiting (429 Too Many Requests)
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After') || '60';
          const error = `Shopify API rate limit exceeded. Please wait ${retryAfter} seconds before trying again.`;
          console.error('⏱️ Rate limit error:', error);
          throw new Error(error);
        }
        
        // Provide helpful error message for authentication errors
        if (response.status === 401 || response.status === 403) {
          const error = 'Invalid Shopify credentials. Please reconfigure your store in Settings.';
          console.error('🔒 Authentication error:', error);
          throw new Error(error);
        }
        
        // Extract error message from Shopify response if available
        const errorMessage = errorData?.errors 
          ? (Array.isArray(errorData.errors) ? errorData.errors.join(', ') : String(errorData.errors))
          : errorData?.error 
          ? String(errorData.error)
          : errorText || `${response.status} ${response.statusText}`;
        
        const error = `Shopify API Error: ${response.status} ${response.statusText} - ${errorMessage}`;
        console.error('❌ Shopify API Error:', error);
        throw new Error(error);
      }

      return response;
    } catch (error) {
      // Re-throw if it's already our formatted error
      if (error instanceof Error && error.message.includes('Shopify')) {
        throw error;
      }
      
      // Handle network errors
      console.error('❌ Network error calling Shopify API:', {
        error,
        message: error instanceof Error ? error.message : String(error),
        url,
      });
      
      throw new Error(`Failed to connect to Shopify API: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const res = await this.requestRaw(endpoint, options);
    return res.json();
  }

  async getCustomers(params?: {
    limit?: number;
    since_id?: string;
    page_info?: string;
    created_at_min?: string;
    created_at_max?: string;
    updated_at_min?: string;
    updated_at_max?: string;
    fields?: string;
  }) {
    const query = new URLSearchParams();
    query.set('limit', String(params?.limit ?? 250));
    if (params?.since_id) query.set('since_id', params.since_id);
    if (params?.page_info) query.set('page_info', params.page_info);
    if (params?.created_at_min) query.set('created_at_min', params.created_at_min);
    if (params?.created_at_max) query.set('created_at_max', params.created_at_max);
    if (params?.updated_at_min) query.set('updated_at_min', params.updated_at_min);
    if (params?.updated_at_max) query.set('updated_at_max', params.updated_at_max);
    if (params?.fields) query.set('fields', params.fields);
    return this.request<ShopifyCustomerListResponse>(`/customers.json?${query}`);
  }

  async getOrders(params?: {
    limit?: number;
    status?: string;
    financial_status?: string;
    fulfillment_status?: string;
    processed_at_min?: string;
    processed_at_max?: string;
    page_info?: string;
    fields?: string;
    order?: string; // sort
  }) {
    const query = new URLSearchParams();
    query.set('limit', String(params?.limit ?? 250));
    query.set('status', params?.status ?? 'any');
    if (params?.financial_status) query.set('financial_status', params.financial_status);
    if (params?.fulfillment_status) query.set('fulfillment_status', params.fulfillment_status);
    if (params?.processed_at_min) query.set('processed_at_min', params.processed_at_min);
    if (params?.processed_at_max) query.set('processed_at_max', params.processed_at_max);
    if (params?.page_info) query.set('page_info', params.page_info);
    if (params?.fields) query.set('fields', params.fields);
    if (params?.order) query.set('order', params.order);
    return this.request(`/orders.json?${query}`);
  }

  async getProducts(params?: {
    limit?: number;
    product_type?: string;
    vendor?: string;
    status?: 'active' | 'archived' | 'draft';
    fields?: string;
    page_info?: string;
  }) {
    const query = new URLSearchParams();
    query.set('limit', String(params?.limit ?? 250));
    if (params?.product_type) query.set('product_type', params.product_type);
    if (params?.vendor) query.set('vendor', params.vendor);
    if (params?.status) query.set('status', params.status);
    if (params?.fields) query.set('fields', params.fields);
    if (params?.page_info) query.set('page_info', params.page_info);
    return this.request(`/products.json?${query}`);
  }

  async getAbandonedCheckouts(params?: {
    limit?: number;
    status?: 'open' | 'completed' | 'recovered';
    page_info?: string;
    fields?: string;
  }): Promise<ShopifyCheckoutResponse> {
    const query = new URLSearchParams();
    query.set('limit', String(params?.limit ?? 250));
    if (params?.status) query.set('status', params.status);
    if (params?.page_info) query.set('page_info', params.page_info);
    if (params?.fields) query.set('fields', params.fields);
    return this.request<ShopifyCheckoutResponse>(`/checkouts.json?${query}`);
  }

  // Single-resource helpers
  async getCustomer(customerId: string): Promise<ShopifyCustomerResponse> {
    return this.request<ShopifyCustomerResponse>(`/customers/${customerId}.json`);
  }
  async getCustomerOrders(customerId: string): Promise<ShopifyOrderListResponse> {
    return this.request<ShopifyOrderListResponse>(`/customers/${customerId}/orders.json`);
  }
  async getOrder(orderId: string) {
    return this.request(`/orders/${orderId}.json`);
  }
  async getProduct(productId: string) {
    return this.request(`/products/${productId}.json`);
  }
  async getMetafields(resource: 'customers'|'orders'|'products', resourceId: string) {
    return this.request(`/${resource}/${resourceId}/metafields.json`);
  }

  // Universal helpers
  async fetchById<T = unknown>(resource: string, id: string | number): Promise<T> {
    return this.request<T>(`/${resource}/${id}.json`);
  }

  async fetchNested<T = unknown>(
    parent: string,
    parentId: string | number,
    child: string,
    params?: Record<string, unknown>,
  ): Promise<T> {
    const query = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => v != null && query.set(k, String(v)));
    const qs = query.toString();
    return this.request<T>(`/${parent}/${parentId}/${child}.json${qs ? `?${qs}` : ''}`);
  }

  async fetchAll<T = unknown>(resource: string, params?: Record<string, unknown>): Promise<T[]> {
    const items: T[] = [];
    let pageInfo: string | undefined = undefined;
    do {
      const query = new URLSearchParams();
      const limit = params?.limit ?? 250;
      query.set('limit', String(limit));
      if (pageInfo) query.set('page_info', pageInfo);
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          if (v != null && k !== 'limit' && k !== 'page_info') query.set(k, String(v));
        });
      }

      const res = await this.requestRaw(`/${resource}.json?${query.toString()}`);
      const data = await res.json();
      if (typeof data === 'object' && data !== null) {
        const firstKey = Object.keys(data)[0];
        const entry = firstKey ? (data as Record<string, unknown>)[firstKey] : undefined;
        if (Array.isArray(entry)) {
          items.push(...(entry as T[]));
        }
      }

      // Parse Link header for next rel
      const link = res.headers.get('link') || res.headers.get('Link');
      if (link && link.includes('rel="next"')) {
        const match = link.match(/[?&]page_info=([^&>]+)/);
        pageInfo = match ? decodeURIComponent(match[1]) : undefined;
      } else {
        pageInfo = undefined;
      }
    } while (pageInfo);

    return items;
  }

  async fetchPaginated<T = unknown>(resource: string, limit: number = 250): Promise<T[]> {
    return this.fetchAll<T>(resource, { limit });
  }
}

// Export the class for dynamic instantiation
export { ShopifyClient };

// Keep default instance for backward compatibility (uses env vars)
export const shopifyClient = new ShopifyClient();


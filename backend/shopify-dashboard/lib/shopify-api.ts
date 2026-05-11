import { getShopToken, deleteShop } from './token-manager';

export class ShopifyAPIError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public isTokenExpired: boolean = false
  ) {
    super(message);
    this.name = 'ShopifyAPIError';
  }
}

/**
 * Call Shopify API with automatic retry on token expiration
 */
export async function callShopifyAPI(
  shop: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  let token = await getShopToken(shop);
  
  if (!token) {
    throw new ShopifyAPIError('No access token found for shop', 404);
  }
  
  const url = `https://${shop}/admin/api/2024-10${endpoint}`;
  
  // First attempt
  let response = await fetch(url, {
    ...options,
    headers: {
      'X-Shopify-Access-Token': token,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  // Handle token expiration
  if (response.status === 401) {
    console.warn(`Token expired for shop: ${shop}`);
    
    // In production, you would:
    // 1. Try to refresh the token via OAuth
    // 2. If that fails, mark shop as requiring re-installation
    
    // For now, delete the expired token
    await deleteShop(shop);
    
    throw new ShopifyAPIError(
      'Shopify access token expired. Please reinstall the app.',
      401,
      true
    );
  }
  
  // Handle rate limiting
  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After') || '2';
    const rateLimitHeader = response.headers.get('X-Shopify-Shop-Api-Call-Limit');
    
    console.warn(`Rate limited. Retry after ${retryAfter}s. Limit: ${rateLimitHeader}`);
    
    throw new ShopifyAPIError(
      `Rate limited. Please try again in ${retryAfter} seconds.`,
      429
    );
  }
  
  return response;
}

/**
 * Call Shopify GraphQL API
 */
export async function callShopifyGraphQL(
  shop: string,
  query: string,
  variables?: Record<string, any>
): Promise<any> {
  const response = await callShopifyAPI(shop, '/graphql.json', {
    method: 'POST',
    body: JSON.stringify({ query, variables }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new ShopifyAPIError(
      `GraphQL request failed: ${response.statusText} - ${errorText}`,
      response.status
    );
  }
  
  const data = await response.json();
  
  if (data.errors) {
    throw new ShopifyAPIError(
      `GraphQL errors: ${JSON.stringify(data.errors)}`,
      400
    );
  }
  
  return data.data;
}

/**
 * Call Shopify REST API
 */
export async function callShopifyREST(
  shop: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<any> {
  const response = await callShopifyAPI(shop, endpoint, options);
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new ShopifyAPIError(
      `REST API request failed: ${response.statusText} - ${errorText}`,
      response.status
    );
  }
  
  return await response.json();
}



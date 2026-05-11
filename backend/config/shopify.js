import { shopifyApi } from '@shopify/shopify-api';
import '@shopify/shopify-api/adapters/node';
import dotenv from 'dotenv';
import { readFileSafe } from '../utils/safeFileStore.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Suppress dotenv informational messages
dotenv.config({ quiet: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Shopify API
// Use a specific API version (2024-01) or let it default to latest
// Enable future flags to suppress warnings
const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY || '',
  apiSecretKey: process.env.SHOPIFY_API_SECRET || '',
  scopes: ['read_products', 'read_orders', 'read_customers', 'read_inventory', 'read_locations', 'read_checkouts'],
  hostName: process.env.HOST || 'localhost:5000',
  apiVersion: process.env.SHOPIFY_API_VERSION || '2024-01',
  isEmbeddedApp: false,
  future: {
    customerAddressDefaultFix: true,
    unstable_managedPricingSupport: true,
  },
});

/**
 * Get session from file-based store (data/shops.json)
 * This integrates with the existing OAuth flow that stores sessions in shopify-dashboard/data/shops.json
 */
async function getSessionFromDB(shop) {
  try {
    // Normalize shop domain
    const normalized = shop.replace(/^https?:\/\//, '').replace(/\.myshopify\.com$/, '');
    const shopDomain = `${normalized}.myshopify.com`;
    
    // Try to read from shopify-dashboard/data/shops.json (where OAuth saves it)
    const shopsPath = join(__dirname, '..', 'shopify-dashboard', 'data', 'shops.json');
    
    let stores = {};
    try {
      stores = await readFileSafe(shopsPath, { default: {} });
    } catch (error) {
      // If file doesn't exist, try fallback to env vars
      console.warn(`⚠️ No shops.json found at ${shopsPath}. Using environment variables as fallback.`);
      
      // Fallback: Use environment variables if available
      if (process.env.SHOPIFY_STORE_URL && process.env.SHOPIFY_ACCESS_TOKEN) {
        const envShop = process.env.SHOPIFY_STORE_URL.replace(/^https?:\/\//, '').replace(/\.myshopify\.com$/, '');
        if (`${envShop}.myshopify.com` === shopDomain) {
          return {
            shop: shopDomain,
            accessToken: process.env.SHOPIFY_ACCESS_TOKEN,
            scope: 'read_products,read_orders,read_customers,read_inventory,read_locations,read_checkouts',
          };
        }
      }
      
      throw new Error(`No session found for shop: ${shopDomain}. Please install the app first via OAuth.`);
    }
    
    const session = stores[shopDomain];
    
    if (!session || !session.accessToken) {
      // Try fallback to env vars
      if (process.env.SHOPIFY_STORE_URL && process.env.SHOPIFY_ACCESS_TOKEN) {
        const envShop = process.env.SHOPIFY_STORE_URL.replace(/^https?:\/\//, '').replace(/\.myshopify\.com$/, '');
        if (`${envShop}.myshopify.com` === shopDomain) {
          console.log('📦 Using environment variable credentials as fallback');
          return {
            shop: shopDomain,
            accessToken: process.env.SHOPIFY_ACCESS_TOKEN,
            scope: 'read_products,read_orders,read_customers,read_inventory,read_locations,read_checkouts',
          };
        }
      }
      
      throw new Error(`No valid session found for shop: ${shopDomain}. Please reconfigure the app.`);
    }
    
    console.log(`✅ Found session for shop: ${shopDomain}`);
    
    return {
      shop: session.shop || shopDomain,
      accessToken: session.accessToken,
      scope: session.scope || 'read_products,read_orders,read_customers,read_inventory,read_locations,read_checkouts',
    };
  } catch (error) {
    console.error('❌ Error getting session from DB:', error);
    throw error;
  }
}

/**
 * Create GraphQL client for a specific shop
 */
async function createShopifyClient(shop) {
  try {
    const session = await getSessionFromDB(shop);
    
    if (!session || !session.accessToken) {
      throw new Error(`No valid session found for shop: ${shop}`);
    }

    const client = new shopify.clients.Graphql({
      session: {
        shop: session.shop,
        accessToken: session.accessToken,
      },
    });

    return client;
  } catch (error) {
    console.error(`❌ Error creating Shopify client for ${shop}:`, error.message);
    throw error;
  }
}

/**
 * Helper function to get date string N months ago (for GraphQL queries)
 */
function getDateMonthsAgo(months) {
  const date = new Date();
  date.setMonth(date.getMonth() - months);
  return date.toISOString().split('T')[0];
}

export { shopify, createShopifyClient, getSessionFromDB, getDateMonthsAgo };



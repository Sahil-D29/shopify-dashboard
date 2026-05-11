import express from "express";
import { createShopifyClient, getDateMonthsAgo } from "../config/shopify.js";
import { updateShopifyHealth } from "../utils/systemHealth.js";
import { authenticate } from "../middleware/auth.js";
import { authorizeStoreAccess, requirePermission } from "../middleware/rbac.js";
import { PERMISSIONS } from "../middleware/permissions.js";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * Get analytics data from Shopify
 * GET /api/shopify/analytics?shop=sai-laxmi-dev.myshopify.com
 * ADMIN: All stores, STORE_OWNER/USER: Own store only
 */
router.get("/analytics", authorizeStoreAccess(), async (req, res) => {
  try {
    const user = req.user;
    const shop = req.storeId || req.query.shop || req.headers['x-shopify-shop'];
    
    if (!shop && user.role !== 'admin') {
      return res.status(400).json({ error: 'Store identifier required' });
    }
    
    // For non-admin users, ensure they can only access their own store
    if (user.role !== 'admin' && shop) {
      const userStores = user.stores || [];
      const normalizedShop = shop.replace('.myshopify.com', '');
      const hasAccess = userStores.some(store => {
        const normalizedStore = String(store).replace('.myshopify.com', '');
        return normalizedStore === normalizedShop || store === shop;
      });
      
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied to this store' });
      }
    }
    
    // Get default store from config if no shop provided (admin only)
    const { getDefaultStore, formatStoreDomain } = await import('../config/stores.config.js');
    const defaultStore = user.role === 'admin' ? getDefaultStore() : null;
    const finalShop = shop || (defaultStore ? formatStoreDomain(defaultStore) : null);
    
    if (!finalShop && user.role !== 'admin') {
      return res.status(400).json({ 
        error: 'Store identifier required',
        message: 'Please provide a shop parameter'
      });
    }
    
    if (!finalShop) {
      return res.status(400).json({ 
        error: 'No store configured',
        message: 'Please provide a shop parameter or configure DEFAULT_STORE_ID'
      });
    }
    console.log(`📊 Fetching analytics for shop: ${finalShop}`);
    
    const client = await createShopifyClient(finalShop);

    // Fetch orders from last month to calculate analytics
    const oneMonthAgo = getDateMonthsAgo(1);
    const ordersQuery = `
      query {
        orders(first: 250, query: "created_at:>=${oneMonthAgo}") {
          edges {
            node {
              id
              name
              createdAt
              totalPriceSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
              customer {
                id
                displayName
                email
              }
            }
          }
        }
      }
    `;

    const response = await client.query({ data: ordersQuery });
    const orders = response.body.data.orders.edges.map(edge => edge.node);
    
    // Update successful sync
    await updateShopifyHealth({ 
      tokenValid: true, 
      lastSuccessfulSync: new Date().toISOString() 
    }).catch(() => {});

    // Calculate analytics from real data
    const totalRevenue = orders.reduce((sum, order) => {
      return sum + parseFloat(order.totalPriceSet?.shopMoney?.amount || 0);
    }, 0);

    const ordersCount = orders.length;
    
    // Get unique customers
    const uniqueCustomers = new Set(
      orders
        .filter(o => o.customer?.id)
        .map(o => o.customer.id)
    );

    const averageOrderValue = ordersCount > 0 ? totalRevenue / ordersCount : 0;
    
    // Calculate growth (last 7 days vs previous 7 days)
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    
    const recentOrders = orders.filter(order => new Date(order.createdAt) > sevenDaysAgo);
    const previousOrders = orders.filter(order => {
      const date = new Date(order.createdAt);
      return date > fourteenDaysAgo && date <= sevenDaysAgo;
    });
    
    const recentRevenue = recentOrders.reduce((sum, order) => sum + parseFloat(order.totalPriceSet?.shopMoney?.amount || 0), 0);
    const previousRevenue = previousOrders.reduce((sum, order) => sum + parseFloat(order.totalPriceSet?.shopMoney?.amount || 0), 0);
    
    const revenueGrowth = previousRevenue > 0 ? ((recentRevenue - previousRevenue) / previousRevenue) * 100 : 0;
    const ordersGrowth = previousOrders.length > 0 ? ((recentOrders.length - previousOrders.length) / previousOrders.length) * 100 : 0;

    res.json({
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      totalOrders: ordersCount,
      totalCustomers: uniqueCustomers.size,
      averageOrderValue: parseFloat(averageOrderValue.toFixed(2)),
      revenueGrowth: parseFloat(revenueGrowth.toFixed(2)),
      ordersGrowth: parseFloat(ordersGrowth.toFixed(2)),
      recentOrders: recentOrders.length,
      previousOrders: previousOrders.length,
      lastSynced: Date.now(),
      cached: false
    });

  } catch (error) {
    console.error('❌ Analytics error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch analytics',
      message: error.message,
      details: error.response?.errors || error.stack
    });
  }
});

/**
 * Get orders from Shopify
 * GET /api/shopify/orders?shop=sai-laxmi-dev.myshopify.com&limit=10
 * ADMIN: All stores, STORE_OWNER: Manage own, USER: View only
 */
router.get("/orders", authorizeStoreAccess(), async (req, res) => {
  try {
    const user = req.user;
    const shop = req.storeId || req.query.shop || req.headers['x-shopify-shop'];
    
    if (!shop && user.role !== 'admin') {
      return res.status(400).json({ error: 'Store identifier required' });
    }
    
    // For non-admin users, ensure they can only access their own store
    if (user.role !== 'admin' && shop) {
      const userStores = user.stores || [];
      const normalizedShop = shop.replace('.myshopify.com', '');
      const hasAccess = userStores.some(store => {
        const normalizedStore = String(store).replace('.myshopify.com', '');
        return normalizedStore === normalizedShop || store === shop;
      });
      
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied to this store' });
      }
    }
    
    // Get default store from config if no shop provided (admin only)
    const { getDefaultStore, formatStoreDomain } = await import('../config/stores.config.js');
    const defaultStore = user.role === 'admin' ? getDefaultStore() : null;
    const finalShop = shop || (defaultStore ? formatStoreDomain(defaultStore) : null);
    
    if (!finalShop && user.role !== 'admin') {
      return res.status(400).json({ 
        error: 'Store identifier required',
        message: 'Please provide a shop parameter'
      });
    }
    
    if (!finalShop) {
      return res.status(400).json({ 
        error: 'No store configured',
        message: 'Please provide a shop parameter or configure DEFAULT_STORE_ID'
      });
    }
    const limit = parseInt(req.query.limit) || 10;
    console.log(`📦 Fetching ${limit} orders for shop: ${finalShop}`);
    
    const client = await createShopifyClient(finalShop);

    const ordersQuery = `
      query {
        orders(first: ${limit}, reverse: true) {
          edges {
            node {
              id
              name
              orderNumber
              createdAt
              displayFinancialStatus
              displayFulfillmentStatus
              totalPriceSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
              customer {
                id
                displayName
                email
                firstName
                lastName
              }
              lineItems(first: 5) {
                edges {
                  node {
                    title
                    quantity
                    originalUnitPriceSet {
                      shopMoney {
                        amount
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    const response = await client.query({ data: ordersQuery });
    
    // Update successful sync
    await updateShopifyHealth({ 
      tokenValid: true, 
      lastSuccessfulSync: new Date().toISOString() 
    }).catch(() => {});
    
    const orders = response.body.data.orders.edges.map(edge => ({
      id: edge.node.id,
      order_number: edge.node.orderNumber,
      name: edge.node.name,
      created_at: edge.node.createdAt,
      financial_status: edge.node.displayFinancialStatus?.toLowerCase(),
      fulfillment_status: edge.node.displayFulfillmentStatus?.toLowerCase(),
      total_price: edge.node.totalPriceSet?.shopMoney?.amount || '0',
      currency: edge.node.totalPriceSet?.shopMoney?.currencyCode || 'USD',
      customer: edge.node.customer ? {
        id: edge.node.customer.id,
        first_name: edge.node.customer.firstName,
        last_name: edge.node.customer.lastName,
        email: edge.node.customer.email,
        display_name: edge.node.customer.displayName
      } : null,
      line_items: edge.node.lineItems.edges.map(li => ({
        title: li.node.title,
        quantity: li.node.quantity,
        price: li.node.originalUnitPriceSet?.shopMoney?.amount || '0'
      }))
    }));

    res.json({ 
      orders,
      lastSynced: Date.now(),
      cached: false
    });

  } catch (error) {
    console.error('❌ Orders error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch orders',
      message: error.message,
      orders: []
    });
  }
});

/**
 * Get products from Shopify
 * GET /api/shopify/products?shop=sai-laxmi-dev.myshopify.com&limit=10
 * ADMIN: All stores, STORE_OWNER: Manage own, USER: View only
 */
router.get("/products", authorizeStoreAccess(), async (req, res) => {
  try {
    const user = req.user;
    const shop = req.storeId || req.query.shop || req.headers['x-shopify-shop'];
    
    if (!shop && user.role !== 'admin') {
      return res.status(400).json({ error: 'Store identifier required' });
    }
    
    // For non-admin users, ensure they can only access their own store
    if (user.role !== 'admin' && shop) {
      const userStores = user.stores || [];
      const normalizedShop = shop.replace('.myshopify.com', '');
      const hasAccess = userStores.some(store => {
        const normalizedStore = String(store).replace('.myshopify.com', '');
        return normalizedStore === normalizedShop || store === shop;
      });
      
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied to this store' });
      }
    }
    
    // Get default store from config if no shop provided (admin only)
    const { getDefaultStore, formatStoreDomain } = await import('../config/stores.config.js');
    const defaultStore = user.role === 'admin' ? getDefaultStore() : null;
    const finalShop = shop || (defaultStore ? formatStoreDomain(defaultStore) : null);
    
    if (!finalShop && user.role !== 'admin') {
      return res.status(400).json({ 
        error: 'Store identifier required',
        message: 'Please provide a shop parameter'
      });
    }
    
    if (!finalShop) {
      return res.status(400).json({ 
        error: 'No store configured',
        message: 'Please provide a shop parameter or configure DEFAULT_STORE_ID'
      });
    }
    const limit = parseInt(req.query.limit) || 10;
    console.log(`🛍️ Fetching ${limit} products for shop: ${finalShop}`);
    
    const client = await createShopifyClient(finalShop);

    const productsQuery = `
      query {
        products(first: ${limit}, reverse: true) {
          edges {
            node {
              id
              title
              status
              vendor
              productType
              totalInventory
              createdAt
              priceRangeV2 {
                minVariantPrice {
                  amount
                  currencyCode
                }
              }
              featuredImage {
                url
                altText
              }
              images(first: 5) {
                edges {
                  node {
                    url
                    altText
                  }
                }
              }
              variants(first: 10) {
                edges {
                  node {
                    id
                    title
                    price
                    sku
                    inventoryQuantity
                    availableForSale
                  }
                }
              }
            }
          }
        }
      }
    `;

    const response = await client.query({ data: productsQuery });
    
    // Update successful sync
    await updateShopifyHealth({ 
      tokenValid: true, 
      lastSuccessfulSync: new Date().toISOString() 
    }).catch(() => {});
    
    const products = response.body.data.products.edges.map(edge => ({
      id: edge.node.id,
      title: edge.node.title,
      status: edge.node.status?.toLowerCase() || 'draft',
      vendor: edge.node.vendor || '',
      product_type: edge.node.productType || '',
      created_at: edge.node.createdAt,
      total_inventory: edge.node.totalInventory || 0,
      price: edge.node.priceRangeV2?.minVariantPrice?.amount || '0',
      currency: edge.node.priceRangeV2?.minVariantPrice?.currencyCode || 'USD',
      featured_image: edge.node.featuredImage?.url || null,
      images: edge.node.images.edges.map(img => ({
        url: img.node.url,
        alt: img.node.altText || edge.node.title
      })),
      variants: edge.node.variants.edges.map(v => ({
        id: v.node.id,
        title: v.node.title,
        price: v.node.price || '0',
        sku: v.node.sku || '',
        inventory_quantity: v.node.inventoryQuantity || 0,
        available_for_sale: v.node.availableForSale || false
      }))
    }));

    res.json({ 
      products,
      lastSynced: Date.now(),
      cached: false
    });

  } catch (error) {
    console.error('❌ Products error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch products',
      message: error.message,
      products: []
    });
  }
});

/**
 * Get customers from Shopify
 * GET /api/shopify/customers?shop=sai-laxmi-dev.myshopify.com&limit=10
 * ADMIN: All stores, STORE_OWNER: Manage own, USER: View only
 */
router.get("/customers", authorizeStoreAccess(), async (req, res) => {
  try {
    const user = req.user;
    const shop = req.storeId || req.query.shop || req.headers['x-shopify-shop'];
    
    if (!shop && user.role !== 'admin') {
      return res.status(400).json({ error: 'Store identifier required' });
    }
    
    // For non-admin users, ensure they can only access their own store
    if (user.role !== 'admin' && shop) {
      const userStores = user.stores || [];
      const normalizedShop = shop.replace('.myshopify.com', '');
      const hasAccess = userStores.some(store => {
        const normalizedStore = String(store).replace('.myshopify.com', '');
        return normalizedStore === normalizedShop || store === shop;
      });
      
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied to this store' });
      }
    }
    
    // Get default store from config if no shop provided (admin only)
    const { getDefaultStore, formatStoreDomain } = await import('../config/stores.config.js');
    const defaultStore = user.role === 'admin' ? getDefaultStore() : null;
    const finalShop = shop || (defaultStore ? formatStoreDomain(defaultStore) : null);
    
    if (!finalShop && user.role !== 'admin') {
      return res.status(400).json({ 
        error: 'Store identifier required',
        message: 'Please provide a shop parameter'
      });
    }
    
    if (!finalShop) {
      return res.status(400).json({ 
        error: 'No store configured',
        message: 'Please provide a shop parameter or configure DEFAULT_STORE_ID'
      });
    }
    const limit = parseInt(req.query.limit) || 10;
    console.log(`👥 Fetching ${limit} customers for shop: ${finalShop}`);
    
    const client = await createShopifyClient(finalShop);

    const customersQuery = `
      query {
        customers(first: ${limit}, reverse: true) {
          edges {
            node {
              id
              displayName
              firstName
              lastName
              email
              phone
              createdAt
              numberOfOrders
              amountSpent {
                amount
                currencyCode
              }
              addresses {
                address1
                city
                province
                country
                zip
              }
            }
          }
        }
      }
    `;

    const response = await client.query({ data: customersQuery });
    
    // Update successful sync
    await updateShopifyHealth({ 
      tokenValid: true, 
      lastSuccessfulSync: new Date().toISOString() 
    }).catch(() => {});
    
    const customers = response.body.data.customers.edges.map(edge => ({
      id: edge.node.id,
      first_name: edge.node.firstName || '',
      last_name: edge.node.lastName || '',
      email: edge.node.email || '',
      phone: edge.node.phone || '',
      created_at: edge.node.createdAt,
      orders_count: edge.node.numberOfOrders || 0,
      total_spent: edge.node.amountSpent?.amount || '0',
      currency: edge.node.amountSpent?.currencyCode || 'USD',
      addresses: edge.node.addresses?.map(addr => ({
        address1: addr.address1 || '',
        city: addr.city || '',
        province: addr.province || '',
        country: addr.country || '',
        zip: addr.zip || ''
      })) || []
    }));

    res.json({ 
      customers,
      lastSynced: Date.now(),
      cached: false
    });

  } catch (error) {
    console.error('❌ Customers error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch customers',
      message: error.message,
      customers: []
    });
  }
});

/**
 * Get locations from Shopify
 * GET /api/shopify/locations?shop=sai-laxmi-dev.myshopify.com
 */
router.get("/locations", async (req, res) => {
  try {
    const { getDefaultStore, formatStoreDomain } = await import('../config/stores.config.js');
    const defaultStore = user.role === 'admin' ? getDefaultStore() : null;
    const shop = req.query.shop || req.headers['x-shopify-shop'] || (defaultStore ? formatStoreDomain(defaultStore) : null);
    
    if (!shop && user.role !== 'admin') {
      return res.status(400).json({ 
        error: 'Store identifier required',
        message: 'Please provide a shop parameter'
      });
    }
    
    if (!shop) {
      return res.status(400).json({ 
        error: 'No store configured',
        message: 'Please provide a shop parameter or configure DEFAULT_STORE_ID'
      });
    }
    console.log(`📍 Fetching locations for shop: ${shop}`);
    
    const client = await createShopifyClient(shop);

    const locationsQuery = `
      query {
        locations(first: 10) {
          edges {
            node {
              id
              name
              address {
                address1
                address2
                city
                province
                country
                zip
                phone
              }
              isActive
            }
          }
        }
      }
    `;

    const response = await client.query({ data: locationsQuery });
    const locations = response.body.data.locations.edges.map(edge => ({
      id: parseInt(edge.node.id.split('/').pop()),
      name: edge.node.name,
      address1: edge.node.address?.address1 || '',
      address2: edge.node.address?.address2 || '',
      city: edge.node.address?.city || '',
      province: edge.node.address?.province || '',
      country: edge.node.address?.country || '',
      zip: edge.node.address?.zip || '',
      phone: edge.node.address?.phone || '',
      country_code: edge.node.address?.country || '',
      active: edge.node.isActive || false
    }));

    res.json({ 
      locations,
      lastSynced: Date.now(),
      cached: false
    });

  } catch (error) {
    console.error('❌ Locations error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch locations',
      message: error.message,
      locations: []
    });
  }
});

/**
 * Get abandoned checkouts from Shopify
 * GET /api/shopify/checkouts?shop=sai-laxmi-dev.myshopify.com&limit=10
 * ADMIN: All stores, STORE_OWNER: View/Recover, USER: View only
 */
router.get("/checkouts", authorizeStoreAccess(), async (req, res) => {
  try {
    const user = req.user;
    const shop = req.storeId || req.query.shop || req.headers['x-shopify-shop'];
    
    if (!shop && user.role !== 'admin') {
      return res.status(400).json({ error: 'Store identifier required' });
    }
    
    // For non-admin users, ensure they can only access their own store
    if (user.role !== 'admin' && shop) {
      const userStores = user.stores || [];
      const normalizedShop = shop.replace('.myshopify.com', '');
      const hasAccess = userStores.some(store => {
        const normalizedStore = String(store).replace('.myshopify.com', '');
        return normalizedStore === normalizedShop || store === shop;
      });
      
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied to this store' });
      }
    }
    
    // Get default store from config if no shop provided (admin only)
    const { getDefaultStore, formatStoreDomain } = await import('../config/stores.config.js');
    const defaultStore = user.role === 'admin' ? getDefaultStore() : null;
    const finalShop = shop || (defaultStore ? formatStoreDomain(defaultStore) : null);
    
    if (!finalShop && user.role !== 'admin') {
      return res.status(400).json({ 
        error: 'Store identifier required',
        message: 'Please provide a shop parameter'
      });
    }
    
    if (!finalShop) {
      return res.status(400).json({ 
        error: 'No store configured',
        message: 'Please provide a shop parameter or configure DEFAULT_STORE_ID'
      });
    }
    const limit = parseInt(req.query.limit) || 10;
    console.log(`🛒 Fetching ${limit} abandoned checkouts for shop: ${finalShop}`);
    
    const client = await createShopifyClient(finalShop);

    const checkoutsQuery = `
      query {
        abandonedCheckouts(first: ${limit}, reverse: true) {
          edges {
            node {
              id
              createdAt
              email
              phone
              totalPriceSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
              customer {
                id
                firstName
                lastName
                email
              }
              lineItems(first: 10) {
                edges {
                  node {
                    title
                    quantity
                    originalUnitPriceSet {
                      shopMoney {
                        amount
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    const response = await client.query({ data: checkoutsQuery });
    const checkouts = response.body.data.abandonedCheckouts.edges.map(edge => ({
      id: edge.node.id,
      email: edge.node.email || '',
      phone: edge.node.phone || '',
      created_at: edge.node.createdAt,
      total_price: edge.node.totalPriceSet?.shopMoney?.amount || '0',
      currency: edge.node.totalPriceSet?.shopMoney?.currencyCode || 'USD',
      customer: edge.node.customer ? {
        id: edge.node.customer.id,
        first_name: edge.node.customer.firstName || '',
        last_name: edge.node.customer.lastName || '',
        email: edge.node.customer.email || ''
      } : null,
      line_items: edge.node.lineItems.edges.map(li => ({
        title: li.node.title,
        quantity: li.node.quantity,
        price: li.node.originalUnitPriceSet?.shopMoney?.amount || '0'
      }))
    }));

    res.json({ 
      checkouts,
      lastSynced: Date.now(),
      cached: false
    });

  } catch (error) {
    console.error('❌ Checkouts error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch checkouts',
      message: error.message,
      checkouts: []
    });
  }
});

export default router;

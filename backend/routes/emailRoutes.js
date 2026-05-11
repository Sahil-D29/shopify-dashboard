// backend/routes/emailRoutes.js
import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  loadTemplates, getTemplateById, getTemplatesByStore, getTemplatesByCategory,
  createTemplate, updateTemplate, deleteTemplate, cloneTemplate, seedDefaultTemplates,
} from '../services/emailTemplateService.js';
import {
  getSubscribersByStore, addSubscriber, unsubscribe, getSubscriberByEmail,
  syncFromShopifyCustomers, loadSuppression, removeFromSuppression,
} from '../services/emailSubscriberService.js';
import {
  getCampaignMetrics, getStoreAnalytics,
} from '../services/emailAnalyticsService.js';
import {
  getDomainsByStore, addDomain, verifyDomain, removeDomain, getDomainById,
} from '../services/domainService.js';
import { sendTestEmail } from '../services/emailService.js';
import { compileMjml, personalizeMergeTags } from '../utils/emailRenderer.js';
import * as abTestService from '../services/abTestService.js';
import { verifyToken, TRACKING_PIXEL_GIF } from '../utils/trackingPixel.js';
import { trackOpen, trackClick, trackUnsubscribe } from '../services/emailAnalyticsService.js';
import { unsubscribe as unsubscribeEmail } from '../services/emailSubscriberService.js';
import { getPreviewPath } from '../utils/templatePreview.js';
import { generateTemplatePreview, generateMobilePreview } from '../utils/templatePreview.js';
import { createShopifyClient } from '../config/shopify.js';
import { createDiscountCode, generateCodes } from '../services/discountService.js';
import * as backInStockService from '../services/backInStockService.js';
import * as crossSellService from '../services/crossSellService.js';
import path from 'path';
import fs from 'fs/promises';

const router = express.Router();

// --- Templates ---

router.get('/templates', authenticate, async (req, res) => {
  try {
    await seedDefaultTemplates();
    const storeId = req.query.storeId || req.user.storeId;
    const category = req.query.category;

    let templates;
    if (category) {
      templates = await getTemplatesByCategory(category, storeId);
    } else {
      templates = await getTemplatesByStore(storeId);
    }

    res.json({ templates });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/templates/:id', authenticate, async (req, res) => {
  try {
    const template = await getTemplateById(req.params.id);
    if (!template) return res.status(404).json({ error: 'Template not found' });
    res.json({ template });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/templates', authenticate, async (req, res) => {
  try {
    const template = await createTemplate(req.body, req.user.id);
    res.status(201).json({ template });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/templates/:id', authenticate, async (req, res) => {
  try {
    const template = await updateTemplate(req.params.id, req.body, req.user.id);
    res.json({ template });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/templates/:id', authenticate, async (req, res) => {
  try {
    await deleteTemplate(req.params.id, req.user.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/templates/:id/clone', authenticate, async (req, res) => {
  try {
    const { name, storeId } = req.body;
    const template = await cloneTemplate(req.params.id, name, storeId || req.user.storeId, req.user.id);
    res.status(201).json({ template });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/templates/:id/preview', authenticate, async (req, res) => {
  try {
    const template = await getTemplateById(req.params.id);
    if (!template) return res.status(404).json({ error: 'Template not found' });

    const preview = await generateTemplatePreview(template.id, template.htmlBody);
    const mobilePreview = await generateMobilePreview(template.id, template.htmlBody);

    res.json({
      desktop: preview?.url || null,
      mobile: mobilePreview?.url || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/templates/preview/:templateId', async (req, res) => {
  try {
    const filePath = await getPreviewPath(req.params.templateId, false);
    if (!filePath) return res.status(404).json({ error: 'Preview not found' });
    res.sendFile(filePath);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/templates/preview/:templateId/mobile', async (req, res) => {
  try {
    const filePath = await getPreviewPath(req.params.templateId, true);
    if (!filePath) return res.status(404).json({ error: 'Preview not found' });
    res.sendFile(filePath);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- MJML Compilation ---

router.post('/compile-mjml', authenticate, async (req, res) => {
  try {
    const { mjml } = req.body;
    if (!mjml) return res.status(400).json({ error: 'MJML content required' });
    const html = compileMjml(mjml);
    res.json({ html });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Subscribers ---

router.get('/subscribers', authenticate, async (req, res) => {
  try {
    const storeId = req.query.storeId || req.user.storeId;
    const { status, page, limit } = req.query;
    const result = await getSubscribersByStore(storeId, {
      status,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 50,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/subscribers', authenticate, async (req, res) => {
  try {
    const subscriber = await addSubscriber(req.body);
    res.status(201).json({ subscriber });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/subscribers/sync', authenticate, async (req, res) => {
  try {
    const storeId = req.body.storeId || req.user.storeId;
    const client = await createShopifyClient(storeId);
    const query = `
      query {
        customers(first: 250) {
          edges {
            node { id firstName lastName email phone }
          }
        }
      }
    `;
    const response = await client.query({ data: query });
    const customers = response.body.data.customers.edges.map(e => e.node);

    const result = await syncFromShopifyCustomers(customers, storeId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/suppression', authenticate, async (req, res) => {
  try {
    const storeId = req.query.storeId || req.user.storeId;
    const entries = await loadSuppression(storeId);
    res.json({ entries });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/suppression/:email', authenticate, async (req, res) => {
  try {
    const storeId = req.query.storeId || req.user.storeId;
    await removeFromSuppression(req.params.email, storeId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Analytics ---

router.get('/analytics/campaign/:campaignId', authenticate, async (req, res) => {
  try {
    const metrics = await getCampaignMetrics(req.params.campaignId);
    res.json({ metrics });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/analytics/overview', authenticate, async (req, res) => {
  try {
    const storeId = req.query.storeId || req.user.storeId;
    const { startDate, endDate } = req.query;
    const analytics = await getStoreAnalytics(storeId, { startDate, endDate });
    res.json({ analytics });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Domains ---

router.get('/domains', authenticate, async (req, res) => {
  try {
    const storeId = req.query.storeId || req.user.storeId;
    const domains = await getDomainsByStore(storeId);
    res.json({ domains });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/domains', authenticate, async (req, res) => {
  try {
    const { domain, storeId } = req.body;
    if (!domain) return res.status(400).json({ error: 'Domain is required' });
    const entry = await addDomain(domain, storeId || req.user.storeId, req.user.id);
    res.status(201).json({ domain: entry });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/domains/:id/verify', authenticate, async (req, res) => {
  try {
    const result = await verifyDomain(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/domains/:id', authenticate, async (req, res) => {
  try {
    await removeDomain(req.params.id, req.user.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Test Send ---

router.post('/test-send', authenticate, async (req, res) => {
  try {
    const { to, subject, htmlBody, fromName, fromEmail } = req.body;
    if (!to || !subject || !htmlBody) {
      return res.status(400).json({ error: 'to, subject, and htmlBody are required' });
    }
    const result = await sendTestEmail({ to, subject, htmlBody, fromName, fromEmail });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Tracking Endpoints (public, no auth) ---

router.get('/track/open/:token', async (req, res) => {
  try {
    const data = verifyToken(req.params.token);
    if (data && data.t === 'open') {
      trackOpen(data.c, data.e).catch(() => {});
    }
  } catch {
    // silent fail for tracking
  }
  res.set('Content-Type', 'image/gif');
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.send(TRACKING_PIXEL_GIF);
});

router.get('/track/click/:token', async (req, res) => {
  try {
    const data = verifyToken(req.params.token);
    if (data && data.t === 'click') {
      trackClick(data.c, data.e, data.u, data.i).catch(() => {});
      return res.redirect(302, data.u);
    }
  } catch {
    // silent fail
  }
  res.redirect(302, '/');
});

// --- Unsubscribe (public, no auth) ---

router.get('/unsubscribe/:token', async (req, res) => {
  try {
    const data = verifyToken(req.params.token);
    if (data && data.t === 'unsub') {
      await unsubscribeEmail(data.e, data.s);
      trackUnsubscribe(null, data.e).catch(() => {});

      res.send(`
        <!DOCTYPE html>
        <html><head><title>Unsubscribed</title>
        <style>body{font-family:Arial,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#f4f4f4;}
        .card{background:#fff;padding:40px;border-radius:12px;text-align:center;max-width:400px;box-shadow:0 2px 10px rgba(0,0,0,0.1);}
        h1{color:#1a1a2e;margin-bottom:12px;} p{color:#666;}</style></head>
        <body><div class="card">
          <h1>You've been unsubscribed</h1>
          <p>You will no longer receive marketing emails from us.</p>
          <p style="font-size:14px;color:#999;margin-top:20px;">If this was a mistake, you can re-subscribe from your account settings.</p>
        </div></body></html>
      `);
    } else {
      res.status(400).send('Invalid unsubscribe link');
    }
  } catch (err) {
    res.status(500).send('Something went wrong');
  }
});

// --- A/B Tests ---

router.get('/ab-tests', authenticate, async (req, res) => {
  try {
    const storeId = req.query.storeId || req.user.storeId;
    const tests = await abTestService.getTestsByStore(storeId);
    res.json({ tests });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/ab-tests/:id', authenticate, async (req, res) => {
  try {
    const test = await abTestService.getTestById(req.params.id);
    if (!test) return res.status(404).json({ error: 'Test not found' });
    res.json({ test });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/ab-tests', authenticate, async (req, res) => {
  try {
    const test = await abTestService.createTest(req.body);
    res.status(201).json({ test });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/ab-tests/:id/start', authenticate, async (req, res) => {
  try {
    const test = await abTestService.startTest(req.params.id);
    res.json({ test });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/ab-tests/:id/select-winner', authenticate, async (req, res) => {
  try {
    const { variantId } = req.body;
    const test = await abTestService.selectWinner(req.params.id, variantId);
    res.json({ test });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/ab-tests/:id', authenticate, async (req, res) => {
  try {
    await abTestService.deleteTest(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Shopify Products (for Product Picker) ---

router.get('/shopify/products', authenticate, async (req, res) => {
  try {
    const storeId = req.query.storeId || req.user.storeId || 'tsg-api.myshopify.com';
    const search = req.query.search || '';
    const limit = parseInt(req.query.limit) || 20;
    const client = await createShopifyClient(storeId);

    const query = `
      query searchProducts($query: String, $first: Int!) {
        products(first: $first, query: $query) {
          edges {
            node {
              id title handle description
              featuredImage { url altText }
              images(first: 3) { edges { node { url altText } } }
              variants(first: 5) {
                edges { node { id title price compareAtPrice inventoryQuantity } }
              }
              priceRange { minVariantPrice { amount currencyCode } maxVariantPrice { amount currencyCode } }
            }
          }
        }
      }
    `;

    const response = await client.query({
      data: { query, variables: { query: search || '', first: limit } },
    });

    const products = response.body.data.products.edges.map((e) => ({
      id: e.node.id,
      title: e.node.title,
      handle: e.node.handle,
      description: e.node.description,
      image: e.node.featuredImage?.url || null,
      images: e.node.images.edges.map((img) => img.node.url),
      variants: e.node.variants.edges.map((v) => ({
        id: v.node.id,
        title: v.node.title,
        price: v.node.price,
        compareAtPrice: v.node.compareAtPrice,
        inventory: v.node.inventoryQuantity,
      })),
      price: e.node.priceRange.minVariantPrice.amount,
      currency: e.node.priceRange.minVariantPrice.currencyCode,
    }));

    res.json({ products });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/shopify/collections', authenticate, async (req, res) => {
  try {
    const storeId = req.query.storeId || req.user.storeId || 'tsg-api.myshopify.com';
    const client = await createShopifyClient(storeId);

    const query = `
      query {
        collections(first: 50) {
          edges {
            node {
              id title handle
              image { url }
              productsCount { count }
            }
          }
        }
      }
    `;

    const response = await client.query({ data: query });
    const collections = response.body.data.collections.edges.map((e) => ({
      id: e.node.id,
      title: e.node.title,
      handle: e.node.handle,
      image: e.node.image?.url || null,
      productCount: e.node.productsCount?.count || 0,
    }));

    res.json({ collections });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Discount Codes ---

router.post('/discounts/generate', authenticate, async (req, res) => {
  try {
    const result = await createDiscountCode(req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/discounts/codes-only', authenticate, async (req, res) => {
  try {
    const { count, prefix } = req.body;
    const codes = generateCodes(count || 1, prefix || '');
    res.json({ codes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Back-in-Stock Alerts ---

router.get('/back-in-stock/waitlist', authenticate, async (req, res) => {
  try {
    const storeId = req.query.storeId || req.user.storeId || 'tsg-api.myshopify.com';
    const entries = await backInStockService.getWaitlistByStore(storeId);
    res.json({ entries });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/back-in-stock/waitlist', authenticate, async (req, res) => {
  try {
    const result = await backInStockService.addToWaitlist(req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/back-in-stock/waitlist/:id', authenticate, async (req, res) => {
  try {
    await backInStockService.removeFromWaitlist(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/back-in-stock/check', authenticate, async (req, res) => {
  try {
    const storeId = req.body.storeId || req.user.storeId || 'tsg-api.myshopify.com';
    const result = await backInStockService.checkAndNotify(storeId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/back-in-stock/history', authenticate, async (req, res) => {
  try {
    const storeId = req.query.storeId || req.user.storeId || 'tsg-api.myshopify.com';
    const history = await backInStockService.getAlertHistory(storeId);
    res.json({ history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Cross-Sell Rules ---

router.get('/cross-sell/rules', authenticate, async (req, res) => {
  try {
    const storeId = req.query.storeId || req.user.storeId || 'tsg-api.myshopify.com';
    const rules = await crossSellService.getRulesByStore(storeId);
    res.json({ rules });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/cross-sell/rules', authenticate, async (req, res) => {
  try {
    const rule = await crossSellService.createRule(req.body);
    res.status(201).json({ rule });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/cross-sell/rules/:id', authenticate, async (req, res) => {
  try {
    const rule = await crossSellService.updateRule(req.params.id, req.body);
    res.json({ rule });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/cross-sell/rules/:id', authenticate, async (req, res) => {
  try {
    await crossSellService.deleteRule(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/cross-sell/recommendations', authenticate, async (req, res) => {
  try {
    const { lineItems, storeId } = req.body;
    const recommendations = await crossSellService.getRecommendationsForOrder(
      lineItems, storeId || req.user.storeId || 'tsg-api.myshopify.com'
    );
    res.json({ recommendations });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Merge Tags Reference ---

router.get('/merge-tags', authenticate, async (req, res) => {
  res.json({
    tags: [
      { tag: '{{first_name}}', description: 'Customer first name' },
      { tag: '{{last_name}}', description: 'Customer last name' },
      { tag: '{{full_name}}', description: 'Customer full name' },
      { tag: '{{email}}', description: 'Customer email' },
      { tag: '{{phone}}', description: 'Customer phone' },
      { tag: '{{shop_name}}', description: 'Store name' },
      { tag: '{{shop_url}}', description: 'Store URL' },
      { tag: '{{order_number}}', description: 'Order number' },
      { tag: '{{order_total}}', description: 'Order total' },
      { tag: '{{tracking_url}}', description: 'Shipment tracking URL' },
      { tag: '{{product_title}}', description: 'Product title' },
      { tag: '{{product_price}}', description: 'Product price' },
      { tag: '{{product_url}}', description: 'Product page URL' },
      { tag: '{{product_image}}', description: 'Product image URL' },
      { tag: '{{discount_code}}', description: 'Discount code' },
      { tag: '{{discount_amount}}', description: 'Discount amount' },
      { tag: '{{unsubscribe_url}}', description: 'Unsubscribe link' },
      { tag: '{{current_date}}', description: 'Current date' },
      { tag: '{{current_year}}', description: 'Current year' },
    ],
  });
});

export default router;

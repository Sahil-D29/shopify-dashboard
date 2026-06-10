// backend/services/emailTemplateService.js
import path from 'path';
import { readFileSafe, writeFileSafe } from '../utils/safeFileStore.js';
import { v4 as uuidv4 } from 'uuid';
import { logActivity } from '../utils/logger.js';

const templatesFile = path.join(process.cwd(), 'backend', 'data', 'email-templates.json');

export async function loadTemplates() {
  const data = await readFileSafe(templatesFile, { default: { templates: [] } });
  return data.templates || [];
}

async function saveTemplates(templates) {
  await writeFileSafe(templatesFile, { templates });
}

export async function getTemplateById(id) {
  const templates = await loadTemplates();
  return templates.find(t => t.id === id);
}

export async function getTemplatesByStore(storeId) {
  const templates = await loadTemplates();
  return templates.filter(t => t.storeId === storeId || t.isGlobal);
}

export async function getTemplatesByCategory(category, storeId) {
  const templates = await loadTemplates();
  return templates.filter(t => t.category === category && (t.storeId === storeId || t.isGlobal));
}

export async function createTemplate(payload, actorId) {
  const templates = await loadTemplates();
  const template = {
    id: `tmpl_${uuidv4()}`,
    name: payload.name,
    description: payload.description || '',
    category: payload.category || 'custom',
    subject: payload.subject || '',
    preheaderText: payload.preheaderText || '',
    htmlBody: payload.htmlBody || '',
    mjmlBody: payload.mjmlBody || '',
    jsonDesign: payload.jsonDesign || null,
    thumbnailUrl: payload.thumbnailUrl || null,
    storeId: payload.storeId,
    isGlobal: payload.isGlobal || false,
    tags: payload.tags || [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: actorId,
  };

  templates.push(template);
  await saveTemplates(templates);

  await logActivity({
    type: 'email_template_created',
    actorId,
    storeId: payload.storeId,
    templateId: template.id,
    templateName: template.name,
  });

  return template;
}

export async function updateTemplate(id, patch, actorId) {
  const templates = await loadTemplates();
  const idx = templates.findIndex(t => t.id === id);
  if (idx === -1) throw new Error('Template not found');

  templates[idx] = {
    ...templates[idx],
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  await saveTemplates(templates);

  await logActivity({
    type: 'email_template_updated',
    actorId,
    storeId: templates[idx].storeId,
    templateId: id,
  });

  return templates[idx];
}

export async function deleteTemplate(id, actorId) {
  const templates = await loadTemplates();
  const template = templates.find(t => t.id === id);
  if (!template) throw new Error('Template not found');
  if (template.isGlobal) throw new Error('Cannot delete global templates');

  const filtered = templates.filter(t => t.id !== id);
  await saveTemplates(filtered);

  await logActivity({
    type: 'email_template_deleted',
    actorId,
    templateId: id,
  });

  return true;
}

export async function cloneTemplate(id, newName, storeId, actorId) {
  const template = await getTemplateById(id);
  if (!template) throw new Error('Template not found');

  return createTemplate({
    ...template,
    id: undefined,
    name: newName || `${template.name} (Copy)`,
    storeId,
    isGlobal: false,
    createdAt: undefined,
    updatedAt: undefined,
    createdBy: undefined,
  }, actorId);
}

export async function seedDefaultTemplates() {
  const templates = await loadTemplates();
  const globalTemplates = templates.filter(t => t.isGlobal);
  if (globalTemplates.length >= 10) return;

  const defaults = getBuiltInTemplates();
  for (const tmpl of defaults) {
    const exists = templates.find(t => t.name === tmpl.name && t.isGlobal);
    if (!exists) {
      templates.push({
        id: `tmpl_${uuidv4()}`,
        ...tmpl,
        isGlobal: true,
        storeId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'system',
      });
    }
  }
  await saveTemplates(templates);
}

function getBuiltInTemplates() {
  return [
    {
      name: 'Welcome Email',
      description: 'Welcome new subscribers to your store',
      category: 'welcome',
      subject: 'Welcome to {{shop_name}}! 🎉',
      preheaderText: 'Thanks for joining us',
      tags: ['welcome', 'onboarding'],
      htmlBody: buildWelcomeTemplate(),
    },
    {
      name: 'Abandoned Cart Recovery',
      description: 'Remind customers about items left in their cart',
      category: 'abandoned_cart',
      subject: '{{first_name}}, you left something behind!',
      preheaderText: 'Complete your purchase today',
      tags: ['abandoned-cart', 'recovery'],
      htmlBody: buildAbandonedCartTemplate(),
    },
    {
      name: 'Order Confirmation',
      description: 'Confirm customer orders with details',
      category: 'transactional',
      subject: 'Order #{{order_number}} confirmed!',
      preheaderText: 'Your order is being processed',
      tags: ['order', 'transactional'],
      htmlBody: buildOrderConfirmationTemplate(),
    },
    {
      name: 'Shipping Update',
      description: 'Notify customers their order has shipped',
      category: 'transactional',
      subject: 'Your order is on its way! 📦',
      preheaderText: 'Track your package',
      tags: ['shipping', 'transactional'],
      htmlBody: buildShippingTemplate(),
    },
    {
      name: 'Promotional Sale',
      description: 'Announce sales and special offers',
      category: 'promotional',
      subject: '🔥 Sale Alert: {{discount_amount}} OFF Everything!',
      preheaderText: 'Limited time offer',
      tags: ['sale', 'promotional', 'discount'],
      htmlBody: buildPromotionalTemplate(),
    },
    {
      name: 'Win-Back',
      description: 'Re-engage inactive customers',
      category: 'winback',
      subject: 'We miss you, {{first_name}}!',
      preheaderText: 'Come back and save',
      tags: ['winback', 're-engagement'],
      htmlBody: buildWinBackTemplate(),
    },
    {
      name: 'Back in Stock',
      description: 'Notify customers when a product is available again',
      category: 'notification',
      subject: '{{product_title}} is back in stock!',
      preheaderText: 'Grab it before it sells out again',
      tags: ['back-in-stock', 'notification'],
      htmlBody: buildBackInStockTemplate(),
    },
    {
      name: 'Review Request',
      description: 'Ask customers to review their purchase',
      category: 'post_purchase',
      subject: 'How was your order, {{first_name}}?',
      preheaderText: 'Share your experience',
      tags: ['review', 'post-purchase'],
      htmlBody: buildReviewRequestTemplate(),
    },
    {
      name: 'Cross-Sell / Upsell',
      description: 'Recommend related products after purchase',
      category: 'post_purchase',
      subject: 'You might also love these, {{first_name}}',
      preheaderText: 'Curated picks just for you',
      tags: ['cross-sell', 'upsell', 'recommendations'],
      htmlBody: buildCrossSellTemplate(),
    },
    {
      name: 'Newsletter',
      description: 'Regular newsletter template',
      category: 'newsletter',
      subject: '{{shop_name}} Newsletter - {{current_date}}',
      preheaderText: "What's new this week",
      tags: ['newsletter', 'updates'],
      htmlBody: buildNewsletterTemplate(),
    },
    {
      name: 'Thank You',
      description: 'Thank customers for their loyalty',
      category: 'post_purchase',
      subject: 'Thank you for your purchase, {{first_name}}!',
      preheaderText: 'We appreciate your support',
      tags: ['thank-you', 'post-purchase'],
      htmlBody: buildThankYouTemplate(),
    },
  ];
}

function baseEmailWrapper(content, preheaderText = '') {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Email</title>
<style>
  body { margin: 0; padding: 0; background-color: #f4f4f4; font-family: Arial, Helvetica, sans-serif; }
  .email-container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
  .header { background-color: #1a1a2e; color: #ffffff; padding: 30px 40px; text-align: center; }
  .header h1 { margin: 0; font-size: 24px; font-weight: 700; }
  .body { padding: 40px; }
  .body h2 { color: #1a1a2e; font-size: 20px; margin-top: 0; }
  .body p { color: #555555; font-size: 16px; line-height: 1.6; }
  .cta-button { display: inline-block; background-color: #e94560; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600; margin: 20px 0; }
  .product-card { border: 1px solid #eee; border-radius: 8px; padding: 16px; margin: 12px 0; text-align: center; }
  .product-card img { max-width: 200px; border-radius: 4px; }
  .product-card h3 { color: #1a1a2e; margin: 10px 0 4px; }
  .product-card .price { color: #e94560; font-size: 18px; font-weight: 700; }
  .footer { background-color: #f8f8f8; padding: 20px 40px; text-align: center; font-size: 12px; color: #999999; }
  .footer a { color: #999999; text-decoration: underline; }
  .divider { border: 0; border-top: 1px solid #eee; margin: 24px 0; }
  @media only screen and (max-width: 600px) {
    .body { padding: 20px; }
    .header { padding: 20px; }
    .footer { padding: 16px 20px; }
  }
</style>
</head>
<body>
${preheaderText ? `<div style="display:none;max-height:0;overflow:hidden;">${preheaderText}</div>` : ''}
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;padding:20px 0;">
<tr><td align="center">
<div class="email-container">
${content}
<div class="footer">
  <p>{{shop_name}}</p>
  <p><a href="{{unsubscribe_url}}">Unsubscribe</a></p>
  <p>&copy; {{current_year}} {{shop_name}}. All rights reserved.</p>
</div>
</div>
</td></tr>
</table>
</body>
</html>`;
}

function buildWelcomeTemplate() {
  return baseEmailWrapper(`
<div class="header"><h1>Welcome to {{shop_name}}!</h1></div>
<div class="body">
  <h2>Hi {{first_name}},</h2>
  <p>We're thrilled to have you join our community. As a thank you for signing up, here's a special offer just for you.</p>
  <p style="text-align:center;">
    <a href="{{shop_url}}" class="cta-button">Start Shopping</a>
  </p>
  <hr class="divider">
  <p style="font-size:14px;color:#777;">If you have any questions, just reply to this email — we're always happy to help.</p>
</div>`, 'Thanks for joining us');
}

function buildAbandonedCartTemplate() {
  return baseEmailWrapper(`
<div class="header"><h1>Forgot something?</h1></div>
<div class="body">
  <h2>Hi {{first_name}},</h2>
  <p>Looks like you left some items in your cart. Don't worry — they're still waiting for you!</p>
  <p style="text-align:center;">
    <a href="{{shop_url}}/cart" class="cta-button">Complete Your Order</a>
  </p>
  <hr class="divider">
  <p style="font-size:14px;color:#777;">This offer won't last forever. Complete your purchase today!</p>
</div>`, 'Complete your purchase today');
}

function buildOrderConfirmationTemplate() {
  return baseEmailWrapper(`
<div class="header"><h1>Order Confirmed! ✅</h1></div>
<div class="body">
  <h2>Thank you, {{first_name}}!</h2>
  <p>Your order <strong>#{{order_number}}</strong> has been confirmed and is being processed.</p>
  <table width="100%" style="border:1px solid #eee;border-radius:8px;padding:16px;margin:16px 0;">
    <tr><td style="padding:8px;color:#555;">Order Number:</td><td style="padding:8px;font-weight:700;">#{{order_number}}</td></tr>
    <tr><td style="padding:8px;color:#555;">Total:</td><td style="padding:8px;font-weight:700;">{{order_total}}</td></tr>
  </table>
  <p style="text-align:center;">
    <a href="{{shop_url}}/account/orders" class="cta-button">View Order</a>
  </p>
</div>`, 'Your order is being processed');
}

function buildShippingTemplate() {
  return baseEmailWrapper(`
<div class="header"><h1>Your Order Has Shipped! 📦</h1></div>
<div class="body">
  <h2>Great news, {{first_name}}!</h2>
  <p>Your order <strong>#{{order_number}}</strong> is on its way to you.</p>
  <p style="text-align:center;">
    <a href="{{tracking_url}}" class="cta-button">Track Your Package</a>
  </p>
  <p style="font-size:14px;color:#777;">You'll receive an update when your package is delivered.</p>
</div>`, 'Track your package');
}

function buildPromotionalTemplate() {
  return baseEmailWrapper(`
<div class="header"><h1>🔥 {{discount_amount}} OFF Everything!</h1></div>
<div class="body">
  <h2>Hey {{first_name}},</h2>
  <p>For a limited time, enjoy <strong>{{discount_amount}} off</strong> your entire order. Use code:</p>
  <div style="text-align:center;background:#f8f8f8;padding:16px;border-radius:8px;margin:20px 0;">
    <span style="font-size:24px;font-weight:700;color:#e94560;letter-spacing:2px;">{{discount_code}}</span>
  </div>
  <p style="text-align:center;">
    <a href="{{shop_url}}" class="cta-button">Shop Now</a>
  </p>
  <p style="font-size:14px;color:#777;">Hurry — this offer won't last long!</p>
</div>`, 'Limited time offer');
}

function buildWinBackTemplate() {
  return baseEmailWrapper(`
<div class="header"><h1>We Miss You! 💛</h1></div>
<div class="body">
  <h2>Hi {{first_name}},</h2>
  <p>It's been a while since we've seen you. We have some exciting new arrivals that we think you'll love.</p>
  <p>As a welcome back gift, use this special code for <strong>{{discount_amount}} off</strong>:</p>
  <div style="text-align:center;background:#f8f8f8;padding:16px;border-radius:8px;margin:20px 0;">
    <span style="font-size:24px;font-weight:700;color:#e94560;letter-spacing:2px;">{{discount_code}}</span>
  </div>
  <p style="text-align:center;">
    <a href="{{shop_url}}" class="cta-button">Come Back & Save</a>
  </p>
</div>`, 'Come back and save');
}

function buildBackInStockTemplate() {
  return baseEmailWrapper(`
<div class="header"><h1>It's Back! 🎉</h1></div>
<div class="body">
  <h2>Hi {{first_name}},</h2>
  <p>Great news — <strong>{{product_title}}</strong> is back in stock!</p>
  <div class="product-card">
    <img src="{{product_image}}" alt="{{product_title}}">
    <h3>{{product_title}}</h3>
    <p class="price">{{product_price}}</p>
  </div>
  <p style="text-align:center;">
    <a href="{{product_url}}" class="cta-button">Grab It Now</a>
  </p>
  <p style="font-size:14px;color:#777;">Hurry — grab it before it sells out again!</p>
</div>`, 'Grab it before it sells out again');
}

function buildReviewRequestTemplate() {
  return baseEmailWrapper(`
<div class="header"><h1>How Was Your Order?</h1></div>
<div class="body">
  <h2>Hi {{first_name}},</h2>
  <p>We hope you're loving your recent purchase! Your feedback helps us improve and helps other shoppers make informed decisions.</p>
  <p>Would you mind taking a moment to leave a review?</p>
  <p style="text-align:center;">
    <a href="{{product_url}}#reviews" class="cta-button">Write a Review</a>
  </p>
  <p style="font-size:14px;color:#777;">Thank you for shopping with us!</p>
</div>`, 'Share your experience');
}

function buildCrossSellTemplate() {
  return baseEmailWrapper(`
<div class="header"><h1>You Might Also Love</h1></div>
<div class="body">
  <h2>Hi {{first_name}},</h2>
  <p>Based on your recent purchase, we handpicked these items just for you.</p>
  <div class="product-card">
    <img src="{{product_image}}" alt="{{product_title}}">
    <h3>{{product_title}}</h3>
    <p class="price">{{product_price}}</p>
    <a href="{{product_url}}" class="cta-button" style="padding:10px 24px;font-size:14px;">View Product</a>
  </div>
  <p style="text-align:center;margin-top:24px;">
    <a href="{{shop_url}}" class="cta-button">Browse All Products</a>
  </p>
</div>`, 'Curated picks just for you');
}

function buildNewsletterTemplate() {
  return baseEmailWrapper(`
<div class="header"><h1>{{shop_name}} Newsletter</h1></div>
<div class="body">
  <h2>Hi {{first_name}},</h2>
  <p>Here's what's new this week at {{shop_name}}.</p>
  <hr class="divider">
  <h3>Featured Product</h3>
  <div class="product-card">
    <img src="{{product_image}}" alt="{{product_title}}">
    <h3>{{product_title}}</h3>
    <p class="price">{{product_price}}</p>
  </div>
  <hr class="divider">
  <p>Stay tuned for more updates and exclusive offers!</p>
  <p style="text-align:center;">
    <a href="{{shop_url}}" class="cta-button">Visit Our Store</a>
  </p>
</div>`, "What's new this week");
}

function buildThankYouTemplate() {
  return baseEmailWrapper(`
<div class="header"><h1>Thank You! 🙏</h1></div>
<div class="body">
  <h2>Hi {{first_name}},</h2>
  <p>Thank you for your recent purchase from {{shop_name}}. Your support means the world to us!</p>
  <p>We're committed to delivering the best experience possible. If there's anything we can do to make your experience even better, don't hesitate to reach out.</p>
  <p style="text-align:center;">
    <a href="{{shop_url}}" class="cta-button">Shop Again</a>
  </p>
</div>`, 'We appreciate your support');
}

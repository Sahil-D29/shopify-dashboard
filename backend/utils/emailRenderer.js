// backend/utils/emailRenderer.js
import mjml2html from 'mjml';
import { generatePixelUrl, generateClickTrackingUrl, generateUnsubscribeUrl } from './trackingPixel.js';
import { EMAIL_CONFIG } from '../config/email.config.js';

export function compileMjml(mjmlContent) {
  const result = mjml2html(mjmlContent, { validationLevel: 'soft' });
  if (result.errors && result.errors.length > 0) {
    console.warn('MJML compilation warnings:', result.errors.map(e => e.message));
  }
  return result.html;
}

export function personalizeMergeTags(content, customer, extraData = {}) {
  if (!content) return content;

  let result = content;

  // Customer merge tags
  result = result.replace(/\{\{first_name\}\}/gi, customer?.firstName || 'Customer');
  result = result.replace(/\{\{last_name\}\}/gi, customer?.lastName || '');
  result = result.replace(/\{\{full_name\}\}/gi, customer?.displayName || customer?.firstName || 'Customer');
  result = result.replace(/\{\{email\}\}/gi, customer?.email || '');
  result = result.replace(/\{\{phone\}\}/gi, customer?.phone || '');

  // Legacy merge tags (WhatsApp compatibility)
  result = result.replace(/\{\{1\}\}/g, customer?.displayName || customer?.firstName || 'Customer');
  result = result.replace(/\{\{2\}\}/g, customer?.firstName || '');
  result = result.replace(/\{\{3\}\}/g, customer?.lastName || '');

  // Store / shop merge tags
  result = result.replace(/\{\{shop_name\}\}/gi, extraData.shopName || '');
  result = result.replace(/\{\{shop_url\}\}/gi, extraData.shopUrl || '');

  // Order merge tags
  result = result.replace(/\{\{order_number\}\}/gi, extraData.orderNumber || '');
  result = result.replace(/\{\{order_total\}\}/gi, extraData.orderTotal || '');
  result = result.replace(/\{\{tracking_url\}\}/gi, extraData.trackingUrl || '');

  // Product merge tags
  result = result.replace(/\{\{product_title\}\}/gi, extraData.productTitle || '');
  result = result.replace(/\{\{product_price\}\}/gi, extraData.productPrice || '');
  result = result.replace(/\{\{product_url\}\}/gi, extraData.productUrl || '');
  result = result.replace(/\{\{product_image\}\}/gi, extraData.productImage || '');

  // Discount merge tags
  result = result.replace(/\{\{discount_code\}\}/gi, extraData.discountCode || '');
  result = result.replace(/\{\{discount_amount\}\}/gi, extraData.discountAmount || '');

  // Date merge tags
  result = result.replace(/\{\{current_date\}\}/gi, new Date().toLocaleDateString());
  result = result.replace(/\{\{current_year\}\}/gi, String(new Date().getFullYear()));

  // Unsubscribe URL
  if (extraData.unsubscribeUrl) {
    result = result.replace(/\{\{unsubscribe_url\}\}/gi, extraData.unsubscribeUrl);
  }

  return result;
}

export function injectTrackingPixel(html, campaignId, subscriberEmail) {
  const baseUrl = EMAIL_CONFIG.tracking.baseUrl;
  const pixelUrl = generatePixelUrl(baseUrl, campaignId, subscriberEmail);
  const pixelTag = `<img src="${pixelUrl}" width="1" height="1" alt="" style="display:none;border:0;" />`;

  if (html.includes('</body>')) {
    return html.replace('</body>', `${pixelTag}</body>`);
  }
  return html + pixelTag;
}

export function wrapLinksForTracking(html, campaignId, subscriberEmail) {
  const baseUrl = EMAIL_CONFIG.tracking.baseUrl;
  let linkIndex = 0;

  return html.replace(/<a\s([^>]*?)href=["']([^"']+)["']([^>]*?)>/gi, (match, pre, url, post) => {
    // Don't wrap unsubscribe links, mailto, tel, or tracking links
    if (
      url.includes('/api/email/') ||
      url.startsWith('mailto:') ||
      url.startsWith('tel:') ||
      url.startsWith('#')
    ) {
      return match;
    }

    const trackingUrl = generateClickTrackingUrl(baseUrl, campaignId, subscriberEmail, url, linkIndex++);
    return `<a ${pre}href="${trackingUrl}"${post}>`;
  });
}

export function injectUnsubscribeFooter(html, unsubscribeUrl, companyName, physicalAddress) {
  const footer = `
    <div style="text-align:center;padding:20px 0;font-size:12px;color:#999;font-family:Arial,sans-serif;">
      <p>${companyName || EMAIL_CONFIG.compliance.companyName || ''}</p>
      <p>${physicalAddress || EMAIL_CONFIG.compliance.physicalAddress || ''}</p>
      <p><a href="${unsubscribeUrl}" style="color:#999;text-decoration:underline;">Unsubscribe</a> from these emails</p>
    </div>
  `;

  if (html.includes('</body>')) {
    return html.replace('</body>', `${footer}</body>`);
  }
  return html + footer;
}

export function renderEmailForRecipient({ htmlBody, campaignId, customer, storeId, extraData = {} }) {
  const baseUrl = EMAIL_CONFIG.tracking.baseUrl;
  const unsubscribeUrl = generateUnsubscribeUrl(baseUrl, customer.email, storeId);

  let rendered = personalizeMergeTags(htmlBody, customer, {
    ...extraData,
    unsubscribeUrl,
  });

  rendered = injectUnsubscribeFooter(
    rendered,
    unsubscribeUrl,
    extraData.companyName,
    extraData.physicalAddress
  );

  rendered = wrapLinksForTracking(rendered, campaignId, customer.email);
  rendered = injectTrackingPixel(rendered, campaignId, customer.email);

  return { html: rendered, unsubscribeUrl };
}

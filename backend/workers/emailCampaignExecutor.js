// backend/workers/emailCampaignExecutor.js
import { createShopifyClient } from '../config/shopify.js';
import { getSegmentById } from '../services/segmentsService.js';
import { updateCampaign, logCampaignExecution } from '../services/campaignsService.js';
import { getSubscribableEmails } from '../services/emailSubscriberService.js';
import { trackSent, trackDelivered } from '../services/emailAnalyticsService.js';
import { sendEmail } from '../services/emailService.js';
import { renderEmailForRecipient, personalizeMergeTags } from '../utils/emailRenderer.js';
import { generateUnsubscribeUrl } from '../utils/trackingPixel.js';
import { logActivity, logError } from '../utils/logger.js';
import { EMAIL_CONFIG } from '../config/email.config.js';

async function evaluateSegmentForEmail(segment, storeId) {
  const client = await createShopifyClient(storeId);
  const query = `
    query {
      customers(first: 250) {
        edges {
          node {
            id
            displayName
            firstName
            lastName
            email
            phone
            numberOfOrders
            amountSpent { amount currencyCode }
          }
        }
      }
    }
  `;

  const response = await client.query({ data: query });
  let customers = response.body.data.customers.edges.map(edge => ({
    id: edge.node.id,
    displayName: edge.node.displayName,
    firstName: edge.node.firstName,
    lastName: edge.node.lastName,
    email: edge.node.email,
    phone: edge.node.phone,
    numberOfOrders: edge.node.numberOfOrders || 0,
    totalSpent: parseFloat(edge.node.amountSpent?.amount || '0'),
  }));

  if (segment.conditionGroups && segment.conditionGroups.length > 0) {
    customers = customers.filter(customer => {
      return segment.conditionGroups.some(group => {
        const conditions = group.conditions || [];
        return conditions.every(condition => {
          let customerValue = '';
          if (condition.field === 'customer_email') customerValue = customer.email || '';
          else if (condition.field === 'customer_phone') customerValue = customer.phone || '';
          else if (condition.field === 'customer_name') customerValue = customer.displayName || '';

          switch (condition.operator) {
            case 'is_not_empty': return customerValue.length > 0;
            case 'is_empty': return customerValue.length === 0;
            case 'equals': return customerValue === condition.value;
            case 'contains': return customerValue.includes(condition.value);
            case 'starts_with': return customerValue.startsWith(condition.value);
            case 'ends_with': return customerValue.endsWith(condition.value);
            default: return true;
          }
        });
      });
    });
  }

  return customers;
}

export async function processEmailCampaign(campaign, queueItem) {
  const storeId = campaign.storeId || campaign.shop;
  const segmentIds = campaign.segmentIds || [];

  let allCustomers = [];
  for (const segId of segmentIds) {
    const segment = await getSegmentById(segId);
    if (segment) {
      const customers = await evaluateSegmentForEmail(segment, storeId);
      allCustomers.push(...customers);
    }
  }

  // Deduplicate by customer ID
  const uniqueCustomers = Array.from(
    new Map(allCustomers.map(c => [c.id, c])).values()
  );

  // Filter out unsubscribed/suppressed emails
  const subscribableCustomers = await getSubscribableEmails(uniqueCustomers, storeId);

  const emailContent = campaign.emailContent || {};
  const subject = emailContent.subject || campaign.name || 'No Subject';
  const htmlBody = emailContent.htmlBody || '';
  const fromName = emailContent.fromName || EMAIL_CONFIG.defaults.fromName;
  const fromEmail = emailContent.fromEmail || EMAIL_CONFIG.defaults.fromEmail;
  const replyTo = emailContent.replyTo || EMAIL_CONFIG.defaults.replyTo;

  let sent = 0;
  let delivered = 0;
  let failed = 0;
  const rateDelay = Math.ceil(1000 / EMAIL_CONFIG.sending.ratePerSecond);

  for (let i = 0; i < subscribableCustomers.length; i++) {
    const customer = subscribableCustomers[i];

    try {
      if (!customer.email) {
        continue;
      }

      // Personalize subject
      const personalizedSubject = personalizeMergeTags(subject, customer, {
        shopName: storeId,
      });

      // Render full email with tracking
      const { html: renderedHtml, unsubscribeUrl } = renderEmailForRecipient({
        htmlBody,
        campaignId: campaign.id,
        customer,
        storeId,
        extraData: { shopName: storeId },
      });

      const result = await sendEmail({
        to: customer.email,
        subject: personalizedSubject,
        htmlBody: renderedHtml,
        fromName,
        fromEmail,
        replyTo,
        headers: { 'List-Unsubscribe': `<${unsubscribeUrl}>` },
      });

      if (result.success) {
        sent++;
        delivered++;
        await trackSent(campaign.id, customer.email);
        await trackDelivered(campaign.id, customer.email);
      } else {
        failed++;
      }

      // Rate limiting
      if (campaign.sendingSpeed === 'SLOW') {
        await new Promise(r => setTimeout(r, 2000));
      } else if (campaign.sendingSpeed === 'MEDIUM') {
        await new Promise(r => setTimeout(r, 1000));
      } else {
        await new Promise(r => setTimeout(r, rateDelay));
      }
    } catch (err) {
      console.error(`Email send failed for ${customer.email}:`, err.message);
      failed++;
    }
  }

  return { sent, delivered, failed, total: subscribableCustomers.length };
}

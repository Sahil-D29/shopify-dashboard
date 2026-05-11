// backend/workers/campaignExecutor.js
import { createShopifyClient } from '../config/shopify.js';
import { getSegmentById } from '../services/segmentsService.js';
import { updateCampaign, logCampaignExecution } from '../services/campaignsService.js';
import { logActivity, logError } from '../utils/logger.js';
import { readFileSafe } from '../utils/safeFileStore.js';
import path from 'path';

const whatsappConfigFile = path.join(process.cwd(), 'backend', 'shopify-dashboard', 'data', 'whatsapp-config.json');

async function getWhatsAppConfig() {
  try {
    const config = await readFileSafe(whatsappConfigFile, { default: {} });
    return config;
  } catch (e) {
    return null;
  }
}

function formatPhoneNumber(phone) {
  if (!phone) return null;
  // Remove all non-digits
  let cleaned = phone.replace(/\D/g, '');
  // If starts with 0, remove it
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  return cleaned;
}

function personalizeMessage(message, customer) {
  if (!message || !customer) return message;
  
  // Replace {{1}} with customer name, {{2}} with first name, etc.
  let personalized = message;
  personalized = personalized.replace(/\{\{1\}\}/g, customer.displayName || customer.firstName || 'Customer');
  personalized = personalized.replace(/\{\{2\}\}/g, customer.firstName || '');
  personalized = personalized.replace(/\{\{3\}\}/g, customer.lastName || '');
  personalized = personalized.replace(/\{\{email\}\}/g, customer.email || '');
  personalized = personalized.replace(/\{\{phone\}\}/g, customer.phone || '');
  
  return personalized;
}

async function sendWhatsAppMessage(phone, message, config) {
  if (!config || !config.phoneNumberId || !config.accessToken) {
    console.warn('WhatsApp config missing, using stub');
    return { success: true, messageId: `stub_${Date.now()}`, stub: true };
  }
  
  const formattedPhone = formatPhoneNumber(phone);
  if (!formattedPhone) {
    throw new Error('Invalid phone number');
  }
  
  try {
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: formattedPhone,
      type: 'text',
      text: {
        preview_url: false,
        body: message
      }
    };
    
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${config.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      }
    );
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error?.message || 'Failed to send WhatsApp message');
    }
    
    return {
      success: true,
      messageId: result.messages?.[0]?.id || `msg_${Date.now()}`,
      stub: false
    };
  } catch (e) {
    console.error('WhatsApp send error:', e.message);
    throw e;
  }
}

async function evaluateSegment(segment, storeId) {
  try {
    const client = await createShopifyClient(storeId);
    
    // Build GraphQL query based on segment filters
    // For now, fetch all customers and filter in-memory (can be optimized later)
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
              amountSpent {
                amount
                currencyCode
              }
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
      totalSpent: parseFloat(edge.node.amountSpent?.amount || '0')
    }));
    
    // Apply segment filters (simplified - can be enhanced)
    if (segment.conditionGroups && segment.conditionGroups.length > 0) {
      customers = customers.filter(customer => {
        return segment.conditionGroups.some(group => {
          const conditions = group.conditions || [];
          return conditions.every(condition => {
            const field = condition.field;
            const operator = condition.operator;
            const value = condition.value;
            
            let customerValue = '';
            if (field === 'customer_email') customerValue = customer.email || '';
            else if (field === 'customer_phone') customerValue = customer.phone || '';
            else if (field === 'customer_name') customerValue = customer.displayName || '';
            
            switch (operator) {
              case 'is_not_empty':
                return customerValue.length > 0;
              case 'is_empty':
                return customerValue.length === 0;
              case 'equals':
                return customerValue === value;
              case 'contains':
                return customerValue.includes(value);
              case 'starts_with':
                return customerValue.startsWith(value);
              case 'ends_with':
                return customerValue.endsWith(value);
              default:
                return true;
            }
          });
        });
      });
    }
    
    return customers;
  } catch (e) {
    console.error('Segment evaluation error:', e.message);
    throw e;
  }
}

export async function processCampaignExecution(queueItem) {
  const { campaignId, scheduledAt, retryCount = 0 } = queueItem;
  const maxRetries = parseInt(process.env.CAMPAIGN_RETRY_LIMIT || '3');

  try {
    // Load campaign
    const { getCampaignById } = await import('../services/campaignsService.js');
    const campaign = await getCampaignById(campaignId);

    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found`);
    }

    // Route email campaigns to the email executor
    const channel = campaign.channel || 'whatsapp';
    if (channel === 'email' || channel === 'mixed') {
      await updateCampaign(campaignId, {
        state: 'running',
        status: 'RUNNING',
        startedAt: new Date().toISOString()
      }, 'system');

      const { processEmailCampaign } = await import('./emailCampaignExecutor.js');
      const emailResult = await processEmailCampaign(campaign, queueItem);

      let whatsappResult = { sent: 0, delivered: 0, failed: 0 };

      // For mixed campaigns, also send WhatsApp
      if (channel === 'mixed') {
        whatsappResult = await runWhatsAppCampaign(campaign, queueItem);
      }

      const metrics = {
        ...campaign.metrics,
        sent: (campaign.metrics?.sent || 0) + emailResult.sent + whatsappResult.sent,
        delivered: (campaign.metrics?.delivered || 0) + emailResult.delivered + whatsappResult.delivered,
        failed: (campaign.metrics?.failed || 0) + emailResult.failed + whatsappResult.failed,
      };

      await updateCampaign(campaignId, {
        state: 'completed',
        status: 'COMPLETED',
        completedAt: new Date().toISOString(),
        metrics,
      }, 'system');

      await logCampaignExecution({
        campaignId,
        storeId: campaign.storeId || campaign.shop,
        status: 'success',
        executedAt: new Date().toISOString(),
        retryCount,
        channel,
        emailSent: emailResult.sent,
        whatsappSent: whatsappResult.sent,
      });

      return { success: true, email: emailResult, whatsapp: whatsappResult };
    }

    // Update status to running
    await updateCampaign(campaignId, {
      state: 'running',
      status: 'RUNNING',
      startedAt: new Date().toISOString()
    }, 'system');

    const storeId = campaign.storeId || campaign.shop;
    if (!storeId) {
      throw new Error('Campaign missing storeId');
    }
    
    // Get segments
    const segmentIds = campaign.segmentIds || [];
    let allCustomers = [];
    
    for (const segId of segmentIds) {
      const segment = await getSegmentById(segId);
      if (segment) {
        const customers = await evaluateSegment(segment, storeId);
        allCustomers.push(...customers);
      }
    }
    
    // Deduplicate by customer ID
    const uniqueCustomers = Array.from(
      new Map(allCustomers.map(c => [c.id, c])).values()
    );
    
    // Get WhatsApp config
    const whatsappConfig = await getWhatsAppConfig();
    
    // Get message content
    const messageBody = campaign.messageContent?.body || campaign.messageContent || '';
    
    // Send messages
    let sent = 0;
    let delivered = 0;
    let failed = 0;
    
    for (const customer of uniqueCustomers) {
      try {
        const phone = customer.phone;
        if (!phone) {
          console.warn(`Skipping customer ${customer.id} - no phone`);
          continue;
        }
        
        const personalizedMessage = personalizeMessage(messageBody, customer);
        const result = await sendWhatsAppMessage(phone, personalizedMessage, whatsappConfig);
        
        if (result.success) {
          sent++;
          if (!result.stub) {
            delivered++;
          }
        } else {
          failed++;
        }
        
        // Rate limiting: slow down if not stub
        if (!result.stub && campaign.sendingSpeed === 'SLOW') {
          await new Promise(resolve => setTimeout(resolve, 2000)); // 2s delay
        } else if (!result.stub && campaign.sendingSpeed === 'MEDIUM') {
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1s delay
        }
      } catch (e) {
        console.error(`Failed to send to customer ${customer.id}:`, e.message);
        failed++;
      }
    }
    
    // Update campaign metrics and status
    const metrics = {
      ...campaign.metrics,
      sent: (campaign.metrics?.sent || 0) + sent,
      delivered: (campaign.metrics?.delivered || 0) + delivered,
      failed: (campaign.metrics?.failed || 0) + failed
    };
    
    await updateCampaign(campaignId, {
      state: 'completed',
      status: 'COMPLETED',
      completedAt: new Date().toISOString(),
      metrics
    }, 'system');
    
    // Log execution
    await logCampaignExecution({
      campaignId,
      storeId,
      status: 'success',
      executedAt: new Date().toISOString(),
      retryCount,
      deliveryCount: delivered,
      sentCount: sent,
      failedCount: failed,
      customerCount: uniqueCustomers.length
    });
    
    await logActivity({
      type: 'campaign_executed',
      actorId: 'system',
      storeId,
      campaignId,
      status: 'success',
      sent,
      delivered,
      failed
    });
    
    return { success: true, sent, delivered, failed };
  } catch (e) {
    console.error('Campaign execution error:', e.message);
    
    // Retry logic
    if (retryCount < maxRetries) {
      const { scheduleCampaign } = await import('../services/campaignsService.js');
      await scheduleCampaign(campaignId, new Date(Date.now() + 60000).toISOString(), 'system');
      
      await logCampaignExecution({
        campaignId,
        status: 'retry_scheduled',
        executedAt: new Date().toISOString(),
        retryCount: retryCount + 1,
        error: e.message
      });
    } else {
      // Max retries reached
      const { updateCampaign } = await import('../services/campaignsService.js');
      await updateCampaign(campaignId, {
        state: 'failed',
        status: 'FAILED',
        failedAt: new Date().toISOString(),
        error: e.message
      }, 'system');
      
      await logCampaignExecution({
        campaignId,
        status: 'failed',
        executedAt: new Date().toISOString(),
        retryCount,
        error: e.message
      });
    }
    
    await logError({
      message: `Campaign execution failed: ${e.message}`,
      stack: e.stack,
      campaignId,
      retryCount
    });

    throw e;
  }
}

async function runWhatsAppCampaign(campaign, queueItem) {
  const storeId = campaign.storeId || campaign.shop;
  const segmentIds = campaign.segmentIds || [];
  let allCustomers = [];

  for (const segId of segmentIds) {
    const segment = await getSegmentById(segId);
    if (segment) {
      const customers = await evaluateSegment(segment, storeId);
      allCustomers.push(...customers);
    }
  }

  const uniqueCustomers = Array.from(new Map(allCustomers.map(c => [c.id, c])).values());
  const whatsappConfig = await getWhatsAppConfig();
  const messageBody = campaign.messageContent?.body || campaign.messageContent || '';

  let sent = 0, delivered = 0, failed = 0;

  for (const customer of uniqueCustomers) {
    try {
      if (!customer.phone) continue;
      const personalizedMessage = personalizeMessage(messageBody, customer);
      const result = await sendWhatsAppMessage(customer.phone, personalizedMessage, whatsappConfig);
      if (result.success) {
        sent++;
        if (!result.stub) delivered++;
      } else {
        failed++;
      }
      if (!result.stub && campaign.sendingSpeed === 'SLOW') {
        await new Promise(r => setTimeout(r, 2000));
      } else if (!result.stub && campaign.sendingSpeed === 'MEDIUM') {
        await new Promise(r => setTimeout(r, 1000));
      }
    } catch {
      failed++;
    }
  }

  return { sent, delivered, failed };
}



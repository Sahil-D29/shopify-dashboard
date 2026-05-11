// backend/workers/journeyExecutor.js
import { getJourneyById, logJourneyExecution } from '../services/journeysService.js';
import { createSegment, getSegmentById } from '../services/segmentsService.js';
import { scheduleCampaign } from '../services/campaignsService.js';
import { logActivity, logError } from '../utils/logger.js';
import { createShopifyClient } from '../config/shopify.js';

async function getCustomerFromShopify(storeId, customerId) {
  try {
    const client = await createShopifyClient(storeId);
    const query = `
      query($id: ID!) {
        customer(id: $id) {
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
    `;
    
    const response = await client.query({
      data: query,
      variables: { id: customerId }
    });
    
    return response.body.data.customer;
  } catch (e) {
    console.error('Error fetching customer:', e.message);
    return null;
  }
}

async function executeJourneyAction(action, customer, storeId, event) {
  try {
    switch (action.type) {
      case 'add_to_segment': {
        const segmentId = action.segmentId;
        if (!segmentId) {
          throw new Error('Segment ID missing in add_to_segment action');
        }
        
        const segment = await getSegmentById(segmentId);
        if (!segment) {
          throw new Error(`Segment ${segmentId} not found`);
        }
        
        // In a real system, you'd maintain a segment membership list
        // For now, we'll just log the action
        await logActivity({
          type: 'journey_action_add_to_segment',
          actorId: 'system',
          storeId,
          journeyId: event.journeyId,
          segmentId,
          customerId: customer.id
        });
        
        return { success: true, action: 'add_to_segment' };
      }
      
      case 'trigger_campaign': {
        const campaignId = action.campaignId;
        if (!campaignId) {
          throw new Error('Campaign ID missing in trigger_campaign action');
        }
        
        // Schedule campaign immediately
        await scheduleCampaign(campaignId, new Date().toISOString(), 'system');
        
        await logActivity({
          type: 'journey_action_trigger_campaign',
          actorId: 'system',
          storeId,
          journeyId: event.journeyId,
          campaignId,
          customerId: customer.id
        });
        
        return { success: true, action: 'trigger_campaign' };
      }
      
      case 'send_message': {
        await logActivity({
          type: 'journey_action_send_message',
          actorId: 'system',
          storeId,
          journeyId: event.journeyId,
          customerId: customer.id,
          message: action.message
        });

        return { success: true, action: 'send_message' };
      }

      case 'send_email': {
        if (!customer.email) {
          return { success: false, error: 'Customer has no email address' };
        }

        const { getTemplateById } = await import('../services/emailTemplateService.js');
        const { sendEmail } = await import('../services/emailService.js');
        const { renderEmailForRecipient, personalizeMergeTags } = await import('../utils/emailRenderer.js');
        const { EMAIL_CONFIG } = await import('../config/email.config.js');

        const templateId = action.templateId;
        const template = templateId ? await getTemplateById(templateId) : null;

        const subject = personalizeMergeTags(
          action.subject || template?.subject || 'Message from your store',
          customer,
          { shopName: storeId }
        );

        const htmlBody = template?.htmlBody || action.htmlBody || '';
        const { html: renderedHtml, unsubscribeUrl } = renderEmailForRecipient({
          htmlBody,
          campaignId: event.journeyId,
          customer,
          storeId,
          extraData: { shopName: storeId },
        });

        await sendEmail({
          to: customer.email,
          subject,
          htmlBody: renderedHtml,
          fromName: action.fromName || EMAIL_CONFIG.defaults.fromName,
          fromEmail: action.fromEmail || EMAIL_CONFIG.defaults.fromEmail,
          headers: { 'List-Unsubscribe': `<${unsubscribeUrl}>` },
        });

        await logActivity({
          type: 'journey_action_send_email',
          actorId: 'system',
          storeId,
          journeyId: event.journeyId,
          customerId: customer.id,
          templateId,
        });

        return { success: true, action: 'send_email' };
      }

      case 'wait': {
        const delayMs = (action.delayMinutes || 0) * 60 * 1000;
        if (delayMs > 0) {
          await new Promise(r => setTimeout(r, Math.min(delayMs, 300000)));
        }
        return { success: true, action: 'wait' };
      }

      default:
        console.warn(`Unknown journey action type: ${action.type}`);
        return { success: false, error: `Unknown action type: ${action.type}` };
    }
  } catch (e) {
    console.error('Journey action execution error:', e.message);
    throw e;
  }
}

export async function runJourneyEvent(event) {
  const { journeyId, eventType, storeId, customerId, payload } = event;
  
  try {
    // Load journey
    const journey = await getJourneyById(journeyId);
    
    if (!journey) {
      throw new Error(`Journey ${journeyId} not found`);
    }
    
    if (!journey.enabled) {
      console.log(`Journey ${journeyId} is disabled, skipping`);
      return { success: false, reason: 'journey_disabled' };
    }
    
    // Check if event type matches journey trigger
    const trigger = journey.trigger;
    if (!trigger || trigger.eventType !== eventType) {
      return { success: false, reason: 'event_type_mismatch' };
    }
    
    // Get customer data
    const customer = await getCustomerFromShopify(storeId, customerId);
    if (!customer) {
      throw new Error(`Customer ${customerId} not found`);
    }
    
    // Execute journey actions
    const actions = journey.actions || [];
    const results = [];
    
    for (const action of actions) {
      try {
        const result = await executeJourneyAction(action, customer, storeId, event);
        results.push(result);
      } catch (e) {
        console.error(`Action execution failed:`, e.message);
        results.push({ success: false, error: e.message });
      }
    }
    
    // Log execution
    await logJourneyExecution({
      journeyId,
      eventId: event.id,
      eventType,
      storeId,
      customerId,
      status: 'completed',
      executedAt: new Date().toISOString(),
      actionsExecuted: results.length,
      results
    });
    
    await logActivity({
      type: 'journey_executed',
      actorId: 'system',
      storeId,
      journeyId,
      eventType,
      customerId,
      status: 'success'
    });
    
    return { success: true, results };
  } catch (e) {
    console.error('Journey event execution error:', e.message);
    
    await logJourneyExecution({
      journeyId,
      eventId: event.id,
      eventType,
      storeId,
      customerId,
      status: 'failed',
      executedAt: new Date().toISOString(),
      error: e.message
    });
    
    await logError({
      message: `Journey execution failed: ${e.message}`,
      stack: e.stack,
      journeyId,
      eventId: event.id
    });
    
    throw e;
  }
}



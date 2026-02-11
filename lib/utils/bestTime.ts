import { readJsonFile } from './json-storage';
import type { ShopifyClient } from '@/lib/shopify/api-helper';
import type { ShopifyOrder } from '@/lib/shopify/client';

interface CampaignMessage {
  messageId: string;
  campaignId: string;
  customerId: string;
  customerPhone: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  failedAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
}

interface BestTimeResult {
  hour: number;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Calculate the best time to send a message to a customer
 * Based on their past message open times and order placement times
 */
export async function calculateBestSendTime(
  customerId: string,
  shopifyClient?: Pick<ShopifyClient, 'fetchAll'>
): Promise<BestTimeResult> {
  try {
    // 1. Get customer's previous message open times
    const messages = readJsonFile<CampaignMessage>('campaign-messages.json');
    const customerMessages = messages.filter(
      m => m.customerId === customerId && m.status === 'read' && m.readAt
    );
    
    const readHours: number[] = [];
    customerMessages.forEach(msg => {
      if (msg.readAt) {
        const date = new Date(msg.readAt);
        readHours.push(date.getHours());
      }
    });
    
    // 2. Get customer's order placement times from Shopify
    const orderHours: number[] = [];
    if (shopifyClient) {
      try {
        const orders = await shopifyClient.fetchAll<ShopifyOrder>('orders', {
          limit: 250,
          customer_id: customerId 
        });
        
        orders.forEach(order => {
          if (order?.created_at) {
            const date = new Date(order.created_at);
            orderHours.push(date.getHours());
          }
        });
      } catch (error) {
        console.error('[BestTime] Error fetching orders:', error);
      }
    }
    
    // 3. Find most common hour for each data source
    const getMostCommonHour = (hours: number[]): number | null => {
      if (hours.length === 0) return null;
      
      const frequency: Record<number, number> = {};
      hours.forEach(hour => {
        frequency[hour] = (frequency[hour] || 0) + 1;
      });
      
      let maxCount = 0;
      let mostCommon = hours[0];
      
      Object.entries(frequency).forEach(([hour, count]) => {
        if (count > maxCount) {
          maxCount = count;
          mostCommon = parseInt(hour);
        }
      });
      
      return mostCommon;
    };
    
    const preferredReadHour = getMostCommonHour(readHours);
    const preferredOrderHour = getMostCommonHour(orderHours);
    
    // 4. Combine data
    let bestHour: number;
    let confidence: 'high' | 'medium' | 'low';
    
    if (preferredReadHour !== null && preferredOrderHour !== null) {
      // Both available: average the two
      bestHour = Math.round((preferredReadHour + preferredOrderHour) / 2);
      confidence = 'high';
    } else if (preferredReadHour !== null) {
      // Only read times available
      bestHour = preferredReadHour;
      confidence = 'medium';
    } else if (preferredOrderHour !== null) {
      // Only order times available
      bestHour = preferredOrderHour;
      confidence = 'medium';
    } else {
      // Neither available: default to 11 AM (peak engagement time)
      bestHour = 11;
      confidence = 'low';
    }
    
    // 5. Apply business rules
    // Never before 9 AM or after 9 PM
    if (bestHour < 9) {
      bestHour = 9;
    } else if (bestHour >= 21) {
      bestHour = 20; // 8 PM
    }
    
    // Round to nearest hour
    bestHour = Math.round(bestHour);
    
    return { hour: bestHour, confidence };
  } catch (error) {
    console.error('[BestTime] Error calculating best time:', error);
    // Default fallback
    return { hour: 11, confidence: 'low' };
  }
}


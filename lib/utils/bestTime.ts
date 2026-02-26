import { prisma } from '@/lib/prisma';
import type { ShopifyClient } from '@/lib/shopify/api-helper';
import type { ShopifyOrder } from '@/lib/shopify/client';

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
    // 1. Get customer's previous message open times from CampaignLog (Prisma)
    const successLogs = await prisma.campaignLog.findMany({
      where: { customerId, status: 'SUCCESS' },
      select: { createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const readHours: number[] = [];
    for (const log of successLogs) {
      if (log.createdAt) {
        readHours.push(log.createdAt.getHours());
      }
    }

    // 2. Get customer's order placement times from Shopify
    const orderHours: number[] = [];
    if (shopifyClient) {
      try {
        const orders = await shopifyClient.fetchAll<ShopifyOrder>('orders', {
          limit: 250,
          customer_id: customerId,
        });

        for (const order of orders) {
          if (order?.created_at) {
            const date = new Date(order.created_at);
            orderHours.push(date.getHours());
          }
        }
      } catch (error) {
        console.error('[BestTime] Error fetching orders:', error);
      }
    }

    // 3. Find most common hour for each data source
    const getMostCommonHour = (hours: number[]): number | null => {
      if (hours.length === 0) return null;

      const frequency: Record<number, number> = {};
      for (const hour of hours) {
        frequency[hour] = (frequency[hour] || 0) + 1;
      }

      let maxCount = 0;
      let mostCommon = hours[0];

      for (const [hour, count] of Object.entries(frequency)) {
        if (count > maxCount) {
          maxCount = count;
          mostCommon = parseInt(hour);
        }
      }

      return mostCommon;
    };

    const preferredReadHour = getMostCommonHour(readHours);
    const preferredOrderHour = getMostCommonHour(orderHours);

    // 4. Combine data
    let bestHour: number;
    let confidence: 'high' | 'medium' | 'low';

    if (preferredReadHour !== null && preferredOrderHour !== null) {
      bestHour = Math.round((preferredReadHour + preferredOrderHour) / 2);
      confidence = 'high';
    } else if (preferredReadHour !== null) {
      bestHour = preferredReadHour;
      confidence = 'medium';
    } else if (preferredOrderHour !== null) {
      bestHour = preferredOrderHour;
      confidence = 'medium';
    } else {
      bestHour = 11; // Default: 11 AM peak engagement time
      confidence = 'low';
    }

    // 5. Apply business rules — never before 9 AM or after 9 PM
    if (bestHour < 9) {
      bestHour = 9;
    } else if (bestHour >= 21) {
      bestHour = 20;
    }

    bestHour = Math.round(bestHour);

    return { hour: bestHour, confidence };
  } catch (error) {
    console.error('[BestTime] Error calculating best time:', error);
    return { hour: 11, confidence: 'low' };
  }
}

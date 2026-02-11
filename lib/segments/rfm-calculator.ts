import type { ShopifyCustomer } from '@/lib/types/shopify-customer';
import type { ShopifyOrder } from '@/lib/shopify/client';

export interface RFMScore {
  recency: number; // 1-5
  frequency: number; // 1-5
  monetary: number; // 1-5
  segment: string; // Champions, Loyal, At Risk, etc.
}

export interface CustomerRFM {
  customerId: string;
  email: string;
  recency: number;
  frequency: number;
  monetary: number;
  rfmScore: RFMScore;
  lastOrderDate?: number;
  totalOrders: number;
  totalSpent: number;
}

/**
 * Calculate RFM scores for a customer
 */
export function calculateRFM(
  customer: ShopifyCustomer,
  orders: ShopifyOrder[],
  referenceDate: number = Date.now()
): RFMScore {
  // Filter orders for this customer
  const customerOrders = orders.filter(
    order => order.customer?.id === customer.id || 
    (order as any).email === customer.email
  );

  // Recency: Days since last order
  const lastOrder = customerOrders
    .map(o => new Date(o.created_at || (o as any).updated_at).getTime())
    .sort((a, b) => b - a)[0];
  
  const daysSinceLastOrder = lastOrder 
    ? Math.floor((referenceDate - lastOrder) / (1000 * 60 * 60 * 24))
    : 999; // Never ordered

  // Frequency: Number of orders
  const frequency = customerOrders.length;

  // Monetary: Total spent
  const monetary = Number(customer.total_spent || 0);

  // Calculate scores (1-5 scale)
  const recencyScore = calculateRecencyScore(daysSinceLastOrder);
  const frequencyScore = calculateFrequencyScore(frequency);
  const monetaryScore = calculateMonetaryScore(monetary);

  // Determine segment
  const segment = determineRFMSegment(recencyScore, frequencyScore, monetaryScore);

  return {
    recency: recencyScore,
    frequency: frequencyScore,
    monetary: monetaryScore,
    segment,
  };
}

/**
 * Calculate Recency Score (1-5)
 * Lower days = higher score
 */
function calculateRecencyScore(days: number): number {
  if (days <= 30) return 5;
  if (days <= 60) return 4;
  if (days <= 90) return 3;
  if (days <= 180) return 2;
  return 1;
}

/**
 * Calculate Frequency Score (1-5)
 * More orders = higher score
 */
function calculateFrequencyScore(orders: number): number {
  if (orders >= 20) return 5;
  if (orders >= 10) return 4;
  if (orders >= 5) return 3;
  if (orders >= 2) return 2;
  return 1;
}

/**
 * Calculate Monetary Score (1-5)
 * Higher spending = higher score
 */
function calculateMonetaryScore(totalSpent: number): number {
  // Adjust thresholds based on your business
  if (totalSpent >= 10000) return 5;
  if (totalSpent >= 5000) return 4;
  if (totalSpent >= 2000) return 3;
  if (totalSpent >= 500) return 2;
  return 1;
}

/**
 * Determine RFM segment based on scores
 */
function determineRFMSegment(recency: number, frequency: number, monetary: number): string {
  const avgScore = (recency + frequency + monetary) / 3;

  // Champions: High scores across all
  if (recency >= 4 && frequency >= 4 && monetary >= 4) {
    return 'Champions';
  }

  // Loyal Customers: High frequency, good recency
  if (frequency >= 4 && recency >= 3) {
    return 'Loyal Customers';
  }

  // Potential Loyalists: Good recency and monetary
  if (recency >= 4 && monetary >= 3) {
    return 'Potential Loyalists';
  }

  // At Risk: Low recency but high frequency/monetary
  if (recency <= 2 && frequency >= 3 && monetary >= 3) {
    return 'At Risk';
  }

  // Cannot Lose Them: Low recency, high frequency and monetary
  if (recency <= 2 && frequency >= 4 && monetary >= 4) {
    return 'Cannot Lose Them';
  }

  // Hibernating: Low recency and frequency
  if (recency <= 2 && frequency <= 2) {
    return 'Hibernating';
  }

  // New Customers: High recency, low frequency
  if (recency >= 4 && frequency <= 2) {
    return 'New Customers';
  }

  // Promising: Good recency, low frequency/monetary
  if (recency >= 3 && frequency <= 2 && monetary <= 2) {
    return 'Promising';
  }

  // Need Attention: Medium scores
  if (avgScore >= 2.5 && avgScore < 3.5) {
    return 'Need Attention';
  }

  // About to Sleep: Low recency, medium frequency
  if (recency <= 2 && frequency >= 2 && frequency <= 3) {
    return 'About to Sleep';
  }

  return 'Others';
}

/**
 * Calculate RFM for all customers
 */
export async function calculateAllRFM(
  customers: ShopifyCustomer[],
  orders: ShopifyOrder[]
): Promise<Map<string, CustomerRFM>> {
  const rfmMap = new Map<string, CustomerRFM>();

  customers.forEach(customer => {
    const rfmScore = calculateRFM(customer, orders);
    const customerOrders = orders.filter(
      o => o.customer?.id === customer.id || (o as any).email === customer.email
    );

    rfmMap.set(String(customer.id), {
      customerId: String(customer.id),
      email: customer.email || '',
      recency: rfmScore.recency,
      frequency: rfmScore.frequency,
      monetary: rfmScore.monetary,
      rfmScore,
      lastOrderDate: customerOrders.length > 0
        ? new Date(customerOrders[0].created_at || (customerOrders[0] as any).updated_at).getTime()
        : undefined,
      totalOrders: customerOrders.length,
      totalSpent: Number(customer.total_spent || 0),
    });
  });

  return rfmMap;
}


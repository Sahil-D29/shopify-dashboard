import type { ShopifyCustomer } from '@/lib/types/shopify-customer';

export interface RFMScores {
  recency: number;   // 1-5 (5 = most recent)
  frequency: number; // 1-5 (5 = most frequent)
  monetary: number;  // 1-5 (5 = highest spender)
}

/**
 * Calculate RFM scores for a set of customers using quintile-based scoring (1-5).
 * Requires at least 5 customers for meaningful quintiles; fewer returns mid-range scores.
 */
export function calculateRFMScores(
  customers: ShopifyCustomer[]
): Map<string | number, RFMScores> {
  const result = new Map<string | number, RFMScores>();

  if (customers.length === 0) return result;

  const now = Date.now();

  // Build raw values per customer
  const data = customers.map(c => {
    const daysSinceLastOrder = c.updated_at
      ? Math.max(Math.floor((now - new Date(c.updated_at).getTime()) / 86400000), 0)
      : 999;
    const frequency = Number(c.orders_count || 0);
    const monetary = Number(c.total_spent || 0);
    return { id: c.id, daysSinceLastOrder, frequency, monetary };
  });

  if (data.length < 5) {
    // Too few customers for meaningful quintiles — assign mid-range
    for (const d of data) {
      result.set(d.id, { recency: 3, frequency: 3, monetary: 3 });
    }
    return result;
  }

  // Sort and assign quintile scores
  const assignQuintiles = (values: number[], ascending: boolean): Map<number, number> => {
    const indexed = values.map((v, i) => ({ v, i }));
    indexed.sort((a, b) => ascending ? a.v - b.v : b.v - a.v);
    const scoreMap = new Map<number, number>();
    const quintileSize = values.length / 5;
    for (let rank = 0; rank < indexed.length; rank++) {
      const score = Math.min(Math.floor(rank / quintileSize) + 1, 5);
      scoreMap.set(indexed[rank].i, score);
    }
    return scoreMap;
  };

  // Recency: lower days = better = higher score (sort descending so lowest days get score 5)
  const recencyScores = assignQuintiles(
    data.map(d => d.daysSinceLastOrder),
    false // descending: highest days first → score 1; lowest days last → score 5
  );

  // Frequency: higher = better = higher score (ascending so highest gets score 5)
  const frequencyScores = assignQuintiles(
    data.map(d => d.frequency),
    true
  );

  // Monetary: higher = better = higher score
  const monetaryScores = assignQuintiles(
    data.map(d => d.monetary),
    true
  );

  for (let i = 0; i < data.length; i++) {
    result.set(data[i].id, {
      recency: recencyScores.get(i) ?? 3,
      frequency: frequencyScores.get(i) ?? 3,
      monetary: monetaryScores.get(i) ?? 3,
    });
  }

  return result;
}

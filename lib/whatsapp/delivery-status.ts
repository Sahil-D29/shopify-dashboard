/** Delivery events may arrive repeatedly or out of order. Never regress a receipt. */
export function nextDeliveryStatus(current: string, incoming: string): string | null {
  const next = ({ sent: 'SENT', delivered: 'DELIVERED', read: 'READ', failed: 'FAILED' } as Record<string, string>)[incoming];
  if (!next || next === current) return null;
  if (current === 'READ' || current === 'FAILED') return null;
  if (current === 'DELIVERED' && next !== 'READ') return null;
  if (next === 'SENT' && current !== 'PENDING' && current !== 'QUEUED') return null;
  return next;
}

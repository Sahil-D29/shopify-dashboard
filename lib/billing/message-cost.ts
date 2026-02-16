/**
 * Per-message cost tracking.
 * DOREC charges ₹0.10 markup per outbound message.
 */
import { prisma } from '@/lib/prisma';

const DEFAULT_MARKUP = 0.10;
const DEFAULT_CURRENCY = 'INR';

export async function getMarkupPerMessage(storeId: string): Promise<{ amount: number; currency: string }> {
  // Future: could be per-store configurable
  return { amount: DEFAULT_MARKUP, currency: DEFAULT_CURRENCY };
}

export async function recordMessageCost(messageId: string, storeId: string): Promise<void> {
  const { amount, currency } = await getMarkupPerMessage(storeId);
  await prisma.message.update({
    where: { id: messageId },
    data: {
      costAmount: amount,
      costCurrency: currency,
    },
  });
}

export async function getMonthlyMessageCosts(storeId: string, period?: string): Promise<{
  totalMessages: number;
  totalCost: number;
  currency: string;
  dailyBreakdown: Array<{ date: string; count: number; cost: number }>;
}> {
  const now = new Date();
  const currentPeriod = period || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [year, month] = currentPeriod.split('-').map(Number);

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);

  const messages = await prisma.message.findMany({
    where: {
      storeId,
      direction: 'OUTBOUND',
      status: { in: ['SENT', 'DELIVERED', 'READ'] },
      createdAt: { gte: startDate, lte: endDate },
    },
    select: {
      createdAt: true,
      costAmount: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const { amount: markupRate } = await getMarkupPerMessage(storeId);

  // Build daily breakdown
  const dailyMap = new Map<string, { count: number; cost: number }>();
  for (const msg of messages) {
    const dateKey = msg.createdAt.toISOString().split('T')[0];
    const existing = dailyMap.get(dateKey) || { count: 0, cost: 0 };
    existing.count++;
    existing.cost += Number(msg.costAmount) || markupRate;
    dailyMap.set(dateKey, existing);
  }

  const dailyBreakdown = Array.from(dailyMap.entries()).map(([date, data]) => ({
    date,
    count: data.count,
    cost: Math.round(data.cost * 100) / 100,
  }));

  const totalMessages = messages.length;
  const totalCost = Math.round(totalMessages * markupRate * 100) / 100;

  return { totalMessages, totalCost, currency: DEFAULT_CURRENCY, dailyBreakdown };
}

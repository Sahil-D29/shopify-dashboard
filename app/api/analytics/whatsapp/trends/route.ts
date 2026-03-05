export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { auth } from '@/lib/auth';

const ZERO_TRENDS = {
  messageTrend: [] as Array<{ date: string; sent: number; delivered: number; read: number; failed: number }>,
  contactGrowth: [] as Array<{ date: string; newContacts: number }>,
};

export async function GET(request: NextRequest) {
  try {
    let storeId = await getCurrentStoreId(request);

    if (!storeId) {
      try {
        const session = await auth();
        if (session?.user?.id) {
          const userStore = await prisma.store.findFirst({
            where: { ownerId: session.user.id },
            select: { id: true },
          });
          if (userStore) storeId = userStore.id;
        }
      } catch { /* ignore auth fallback errors */ }
    }

    if (!storeId) {
      return NextResponse.json(ZERO_TRENDS);
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get message trend using raw SQL for efficient date grouping
    const messageTrend = await prisma.$queryRaw<Array<{
      date: Date;
      sent: bigint;
      delivered: bigint;
      read: bigint;
      failed: bigint;
    }>>`
      SELECT
        DATE("createdAt") as date,
        COUNT(*) FILTER (WHERE status IN ('SENT', 'DELIVERED', 'READ')) as sent,
        COUNT(*) FILTER (WHERE status IN ('DELIVERED', 'READ')) as delivered,
        COUNT(*) FILTER (WHERE status = 'READ') as read,
        COUNT(*) FILTER (WHERE status = 'FAILED') as failed
      FROM "Message"
      WHERE "storeId" = ${storeId}
        AND "direction" = 'OUTBOUND'
        AND "createdAt" >= ${thirtyDaysAgo}
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `;

    // Get contact growth
    const contactGrowth = await prisma.$queryRaw<Array<{
      date: Date;
      newContacts: bigint;
    }>>`
      SELECT
        DATE("createdAt") as date,
        COUNT(*) as "newContacts"
      FROM "Contact"
      WHERE "storeId" = ${storeId}
        AND "createdAt" >= ${thirtyDaysAgo}
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `;

    return NextResponse.json({
      messageTrend: messageTrend.map(row => ({
        date: new Date(row.date).toISOString().split('T')[0],
        sent: Number(row.sent),
        delivered: Number(row.delivered),
        read: Number(row.read),
        failed: Number(row.failed),
      })),
      contactGrowth: contactGrowth.map(row => ({
        date: new Date(row.date).toISOString().split('T')[0],
        newContacts: Number(row.newContacts),
      })),
    });
  } catch (error) {
    console.error('[WhatsApp Trends Analytics] Error:', error);
    return NextResponse.json(ZERO_TRENDS);
  }
}

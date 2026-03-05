export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { auth } from '@/lib/auth';

const ZERO_OVERVIEW = {
  campaigns: {
    total: 0, active: 0,
    totalSent: 0, totalDelivered: 0, totalRead: 0,
    totalClicked: 0, totalConverted: 0, totalFailed: 0,
    totalRevenue: 0,
    deliveryRate: 0, readRate: 0, clickRate: 0, conversionRate: 0,
  },
  contacts: {
    total: 0, optedIn: 0, optedOut: 0,
    bySource: {} as Record<string, number>,
  },
  conversations: {
    total: 0, open: 0, pending: 0, resolved: 0, closed: 0,
  },
  journeys: {
    total: 0, active: 0,
    totalEnrollments: 0, completedEnrollments: 0,
  },
  messages: {
    total: 0, inbound: 0, outbound: 0, totalCost: 0,
  },
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
      return NextResponse.json(ZERO_OVERVIEW);
    }

    const [campaigns, contactTotal, contactByOptIn, contactBySource, conversationStats, journeys, messageStats] = await Promise.all([
      // Campaign aggregates
      prisma.campaign.findMany({
        where: { storeId },
        select: {
          status: true,
          totalSent: true,
          totalDelivered: true,
          totalOpened: true,
          totalClicked: true,
          totalConverted: true,
          totalFailed: true,
          totalRevenue: true,
        },
      }),
      // Total contacts
      prisma.contact.count({ where: { storeId } }),
      // Contact opt-in breakdown
      prisma.contact.groupBy({
        by: ['optInStatus'],
        where: { storeId },
        _count: true,
      }),
      // Contact source breakdown
      prisma.contact.groupBy({
        by: ['source'],
        where: { storeId },
        _count: true,
      }),
      // Conversation status breakdown
      prisma.conversation.groupBy({
        by: ['status'],
        where: { storeId },
        _count: true,
      }),
      // Journey stats
      prisma.journey.findMany({
        where: { storeId },
        select: {
          status: true,
          totalEnrollments: true,
          completedEnrollments: true,
        },
      }),
      // Message stats
      prisma.message.groupBy({
        by: ['direction'],
        where: { storeId },
        _count: true,
      }),
    ]);

    // Campaign metrics
    const totalSent = campaigns.reduce((s, c) => s + (c.totalSent ?? 0), 0);
    const totalDelivered = campaigns.reduce((s, c) => s + (c.totalDelivered ?? 0), 0);
    const totalRead = campaigns.reduce((s, c) => s + (c.totalOpened ?? 0), 0);
    const totalClicked = campaigns.reduce((s, c) => s + (c.totalClicked ?? 0), 0);
    const totalConverted = campaigns.reduce((s, c) => s + (c.totalConverted ?? 0), 0);
    const totalFailed = campaigns.reduce((s, c) => s + (c.totalFailed ?? 0), 0);
    const totalRevenue = campaigns.reduce((s, c) => s + (c.totalRevenue ?? 0), 0);
    const activeCampaigns = campaigns.filter(c => c.status === 'RUNNING').length;
    const deliveryRate = totalSent > 0 ? Math.round((totalDelivered / totalSent) * 1000) / 10 : 0;
    const readRate = totalDelivered > 0 ? Math.round((totalRead / totalDelivered) * 1000) / 10 : 0;
    const clickRate = totalRead > 0 ? Math.round((totalClicked / totalRead) * 1000) / 10 : 0;
    const conversionRate = totalSent > 0 ? Math.round((totalConverted / totalSent) * 1000) / 10 : 0;

    // Contact metrics
    const optedIn = contactByOptIn.find(c => c.optInStatus === 'OPTED_IN')?._count ?? 0;
    const optedOut = contactByOptIn.find(c => c.optInStatus === 'OPTED_OUT')?._count ?? 0;
    const bySource: Record<string, number> = {};
    contactBySource.forEach(c => { bySource[c.source] = c._count; });

    // Conversation metrics
    const convMap: Record<string, number> = {};
    conversationStats.forEach(c => { convMap[c.status] = c._count; });

    // Journey metrics
    const activeJourneys = journeys.filter(j => j.status === 'ACTIVE').length;
    const totalEnrollments = journeys.reduce((s, j) => s + (j.totalEnrollments ?? 0), 0);
    const completedEnrollments = journeys.reduce((s, j) => s + (j.completedEnrollments ?? 0), 0);

    // Message metrics
    const inbound = messageStats.find(m => m.direction === 'INBOUND')?._count ?? 0;
    const outbound = messageStats.find(m => m.direction === 'OUTBOUND')?._count ?? 0;
    const totalMessages = inbound + outbound;

    return NextResponse.json({
      campaigns: {
        total: campaigns.length,
        active: activeCampaigns,
        totalSent, totalDelivered, totalRead,
        totalClicked, totalConverted, totalFailed,
        totalRevenue,
        deliveryRate, readRate, clickRate, conversionRate,
      },
      contacts: {
        total: contactTotal,
        optedIn,
        optedOut,
        bySource,
      },
      conversations: {
        total: Object.values(convMap).reduce((s, v) => s + v, 0),
        open: convMap['OPEN'] ?? 0,
        pending: convMap['PENDING'] ?? 0,
        resolved: convMap['RESOLVED'] ?? 0,
        closed: convMap['CLOSED'] ?? 0,
      },
      journeys: {
        total: journeys.length,
        active: activeJourneys,
        totalEnrollments,
        completedEnrollments,
      },
      messages: {
        total: totalMessages,
        inbound,
        outbound,
        totalCost: 0,
      },
    });
  } catch (error) {
    console.error('[WhatsApp Overview Analytics] Error:', error);
    return NextResponse.json(ZERO_OVERVIEW);
  }
}

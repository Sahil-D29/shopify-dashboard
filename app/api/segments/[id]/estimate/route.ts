export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

const MOCK_SEGMENT_ESTIMATES: Record<string, { total: number; estimatedAt: string }> = {
  seg_vip_customers: { total: 1247, estimatedAt: new Date(Date.now() - 1000 * 60 * 5).toISOString() },
  seg_recent_shoppers: { total: 5689, estimatedAt: new Date(Date.now() - 1000 * 60 * 8).toISOString() },
  seg_abandoned_cart: { total: 3298, estimatedAt: new Date(Date.now() - 1000 * 60 * 3).toISOString() },
  seg_loyalty_gold: { total: 879, estimatedAt: new Date(Date.now() - 1000 * 60 * 1).toISOString() },
  seg_email_engaged: { total: 4120, estimatedAt: new Date(Date.now() - 1000 * 60 * 6).toISOString() },
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const resolved = await params;
    const estimate = MOCK_SEGMENT_ESTIMATES[resolved.id];
    if (!estimate) {
      return NextResponse.json({ error: 'Segment not found.' }, { status: 404 });
    }

    return NextResponse.json({
      segmentId: resolved.id,
      total: estimate.total,
      estimatedAt: estimate.estimatedAt,
    });
  } catch (error) {
    console.error('[segments][estimate][GET]', error);
    return NextResponse.json({ error: 'Failed to estimate segment size.' }, { status: 500 });
  }
}




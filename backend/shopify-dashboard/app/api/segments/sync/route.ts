import { NextRequest, NextResponse } from 'next/server';
import { syncAllSegments, getSyncStatus } from '@/lib/jobs/segment-sync-job';
import { requireStoreAccess } from '@/lib/tenant/api-helpers';

/**
 * GET /api/segments/sync
 * Get sync status
 */
export async function GET() {
  try {
    const status = getSyncStatus();
    return NextResponse.json({ status });
  } catch (error) {
    console.error('Error getting sync status:', error);
    return NextResponse.json(
      { error: 'Failed to get sync status' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/segments/sync
 * Force sync all segments
 */
export async function POST(request: NextRequest) {
  try {
    // Require store access
    await requireStoreAccess(request);
    
    // Mark as running
    const { writeJsonFile } = await import('@/lib/utils/json-storage');
    writeJsonFile('segment-sync-status.json', {
      isRunning: true,
      lastRun: undefined,
      nextRun: undefined,
    });

    // Run sync
    const results = await syncAllSegments(request);

    return NextResponse.json({
      success: true,
      results,
      syncedAt: Date.now(),
    });
  } catch (error) {
    console.error('Error syncing segments:', error);
    return NextResponse.json(
      { 
        error: 'Failed to sync segments',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}


import { NextRequest, NextResponse } from 'next/server';
import { readJsonFile } from '@/lib/utils/json-storage';
import { JourneyEnrollment } from '@/lib/types/journey';
import { processEnrollment } from '@/lib/journeys/executor';
import { runJourneyEngine } from '@/lib/journey-engine';
import { getShopifyClient } from '@/lib/shopify/api-helper';

export const runtime = 'nodejs';

interface EnrollmentProcessResult {
  enrollmentId: string;
  status: 'processed' | 'error';
  error?: string;
}

const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/**
 * Process all active journey enrollments
 * This endpoint can be called periodically (cron) or manually
 */
export async function POST(request: NextRequest) {
  try {
    const shopifyClient = getShopifyClient(request);
    const engineSummary = await runJourneyEngine({ shopifyClient, logger: entry => console.info('[journey-engine]', entry) });

    const enrollments = readJsonFile<JourneyEnrollment>('journey-enrollments.json');
    const activeEnrollments = enrollments.filter(e => e.status === 'ACTIVE');
    const results: EnrollmentProcessResult[] = [];

    for (const enrollment of activeEnrollments) {
      try {
        await processEnrollment(enrollment.id, shopifyClient);
        results.push({ enrollmentId: enrollment.id, status: 'processed' });
      } catch (error) {
        results.push({ enrollmentId: enrollment.id, status: 'error', error: getErrorMessage(error) });
      }
    }

    return NextResponse.json({
      processed: results.length,
      results,
      engine: engineSummary,
    });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}


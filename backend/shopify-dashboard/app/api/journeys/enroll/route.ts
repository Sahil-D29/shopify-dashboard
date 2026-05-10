import { NextRequest, NextResponse } from 'next/server';
import { enrollCustomer } from '@/lib/journeys/executor';
import { getShopifyClient } from '@/lib/shopify/api-helper';

export const runtime = 'nodejs';

interface EnrollPayload {
  journeyId: string;
  customerId: string;
}

const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/**
 * Manually enroll a customer in a journey
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<EnrollPayload>;
    const journeyId = typeof body.journeyId === 'string' ? body.journeyId : '';
    const customerId = typeof body.customerId === 'string' ? body.customerId : '';

    if (!journeyId || !customerId) {
      return NextResponse.json({ error: 'journeyId and customerId required' }, { status: 400 });
    }

    const shopifyClient = getShopifyClient(request);
    const enrollment = await enrollCustomer(journeyId, customerId, shopifyClient);

    if (!enrollment) {
      return NextResponse.json({ error: 'Failed to enroll customer' }, { status: 400 });
    }

    return NextResponse.json({ enrollment });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}


import { NextResponse } from 'next/server';

const resolveParams = async (
  params: { experimentId: string } | Promise<{ experimentId: string }>,
): Promise<{ experimentId: string }> => (params instanceof Promise ? params : Promise.resolve(params));

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ experimentId: string }> },
) {
  const { experimentId } = await params;

  return NextResponse.json({
    experimentId,
    status: 'running',
    startedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    results: [
      {
        variantId: 'variant_control',
        variantName: 'Control',
        users: 1250,
        conversions: 75,
        conversionRate: 0.06,
        confidence: null,
        isWinner: false,
        lift: 0,
      },
      {
        variantId: 'variant_b',
        variantName: 'Variant B',
        users: 1250,
        conversions: 95,
        conversionRate: 0.076,
        confidence: 0.89,
        isWinner: false,
        lift: 0.267,
      },
    ],
  });
}



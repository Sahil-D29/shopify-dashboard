import { NextRequest, NextResponse } from 'next/server';

import type { SampleSizeParams, SampleSizeResult } from '@/lib/types/experiment-config';

const Z_SCORES: Record<number, number> = {
  0.9: 1.6449,
  0.95: 1.96,
  0.99: 2.5758,
};

const POWER_Z: Record<number, number> = {
  0.7: 0.5244,
  0.8: 0.8416,
  0.9: 1.2816,
};

function calculateSampleSize(params: SampleSizeParams): SampleSizeResult {
  const baseline = Math.max(0.0001, params.baselineConversionRate);
  const absoluteEffect = baseline * params.minimumDetectableEffect;
  const zAlpha = Z_SCORES[params.confidenceLevel] ?? 1.96;
  const zBeta = POWER_Z[params.statisticalPower] ?? 0.8416;
  const pooledVariance = baseline * (1 - baseline);
  const nPerVariant = Math.ceil(
    ((zAlpha + zBeta) ** 2 * 2 * pooledVariance) / Math.max(absoluteEffect ** 2, 1e-6),
  );
  const usersPerVariant = Math.max(100, nPerVariant);
  const totalUsers = usersPerVariant * params.numberOfVariants;

  return {
    usersPerVariant,
    totalUsers,
    estimatedDays: Math.max(7, Math.ceil(totalUsers / (params.numberOfVariants * 350))),
    confidenceLevel: params.confidenceLevel,
  };
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as SampleSizeParams;
    const result = calculateSampleSize(payload);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[experiments][sample-size][POST]', error);
    return NextResponse.json({ error: 'Failed to calculate sample size.' }, { status: 500 });
  }
}




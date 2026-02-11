import { NextRequest, NextResponse } from 'next/server';

import { readJsonFile } from '@/lib/utils/json-storage';
import type { CustomerSegment } from '@/lib/types/segment';

export const runtime = 'nodejs';

interface PreviewRequestBody {
  triggerType?: string;
  segmentMode?: string;
  segmentId?: string;
  filters?: {
    orderValueOperator?: string;
    orderValueAmount?: number;
    productCategories?: string[];
    customerTags?: string[];
    locationField?: string;
    locationValue?: string;
  };
}

const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as PreviewRequestBody;

    let estimatedCustomers = 0;

    if (body.segmentId) {
      try {
        const segments = readJsonFile<CustomerSegment>('segments.json');
        const segment = segments.find(item => item.id === body.segmentId);
        if (segment?.customerCount != null) {
          estimatedCustomers = segment.customerCount;
        } else if (segment?.totalRevenue != null) {
          estimatedCustomers = Math.max(Math.round(segment.totalRevenue / 100), 0);
        }
      } catch (error) {
        console.warn('[preview-trigger] Unable to read segments store', error);
      }
    }

    if (!estimatedCustomers) {
      // Provide a deterministic pseudo-random fallback based on trigger type + filters.
      const seedSource = JSON.stringify({
        triggerType: body.triggerType,
        segmentId: body.segmentId,
        filters: body.filters,
      });
      let hash = 0;
      for (let idx = 0; idx < seedSource.length; idx += 1) {
        hash = (hash << 5) - hash + seedSource.charCodeAt(idx);
        hash |= 0;
      }
      const normalized = Math.abs(hash % 500) + 25;
      estimatedCustomers = normalized;
    }

    if (body.filters) {
      const filterCount = Object.values(body.filters).reduce<number>((count, value) => {
        if (!value) return count;
        if (Array.isArray(value)) return count + value.length;
        return count + 1;
      }, 0);
      estimatedCustomers = Math.max(Math.floor(estimatedCustomers * (1 - Math.min(filterCount * 0.05, 0.4))), 5);
    }

    return NextResponse.json({ estimatedCustomers });
  } catch (error) {
    console.error('[preview-trigger] Failed to preview trigger', error);
    return NextResponse.json({ error: 'Failed to preview trigger', message: getErrorMessage(error) }, { status: 500 });
  }
}


import type { NextRequest } from 'next/server';
import { handlers } from '@/lib/auth';

// Wrap so Next.js 15 passes (request, context); NextAuth handlers expect (request) only.
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ nextauth?: string[] }> }
) {
  return handlers.GET(request);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ nextauth?: string[] }> }
) {
  return handlers.POST(request);
}


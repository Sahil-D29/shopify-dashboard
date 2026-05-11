import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'ok',
    message: 'Test route is working!',
    timestamp: new Date().toISOString(),
    url: request.url,
  });
}



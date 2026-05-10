import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;
    const tokenHeader = request.headers.get('authorization') || 
                       request.cookies.get('token')?.value;
    
    if (!tokenHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const res = await fetch(`${API_BASE}/api/teams/invitations/${token}/accept`, {
      method: 'POST',
      headers: {
        'Authorization': tokenHeader.startsWith('Bearer ') ? tokenHeader : `Bearer ${tokenHeader}`,
      }
    });
    
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Failed to accept invitation' }));
      return NextResponse.json(error, { status: res.status });
    }
    
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Accept invitation API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { storeId: string; userId: string } }
) {
  try {
    const { storeId, userId } = params;
    const token = request.headers.get('authorization') || 
                 request.cookies.get('token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const res = await fetch(`${API_BASE}/api/teams/${storeId}/members/${userId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`,
      }
    });
    
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Failed to remove team member' }));
      return NextResponse.json(error, { status: res.status });
    }
    
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Remove member API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


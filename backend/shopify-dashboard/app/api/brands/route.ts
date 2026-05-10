import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const storeId = searchParams.get('storeId');
    
    const token = request.headers.get('authorization') || 
                 request.cookies.get('token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const url = `${API_BASE}/api/brands${storeId ? `?storeId=${storeId}` : ''}`;
    const res = await fetch(url, {
      headers: {
        'Authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`,
      }
    });
    
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Failed to fetch brands' }));
      return NextResponse.json(error, { status: res.status });
    }
    
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Brands API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = request.headers.get('authorization') || 
                 request.cookies.get('token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const res = await fetch(`${API_BASE}/api/brands`, {
      method: 'POST',
      headers: {
        'Authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Failed to create brand' }));
      return NextResponse.json(error, { status: res.status });
    }
    
    const data = await res.json();
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Create brand error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


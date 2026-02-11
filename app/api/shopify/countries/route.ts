import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';

    // Common countries list
    const countries = [
      { value: 'US', label: 'United States', name: 'United States', code: 'US' },
      { value: 'CA', label: 'Canada', name: 'Canada', code: 'CA' },
      { value: 'GB', label: 'United Kingdom', name: 'United Kingdom', code: 'GB' },
      { value: 'AU', label: 'Australia', name: 'Australia', code: 'AU' },
      { value: 'DE', label: 'Germany', name: 'Germany', code: 'DE' },
      { value: 'FR', label: 'France', name: 'France', code: 'FR' },
      { value: 'IT', label: 'Italy', name: 'Italy', code: 'IT' },
      { value: 'ES', label: 'Spain', name: 'Spain', code: 'ES' },
      { value: 'NL', label: 'Netherlands', name: 'Netherlands', code: 'NL' },
      { value: 'BE', label: 'Belgium', name: 'Belgium', code: 'BE' },
      { value: 'CH', label: 'Switzerland', name: 'Switzerland', code: 'CH' },
      { value: 'AT', label: 'Austria', name: 'Austria', code: 'AT' },
      { value: 'SE', label: 'Sweden', name: 'Sweden', code: 'SE' },
      { value: 'NO', label: 'Norway', name: 'Norway', code: 'NO' },
      { value: 'DK', label: 'Denmark', name: 'Denmark', code: 'DK' },
      { value: 'FI', label: 'Finland', name: 'Finland', code: 'FI' },
      { value: 'PL', label: 'Poland', name: 'Poland', code: 'PL' },
      { value: 'IE', label: 'Ireland', name: 'Ireland', code: 'IE' },
      { value: 'PT', label: 'Portugal', name: 'Portugal', code: 'PT' },
      { value: 'GR', label: 'Greece', name: 'Greece', code: 'GR' },
      { value: 'JP', label: 'Japan', name: 'Japan', code: 'JP' },
      { value: 'CN', label: 'China', name: 'China', code: 'CN' },
      { value: 'IN', label: 'India', name: 'India', code: 'IN' },
      { value: 'BR', label: 'Brazil', name: 'Brazil', code: 'BR' },
      { value: 'MX', label: 'Mexico', name: 'Mexico', code: 'MX' },
      { value: 'AR', label: 'Argentina', name: 'Argentina', code: 'AR' },
      { value: 'ZA', label: 'South Africa', name: 'South Africa', code: 'ZA' },
      { value: 'NZ', label: 'New Zealand', name: 'New Zealand', code: 'NZ' },
      { value: 'SG', label: 'Singapore', name: 'Singapore', code: 'SG' },
    ];

    let filtered = countries;
    
    // Filter by search query
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = countries.filter(c => 
        c.name.toLowerCase().includes(searchLower) || 
        c.label.toLowerCase().includes(searchLower) ||
        c.code.toLowerCase().includes(searchLower)
      );
    }

    return NextResponse.json({ items: filtered });
  } catch (error) {
    console.error('Error fetching countries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch countries', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}


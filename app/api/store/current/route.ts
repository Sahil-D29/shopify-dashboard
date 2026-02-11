import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/permissions';
import { getShopToken, getAllShops } from '@/lib/token-manager';

/**
 * GET /api/store/current - Get current user's store
 */
export async function GET(request: NextRequest) {
  const { session, error } = await requireAuth();
  if (error) return error;
  
  try {
    // Admins can query specific shop
    if ((session!.user as any).role === 'ADMIN') {
      const shop = request.nextUrl.searchParams.get('shop');
      
      if (shop) {
        const token = await getShopToken(shop);
        return NextResponse.json({
          shop,
          hasToken: !!token,
          // Don't send token to client!
        });
      }
      
      // Return all shops for admin
      const shops = await getAllShops();
      return NextResponse.json({ shops });
    }
    
    // Regular users: return their store
    // This would come from database in full implementation
    const shopDomain = (session!.user as any).store?.shopifyDomain;
    
    if (!shopDomain) {
      return NextResponse.json(
        { error: 'No store associated with this account' },
        { status: 404 }
      );
    }
    
    const hasToken = !!(await getShopToken(shopDomain));
    
    return NextResponse.json({
      shop: shopDomain,
      hasToken,
      storeName: (session!.user as any).store?.storeName,
    });
    
  } catch (err) {
    console.error('Error fetching store:', err);
    return NextResponse.json(
      { error: 'Failed to fetch store' },
      { status: 500 }
    );
  }
}



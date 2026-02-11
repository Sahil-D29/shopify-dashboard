import { NextRequest, NextResponse } from 'next/server';
import type { ShopifyConfig } from '@/lib/store-config';
import { getUserContext } from '@/lib/user-context';

type TestConnectionPayload = ShopifyConfig;

interface ShopifyShopResponse {
  shop?: {
    name?: string;
  };
}

const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export async function POST(request: NextRequest) {
  try {
    // Get user context for authentication
    const userContext = await getUserContext(request);
    if (!userContext) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', message: 'Please sign in' },
        { status: 401 }
      );
    }

    let config: Partial<TestConnectionPayload>;
    try {
      config = (await request.json()) as Partial<TestConnectionPayload>;
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body', message: 'Invalid request format' },
        { status: 400 }
      );
    }

    // Validate the configuration
    if (!config.shopUrl || !config.accessToken || !config.apiKey || !config.apiSecret) {
      return NextResponse.json(
        { success: false, message: 'Missing required configuration fields' },
        { status: 400 }
      );
    }

    // Normalize and validate shop URL format
    // Remove https:// or http:// if present
    let normalizedShopUrl = config.shopUrl.replace(/^https?:\/\//, '').trim();
    // Remove trailing slash
    normalizedShopUrl = normalizedShopUrl.replace(/\/$/, '');
    
    // Validate shop URL format (should be: shopname.myshopify.com)
    const shopUrlPattern = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;
    if (!shopUrlPattern.test(normalizedShopUrl)) {
      return NextResponse.json(
        { 
          success: false, 
          message: `Invalid shop URL format. Expected format: shopname.myshopify.com (got: ${config.shopUrl})` 
        },
        { status: 400 }
      );
    }
    
    // Use normalized shop URL
    const shopUrl = normalizedShopUrl;

    // Test the connection by making a simple API call to Shopify
    // Try latest API version first, then fallback to stable version
    const apiVersion = process.env.SHOPIFY_API_VERSION || '2024-10';
    const testUrl = `https://${shopUrl}/admin/api/${apiVersion}/shop.json`;
    
    console.log('[Test Connection] Testing Shopify connection:', {
      originalShopUrl: config.shopUrl,
      normalizedShopUrl: shopUrl,
      apiVersion,
      testUrl,
      hasAccessToken: !!config.accessToken,
      accessTokenLength: config.accessToken?.length || 0,
    });
    
    const response = await fetch(testUrl, {
      headers: {
        'X-Shopify-Access-Token': config.accessToken,
        'Content-Type': 'application/json',
      },
    });

    // Try to get error details from response
    let errorMessage = `Failed to connect: ${response.status} ${response.statusText}`;
    let errorDetails: any = null;

    if (!response.ok) {
      try {
        const errorData = await response.json().catch(() => null);
        if (errorData) {
          errorDetails = errorData;
          // Shopify API errors are often in error.error_description or error.message
          errorMessage = errorData.error_description || 
                        errorData.error?.message || 
                        errorData.message || 
                        errorMessage;
          
          console.error('[Test Connection] Shopify API error:', {
            status: response.status,
            statusText: response.statusText,
            errorData,
          });
        }
      } catch (parseError) {
        const errorText = await response.text().catch(() => '');
        console.error('[Test Connection] Failed to parse error response:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
        });
      }

      return NextResponse.json(
        { 
          success: false, 
          message: errorMessage,
          error: errorDetails?.error || null,
          status: response.status,
          details: errorDetails,
        },
        { status: 200 } // Return 200 with success: false to show error in UI
      );
    }

    let data: ShopifyShopResponse;
    try {
      data = await response.json();
    } catch (error) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Failed to parse Shopify API response',
          error: getErrorMessage(error),
        },
        { status: 200 } // Return 200 with success: false
      );
    }
    
    return NextResponse.json({
      success: true,
      message: `Successfully connected to ${(data as ShopifyShopResponse).shop?.name || config.shopUrl}`,
      shop: data.shop,
    });
  } catch (error) {
    console.error('Test connection error:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: getErrorMessage(error) || 'An error occurred while testing the connection',
      },
      { status: 500 }
    );
  }
}


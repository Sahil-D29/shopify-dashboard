import { NextResponse } from 'next/server';
import type { ShopifyConfig } from '@/lib/store-config';

type TestConnectionPayload = ShopifyConfig;

interface ShopifyShopResponse {
  shop?: {
    name?: string;
  };
}

const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export async function POST(request: Request) {
  try {
    const config = (await request.json()) as Partial<TestConnectionPayload>;

    // Validate the configuration
    if (!config.shopUrl || !config.accessToken || !config.apiKey || !config.apiSecret) {
      return NextResponse.json(
        { success: false, message: 'Missing required configuration fields' },
        { status: 400 }
      );
    }

    // Validate shop URL format
    const shopUrlPattern = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;
    if (!shopUrlPattern.test(config.shopUrl)) {
      return NextResponse.json(
        { success: false, message: 'Invalid shop URL format' },
        { status: 400 }
      );
    }

    // Test the connection by making a simple API call to Shopify
    const apiVersion = process.env.SHOPIFY_API_VERSION || '2024-10';
    const testUrl = `https://${config.shopUrl}/admin/api/${apiVersion}/shop.json`;
    const response = await fetch(testUrl, {
      headers: {
        'X-Shopify-Access-Token': config.accessToken,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { 
          success: false, 
          message: `Failed to connect: ${response.status} ${response.statusText}` 
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    
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


import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { UserRole, UserStatus } from '@prisma/client';

export interface WhatsAppServerConfig {
  wabaId: string;
  phoneNumberId: string;
  accessToken: string;
  appId: string;
  appSecret: string;
  webhookVerifyToken?: string;
  contactEmail?: string;
  connectedPhoneNumber?: string;
  isVerified: boolean;
  configuredAt: number;
}

// GET - Retrieve WhatsApp configuration
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    let storeId = searchParams.get('storeId');

    if (!storeId) {
      // No store in query (e.g. "No stores" in UI). Resolve current user's first store.
      const session = await auth();
      if (!session?.user?.id) {
        return NextResponse.json(
          { success: false, message: 'Store ID is required' },
          { status: 400 }
        );
      }
      const userEmail = (session.user.email || '').toLowerCase();
      const dbUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true },
      });
      const userForOwner = dbUser || await prisma.user.findUnique({
        where: { email: userEmail },
        select: { id: true },
      });
      if (!userForOwner) {
        return NextResponse.json({
          success: false,
          message: 'WhatsApp not configured',
          config: null,
        });
      }
      const firstStore = await prisma.store.findFirst({
        where: { ownerId: userForOwner.id },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      storeId = firstStore?.id ?? null;
    }

    if (!storeId) {
      return NextResponse.json({
        success: false,
        message: 'WhatsApp not configured',
        config: null,
      });
    }

    const config = await prisma.whatsAppConfig.findUnique({
      where: { storeId }
    });
    
    if (!config) {
      return NextResponse.json({
        success: false,
        message: 'WhatsApp not configured',
        config: null,
      });
    }

    // Return config without sensitive data for display
    const safeConfig = {
      storeId: config.storeId,
      phoneNumberId: config.phoneNumberId,
      businessAccountId: config.businessAccountId,
      accessToken: config.accessToken ? '••••••••' + config.accessToken.slice(-8) : '',
      webhookVerifyToken: config.webhookVerifyToken ? '••••••••' : '',
      isConfigured: config.isConfigured,
      templates: config.templates,
      settings: config.settings,
    };

    return NextResponse.json({
      success: true,
      config: safeConfig,
      isConfigured: config.isConfigured,
    });
  } catch (error) {
    console.error('[WhatsApp Config] GET error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to read configuration' },
      { status: 500 }
    );
  }
}

// POST - Save WhatsApp configuration
export async function POST(request: NextRequest) {
  try {
    let body: any;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        { success: false, message: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }
    
    let storeId = body?.storeId;
    if (!storeId) {
      // Require a valid database so we can create/find user and default store (Neon adapter needs DATABASE_URL)
      const dbUrl = process.env.DATABASE_URL;
      if (!dbUrl || typeof dbUrl !== 'string' || !dbUrl.startsWith('postgres')) {
        return NextResponse.json(
          {
            success: false,
            message: 'Database is not configured. Add DATABASE_URL to your .env file (e.g. a Neon Postgres connection string) so WhatsApp can be saved without a store.',
          },
          { status: 503 }
        );
      }

      // No store selected (e.g. "No stores" / Shopify not configured yet). Get or create a default store for the current user.
      let session;
      try {
        session = await auth();
      } catch (authError) {
        console.error('[WhatsApp Config] auth() error:', authError);
        return NextResponse.json(
          { success: false, message: 'Session error. Please sign in again.' },
          { status: 401 }
        );
      }
      if (!session?.user?.id || !session?.user?.email) {
        return NextResponse.json(
          { success: false, message: 'Unauthorized. Please sign in again.' },
          { status: 401 }
        );
      }
      const userEmail = (session.user.email || '').toLowerCase().trim();
      const userName = (session.user.name || 'User').trim() || 'User';

      let ownerId: string;
      try {
        // Ensure Prisma User exists (find or create)
        let owner: { id: string };
        const existingUser = await prisma.user.findUnique({
          where: { email: userEmail },
          select: { id: true },
        });
        if (existingUser) {
          owner = existingUser;
        } else {
          const created = await prisma.user.create({
            data: {
              email: userEmail,
              name: userName,
              passwordHash: null,
              role: UserRole.STORE_OWNER,
              status: UserStatus.ACTIVE,
            },
            select: { id: true },
          });
          owner = created;
        }
        ownerId = owner.id;
      } catch (dbError) {
        const msg = dbError instanceof Error ? dbError.message : String(dbError);
        if (msg.includes('Invalid URL') || msg.includes('connection')) {
          return NextResponse.json(
            {
              success: false,
              message: 'Database connection failed. Set a valid DATABASE_URL in your .env (e.g. from Neon).',
            },
            { status: 503 }
          );
        }
        throw dbError;
      }

      const existingStore = await prisma.store.findFirst({
        where: { ownerId },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      if (existingStore) {
        storeId = existingStore.id;
      } else {
        const uniqueSuffix = randomBytes(4).toString('hex');
        const defaultDomain = `default-${ownerId.slice(0, 8)}-${uniqueSuffix}.myshopify.com`;
        const defaultStoreId = `store_default_${ownerId.slice(0, 8)}_${uniqueSuffix}`;
        const newStore = await prisma.store.create({
          data: {
            shopifyDomain: defaultDomain,
            shopifyStoreId: defaultStoreId,
            storeName: 'My Store',
            accessToken: 'pending',
            scope: 'pending',
            isActive: true,
            ownerId,
          },
        });
        storeId = newStore.id;
      }
    }

    // Validate required fields
    if (!body.phoneNumberId || !body.accessToken) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields: phoneNumberId, accessToken' },
        { status: 400 }
      );
    }

    // Upsert configuration
    const config = await prisma.whatsAppConfig.upsert({
      where: { storeId },
      create: {
        storeId,
        phoneNumberId: body.phoneNumberId,
        businessAccountId: body.businessAccountId || body.wabaId,
        accessToken: body.accessToken,
        webhookVerifyToken: body.webhookVerifyToken,
        isConfigured: true,
        templates: body.templates || [],
        settings: {
          contactEmail: body.contactEmail,
          connectedPhoneNumber: body.connectedPhoneNumber,
          isVerified: body.isVerified || false,
        }
      },
      update: {
        phoneNumberId: body.phoneNumberId,
        businessAccountId: body.businessAccountId || body.wabaId,
        accessToken: body.accessToken,
        webhookVerifyToken: body.webhookVerifyToken,
        isConfigured: true,
        templates: body.templates,
        settings: {
          contactEmail: body.contactEmail,
          connectedPhoneNumber: body.connectedPhoneNumber,
          isVerified: body.isVerified,
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: 'WhatsApp configuration saved successfully',
      config: {
        storeId: config.storeId,
        phoneNumberId: config.phoneNumberId,
        isConfigured: config.isConfigured
      },
      storeId: config.storeId, // So frontend can refresh store list / set current store
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[WhatsApp Config] POST error:', err.message, err.stack);
    return NextResponse.json(
      { success: false, message: err.message || 'Failed to save configuration' },
      { status: 500 }
    );
  }
}

// DELETE - Clear WhatsApp configuration
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId');

    if (!storeId) {
      return NextResponse.json(
        { success: false, message: 'Store ID is required' },
        { status: 400 }
      );
    }

    await prisma.whatsAppConfig.delete({
      where: { storeId }
    });

    return NextResponse.json({
      success: true,
      message: 'WhatsApp configuration cleared',
    });
  } catch (error) {
    console.error('[WhatsApp Config] DELETE error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to clear configuration' },
      { status: 500 }
    );
  }
}


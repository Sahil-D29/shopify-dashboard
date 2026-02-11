import { prisma } from '@/lib/prisma';

export interface Store {
  id: string;
  name: string;
  shopDomain: string;
  owner: string;
  status: 'active' | 'inactive' | 'suspended';
  plan: 'free' | 'basic' | 'pro' | 'enterprise';
  createdAt: string;
  usersCount?: number;
  messagesCount?: number;
  lastSync?: string;
  settings?: {
    timezone?: string;
    currency?: string;
  };
}

// Read store registry from database
export async function readStoreRegistry(): Promise<Store[]> {
  try {
    const stores = await prisma.store.findMany({
      include: {
        owner: true,
        subscriptions: {
          where: { status: 'ACTIVE' },
          take: 1,
          orderBy: { createdAt: 'desc' }
        },
        _count: {
          select: {
            members: true,
            campaigns: true
          }
        }
      }
    });

    return stores.map((s: any) => ({
      id: s.id,
      name: s.storeName,
      shopDomain: s.shopifyDomain,
      owner: s.owner.email,
      status: s.isActive ? 'active' : 'inactive',
      plan: (s.subscriptions[0]?.planId || 'free') as Store['plan'],
      createdAt: s.createdAt.toISOString(),
      usersCount: s._count.members + 1, // members + owner
      messagesCount: s._count.campaigns,
      lastSync: s.updatedAt.toISOString(),
    }));
  } catch (error) {
    console.error('Error reading store registry from database:', error);
    // Return empty array instead of default store
    return [];
  }
}

// Write store registry (deprecated - use direct store creation)
export async function writeStoreRegistry(stores: Store[]): Promise<void> {
  console.warn('writeStoreRegistry is deprecated. Use store repository methods instead.');
  // This function is now a no-op as we use database
}

// Get stores the user has access to (owner or member)
export async function getStoresForUser(userId: string): Promise<Store[]> {
  try {
    const stores = await prisma.store.findMany({
      where: {
        OR: [
          { ownerId: userId },
          { members: { some: { userId, status: 'ACTIVE' } } },
        ],
      },
      include: {
        owner: true,
        subscriptions: {
          where: { status: 'ACTIVE' },
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: { members: true, campaigns: true },
        },
      },
    });
    return stores.map((s: any) => ({
      id: s.id,
      name: s.storeName,
      shopDomain: s.shopifyDomain,
      owner: s.owner.email,
      status: s.isActive ? 'active' : 'inactive',
      plan: (s.subscriptions[0]?.planId || 'free') as Store['plan'],
      createdAt: s.createdAt.toISOString(),
      usersCount: s._count.members + 1,
      messagesCount: s._count.campaigns,
      lastSync: s.updatedAt.toISOString(),
    }));
  } catch (error) {
    console.error('Error getStoresForUser:', error);
    return [];
  }
}

// Find store by ID
export async function findStoreById(storeId: string): Promise<Store | null> {
  try {
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      include: {
        owner: true,
        subscriptions: {
          where: { status: 'ACTIVE' },
          take: 1
        },
        _count: {
          select: {
            members: true,
            campaigns: true
          }
        }
      }
    });

    if (!store) return null;

    return {
      id: store.id,
      name: store.storeName,
      shopDomain: store.shopifyDomain,
      owner: store.owner.email,
      status: store.isActive ? 'active' : 'inactive',
      plan: (store.subscriptions[0]?.planId || 'free') as Store['plan'],
      createdAt: store.createdAt.toISOString(),
      usersCount: store._count.members + 1,
      messagesCount: store._count.campaigns,
      lastSync: store.updatedAt.toISOString(),
    };
  } catch (error) {
    console.error('Error finding store:', error);
    return null;
  }
}

// Create new store with creator as OWNER (Store + StoreMember)
export async function createStoreForUser(
  creatorId: string,
  data: { name: string; shopDomain: string }
): Promise<Store> {
  const raw = data.shopDomain.trim().toLowerCase();
  const normalizedDomain = raw.endsWith('.myshopify.com')
    ? raw
    : `${raw.replace(/\.myshopify\.com$/i, '')}.myshopify.com`;

  const existingStore = await prisma.store.findUnique({
    where: { shopifyDomain: normalizedDomain },
  });
  if (existingStore) {
    throw new Error('Store with this domain already exists');
  }

  const store = await prisma.store.create({
    data: {
      shopifyDomain: normalizedDomain,
      shopifyStoreId: `store_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      storeName: data.name,
      accessToken: 'placeholder_token',
      scope: 'read_products,write_products',
      ownerId: creatorId,
      isActive: true,
    },
    include: {
      owner: true,
      _count: { select: { members: true, campaigns: true } },
    },
  });

  await prisma.storeMember.create({
    data: {
      userId: creatorId,
      storeId: store.id,
      role: 'OWNER',
      status: 'ACTIVE',
    },
  });

  return {
    id: store.id,
    name: store.storeName,
    shopDomain: store.shopifyDomain,
    owner: store.owner.email,
    status: 'active',
    plan: 'free',
    createdAt: store.createdAt.toISOString(),
    usersCount: store._count.members + 1,
    messagesCount: 0,
    lastSync: store.updatedAt.toISOString(),
  };
}

// Create new store (admin/legacy: owner by email)
export async function createStore(storeData: {
  name: string;
  shopDomain: string;
  owner: string;
  plan?: 'free' | 'basic' | 'pro';
}): Promise<Store> {
  const existingStore = await prisma.store.findUnique({
    where: { shopifyDomain: storeData.shopDomain },
  });
  if (existingStore) {
    throw new Error('Store with this domain already exists');
  }

  let owner = await prisma.user.findUnique({
    where: { email: storeData.owner },
  });
  if (!owner) {
    owner = await prisma.user.create({
      data: {
        email: storeData.owner,
        name: storeData.owner.split('@')[0],
        role: 'STORE_OWNER',
        status: 'ACTIVE',
      },
    });
  }

  const storeId = `store_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  await prisma.store.create({
    data: {
      id: storeId,
      shopifyDomain: storeData.shopDomain,
      shopifyStoreId: storeId,
      storeName: storeData.name,
      accessToken: 'placeholder_token',
      scope: 'read_products,write_products',
      ownerId: owner.id,
      isActive: true,
    },
  });

  await prisma.storeMember.create({
    data: {
      userId: owner.id,
      storeId,
      role: 'OWNER',
      status: 'ACTIVE',
    },
  });

  return (await findStoreById(storeId))!;
}

// Update store
export async function updateStore(
  storeId: string,
  updates: Partial<Store>
): Promise<Store> {
  const store = await prisma.store.findUnique({
    where: { id: storeId }
  });

  if (!store) {
    throw new Error('Store not found');
  }

  const updateData: any = {};
  if (updates.name) updateData.storeName = updates.name;
  if (updates.status !== undefined) updateData.isActive = updates.status === 'active';

  await prisma.store.update({
    where: { id: storeId },
    data: updateData
  });

  return await findStoreById(storeId) as Store;
}

// Delete store
export async function deleteStore(storeId: string): Promise<void> {
  try {
    await prisma.store.delete({
      where: { id: storeId }
    });
  } catch (error) {
    throw new Error('Store not found');
  }
}

// Get store statistics
export async function getStoreStats(storeId: string): Promise<{
  usersCount: number;
  messagesCount: number;
  lastSync?: string;
}> {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    include: {
      _count: {
        select: {
          members: true,
          campaigns: true
        }
      }
    }
  });

  if (!store) {
    return {
      usersCount: 0,
      messagesCount: 0
    };
  }

  // Calculate messages from campaigns
  const campaignStats = await prisma.campaign.aggregate({
    where: { storeId },
    _sum: {
      totalSent: true
    }
  });

  return {
    usersCount: store._count.members + 1, // members + owner
    messagesCount: campaignStats._sum.totalSent || 0,
    lastSync: store.updatedAt.toISOString()
  };
}


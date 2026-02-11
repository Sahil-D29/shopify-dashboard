import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin-auth';
import { readAllUsers, createStoreUser } from '@/lib/store-users';
import { prisma } from '@/lib/prisma';

// Map Prisma StoreRole + OWNER to admin panel role
function toAdminRole(role: string): 'admin' | 'manager' | 'builder' | 'viewer' {
  const r = (role || '').toUpperCase();
  if (r === 'OWNER') return 'admin';
  if (r === 'MANAGER') return 'manager';
  if (r === 'TEAM_MEMBER') return 'builder';
  return 'viewer';
}

// GET /api/admin/users - List all users (Prisma + legacy store-users) with filters
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const { searchParams } = request.nextUrl;
    const search = searchParams.get('search') || '';
    const role = searchParams.get('role');
    const status = searchParams.get('status');
    const storeId = searchParams.get('storeId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    type AdminUserRow = {
      id: string;
      name: string;
      email: string;
      phone?: string;
      storeId: string;
      role: 'admin' | 'manager' | 'builder' | 'viewer';
      status: 'active' | 'inactive' | 'deleted';
      createdAt: string;
      lastLogin?: string;
      _source?: 'prisma' | 'legacy';
    };

    const rows: AdminUserRow[] = [];

    // 1. Prisma users (all users who have a store: owner or member)
    const prismaUsers = await prisma.user.findMany({
      where: { role: { not: 'SUPER_ADMIN' } },
      include: {
        ownedStores: { select: { id: true, storeName: true } },
        storeMembers: { include: { store: { select: { id: true, storeName: true } } } },
      },
    });

    for (const u of prismaUsers) {
      const userStatus = u.status === 'ACTIVE' ? 'active' : 'inactive';
      // One row per store: owner of store (use StoreMember.role if set, else admin)
      for (const store of u.ownedStores) {
        const memberForStore = u.storeMembers.find((m) => m.storeId === store.id);
        const role = memberForStore ? toAdminRole(memberForStore.role) : 'admin';
        rows.push({
          id: u.id,
          name: u.name,
          email: u.email,
          storeId: store.id,
          role,
          status: userStatus,
          createdAt: u.createdAt.toISOString(),
          lastLogin: u.lastLogin?.toISOString(),
          _source: 'prisma',
        });
      }
      // One row per store: member (not owner)
      for (const m of u.storeMembers) {
        if (u.ownedStores.some((s) => s.id === m.storeId)) continue; // already added as owner
        const memberStatus = m.status === 'ACTIVE' ? 'active' : m.status === 'PENDING' ? 'inactive' : 'inactive';
        rows.push({
          id: u.id,
          name: u.name,
          email: u.email,
          storeId: m.storeId,
          role: toAdminRole(m.role),
          status: memberStatus,
          createdAt: m.joinedAt.toISOString(),
          _source: 'prisma',
        });
      }
      // User with no store yet (e.g. just signed up): show once with placeholder
      if (u.ownedStores.length === 0 && u.storeMembers.length === 0) {
        rows.push({
          id: u.id,
          name: u.name,
          email: u.email,
          storeId: '',
          role: 'viewer',
          status: u.status === 'ACTIVE' ? 'active' : 'inactive',
          createdAt: u.createdAt.toISOString(),
          lastLogin: u.lastLogin?.toISOString(),
          _source: 'prisma',
        });
      }
    }

    // 2. Legacy store-users (JSON) – add if email not already in rows
    const legacyUsers = await readAllUsers();
    const prismaEmails = new Set(rows.map((r) => r.email.toLowerCase()));
    for (const u of legacyUsers) {
      if (prismaEmails.has(u.email.toLowerCase())) continue;
      rows.push({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        storeId: u.storeId,
        role: u.role,
        status: u.status,
        createdAt: u.createdAt,
        lastLogin: u.lastLogin,
        _source: 'legacy',
      });
    }

    // Filters
    let filtered = rows;
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (u) =>
          u.name.toLowerCase().includes(searchLower) ||
          u.email.toLowerCase().includes(searchLower) ||
          u.phone?.toLowerCase().includes(searchLower)
      );
    }
    if (role) filtered = filtered.filter((u) => u.role === role);
    if (status) filtered = filtered.filter((u) => u.status === status);
    if (storeId) filtered = filtered.filter((u) => u.storeId === storeId);
    if (status !== 'deleted') {
      filtered = filtered.filter((u) => u.status !== 'deleted');
    }

    // Sort by created date (newest first)
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const total = filtered.length;
    const startIndex = (page - 1) * limit;
    const paginatedUsers = filtered.slice(startIndex, startIndex + limit).map(({ _source, ...rest }) => rest);

    return NextResponse.json({
      users: paginatedUsers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    if (error.message === 'Admin authentication required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Get users error:', error);
    return NextResponse.json({ error: 'An error occurred' }, { status: 500 });
  }
}

// POST /api/admin/users - Create new user
export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);

    const body = await request.json();
    const { name, email, password, phone, storeId, role, sendWelcomeEmail } = body;

    // Validation
    if (!name || !email || !password || !storeId || !role) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate role
    const validRoles = ['admin', 'manager', 'builder', 'viewer'];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    // Validate password strength
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    // Create user
    const user = await createStoreUser(storeId, {
      name,
      email,
      password,
      phone,
      role,
    });

    // TODO: Send welcome email if requested
    if (sendWelcomeEmail) {
      // Implement email sending
    }

    // Log action
    const adminSession = await requireAdmin(request);
    await import('@/lib/auth/admin-auth').then(({ logAdminAction }) =>
      logAdminAction(
        adminSession.userId,
        'user_created',
        { userId: user.id, email: user.email, role: user.role },
        request.headers.get('x-forwarded-for') || null,
        'success'
      )
    );

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        storeId: user.storeId,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
      },
    });
  } catch (error: any) {
    if (error.message === 'Admin authentication required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (error.message.includes('already exists')) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    console.error('Create user error:', error);
    return NextResponse.json({ error: 'An error occurred' }, { status: 500 });
  }
}


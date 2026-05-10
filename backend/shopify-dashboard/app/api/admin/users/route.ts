import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin-auth';
import { readAllUsers, createStoreUser } from '@/lib/store-users';

// GET /api/admin/users - List all users with filters
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

    let users = await readAllUsers();

    // Filter by search term
    if (search) {
      const searchLower = search.toLowerCase();
      users = users.filter(
        (u) =>
          u.name.toLowerCase().includes(searchLower) ||
          u.email.toLowerCase().includes(searchLower) ||
          u.phone?.includes(search)
      );
    }

    // Filter by role
    if (role) {
      users = users.filter((u) => u.role === role);
    }

    // Filter by status
    if (status) {
      users = users.filter((u) => u.status === status);
    }

    // Filter by store
    if (storeId) {
      users = users.filter((u) => u.storeId === storeId);
    }

    // Exclude deleted users unless explicitly requested
    if (status !== 'deleted') {
      users = users.filter((u) => u.status !== 'deleted');
    }

    // Sort by created date (newest first)
    users.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Pagination
    const total = users.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedUsers = users.slice(startIndex, endIndex);

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


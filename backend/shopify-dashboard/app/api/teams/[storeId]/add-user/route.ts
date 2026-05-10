import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { findUserByEmail } from '@/lib/fileAuth';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const TEAMS_FILE = path.join(process.cwd(), 'data', 'teams.json');

async function loadTeams() {
  try {
    const data = await fs.readFile(TEAMS_FILE, 'utf-8');
    return JSON.parse(data || '{"teams": []}');
  } catch {
    await fs.mkdir(path.dirname(TEAMS_FILE), { recursive: true });
    await fs.writeFile(TEAMS_FILE, JSON.stringify({ teams: [] }, null, 2));
    return { teams: [] };
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ storeId: string }> | { storeId: string } }
) {
  try {
    // Handle both sync and async params (Next.js 15+)
    const params = context.params;
    const resolvedParams = params instanceof Promise ? await params : params;
    const storeId = resolvedParams.storeId;
    
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[API] Adding user, requested by:', session.user.email);

    // Get role from session first, then fallback to database
    let userRole = (session.user as any).role;
    const userEmail = session.user.email || '';
    
    // If role not in session, fetch from database
    if (!userRole && userEmail) {
      try {
        const user = await findUserByEmail(userEmail);
        if (user) {
          userRole = (user as any).role;
        }
      } catch (error) {
        console.warn('[API] Could not fetch user from database:', error);
      }
    }
    
    // Normalize role for checking
    const normalizedRole = userRole ? userRole.toUpperCase().replace(/_/g, '') : '';
    const canAdd = ['ADMIN', 'SUPERADMIN', 'MANAGER'].includes(normalizedRole);
    
    console.log('[API] User role:', userRole, 'Normalized:', normalizedRole, 'Can add:', canAdd);
    
    if (!canAdd) {
      return NextResponse.json({ 
        error: 'Forbidden - Only admins can add users',
        message: `Your role (${userRole || 'none'}) does not have permission to add team members`
      }, { status: 403 });
    }

    const { email, role: newRole } = await req.json();
    if (!email || !newRole) {
      return NextResponse.json({ error: 'Email and role are required' }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    const teamsData = await loadTeams();
    let team = teamsData.teams?.find((t: any) => t.storeId === storeId);
    if (!team) {
      team = { storeId: storeId, members: [], pendingUsers: [] };
      teamsData.teams = teamsData.teams || [];
      teamsData.teams.push(team);
    }

    const existsMember = team.members?.some((m: any) => m.email === email);
    if (existsMember) {
      return NextResponse.json({ error: 'User is already a team member' }, { status: 400 });
    }

    const existsPending = team.pendingUsers?.some((u: any) => u.email === email);
    if (existsPending) {
      return NextResponse.json({ error: 'User is already in the pending list' }, { status: 400 });
    }

    const pendingUser = {
      id: crypto.randomUUID(),
      email,
      role: newRole,
      addedBy: session.user.email,
      addedAt: new Date().toISOString(),
      status: 'pending',
    };

    team.pendingUsers = team.pendingUsers || [];
    team.pendingUsers.push(pendingUser);

    await fs.mkdir(path.dirname(TEAMS_FILE), { recursive: true });
    await fs.writeFile(TEAMS_FILE, JSON.stringify(teamsData, null, 2));

    console.log('[API] User added to pending list:', email);

    return NextResponse.json({
      success: true,
      message: 'User added successfully. They will get access when they sign in.',
      user: {
        id: pendingUser.id,
        email: pendingUser.email,
        role: pendingUser.role,
        status: pendingUser.status,
      },
    });
  } catch (error) {
    console.error('[API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


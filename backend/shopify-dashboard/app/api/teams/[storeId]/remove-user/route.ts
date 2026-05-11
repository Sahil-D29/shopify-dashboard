import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import fs from 'fs/promises';
import path from 'path';

const TEAMS_FILE = path.join(process.cwd(), 'data', 'teams.json');

async function loadTeams() {
  const data = await fs.readFile(TEAMS_FILE, 'utf-8');
  return JSON.parse(data || '{"teams": []}');
}

export async function DELETE(
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

    const role = (session.user as any).role?.toUpperCase?.() || '';
    const canRemove = ['ADMIN', 'SUPER_ADMIN', 'SUPERADMIN'].includes(role);
    if (!canRemove) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    let teamsData;
    try {
      teamsData = await loadTeams();
    } catch {
      return NextResponse.json({ error: 'Team data not found' }, { status: 404 });
    }

    const team = teamsData.teams?.find((t: any) => t.storeId === storeId);
    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    team.members = team.members?.filter((m: any) => m.email !== email) || [];
    team.pendingUsers = team.pendingUsers?.filter((u: any) => u.email !== email) || [];

    await fs.writeFile(TEAMS_FILE, JSON.stringify(teamsData, null, 2));

    return NextResponse.json({ success: true, message: 'User removed successfully' });
  } catch (error) {
    console.error('[API] Error removing user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


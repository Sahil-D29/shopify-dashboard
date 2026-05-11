import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { findUserByEmail } from '@/lib/fileAuth';
import fs from 'fs/promises';
import path from 'path';

const TEAMS_FILE = path.join(process.cwd(), 'data', 'teams.json');

async function ensureTeamsFile() {
  try {
    await fs.access(TEAMS_FILE);
  } catch {
    await fs.mkdir(path.dirname(TEAMS_FILE), { recursive: true });
    await fs.writeFile(TEAMS_FILE, JSON.stringify({ teams: [] }, null, 2));
  }
}

async function loadTeams() {
  await ensureTeamsFile();
  const content = await fs.readFile(TEAMS_FILE, 'utf-8');
  return JSON.parse(content || '{"teams": []}');
}

function normalizeRole(role: string | undefined): string {
  if (!role) return '';
  // Remove underscores and convert to uppercase
  return role.toUpperCase().replace(/_/g, '');
}

function canAccessTeam(role: string): boolean {
  const normalized = normalizeRole(role);
  const allowed = ['ADMIN', 'SUPERADMIN', 'MANAGER', 'OWNER', 'STOREOWNER'];
  return allowed.includes(normalized);
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ storeId: string }> | { storeId: string } }
) {
  try {
    // Handle both sync and async params (Next.js 15+)
    const params = context.params;
    const resolvedParams = params instanceof Promise ? await params : params;
    const storeId = resolvedParams.storeId;
    
    console.log('\n=== Team API GET Request ===');
    console.log('Store ID:', storeId);
    
    // Check authentication
    const session = await auth();
    
    if (!session || !session.user) {
      console.log('❌ No session found');
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Please sign in' },
        { status: 401 }
      );
    }

    const userEmail = session.user.email || '';
    console.log('✓ User:', userEmail);
    
    // Get role from session first, then fallback to database
    let userRole = (session.user as any).role;
    console.log('✓ Role from session:', userRole || '(not found)');
    
    // If role not in session, fetch from database
    if (!userRole && userEmail) {
      try {
        const user = await findUserByEmail(userEmail);
        if (user) {
          userRole = (user as any).role;
          console.log('✓ Role from database:', userRole || '(not found)');
        }
      } catch (error) {
        console.warn('⚠ Could not fetch user from database:', error);
      }
    }
    
    // Check permissions
    if (!canAccessTeam(userRole)) {
      console.log('❌ Permission denied');
      console.log('   User role:', userRole);
      console.log('   Normalized:', normalizeRole(userRole));
      console.log('   Required: admin, super_admin, manager, store_owner');
      
      return NextResponse.json(
        { 
          error: 'Forbidden',
          message: `Your role (${userRole || 'none'}) cannot access team management`,
          requiredRoles: ['admin', 'super_admin', 'manager', 'store_owner']
        },
        { status: 403 }
      );
    }

    console.log('✓ Permission granted');

    // Load team data
    const teamsData = await loadTeams();
    let team = teamsData.teams?.find((t: any) => t.storeId === storeId);

    if (!team) {
      console.log('Creating default team structure');
      team = {
        storeId: storeId,
        members: [],
        pendingUsers: []
      };
    }

    console.log('✓ Team loaded');
    console.log('  Members:', team.members?.length || 0);
    console.log('  Pending:', team.pendingUsers?.length || 0);
    console.log('=== Request Complete ===\n');

    return NextResponse.json({ team });

  } catch (error) {
    console.error('❌ Error in Team API:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}


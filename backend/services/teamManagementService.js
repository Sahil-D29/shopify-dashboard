// backend/services/teamManagementService.js
import { readFileSafe, writeFileSafe } from '../utils/fileStorage.js';
import { v4 as uuidv4 } from 'uuid';
import { logActivity } from '../utils/logger.js';
import { getSubscriptionByUserId } from './subscriptionsService.js';
import { getPlanFeatures } from './subscriptionsService.js';

/**
 * Get store team data
 */
async function getStoreTeams() {
  const data = await readFileSafe('store-teams.json', { default: { teams: [] } });
  return data.teams || [];
}

/**
 * Get invitations data
 */
async function getInvitations() {
  const data = await readFileSafe('invitations.json', { default: { invitations: [] } });
  return data.invitations || [];
}

/**
 * Get users data
 */
async function getUsers() {
  const data = await readFileSafe('users.json', { default: { users: [] } });
  return data.users || [];
}

/**
 * Update users data
 */
async function updateUsers(users) {
  await writeFileSafe('users.json', { users });
}

/**
 * Get team members for a store
 */
export async function getStoreTeam(storeId) {
  const teams = await getStoreTeams();
  const team = teams.find(t => t.storeId === storeId);
  
  if (!team) {
    return {
      storeId,
      ownerId: null,
      teamMembers: []
    };
  }
  
  // Enrich with user details
  const users = await getUsers();
  const enrichedMembers = team.teamMembers.map(member => {
    const user = users.find(u => u.id === member.userId);
    return {
      ...member,
      user: user ? {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        lastLogin: user.lastLogin
      } : null
    };
  });
  
  return {
    ...team,
    teamMembers: enrichedMembers
  };
}

/**
 * Check team member limits based on subscription plan
 */
async function checkTeamMemberLimit(storeId, ownerId) {
  const subscription = await getSubscriptionByUserId(ownerId);
  
  if (!subscription) {
    throw new Error('Store owner does not have an active subscription');
  }
  
  const plan = await getPlanFeatures(subscription.planType);
  if (!plan) {
    throw new Error('Invalid subscription plan');
  }
  
  // Get current team count
  const team = await getStoreTeam(storeId);
  const currentCount = team.teamMembers.length;
  
  // Check limits based on plan
  // Get team member limit from plan features
  const teamMemberLimit = plan.features?.teamMembersPerStore;
  let maxMembers = teamMemberLimit !== undefined ? teamMemberLimit : 0;
  
  // Fallback to defaults if not in plan features
  if (maxMembers === 0) {
    if (subscription.planType === 'basic') {
      maxMembers = 2;
    } else if (subscription.planType === 'pro') {
      maxMembers = 10;
    } else if (subscription.planType === 'enterprise') {
      maxMembers = -1; // Unlimited
    }
  }
  
  if (maxMembers !== -1 && currentCount >= maxMembers) {
    throw new Error(`Team member limit reached. Your ${subscription.planType} plan allows ${maxMembers} team members.`);
  }
  
  return true;
}

/**
 * Invite a team member
 */
export async function inviteTeamMember(storeId, email, role, permissions, invitedBy) {
  // Validate role
  const validRoles = ['manager', 'team_member', 'viewer'];
  if (!validRoles.includes(role)) {
    throw new Error(`Invalid role. Allowed roles: ${validRoles.join(', ')}`);
  }
  
  // Check if user already exists
  const users = await getUsers();
  const existingUser = users.find(u => u.email === email);
  
  // Check if already a team member
  const team = await getStoreTeam(storeId);
  if (existingUser) {
    const isAlreadyMember = team.teamMembers.some(m => m.userId === existingUser.id);
    if (isAlreadyMember) {
      throw new Error('User is already a team member of this store');
    }
  }
  
  // Check team member limits
  const ownerId = team.ownerId || invitedBy;
  await checkTeamMemberLimit(storeId, ownerId);
  
  // Check for existing pending invitation
  const invitations = await getInvitations();
  const existingInvitation = invitations.find(
    inv => inv.email === email && inv.storeId === storeId && inv.status === 'pending'
  );
  
  if (existingInvitation) {
    throw new Error('An invitation is already pending for this email');
  }
  
  // Create invitation
  const invitationId = `inv_${uuidv4()}`;
  const token = uuidv4();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry
  
  const invitation = {
    id: invitationId,
    email,
    storeId,
    role,
    permissions: permissions || [],
    invitedBy,
    invitedAt: new Date().toISOString(),
    expiresAt: expiresAt.toISOString(),
    status: 'pending',
    token
  };
  
  invitations.push(invitation);
  await writeFileSafe('invitations.json', { invitations });
  
  // Log activity
  await logActivity({
    userId: invitedBy,
    storeId,
    action: 'user_invited',
    details: {
      invitedEmail: email,
      role,
      invitationId
    },
    timestamp: new Date().toISOString()
  });
  
  return {
    invitation,
    invitationLink: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/accept-invitation?token=${token}`
  };
}

/**
 * Accept invitation
 */
export async function acceptInvitation(token, userId) {
  const invitations = await getInvitations();
  const invitation = invitations.find(inv => inv.token === token && inv.status === 'pending');
  
  if (!invitation) {
    throw new Error('Invalid or expired invitation');
  }
  
  // Check expiry
  if (new Date(invitation.expiresAt) < new Date()) {
    invitation.status = 'expired';
    await writeFileSafe('invitations.json', { invitations });
    throw new Error('Invitation has expired');
  }
  
  // Get user
  const users = await getUsers();
  const user = users.find(u => u.id === userId);
  
  if (!user) {
    throw new Error('User not found');
  }
  
  // Verify email matches
  if (user.email !== invitation.email) {
    throw new Error('Email does not match invitation');
  }
  
  // Add to store team
  const teams = await getStoreTeams();
  let team = teams.find(t => t.storeId === invitation.storeId);
  
  if (!team) {
    team = {
      storeId: invitation.storeId,
      ownerId: invitation.invitedBy,
      teamMembers: []
    };
    teams.push(team);
  }
  
  // Add team member
  team.teamMembers.push({
    userId: user.id,
    role: invitation.role,
    permissions: invitation.permissions,
    addedAt: new Date().toISOString(),
    addedBy: invitation.invitedBy,
    status: 'active'
  });
  
  // Update user assigned stores
  if (!user.assignedStores) {
    user.assignedStores = [];
  }
  if (!user.assignedStores.includes(invitation.storeId)) {
    user.assignedStores.push(invitation.storeId);
  }
  
  // Update user role if needed (only if current role is lower)
  const roleHierarchy = ['viewer', 'team_member', 'manager', 'store_owner', 'super_admin'];
  const currentRoleIndex = roleHierarchy.indexOf(user.role || 'viewer');
  const newRoleIndex = roleHierarchy.indexOf(invitation.role);
  
  if (newRoleIndex > currentRoleIndex) {
    user.role = invitation.role;
  }
  
  user.updatedAt = new Date().toISOString();
  
  // Update invitation status
  invitation.status = 'accepted';
  invitation.acceptedAt = new Date().toISOString();
  invitation.acceptedBy = userId;
  
  await writeFileSafe('store-teams.json', { teams });
  await updateUsers(users);
  await writeFileSafe('invitations.json', { invitations });
  
  // Log activity
  await logActivity({
    userId,
    storeId: invitation.storeId,
    action: 'invitation_accepted',
    details: {
      invitationId: invitation.id,
      role: invitation.role
    },
    timestamp: new Date().toISOString()
  });
  
  return {
    success: true,
    teamMember: team.teamMembers[team.teamMembers.length - 1]
  };
}

/**
 * Remove team member
 */
export async function removeTeamMember(storeId, userId, removedBy) {
  const teams = await getStoreTeams();
  const team = teams.find(t => t.storeId === storeId);
  
  if (!team) {
    throw new Error('Store team not found');
  }
  
  const memberIndex = team.teamMembers.findIndex(m => m.userId === userId);
  if (memberIndex === -1) {
    throw new Error('Team member not found');
  }
  
  const member = team.teamMembers[memberIndex];
  
  // Remove from team
  team.teamMembers.splice(memberIndex, 1);
  
  // Update user assigned stores
  const users = await getUsers();
  const user = users.find(u => u.id === userId);
  if (user && user.assignedStores) {
    user.assignedStores = user.assignedStores.filter(s => s !== storeId);
    user.updatedAt = new Date().toISOString();
    await updateUsers(users);
  }
  
  await writeFileSafe('store-teams.json', { teams });
  
  // Log activity
  await logActivity({
    userId: removedBy,
    storeId,
    action: 'user_removed',
    details: {
      removedUserId: userId,
      removedUserEmail: user?.email,
      role: member.role
    },
    timestamp: new Date().toISOString()
  });
  
  return { success: true };
}

/**
 * Update team member role
 */
export async function updateTeamMemberRole(storeId, userId, newRole, updatedBy) {
  const validRoles = ['manager', 'team_member', 'viewer'];
  if (!validRoles.includes(newRole)) {
    throw new Error(`Invalid role. Allowed roles: ${validRoles.join(', ')}`);
  }
  
  const teams = await getStoreTeams();
  const team = teams.find(t => t.storeId === storeId);
  
  if (!team) {
    throw new Error('Store team not found');
  }
  
  const member = team.teamMembers.find(m => m.userId === userId);
  if (!member) {
    throw new Error('Team member not found');
  }
  
  const oldRole = member.role;
  member.role = newRole;
  member.updatedAt = new Date().toISOString();
  member.updatedBy = updatedBy;
  
  // Update user role if needed
  const users = await getUsers();
  const user = users.find(u => u.id === userId);
  if (user) {
    const roleHierarchy = ['viewer', 'team_member', 'manager', 'store_owner', 'super_admin'];
    const currentRoleIndex = roleHierarchy.indexOf(user.role || 'viewer');
    const newRoleIndex = roleHierarchy.indexOf(newRole);
    
    if (newRoleIndex > currentRoleIndex) {
      user.role = newRole;
      user.updatedAt = new Date().toISOString();
      await updateUsers(users);
    }
  }
  
  await writeFileSafe('store-teams.json', { teams });
  
  // Log activity
  await logActivity({
    userId: updatedBy,
    storeId,
    action: 'role_changed',
    details: {
      targetUserId: userId,
      oldRole,
      newRole
    },
    timestamp: new Date().toISOString()
  });
  
  return { success: true, member };
}

/**
 * Update team member permissions
 */
export async function updateTeamMemberPermissions(storeId, userId, permissions, updatedBy) {
  const teams = await getStoreTeams();
  const team = teams.find(t => t.storeId === storeId);
  
  if (!team) {
    throw new Error('Store team not found');
  }
  
  const member = team.teamMembers.find(m => m.userId === userId);
  if (!member) {
    throw new Error('Team member not found');
  }
  
  member.permissions = permissions || [];
  member.updatedAt = new Date().toISOString();
  member.updatedBy = updatedBy;
  
  await writeFileSafe('store-teams.json', { teams });
  
  // Log activity
  await logActivity({
    userId: updatedBy,
    storeId,
    action: 'permissions_updated',
    details: {
      targetUserId: userId,
      permissions
    },
    timestamp: new Date().toISOString()
  });
  
  return { success: true, member };
}

/**
 * Get pending invitations for a store
 */
export async function getPendingInvitations(storeId) {
  const invitations = await getInvitations();
  return invitations.filter(
    inv => inv.storeId === storeId && inv.status === 'pending'
  );
}

/**
 * Cancel invitation
 */
export async function cancelInvitation(invitationId, cancelledBy) {
  const invitations = await getInvitations();
  const invitation = invitations.find(inv => inv.id === invitationId);
  
  if (!invitation) {
    throw new Error('Invitation not found');
  }
  
  invitation.status = 'cancelled';
  invitation.cancelledAt = new Date().toISOString();
  invitation.cancelledBy = cancelledBy;
  
  await writeFileSafe('invitations.json', { invitations });
  
  // Log activity
  await logActivity({
    userId: cancelledBy,
    storeId: invitation.storeId,
    action: 'invitation_cancelled',
    details: {
      invitationId,
      email: invitation.email
    },
    timestamp: new Date().toISOString()
  });
  
  return { success: true };
}

/**
 * Resend invitation
 */
export async function resendInvitation(invitationId, invitedBy) {
  const invitations = await getInvitations();
  const invitation = invitations.find(inv => inv.id === invitationId);
  
  if (!invitation) {
    throw new Error('Invitation not found');
  }
  
  if (invitation.status !== 'pending') {
    throw new Error('Can only resend pending invitations');
  }
  
  // Extend expiry
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  invitation.expiresAt = expiresAt.toISOString();
  invitation.resentAt = new Date().toISOString();
  invitation.resentBy = invitedBy;
  
  await writeFileSafe('invitations.json', { invitations });
  
  // Log activity
  await logActivity({
    userId: invitedBy,
    storeId: invitation.storeId,
    action: 'invitation_resent',
    details: {
      invitationId,
      email: invitation.email
    },
    timestamp: new Date().toISOString()
  });
  
  return {
    invitation,
    invitationLink: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/accept-invitation?token=${invitation.token}`
  };
}


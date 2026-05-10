// backend/services/permissionsService.js
import { readFileSafe } from '../utils/fileStorage.js';
import { getPermissionsForRole } from '../config/permissions.config.js';
import { ROLES } from '../config/roles.config.js';

/**
 * Get users data
 */
async function getUsers() {
  const data = await readFileSafe('users.json', { default: { users: [] } });
  return data.users || [];
}

/**
 * Get store teams data
 */
async function getStoreTeams() {
  const data = await readFileSafe('store-teams.json', { default: { teams: [] } });
  return data.teams || [];
}

/**
 * Get user by ID
 */
export async function getUserById(userId) {
  const users = await getUsers();
  return users.find(u => u.id === userId);
}

/**
 * Check if user has permission for a store
 */
export async function checkPermission(userId, storeId, permission) {
  const user = await getUserById(userId);
  
  if (!user) {
    return false;
  }
  
  // Super admin has all permissions
  if (user.role === ROLES.SUPER_ADMIN || user.role === ROLES.ADMIN) {
    return true;
  }
  
  // Store owner has all permissions for their stores
  if (user.role === ROLES.STORE_OWNER) {
    const ownedStores = user.ownedStores || [];
    if (ownedStores.includes(storeId)) {
      return true;
    }
  }
  
  // Check if user is assigned to this store
  const assignedStores = user.assignedStores || [];
  if (!assignedStores.includes(storeId)) {
    return false;
  }
  
  // Get team member permissions
  const teams = await getStoreTeams();
  const team = teams.find(t => t.storeId === storeId);
  
  if (!team) {
    return false;
  }
  
  const member = team.teamMembers.find(m => m.userId === userId);
  if (!member || member.status !== 'active') {
    return false;
  }
  
  // Check role-based permissions
  const rolePermissions = getPermissionsForRole(member.role);
  
  // Wildcard permission
  if (rolePermissions.includes('*') || rolePermissions.includes(permission)) {
    return true;
  }
  
  // Check custom permissions override
  const customPermissions = member.permissions || [];
  if (customPermissions.includes('*') || customPermissions.includes(permission)) {
    return true;
  }
  
  return false;
}

/**
 * Get all permissions for a user in a store
 */
export async function getUserPermissions(userId, storeId) {
  const user = await getUserById(userId);
  
  if (!user) {
    return [];
  }
  
  // Super admin has all permissions
  if (user.role === ROLES.SUPER_ADMIN || user.role === ROLES.ADMIN) {
    return ['*'];
  }
  
  // Store owner has all permissions for their stores
  if (user.role === ROLES.STORE_OWNER) {
    const ownedStores = user.ownedStores || [];
    if (ownedStores.includes(storeId)) {
      return ['*'];
    }
  }
  
  // Get team member permissions
  const teams = await getStoreTeams();
  const team = teams.find(t => t.storeId === storeId);
  
  if (!team) {
    return [];
  }
  
  const member = team.teamMembers.find(m => m.userId === userId);
  if (!member || member.status !== 'active') {
    return [];
  }
  
  // Combine role permissions and custom permissions
  const rolePermissions = getPermissionsForRole(member.role);
  const customPermissions = member.permissions || [];
  
  // Remove duplicates
  const allPermissions = [...new Set([...rolePermissions, ...customPermissions])];
  
  return allPermissions;
}

/**
 * Get permissions for a role
 */
export function getRolePermissions(role) {
  return getPermissionsForRole(role);
}

/**
 * Update custom permissions for a user in a store
 */
export async function updateCustomPermissions(userId, storeId, permissions) {
  // This is handled by teamManagementService.updateTeamMemberPermissions
  // This function is kept for backward compatibility
  const { updateTeamMemberPermissions } = await import('./teamManagementService.js');
  return await updateTeamMemberPermissions(storeId, userId, permissions, userId);
}

/**
 * Check if user can access a store
 */
export async function canAccessStore(userId, storeId) {
  const user = await getUserById(userId);
  
  if (!user) {
    return false;
  }
  
  // Super admin can access all stores
  if (user.role === ROLES.SUPER_ADMIN || user.role === ROLES.ADMIN) {
    return true;
  }
  
  // Store owner can access their stores
  if (user.role === ROLES.STORE_OWNER) {
    const ownedStores = user.ownedStores || [];
    return ownedStores.includes(storeId);
  }
  
  // Check if user is assigned to this store
  const assignedStores = user.assignedStores || [];
  if (assignedStores.includes(storeId)) {
    // Verify they're still an active team member
    const teams = await getStoreTeams();
    const team = teams.find(t => t.storeId === storeId);
    if (team) {
      const member = team.teamMembers.find(m => m.userId === userId);
      return member && member.status === 'active';
    }
  }
  
  return false;
}

/**
 * Get all stores a user can access
 */
export async function getUserStores(userId) {
  const user = await getUserById(userId);
  
  if (!user) {
    return [];
  }
  
  // Super admin can access all stores (would need to fetch from store registry)
  if (user.role === ROLES.SUPER_ADMIN || user.role === ROLES.ADMIN) {
    // Return all stores - in production, fetch from store registry
    return [];
  }
  
  // Combine owned and assigned stores
  const ownedStores = user.ownedStores || [];
  const assignedStores = user.assignedStores || [];
  
  // Remove duplicates
  return [...new Set([...ownedStores, ...assignedStores])];
}

/**
 * Check if user can invite team members
 */
export async function canInviteTeamMembers(userId, storeId) {
  const user = await getUserById(userId);
  
  if (!user) {
    return false;
  }
  
  // Super admin can invite
  if (user.role === ROLES.SUPER_ADMIN || user.role === ROLES.ADMIN) {
    return true;
  }
  
  // Store owner can invite
  if (user.role === ROLES.STORE_OWNER) {
    const ownedStores = user.ownedStores || [];
    return ownedStores.includes(storeId);
  }
  
  // Manager can invite team_member and viewer only
  const teams = await getStoreTeams();
  const team = teams.find(t => t.storeId === storeId);
  if (team) {
    const member = team.teamMembers.find(m => m.userId === userId);
    if (member && member.role === 'manager' && member.status === 'active') {
      return true;
    }
  }
  
  return false;
}

/**
 * Check if user can remove team members
 */
export async function canRemoveTeamMembers(userId, storeId) {
  const user = await getUserById(userId);
  
  if (!user) {
    return false;
  }
  
  // Super admin can remove
  if (user.role === ROLES.SUPER_ADMIN || user.role === ROLES.ADMIN) {
    return true;
  }
  
  // Store owner can remove
  if (user.role === ROLES.STORE_OWNER) {
    const ownedStores = user.ownedStores || [];
    return ownedStores.includes(storeId);
  }
  
  // Manager cannot remove other managers or store owner
  return false;
}


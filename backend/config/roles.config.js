// backend/config/roles.config.js
// Role definitions - NO hardcoding, all from config

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin', // Alias for super_admin (backward compatibility)
  STORE_OWNER: 'store_owner',
  MANAGER: 'manager',
  TEAM_MEMBER: 'team_member',
  VIEWER: 'viewer',
  USER: 'user' // Alias for team_member (backward compatibility)
};

// Role display names
export const ROLE_DISPLAY_NAMES = {
  [ROLES.SUPER_ADMIN]: 'Super Admin',
  [ROLES.ADMIN]: 'Administrator',
  [ROLES.STORE_OWNER]: 'Store Owner',
  [ROLES.MANAGER]: 'Store Manager',
  [ROLES.TEAM_MEMBER]: 'Team Member',
  [ROLES.VIEWER]: 'Viewer',
  [ROLES.USER]: 'Team Member'
};

// Role descriptions
export const ROLE_DESCRIPTIONS = {
  [ROLES.SUPER_ADMIN]: 'Full platform access to all stores and users. Can impersonate any user.',
  [ROLES.ADMIN]: 'Full platform access to all stores and features',
  [ROLES.STORE_OWNER]: 'Full access to their own store(s). Can invite/manage team members.',
  [ROLES.MANAGER]: 'Can manage store operations, campaigns, and customers. Cannot access billing or store settings.',
  [ROLES.TEAM_MEMBER]: 'Limited access based on permissions. Can view campaigns and customers.',
  [ROLES.VIEWER]: 'Read-only access. Can view data but cannot make changes.',
  [ROLES.USER]: 'Limited access to assigned store(s), primarily read-only'
};

// Valid roles array
export const VALID_ROLES = Object.values(ROLES);

/**
 * Check if a role is valid
 * @param {string} role - Role to validate
 * @returns {boolean}
 */
export function isValidRole(role) {
  return VALID_ROLES.includes(role);
}

/**
 * Get role display name
 * @param {string} role - Role identifier
 * @returns {string}
 */
export function getRoleDisplayName(role) {
  return ROLE_DISPLAY_NAMES[role] || role;
}


// Permission definitions
export const PERMISSIONS = {
  // User permissions
  'users.view': 'View users',
  'users.create': 'Create users',
  'users.edit': 'Edit users',
  'users.delete': 'Delete users',
  
  // Journey permissions
  'journeys.view': 'View journeys',
  'journeys.create': 'Create journeys',
  'journeys.edit': 'Edit journeys',
  'journeys.delete': 'Delete journeys',
  'journeys.activate': 'Activate/deactivate journeys',
  
  // Campaign permissions
  'campaigns.view': 'View campaigns',
  'campaigns.create': 'Create campaigns',
  'campaigns.edit': 'Edit campaigns',
  'campaigns.delete': 'Delete campaigns',
  'campaigns.send': 'Send campaigns',
  
  // Customer permissions
  'customers.view': 'View customers',
  'customers.export': 'Export customer data',
  
  // Segment permissions
  'segments.view': 'View segments',
  'segments.create': 'Create segments',
  'segments.edit': 'Edit segments',
  'segments.delete': 'Delete segments',
  
  // Analytics permissions
  'analytics.view': 'View analytics',
  
  // Settings permissions
  'settings.view': 'View settings',
  'settings.edit': 'Edit settings',
} as const;

export type Permission = keyof typeof PERMISSIONS | '*';
export type UserRole = 'admin' | 'manager' | 'builder' | 'viewer';

// Role-permission mapping
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: ['*'], // All permissions
  
  manager: [
    'campaigns.view',
    'campaigns.create',
    'campaigns.edit',
    'campaigns.send',
    'segments.view',
    'segments.create',
    'segments.edit',
    'customers.view',
    'customers.export',
    'analytics.view',
  ],
  
  builder: [
    'journeys.view',
    'journeys.create',
    'journeys.edit',
    'journeys.activate',
    'segments.view',
    'segments.create',
    'segments.edit',
    'customers.view',
  ],
  
  viewer: [
    'journeys.view',
    'campaigns.view',
    'customers.view',
    'segments.view',
    'analytics.view',
  ],
};

// Check if user has permission
export function hasPermission(userRole: UserRole, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[userRole] || [];
  
  // '*' means all permissions
  if (permissions.includes('*')) {
    return true;
  }
  
  return permissions.includes(permission);
}

// Get all permissions for a role
export function getPermissionsForRole(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}

// Check if user can perform action
export function canPerformAction(
  userRole: UserRole,
  action: Permission
): boolean {
  return hasPermission(userRole, action);
}

// Get role display name
export function getRoleDisplayName(role: UserRole): string {
  const roleNames: Record<UserRole, string> = {
    admin: 'Admin',
    manager: 'Manager',
    builder: 'Builder',
    viewer: 'Viewer',
  };
  return roleNames[role] || role;
}

// Get role description
export function getRoleDescription(role: UserRole): string {
  const descriptions: Record<UserRole, string> = {
    admin: 'Full access to all features and settings',
    manager: 'Manage campaigns, segments, and view analytics',
    builder: 'Create and manage journeys and customer segments',
    viewer: 'Read-only access to view data and reports',
  };
  return descriptions[role] || '';
}


// backend/middleware/permissions.js
// Permission checking utilities - uses config files (NO hardcoding)

import { PERMISSIONS, ROLE_PERMISSIONS, getPermissionsForRole } from '../config/permissions.config.js';
import { ROLES } from '../config/roles.config.js';

// Re-export permissions for convenience
export { PERMISSIONS };

/**
 * Check if a user has a specific permission
 * @param {Object} user - User object with role property
 * @param {string} permission - Permission to check
 * @returns {boolean}
 */
export function hasPermission(user, permission) {
  if (!user || !user.role) {
    return false;
  }
  
  const userPermissions = getPermissionsForRole(user.role);
  return userPermissions.includes(permission);
}

/**
 * Check if user has any of the given permissions
 * @param {Object} user - User object
 * @param {string[]} permissions - Array of permissions to check
 * @returns {boolean}
 */
export function hasAnyPermission(user, permissions) {
  return permissions.some(permission => hasPermission(user, permission));
}

/**
 * Check if user has all of the given permissions
 * @param {Object} user - User object
 * @param {string[]} permissions - Array of permissions to check
 * @returns {boolean}
 */
export function hasAllPermissions(user, permissions) {
  return permissions.every(permission => hasPermission(user, permission));
}


/**
 * Check if user can access a specific store
 * @param {Object} user - User object
 * @param {string} storeId - Store identifier
 * @returns {boolean}
 */
export function canAccessStore(user, storeId) {
  if (!user || !storeId) {
    return false;
  }
  
  // Admin can access all stores
  if (user.role === ROLES.ADMIN) {
    return true;
  }
  
  // Store owner and user can only access their own stores
  const userStores = user.stores || [];
  const normalizedStoreId = storeId.replace('.myshopify.com', '');
  
  return userStores.some(store => {
    const normalizedUserStore = typeof store === 'string' 
      ? store.replace('.myshopify.com', '')
      : store;
    return normalizedUserStore === normalizedStoreId || 
           normalizedUserStore === storeId ||
           store === storeId;
  });
}

/**
 * Check if user can perform write operations on a resource
 * @param {Object} user - User object
 * @param {string} resourceType - Type of resource (campaigns, journeys, segments, etc.)
 * @returns {boolean}
 */
export function canWriteResource(user, resourceType) {
  if (!user) return false;
  
  if (user.role === ROLES.ADMIN) {
    return true;
  }
  
  if (user.role === ROLES.STORE_OWNER) {
    return ['campaigns', 'journeys', 'segments'].includes(resourceType);
  }
  
  if (user.role === ROLES.USER) {
    // Check granular permissions
    const featurePerms = user.permissions?.[resourceType];
    if (!featurePerms) return false;
    
    // If any write action is allowed, return true
    return featurePerms.create === true || 
           featurePerms.edit === true || 
           featurePerms.delete === true;
  }
  
  return false;
}

/**
 * Check if user has specific permission for a feature and action
 * @param {Object} user - User object
 * @param {string} feature - Feature name (campaigns, customers, orders, etc.)
 * @param {string} action - Action name (view, create, edit, delete, etc.)
 * @returns {boolean}
 */
export function hasFeaturePermission(user, feature, action) {
  if (!user || !feature || !action) return false;
  
  // ADMIN has all permissions
  if (user.role === ROLES.ADMIN) {
    return true;
  }
  
  // STORE_OWNER has all permissions for their stores
  if (user.role === ROLES.STORE_OWNER) {
    return true;
  }
  
  // USER - check granular permissions
  if (user.role === ROLES.USER) {
    const featurePerms = user.permissions?.[feature];
    if (!featurePerms) return false;
    
    return featurePerms[action] === true;
  }
  
  return false;
}

/**
 * Get user's permissions for a specific feature
 * @param {Object} user - User object
 * @param {string} feature - Feature name
 * @returns {object|null}
 */
export function getFeaturePermissions(user, feature) {
  if (!user || !feature) return null;
  
  if (user.role === ROLES.ADMIN || user.role === ROLES.STORE_OWNER) {
    // Return all permissions as true for admin/store owner
    return {
      view: true,
      create: true,
      edit: true,
      delete: user.role === ROLES.ADMIN, // Only admin can delete
      publish: true,
      activate: true,
      recover: true
    };
  }
  
  if (user.role === ROLES.USER) {
    return user.permissions?.[feature] || null;
  }
  
  return null;
}


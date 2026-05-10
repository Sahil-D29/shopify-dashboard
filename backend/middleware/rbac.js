// backend/middleware/rbac.js
import { logActivity } from '../utils/logger.js';
import { hasPermission, hasAnyPermission, canAccessStore, canWriteResource } from './permissions.js';
import * as permissionsService from '../services/permissionsService.js';
import { ROLES } from '../config/roles.config.js';

/**
 * Authorize based on roles (backward compatibility)
 * @param {string[]} allowedRoles - Array of allowed roles
 */
export function authorize(allowedRoles = []) {
  return (req, res, next) => {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }
    
    if (!allowedRoles.includes(user.role)) {
      logActivity({
        type: 'access_denied',
        actorId: user.id,
        actorEmail: user.email,
        role: user.role,
        endpoint: req.path,
        method: req.method,
        reason: 'Insufficient role permissions'
      });
      
      return res.status(403).json({ 
        error: 'Forbidden',
        message: `This action requires one of: ${allowedRoles.join(', ')}`
      });
    }
    
    next();
  };
}

/**
 * Authorize based on specific permissions (with store context)
 * @param {string|string[]} permissions - Single permission or array of permissions
 */
export function requirePermission(permissions) {
  const permissionArray = Array.isArray(permissions) ? permissions : [permissions];
  
  return async (req, res, next) => {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }
    
    // Super admin and admin have all permissions
    if (user.role === ROLES.SUPER_ADMIN || user.role === ROLES.ADMIN) {
      return next();
    }
    
    // Get storeId from request
    const storeId = req.params.storeId || req.body.storeId || req.query.storeId || req.storeId;
    
    // If storeId is available, check store-specific permissions
    if (storeId) {
      try {
        const hasPermission = await Promise.all(
          permissionArray.map(perm => permissionsService.checkPermission(user.id, storeId, perm))
        );
        
        if (!hasPermission.some(p => p === true)) {
          logActivity({
            type: 'access_denied',
            actorId: user.id,
            actorEmail: user.email,
            role: user.role,
            storeId,
            endpoint: req.path,
            method: req.method,
            reason: 'Missing required permission',
            requiredPermissions: permissionArray
          });
          
          return res.status(403).json({ 
            error: 'Forbidden',
            message: 'You do not have permission to perform this action'
          });
        }
        
        return next();
      } catch (error) {
        console.error('Permission check error:', error);
        return res.status(500).json({ error: 'Permission check failed' });
      }
    }
    
    // Fallback to role-based permission check (backward compatibility)
    if (!hasAnyPermission(user, permissionArray)) {
      logActivity({
        type: 'access_denied',
        actorId: user.id,
        actorEmail: user.email,
        role: user.role,
        endpoint: req.path,
        method: req.method,
        reason: 'Missing required permission',
        requiredPermissions: permissionArray
      });
      
      return res.status(403).json({ 
        error: 'Forbidden',
        message: 'You do not have permission to perform this action'
      });
    }
    
    next();
  };
}

/**
 * Authorize store access - ensures user can only access their own stores (unless admin)
 */
export function authorizeStoreAccess() {
  return async (req, res, next) => {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }
    
    // Super admin and admin have access to all stores
    if (user.role === ROLES.SUPER_ADMIN || user.role === ROLES.ADMIN) {
      // Get storeId if provided, but don't require it for admin
      const storeId = req.params.storeId || req.body.storeId || req.query.storeId || req.query.shop || req.body.shop;
      if (storeId) {
        req.storeId = storeId;
      }
      return next();
    }
    
    // Get storeId from params, body, or query
    const storeId = req.params.storeId || req.body.storeId || req.query.storeId || req.query.shop || req.body.shop;
    
    if (!storeId) {
      // For store_owner and team members, storeId is required
      return res.status(400).json({ error: 'Missing store identifier' });
    }
    
    // Check if user can access this store using the new permission service
    try {
      const canAccess = await permissionsService.canAccessStore(user.id, storeId);
      
      if (!canAccess) {
        // Fallback to old method for backward compatibility
        if (!canAccessStore(user, storeId)) {
          logActivity({
            type: 'store_access_denied',
            actorId: user.id,
            actorEmail: user.email,
            role: user.role,
            storeId: storeId,
            endpoint: req.path,
            method: req.method
          });
          
          return res.status(403).json({ 
            error: 'No access to this store',
            message: 'You do not have permission to access this store'
          });
        }
      }
      
      req.storeId = storeId;
      next();
    } catch (error) {
      console.error('Store access check error:', error);
      // Fallback to old method
      if (!canAccessStore(user, storeId)) {
        return res.status(403).json({ 
          error: 'No access to this store',
          message: 'You do not have permission to access this store'
        });
      }
      req.storeId = storeId;
      next();
    }
  };
}

/**
 * Filter data based on user role and store access
 * Admin sees all, others see only their stores
 */
export function filterDataByStoreAccess(user, data, storeIdField = 'storeId') {
  if (!user) {
    return [];
  }
  
  // Admin sees all data
  if (user.role === 'admin') {
    return Array.isArray(data) ? data : [];
  }
  
  // Store owner and user see only their stores
  const userStores = user.stores || [];
  const normalizedUserStores = userStores.map(s => 
    typeof s === 'string' ? s.replace('.myshopify.com', '') : s
  );
  
  if (Array.isArray(data)) {
    return data.filter(item => {
      const itemStoreId = item[storeIdField] || item.store || item.shop;
      if (!itemStoreId) return false;
      
      const normalizedItemStore = String(itemStoreId).replace('.myshopify.com', '');
      return normalizedUserStores.some(store => 
        store === normalizedItemStore || 
        store === itemStoreId ||
        String(itemStoreId).includes(store)
      );
    });
  }
  
  return [];
}

/**
 * Check if user can write to a resource
 */
export function requireWritePermission(resourceType) {
  return (req, res, next) => {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }
    
    if (!canWriteResource(user, resourceType)) {
      logActivity({
        type: 'write_permission_denied',
        actorId: user.id,
        actorEmail: user.email,
        role: user.role,
        resourceType: resourceType,
        endpoint: req.path,
        method: req.method
      });
      
      return res.status(403).json({ 
        error: 'Forbidden',
        message: `You do not have permission to modify ${resourceType}`
      });
    }
    
    next();
  };
}

/**
 * Require admin role specifically
 */
export function requireAdmin() {
  return authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN]);
}

/**
 * Require store owner or admin
 */
export function requireStoreOwnerOrAdmin() {
  return authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STORE_OWNER]);
}

/**
 * Require store owner
 */
export function requireStoreOwner() {
  return async (req, res, next) => {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }
    
    // Super admin and admin are allowed
    if (user.role === ROLES.SUPER_ADMIN || user.role === ROLES.ADMIN) {
      return next();
    }
    
    // Check if user is store owner
    if (user.role !== ROLES.STORE_OWNER) {
      return res.status(403).json({ 
        error: 'Forbidden',
        message: 'This action requires store owner role'
      });
    }
    
    // Verify store ownership
    const storeId = req.params.storeId || req.body.storeId || req.query.storeId;
    if (storeId) {
      const ownedStores = user.ownedStores || [];
      if (!ownedStores.includes(storeId)) {
        return res.status(403).json({ 
          error: 'Forbidden',
          message: 'You do not own this store'
        });
      }
    }
    
    next();
  };
}


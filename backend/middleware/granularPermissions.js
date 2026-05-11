// backend/middleware/granularPermissions.js
// Middleware for checking granular permissions
// NO hardcoding

import { hasFeaturePermission } from './permissions.js';
import { ROLES } from '../config/roles.config.js';
import { logActivity } from '../utils/logger.js';

/**
 * Check if user has specific permission for a feature and action
 * @param {string} feature - Feature name (campaigns, customers, orders, etc.)
 * @param {string} action - Action name (view, create, edit, delete, publish, etc.)
 * @returns {Function} Express middleware
 */
export function checkPermission(feature, action) {
  return (req, res, next) => {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
    }
    
    // ADMIN has all permissions
    if (user.role === ROLES.ADMIN) {
      return next();
    }
    
    // STORE_OWNER has all permissions for their stores
    if (user.role === ROLES.STORE_OWNER) {
      return next();
    }
    
    // USER - check granular permissions
    if (user.role === ROLES.USER) {
      const hasPermission = hasFeaturePermission(user, feature, action);
      
      if (!hasPermission) {
        const featurePerms = user.permissions?.[feature] || {};
        
        // Log permission denial
        logActivity({
          type: 'permission_denied',
          actorId: user.id,
          actorEmail: user.email,
          role: user.role,
          feature: feature,
          action: action,
          endpoint: req.path,
          method: req.method,
          reason: 'Insufficient granular permissions',
          userPermissions: featurePerms
        });
        
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: `You don't have permission to ${action} ${feature}`,
            requiredPermission: `${feature}:${action}`,
            yourPermissions: featurePerms,
            availableActions: Object.keys(featurePerms).filter(k => featurePerms[k] === true)
          }
        });
      }
      
      return next();
    }
    
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Invalid role'
      }
    });
  };
}

/**
 * Check if user has any of the specified permissions
 * @param {string} feature - Feature name
 * @param {string[]} actions - Array of action names
 * @returns {Function} Express middleware
 */
export function checkAnyPermission(feature, actions) {
  return (req, res, next) => {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
    }
    
    // ADMIN and STORE_OWNER have all permissions
    if (user.role === ROLES.ADMIN || user.role === ROLES.STORE_OWNER) {
      return next();
    }
    
    // USER - check if they have any of the required permissions
    if (user.role === ROLES.USER) {
      const hasAny = actions.some(action => hasFeaturePermission(user, feature, action));
      
      if (!hasAny) {
        const featurePerms = user.permissions?.[feature] || {};
        
        logActivity({
          type: 'permission_denied',
          actorId: user.id,
          actorEmail: user.email,
          role: user.role,
          feature: feature,
          requiredActions: actions,
          endpoint: req.path,
          method: req.method,
          reason: 'None of the required permissions available',
          userPermissions: featurePerms
        });
        
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: `You need at least one of these permissions: ${actions.join(', ')}`,
            requiredPermissions: actions.map(a => `${feature}:${a}`),
            yourPermissions: featurePerms
          }
        });
      }
      
      return next();
    }
    
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Invalid role'
      }
    });
  };
}


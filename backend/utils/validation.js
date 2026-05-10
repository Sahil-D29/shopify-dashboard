// backend/utils/validation.js
// Input validation utilities

import { isValidRole } from '../config/roles.config.js';
import { isValidStoreId } from '../config/stores.config.js';

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean}
 */
export function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Backwards-compatible alias used by authRoutes.js
export const validateEmail = isValidEmail;

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @param {object} options - Validation options
 * @returns {object} - { valid: boolean, errors: string[] }
 */
export function validatePassword(password, options = {}) {
  const {
    minLength = 8,
    requireUppercase = true,
    requireLowercase = true,
    requireNumbers = true,
    requireSpecialChars = false
  } = options;
  
  const errors = [];
  
  if (!password || typeof password !== 'string') {
    errors.push('Password is required');
    return { valid: false, errors };
  }
  
  if (password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters long`);
  }
  
  if (requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (requireNumbers && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate user role
 * @param {string} role - Role to validate
 * @returns {boolean}
 */
export function validateRole(role) {
  return isValidRole(role);
}

/**
 * Validate store ID
 * @param {string} storeId - Store ID to validate
 * @returns {boolean}
 */
export function validateStoreId(storeId) {
  return isValidStoreId(storeId);
}

/**
 * Validate user object structure
 * @param {object} user - User object to validate
 * @returns {object} - { valid: boolean, errors: string[] }
 */
export function validateUser(user) {
  const errors = [];
  
  if (!user || typeof user !== 'object') {
    errors.push('User object is required');
    return { valid: false, errors };
  }
  
  if (!user.email || !isValidEmail(user.email)) {
    errors.push('Valid email is required');
  }
  
  if (!user.role || !validateRole(user.role)) {
    errors.push('Valid role is required');
  }
  
  if (user.stores && !Array.isArray(user.stores)) {
    errors.push('Stores must be an array');
  }
  
  if (user.stores && Array.isArray(user.stores)) {
    for (const storeId of user.stores) {
      if (!validateStoreId(storeId)) {
        errors.push(`Invalid store ID: ${storeId}`);
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Sanitize string input
 * @param {string} input - Input to sanitize
 * @returns {string}
 */
export function sanitizeString(input) {
  if (typeof input !== 'string') return '';
  return input.trim().replace(/[<>]/g, '');
}

/**
 * Validate UUID format
 * @param {string} id - ID to validate
 * @returns {boolean}
 */
export function isValidUUID(id) {
  if (!id || typeof id !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * Generate UUID v4
 * @returns {string}
 */
export function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}


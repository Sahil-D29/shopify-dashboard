// backend/config/stores.config.js
// Store-related configuration - NO hardcoding

/**
 * Get default store from environment variable
 * Used only as fallback when no store is provided
 * @returns {string|null}
 */
export function getDefaultStore() {
  return process.env.SHOPIFY_STORE_URL || 
         process.env.DEFAULT_STORE_ID || 
         null;
}

/**
 * Normalize store ID (remove .myshopify.com if present)
 * @param {string} storeId - Store identifier
 * @returns {string}
 */
export function normalizeStoreId(storeId) {
  if (!storeId) return null;
  
  // Remove protocol if present
  let normalized = storeId.replace(/^https?:\/\//, '');
  
  // Remove .myshopify.com suffix if present
  normalized = normalized.replace(/\.myshopify\.com$/, '');
  
  return normalized;
}

/**
 * Format store ID with .myshopify.com suffix
 * @param {string} storeId - Store identifier (with or without suffix)
 * @returns {string}
 */
export function formatStoreDomain(storeId) {
  if (!storeId) return null;
  
  const normalized = normalizeStoreId(storeId);
  return `${normalized}.myshopify.com`;
}

/**
 * Check if store ID format is valid
 * @param {string} storeId - Store identifier to validate
 * @returns {boolean}
 */
export function isValidStoreId(storeId) {
  if (!storeId || typeof storeId !== 'string') return false;
  
  // Store ID should be alphanumeric with hyphens/underscores
  // Can be with or without .myshopify.com
  const normalized = normalizeStoreId(storeId);
  return /^[a-zA-Z0-9_-]+$/.test(normalized);
}


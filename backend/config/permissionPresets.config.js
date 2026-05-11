// backend/config/permissionPresets.config.js
// Permission presets for quick team member setup
// NO hardcoding - all configurable

/**
 * Default permission presets that store owners can use
 * These can be customized per store owner and saved to permission-presets.json
 */
export const PERMISSION_PRESETS = {
  "Marketing Manager": {
    dashboard: { view: true },
    campaigns: { 
      view: true, 
      create: true, 
      edit: true, 
      delete: false,  // Usually restricted
      publish: true 
    },
    journeys: { 
      view: true, 
      create: true, 
      edit: true, 
      delete: false, 
      activate: true 
    },
    segments: { 
      view: true, 
      create: true, 
      edit: true, 
      delete: false 
    },
    customers: { 
      view: true, 
      create: false, 
      edit: false, 
      delete: false 
    },
    orders: { 
      view: true, 
      edit: false, 
      refund: false, 
      cancel: false 
    },
    products: { 
      view: true, 
      create: false, 
      edit: false, 
      delete: false 
    },
    abandonedCarts: { 
      view: true, 
      recover: true, 
      editRecoverySettings: false 
    }
  },
  
  "Customer Support": {
    dashboard: { view: true },
    customers: { 
      view: true, 
      create: true, 
      edit: true, 
      delete: false 
    },
    orders: { 
      view: true, 
      edit: true, 
      refund: false,  // Sensitive operation
      cancel: false 
    },
    products: { 
      view: true, 
      create: false, 
      edit: false, 
      delete: false 
    },
    campaigns: { 
      view: true, 
      create: false, 
      edit: false, 
      delete: false, 
      publish: false 
    },
    journeys: { 
      view: true, 
      create: false, 
      edit: false, 
      delete: false, 
      activate: false 
    },
    segments: { 
      view: true, 
      create: false, 
      edit: false, 
      delete: false 
    },
    abandonedCarts: { 
      view: true, 
      recover: false, 
      editRecoverySettings: false 
    }
  },
  
  "Content Manager": {
    dashboard: { view: true },
    products: { 
      view: true, 
      create: true, 
      edit: true, 
      delete: false 
    },
    campaigns: { 
      view: true, 
      create: true, 
      edit: true, 
      delete: false, 
      publish: false  // Usually needs approval
    },
    customers: { 
      view: true, 
      create: false, 
      edit: false, 
      delete: false 
    },
    orders: { 
      view: true, 
      edit: false, 
      refund: false, 
      cancel: false 
    },
    journeys: { 
      view: true, 
      create: false, 
      edit: false, 
      delete: false, 
      activate: false 
    },
    segments: { 
      view: true, 
      create: false, 
      edit: false, 
      delete: false 
    },
    abandonedCarts: { 
      view: true, 
      recover: false, 
      editRecoverySettings: false 
    }
  },
  
  "View Only": {
    dashboard: { view: true },
    customers: { view: true, create: false, edit: false, delete: false },
    orders: { view: true, edit: false, refund: false, cancel: false },
    products: { view: true, create: false, edit: false, delete: false },
    campaigns: { view: true, create: false, edit: false, delete: false, publish: false },
    journeys: { view: true, create: false, edit: false, delete: false, activate: false },
    segments: { view: true, create: false, edit: false, delete: false },
    abandonedCarts: { view: true, recover: false, editRecoverySettings: false }
  },
  
  "Power User": {
    dashboard: { view: true },
    campaigns: { view: true, create: true, edit: true, delete: false, publish: true },
    journeys: { view: true, create: true, edit: true, delete: false, activate: true },
    segments: { view: true, create: true, edit: true, delete: false },
    customers: { view: true, create: true, edit: true, delete: false },
    orders: { view: true, edit: true, refund: false, cancel: false },
    products: { view: true, create: true, edit: true, delete: false },
    abandonedCarts: { view: true, recover: true, editRecoverySettings: false }
  }
};

/**
 * Get default permissions for a preset
 * @param {string} presetName - Name of the preset
 * @returns {object|null}
 */
export function getPresetPermissions(presetName) {
  return PERMISSION_PRESETS[presetName] || null;
}

/**
 * Get all available preset names
 * @returns {string[]}
 */
export function getPresetNames() {
  return Object.keys(PERMISSION_PRESETS);
}

/**
 * Merge permissions (useful for custom presets)
 * @param {object} basePermissions - Base permissions
 * @param {object} additionalPermissions - Additional permissions to merge
 * @returns {object}
 */
export function mergePermissions(basePermissions, additionalPermissions) {
  const merged = { ...basePermissions };
  
  for (const [feature, actions] of Object.entries(additionalPermissions)) {
    if (!merged[feature]) {
      merged[feature] = {};
    }
    merged[feature] = { ...merged[feature], ...actions };
  }
  
  return merged;
}

/**
 * Get default permissions for a new user (view only)
 * @returns {object}
 */
export function getDefaultUserPermissions() {
  return PERMISSION_PRESETS["View Only"];
}


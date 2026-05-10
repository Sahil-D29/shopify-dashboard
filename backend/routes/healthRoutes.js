// backend/routes/healthRoutes.js
import express from 'express';
import { getSystemHealth } from '../utils/systemHealth.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';

const router = express.Router();

// Default system structure for error responses
const DEFAULT_SYSTEM_STRUCTURE = {
  server: {
    startedAt: null,
    uptimeSeconds: 0
  },
  workers: {
    campaign: 'stopped',
    journey: 'stopped'
  },
  shopify: {
    lastTokenCheck: null,
    tokenValid: false,
    lastSuccessfulSync: null
  },
  lastUpdated: null
};

/**
 * GET /api/health - PUBLIC endpoint (NO AUTH REQUIRED)
 * ALWAYS returns JSON in this exact format:
 * { ok: boolean, system: object | null, error?: string }
 */
router.get('/health', async (req, res) => {
  // Wrap everything in try-catch to ensure JSON response
  try {
    const system = await getSystemHealth();
    
    // Validate system is an object
    if (!system || typeof system !== 'object') {
      throw new Error('Invalid system health data structure');
    }
    
    // ALWAYS return this exact format
    res.status(200).json({
      ok: true,
      system: system
    });
  } catch (error) {
    console.error('Health check error:', error);
    
    // ALWAYS return JSON, even on error
    // NEVER return HTML, text, or undefined
    res.status(500).json({
      ok: false,
      error: error.message || 'Failed to load system health',
      system: null
    });
  }
});

/**
 * GET /api/admin/health - ADMIN ONLY
 * ALWAYS returns JSON in this exact format:
 * { ok: boolean, system: object | null, error?: string }
 */
router.get('/admin/health', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const system = await getSystemHealth();
    
    // Validate system is an object
    if (!system || typeof system !== 'object') {
      throw new Error('Invalid system health data structure');
    }
    
    // ALWAYS return this exact format
    res.status(200).json({
      ok: true,
      system: system
    });
  } catch (error) {
    console.error('Admin health check error:', error);
    
    // ALWAYS return JSON, even on error
    res.status(500).json({
      ok: false,
      error: error.message || 'Failed to load system health',
      system: null
    });
  }
});

export default router;

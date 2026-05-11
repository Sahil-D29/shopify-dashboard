// backend/routes/journeysRoutes.js
import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorizeStoreAccess, filterDataByStoreAccess, requireWritePermission } from '../middleware/rbac.js';
import * as journeysService from '../services/journeysService.js';
import { logError } from '../utils/logger.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// GET /api/journeys - List journeys
// ADMIN: All journeys, STORE_OWNER/USER: Own store journeys only
router.get('/', authorizeStoreAccess(), async (req, res, next) => {
  try {
    const user = req.user;
    const storeId = req.storeId || req.query.storeId || req.query.shop;
    let journeys;
    
    if (user.role === 'admin') {
      // Admin sees all journeys
      if (storeId) {
        journeys = await journeysService.getJourneysByStore(storeId);
      } else {
        journeys = await journeysService.loadJourneys();
      }
    } else {
      // Store owner and user see only their store's journeys
      if (!storeId) {
        return res.status(400).json({ error: 'Store identifier required' });
      }
      journeys = await journeysService.getJourneysByStore(storeId);
      // Filter to ensure user only sees their store's data
      journeys = filterDataByStoreAccess(user, journeys, 'storeId');
    }
    
    res.json({ journeys });
  } catch (e) {
    next(e);
  }
});

// GET /api/journeys/:id - Get journey by ID
// ADMIN: Any journey, STORE_OWNER/USER: Own store journeys only
router.get('/:id', authorizeStoreAccess(), async (req, res, next) => {
  try {
    const user = req.user;
    const journey = await journeysService.getJourneyById(req.params.id);
    
    if (!journey) {
      return res.status(404).json({ error: 'Journey not found' });
    }
    
    // Check store access (admin bypasses this check)
    if (user.role !== 'admin' && !filterDataByStoreAccess(user, [journey], 'storeId').length) {
      return res.status(403).json({ error: 'Access denied to this journey' });
    }
    
    res.json(journey);
  } catch (e) {
    next(e);
  }
});

// GET /api/journeys/:id/logs - Get journey logs
router.get('/:id/logs', async (req, res, next) => {
  try {
    const logs = await journeysService.getJourneyLogs(req.params.id);
    res.json({ logs });
  } catch (e) {
    next(e);
  }
});

// POST /api/journeys - Create journey
// ADMIN: All stores, STORE_OWNER: Own store, USER: Not allowed (view only)
router.post('/', authorizeStoreAccess(), requireWritePermission('journeys'), async (req, res, next) => {
  try {
    const user = req.user;
    
    // Users cannot create journeys (view only)
    if (user.role === 'user') {
      return res.status(403).json({ 
        error: 'Forbidden',
        message: 'You do not have permission to create journeys'
      });
    }
    
    // Ensure storeId is set for non-admin users
    if (user.role !== 'admin' && !req.storeId) {
      req.storeId = req.body.storeId || req.body.shop;
    }
    
    const journeyData = {
      ...req.body,
      storeId: req.storeId || req.body.storeId || req.body.shop,
      createdBy: user.id
    };
    
    const journey = await journeysService.createJourney(journeyData, user.id);
    res.status(201).json(journey);
  } catch (e) {
    next(e);
  }
});

// PUT /api/journeys/:id - Update journey
// ADMIN: Any journey, STORE_OWNER: Own store, USER: Not allowed
router.put('/:id', authorizeStoreAccess(), requireWritePermission('journeys'), async (req, res, next) => {
  try {
    const user = req.user;
    
    // Users cannot edit journeys
    if (user.role === 'user') {
      return res.status(403).json({ 
        error: 'Forbidden',
        message: 'You do not have permission to edit journeys'
      });
    }
    
    // Check if journey exists and user has access
    const existingJourney = await journeysService.getJourneyById(req.params.id);
    if (!existingJourney) {
      return res.status(404).json({ error: 'Journey not found' });
    }
    
    // Check store access (admin bypasses)
    if (user.role !== 'admin' && !filterDataByStoreAccess(user, [existingJourney], 'storeId').length) {
      return res.status(403).json({ error: 'Access denied to this journey' });
    }
    
    const journey = await journeysService.updateJourney(req.params.id, req.body, user.id);
    res.json(journey);
  } catch (e) {
    if (e.message === 'Journey not found') {
      return res.status(404).json({ error: e.message });
    }
    next(e);
  }
});

// DELETE /api/journeys/:id - Delete journey
// ADMIN: Any journey, STORE_OWNER: Own store, USER: Not allowed
router.delete('/:id', authorizeStoreAccess(), requireWritePermission('journeys'), async (req, res, next) => {
  try {
    const user = req.user;
    
    // Users cannot delete journeys
    if (user.role === 'user') {
      return res.status(403).json({ 
        error: 'Forbidden',
        message: 'You do not have permission to delete journeys'
      });
    }
    
    // Check if journey exists and user has access
    const existingJourney = await journeysService.getJourneyById(req.params.id);
    if (!existingJourney) {
      return res.status(404).json({ error: 'Journey not found' });
    }
    
    // Check store access (admin bypasses)
    if (user.role !== 'admin' && !filterDataByStoreAccess(user, [existingJourney], 'storeId').length) {
      return res.status(403).json({ error: 'Access denied to this journey' });
    }
    
    await journeysService.deleteJourney(req.params.id, user.id);
    res.json({ success: true });
  } catch (e) {
    if (e.message === 'Journey not found') {
      return res.status(404).json({ error: e.message });
    }
    next(e);
  }
});

export default router;


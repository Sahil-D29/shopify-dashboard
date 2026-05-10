// backend/routes/segmentsRoutes.js
import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorizeStoreAccess, filterDataByStoreAccess, requireWritePermission } from '../middleware/rbac.js';
import * as segmentsService from '../services/segmentsService.js';
import { logError } from '../utils/logger.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// GET /api/segments - List segments
// ADMIN: All segments, STORE_OWNER/USER: Own store segments only
router.get('/', authorizeStoreAccess(), async (req, res, next) => {
  try {
    const user = req.user;
    const storeId = req.storeId || req.query.storeId || req.query.shop;
    let segments;
    
    if (user.role === 'admin') {
      // Admin sees all segments
      if (storeId) {
        segments = await segmentsService.getSegmentsByStore(storeId);
      } else {
        segments = await segmentsService.loadSegments();
      }
    } else {
      // Store owner and user see only their store's segments
      if (!storeId) {
        return res.status(400).json({ error: 'Store identifier required' });
      }
      segments = await segmentsService.getSegmentsByStore(storeId);
      // Filter to ensure user only sees their store's data
      segments = filterDataByStoreAccess(user, segments, 'storeId');
    }
    
    res.json({ segments });
  } catch (e) {
    next(e);
  }
});

// GET /api/segments/:id - Get segment by ID
// ADMIN: Any segment, STORE_OWNER/USER: Own store segments only
router.get('/:id', authorizeStoreAccess(), async (req, res, next) => {
  try {
    const user = req.user;
    const segment = await segmentsService.getSegmentById(req.params.id);
    
    if (!segment) {
      return res.status(404).json({ error: 'Segment not found' });
    }
    
    // Check store access (admin bypasses this check)
    if (user.role !== 'admin' && !filterDataByStoreAccess(user, [segment], 'storeId').length) {
      return res.status(403).json({ error: 'Access denied to this segment' });
    }
    
    res.json(segment);
  } catch (e) {
    next(e);
  }
});

// POST /api/segments - Create segment
// ADMIN: All stores, STORE_OWNER: Own store, USER: Not allowed (view only)
router.post('/', authorizeStoreAccess(), requireWritePermission('segments'), async (req, res, next) => {
  try {
    const user = req.user;
    
    // Users cannot create segments (view only)
    if (user.role === 'user') {
      return res.status(403).json({ 
        error: 'Forbidden',
        message: 'You do not have permission to create segments'
      });
    }
    
    // Ensure storeId is set for non-admin users
    if (user.role !== 'admin' && !req.storeId) {
      req.storeId = req.body.storeId || req.body.shop;
    }
    
    const segmentData = {
      ...req.body,
      storeId: req.storeId || req.body.storeId || req.body.shop,
      createdBy: user.id
    };
    
    const segment = await segmentsService.createSegment(segmentData, user.id);
    res.status(201).json(segment);
  } catch (e) {
    next(e);
  }
});

// PUT /api/segments/:id - Update segment
// ADMIN: Any segment, STORE_OWNER: Own store, USER: Not allowed
router.put('/:id', authorizeStoreAccess(), requireWritePermission('segments'), async (req, res, next) => {
  try {
    const user = req.user;
    
    // Users cannot edit segments
    if (user.role === 'user') {
      return res.status(403).json({ 
        error: 'Forbidden',
        message: 'You do not have permission to edit segments'
      });
    }
    
    // Check if segment exists and user has access
    const existingSegment = await segmentsService.getSegmentById(req.params.id);
    if (!existingSegment) {
      return res.status(404).json({ error: 'Segment not found' });
    }
    
    // Check store access (admin bypasses)
    if (user.role !== 'admin' && !filterDataByStoreAccess(user, [existingSegment], 'storeId').length) {
      return res.status(403).json({ error: 'Access denied to this segment' });
    }
    
    const segment = await segmentsService.updateSegment(req.params.id, req.body, user.id);
    res.json(segment);
  } catch (e) {
    if (e.message === 'Segment not found') {
      return res.status(404).json({ error: e.message });
    }
    next(e);
  }
});

// DELETE /api/segments/:id - Delete segment
// ADMIN: Any segment, STORE_OWNER: Own store, USER: Not allowed
router.delete('/:id', authorizeStoreAccess(), requireWritePermission('segments'), async (req, res, next) => {
  try {
    const user = req.user;
    
    // Users cannot delete segments
    if (user.role === 'user') {
      return res.status(403).json({ 
        error: 'Forbidden',
        message: 'You do not have permission to delete segments'
      });
    }
    
    // Check if segment exists and user has access
    const existingSegment = await segmentsService.getSegmentById(req.params.id);
    if (!existingSegment) {
      return res.status(404).json({ error: 'Segment not found' });
    }
    
    // Check store access (admin bypasses)
    if (user.role !== 'admin' && !filterDataByStoreAccess(user, [existingSegment], 'storeId').length) {
      return res.status(403).json({ error: 'Access denied to this segment' });
    }
    
    await segmentsService.deleteSegment(req.params.id, user.id);
    res.json({ success: true });
  } catch (e) {
    if (e.message === 'Segment not found') {
      return res.status(404).json({ error: e.message });
    }
    next(e);
  }
});

export default router;


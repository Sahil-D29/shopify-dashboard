// backend/routes/brandsRoutes.js
import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorizeStoreAccess } from '../middleware/rbac.js';
import { ROLES } from '../config/roles.config.js';
import * as brandsService from '../services/brandsService.js';
import { logError } from '../utils/logger.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// GET /api/brands - Get brands for store
router.get('/', authorizeStoreAccess(), async (req, res, next) => {
  try {
    const storeId = req.storeId || req.query.storeId;
    
    if (!storeId) {
      return res.status(400).json({ error: 'Store ID is required' });
    }
    
    const brands = await brandsService.getBrandsByStoreId(storeId);
    res.json({ brands });
  } catch (e) {
    next(e);
  }
});

// GET /api/brands/:id - Get brand by ID
router.get('/:id', async (req, res, next) => {
  try {
    const brand = await brandsService.getBrandById(req.params.id);
    
    if (!brand) {
      return res.status(404).json({ error: 'Brand not found' });
    }
    
    res.json({ brand });
  } catch (e) {
    next(e);
  }
});

// POST /api/brands - Create brand
router.post('/', authorizeStoreAccess(), async (req, res, next) => {
  try {
    const user = req.user;
    const storeId = req.storeId || req.body.storeId;
    
    if (!storeId) {
      return res.status(400).json({ error: 'Store ID is required' });
    }
    
    const brand = await brandsService.createBrand({
      ...req.body,
      storeId
    }, user.id);
    
    res.status(201).json({ brand });
  } catch (e) {
    next(e);
  }
});

// PUT /api/stores/:storeId/brand - Update brand for store
router.put('/stores/:storeId/brand', authorizeStoreAccess(), async (req, res, next) => {
  try {
    const user = req.user;
    const { storeId } = req.params;
    
    // Get existing brands for store
    const existingBrands = await brandsService.getBrandsByStoreId(storeId);
    
    if (existingBrands.length === 0) {
      // Create new brand
      const brand = await brandsService.createBrand({
        ...req.body,
        storeId
      }, user.id);
      return res.json({ brand });
    }
    
    // Update first brand (or you can implement multi-brand logic)
    const brand = await brandsService.updateBrand(existingBrands[0].id, req.body, user.id);
    res.json({ brand });
  } catch (e) {
    next(e);
  }
});

// PUT /api/brands/:id - Update brand
router.put('/:id', async (req, res, next) => {
  try {
    const user = req.user;
    const brand = await brandsService.updateBrand(req.params.id, req.body, user.id);
    res.json({ brand });
  } catch (e) {
    if (e.message === 'Brand not found') {
      return res.status(404).json({ error: e.message });
    }
    next(e);
  }
});

// DELETE /api/brands/:id - Delete brand
router.delete('/:id', async (req, res, next) => {
  try {
    const user = req.user;
    await brandsService.deleteBrand(req.params.id, user.id);
    res.json({ success: true });
  } catch (e) {
    if (e.message === 'Brand not found') {
      return res.status(404).json({ error: e.message });
    }
    next(e);
  }
});

export default router;


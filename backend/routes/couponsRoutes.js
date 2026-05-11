// backend/routes/couponsRoutes.js
import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { ROLES } from '../config/roles.config.js';
import * as couponsService from '../services/couponsService.js';
import { logError } from '../utils/logger.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// POST /api/coupons/validate - Validate coupon code
router.post('/validate', async (req, res, next) => {
  try {
    const user = req.user;
    const { code, planType } = req.body;
    
    if (!code || !planType) {
      return res.status(400).json({ error: 'Coupon code and plan type are required' });
    }
    
    const validation = await couponsService.validateCoupon(code, user.id, planType);
    
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }
    
    res.json({
      valid: true,
      coupon: {
        code: validation.coupon.code,
        discountType: validation.coupon.discountType,
        value: validation.coupon.value
      }
    });
  } catch (e) {
    next(e);
  }
});

// GET /api/coupons - Get all coupons (admin only) or active coupons
router.get('/', async (req, res, next) => {
  try {
    const user = req.user;
    
    if (user.role === ROLES.ADMIN) {
      const coupons = await couponsService.loadCoupons();
      res.json({ coupons });
    } else {
      const coupons = await couponsService.getActiveCoupons();
      res.json({ coupons });
    }
  } catch (e) {
    next(e);
  }
});

// POST /api/coupons - Create coupon (admin only)
router.post('/', async (req, res, next) => {
  try {
    const user = req.user;
    
    if (user.role !== ROLES.ADMIN) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { code, discountType, value, validFrom, validUntil, usageLimit, applicablePlans, singleUse, description } = req.body;
    
    if (!code || !discountType || value === undefined) {
      return res.status(400).json({ error: 'Code, discount type, and value are required' });
    }
    
    if (!['percentage', 'fixed'].includes(discountType)) {
      return res.status(400).json({ error: 'Discount type must be "percentage" or "fixed"' });
    }
    
    const coupon = await couponsService.createCoupon({
      code,
      discountType,
      value,
      validFrom,
      validUntil,
      usageLimit,
      applicablePlans: applicablePlans || [],
      singleUse: singleUse || false,
      description
    }, user.id);
    
    res.status(201).json({ coupon });
  } catch (e) {
    if (e.message.includes('already exists')) {
      return res.status(400).json({ error: e.message });
    }
    next(e);
  }
});

// PUT /api/coupons/:id - Update coupon (admin only)
router.put('/:id', async (req, res, next) => {
  try {
    const user = req.user;
    
    if (user.role !== ROLES.ADMIN) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const coupon = await couponsService.updateCoupon(req.params.id, req.body, user.id);
    res.json({ coupon });
  } catch (e) {
    if (e.message === 'Coupon not found') {
      return res.status(404).json({ error: e.message });
    }
    next(e);
  }
});

// DELETE /api/coupons/:id - Delete coupon (admin only)
router.delete('/:id', async (req, res, next) => {
  try {
    const user = req.user;
    
    if (user.role !== ROLES.ADMIN) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    await couponsService.deleteCoupon(req.params.id, user.id);
    res.json({ success: true });
  } catch (e) {
    if (e.message === 'Coupon not found') {
      return res.status(404).json({ error: e.message });
    }
    next(e);
  }
});

export default router;


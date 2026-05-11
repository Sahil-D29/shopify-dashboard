// backend/routes/subscriptionsRoutes.js
import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorizeStoreAccess } from '../middleware/rbac.js';
import { ROLES } from '../config/roles.config.js';
import * as subscriptionsService from '../services/subscriptionsService.js';
import * as couponsService from '../services/couponsService.js';
import * as usageMetricsService from '../services/usageMetricsService.js';
import { logError } from '../utils/logger.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// POST /api/subscriptions/create - Create new subscription
router.post('/create', async (req, res, next) => {
  try {
    const user = req.user;
    const { planType, billingCycle, couponCode } = req.body;
    
    if (!planType || !['basic', 'pro'].includes(planType)) {
      return res.status(400).json({ error: 'Invalid plan type. Must be "basic" or "pro"' });
    }
    
    // Validate coupon if provided
    let discountAmount = 0;
    let appliedCoupon = null;
    
    if (couponCode) {
      const validation = await couponsService.validateCoupon(couponCode, user.id, planType);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }
      
      appliedCoupon = validation.coupon;
      const plan = await subscriptionsService.getPlanFeatures(planType);
      
      // Calculate discount
      if (appliedCoupon.discountType === 'percentage') {
        discountAmount = (plan.price * appliedCoupon.value) / 100;
      } else {
        discountAmount = Math.min(appliedCoupon.value, plan.price);
      }
    }
    
    const subscription = await subscriptionsService.createSubscription({
      userId: user.id,
      planType,
      billingCycle: billingCycle || 'monthly',
      couponCode: couponCode || null,
      discountAmount
    }, user.id);
    
    // Apply coupon if used
    if (appliedCoupon) {
      await couponsService.applyCoupon(couponCode, user.id, user.id);
    }
    
    res.status(201).json({ subscription });
  } catch (e) {
    if (e.message.includes('already has an active subscription')) {
      return res.status(400).json({ error: e.message });
    }
    next(e);
  }
});

// GET /api/subscriptions/:userId - Get current subscription
router.get('/:userId', async (req, res, next) => {
  try {
    const user = req.user;
    const { userId } = req.params;
    
    // Users can only view their own subscription unless admin
    if (user.role !== ROLES.ADMIN && user.id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const subscription = await subscriptionsService.getSubscriptionByUserId(userId);
    
    if (!subscription) {
      return res.status(404).json({ error: 'No active subscription found' });
    }
    
    // Get plan features
    const planFeatures = await subscriptionsService.getPlanFeatures(subscription.planType);
    
    res.json({ subscription, planFeatures });
  } catch (e) {
    next(e);
  }
});

// PUT /api/subscriptions/:id/upgrade - Upgrade subscription
router.put('/:id/upgrade', async (req, res, next) => {
  try {
    const user = req.user;
    const { id } = req.params;
    
    const subscription = await subscriptionsService.getSubscriptionById(id);
    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }
    
    // Users can only upgrade their own subscription unless admin
    if (user.role !== ROLES.ADMIN && subscription.userId !== user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const result = await subscriptionsService.upgradeSubscription(id, user.id);
    res.json(result);
  } catch (e) {
    if (e.message.includes('already on Pro plan')) {
      return res.status(400).json({ error: e.message });
    }
    next(e);
  }
});

// PUT /api/subscriptions/:id/downgrade - Downgrade subscription
router.put('/:id/downgrade', async (req, res, next) => {
  try {
    const user = req.user;
    const { id } = req.params;
    
    const subscription = await subscriptionsService.getSubscriptionById(id);
    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }
    
    // Users can only downgrade their own subscription unless admin
    if (user.role !== ROLES.ADMIN && subscription.userId !== user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const result = await subscriptionsService.downgradeSubscription(id, user.id);
    res.json({ subscription: result });
  } catch (e) {
    if (e.message.includes('already on Basic plan')) {
      return res.status(400).json({ error: e.message });
    }
    next(e);
  }
});

// POST /api/subscriptions/apply-coupon - Apply discount code
router.post('/apply-coupon', async (req, res, next) => {
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
    
    const coupon = validation.coupon;
    const plan = await subscriptionsService.getPlanFeatures(planType);
    
    // Calculate discount amount
    let discountAmount = 0;
    if (coupon.discountType === 'percentage') {
      discountAmount = (plan.price * coupon.value) / 100;
    } else {
      discountAmount = Math.min(coupon.value, plan.price);
    }
    
    res.json({
      valid: true,
      coupon: {
        code: coupon.code,
        discountType: coupon.discountType,
        value: coupon.value
      },
      discountAmount,
      finalPrice: plan.price - discountAmount
    });
  } catch (e) {
    next(e);
  }
});

// GET /api/subscriptions/usage - Get current usage metrics
router.get('/usage', authorizeStoreAccess(), async (req, res, next) => {
  try {
    const user = req.user;
    const storeId = req.storeId || req.query.storeId;
    
    if (!storeId) {
      return res.status(400).json({ error: 'Store ID is required' });
    }
    
    const subscription = await subscriptionsService.getSubscriptionByUserId(user.id);
    if (!subscription) {
      return res.status(404).json({ error: 'No active subscription found' });
    }
    
    const metrics = await usageMetricsService.getUsageMetrics(storeId, user.id);
    const percentages = usageMetricsService.getUsagePercentage(metrics);
    const limitExceeded = usageMetricsService.checkLimitExceeded(metrics);
    const planFeatures = await subscriptionsService.getPlanFeatures(subscription.planType);
    
    res.json({
      metrics,
      percentages,
      limitExceeded,
      planFeatures: planFeatures.features,
      subscription
    });
  } catch (e) {
    next(e);
  }
});

// GET /api/subscriptions - Get all subscriptions (admin only)
router.get('/', async (req, res, next) => {
  try {
    const user = req.user;
    
    if (user.role !== ROLES.ADMIN) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const subscriptions = await subscriptionsService.loadSubscriptions();
    res.json({ subscriptions });
  } catch (e) {
    next(e);
  }
});

// GET /api/subscriptions/plan-features - Get all plan features
router.get('/plan-features', async (req, res, next) => {
  try {
    const plans = await subscriptionsService.getAllPlanFeatures();
    res.json({ success: true, plans });
  } catch (error) {
    next(error);
  }
});

// GET /api/subscriptions/plan-features/:planId - Get specific plan features
router.get('/plan-features/:planId', async (req, res, next) => {
  try {
    const { planId } = req.params;
    const plan = await subscriptionsService.getPlanFeatures(planId);
    
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    
    res.json({ success: true, plan });
  } catch (error) {
    next(error);
  }
});

export default router;


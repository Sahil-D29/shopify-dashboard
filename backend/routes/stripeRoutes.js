// backend/routes/stripeRoutes.js
import express from 'express';
import { authenticate } from '../middleware/auth.js';
import * as stripeService from '../services/stripeService.js';
import { logError } from '../utils/logger.js';
import Stripe from 'stripe';

const router = express.Router();

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

// POST /api/stripe/create-checkout - Create checkout session
router.post('/create-checkout', authenticate, async (req, res, next) => {
  try {
    const user = req.user;
    const { planType, billingCycle, couponCode, successUrl, cancelUrl } = req.body;
    
    if (!planType || !['basic', 'pro'].includes(planType)) {
      return res.status(400).json({ error: 'Invalid plan type' });
    }
    
    const session = await stripeService.createCheckoutSession({
      userId: user.id,
      email: user.email,
      planType,
      billingCycle: billingCycle || 'monthly',
      couponCode,
      successUrl,
      cancelUrl
    });
    
    res.json({ sessionId: session.id, url: session.url });
  } catch (e) {
    if (e.message.includes('not configured')) {
      return res.status(503).json({ error: 'Payment system is not configured' });
    }
    next(e);
  }
});

// POST /api/stripe/webhook - Stripe webhook handler
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  
  if (!stripeWebhookSecret) {
    console.error('Stripe webhook secret not configured');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }
  
  let event;
  
  try {
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-12-18.acacia',
    });
    
    event = stripe.webhooks.constructEvent(req.body, sig, stripeWebhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  
  try {
    await stripeService.handleWebhookEvent(event);
    res.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    await logError({
      message: `Stripe webhook handler error: ${error.message}`,
      stack: error.stack,
      type: 'stripe_webhook_handler_error'
    });
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

// POST /api/stripe/cancel-subscription - Cancel subscription
router.post('/cancel-subscription', authenticate, async (req, res, next) => {
  try {
    const user = req.user;
    const { subscriptionId } = req.body;
    
    // Get subscription to verify ownership
    const { getSubscriptionById } = await import('../services/subscriptionsService.js');
    const subscription = await getSubscriptionById(subscriptionId);
    
    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }
    
    if (subscription.userId !== user.id && user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    if (subscription.stripeSubscriptionId) {
      await stripeService.cancelStripeSubscription(subscription.stripeSubscriptionId);
    }
    
    const { cancelSubscription } = await import('../services/subscriptionsService.js');
    await cancelSubscription(subscriptionId, user.id);
    
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

export default router;


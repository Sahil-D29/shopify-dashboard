// backend/services/stripeService.js
import Stripe from 'stripe';
import * as subscriptionsService from './subscriptionsService.js';
import { logError } from '../utils/logger.js';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
let stripe = null;

if (stripeSecretKey) {
  stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2024-12-18.acacia',
  });
}

/**
 * Create Stripe checkout session
 */
export async function createCheckoutSession(subscriptionData) {
  if (!stripe) {
    throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.');
  }
  
  const { userId, planType, billingCycle, couponCode, successUrl, cancelUrl } = subscriptionData;
  
  const plan = await subscriptionsService.getPlanFeatures(planType);
  if (!plan) {
    throw new Error('Invalid plan type');
  }
  
  // Calculate price based on billing cycle
  let price = plan.price;
  if (billingCycle === 'yearly') {
    price = plan.price * 12 * 0.9; // 10% discount for yearly
  }
  
  // Apply coupon discount if provided
  let discountAmount = 0;
  if (couponCode) {
    const { validateCoupon } = await import('./couponsService.js');
    const validation = await validateCoupon(couponCode, userId, planType);
    if (validation.valid) {
      const coupon = validation.coupon;
      if (coupon.discountType === 'percentage') {
        discountAmount = (price * coupon.value) / 100;
      } else {
        discountAmount = Math.min(coupon.value, price);
      }
    }
  }
  
  const finalPrice = Math.max(0, price - discountAmount);
  
  const sessionParams = {
    payment_method_types: ['card'],
    mode: 'subscription',
    customer_email: subscriptionData.email,
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${plan.name} - ${billingCycle}`,
            description: `Subscription to ${plan.name} plan (${billingCycle})`
          },
          unit_amount: Math.round(finalPrice * 100), // Convert to cents
          recurring: {
            interval: billingCycle === 'yearly' ? 'year' : 'month'
          }
        },
        quantity: 1
      }
    ],
    metadata: {
      userId,
      planType,
      billingCycle,
      couponCode: couponCode || ''
    },
    success_url: successUrl || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/subscription/cancel`
  };
  
  // Add coupon if provided
  if (couponCode && discountAmount > 0) {
    // Note: In production, you'd create a Stripe coupon first
    // For now, we'll handle discount in metadata
  }
  
  const session = await stripe.checkout.sessions.create(sessionParams);
  
  return session;
}

/**
 * Handle Stripe webhook events
 */
export async function handleWebhookEvent(event) {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }
  
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;
        
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
        
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
        
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;
        
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;
        
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
    
    return { received: true };
  } catch (error) {
    await logError({
      message: `Stripe webhook error: ${error.message}`,
      stack: error.stack,
      type: 'stripe_webhook_error',
      eventType: event.type
    });
    throw error;
  }
}

/**
 * Handle checkout session completed
 */
async function handleCheckoutCompleted(session) {
  const { userId, planType, billingCycle, couponCode } = session.metadata;
  
  // Create subscription
  const subscription = await subscriptionsService.createSubscription({
    userId,
    planType,
    billingCycle,
    couponCode: couponCode || null,
    stripeSubscriptionId: session.subscription,
    stripeCustomerId: session.customer
  }, userId);
  
  // Record payment
  await subscriptionsService.recordPayment({
    subscriptionId: subscription.id,
    userId,
    amount: session.amount_total / 100, // Convert from cents
    currency: session.currency,
    type: 'subscription',
    status: 'succeeded',
    stripePaymentIntentId: session.payment_intent,
    stripeInvoiceId: session.invoice,
    description: `Initial subscription payment for ${planType} plan`
  }, userId);
  
  // Apply coupon if used
  if (couponCode) {
    const { applyCoupon } = await import('./couponsService.js');
    await applyCoupon(couponCode, userId, userId);
  }
}

/**
 * Handle subscription updated
 */
async function handleSubscriptionUpdated(stripeSubscription) {
  const subscriptions = await subscriptionsService.loadSubscriptions();
  const subscription = subscriptions.find(s => s.stripeSubscriptionId === stripeSubscription.id);
  
  if (!subscription) {
    console.warn(`Subscription not found for Stripe subscription: ${stripeSubscription.id}`);
    return;
  }
  
  const updates = {
    status: stripeSubscription.status === 'active' ? 'active' : 
             stripeSubscription.status === 'canceled' ? 'cancelled' : 
             stripeSubscription.status === 'past_due' ? 'past_due' : 'inactive'
  };
  
  if (stripeSubscription.current_period_end) {
    updates.endDate = new Date(stripeSubscription.current_period_end * 1000).toISOString();
  }
  
  await subscriptionsService.updateSubscription(subscription.id, updates, subscription.userId);
}

/**
 * Handle subscription deleted
 */
async function handleSubscriptionDeleted(stripeSubscription) {
  const subscriptions = await subscriptionsService.loadSubscriptions();
  const subscription = subscriptions.find(s => s.stripeSubscriptionId === stripeSubscription.id);
  
  if (subscription) {
    await subscriptionsService.cancelSubscription(subscription.id, subscription.userId);
  }
}

/**
 * Handle payment succeeded
 */
async function handlePaymentSucceeded(invoice) {
  const subscriptions = await subscriptionsService.loadSubscriptions();
  const subscription = subscriptions.find(s => s.stripeSubscriptionId === invoice.subscription);
  
  if (subscription) {
    await subscriptionsService.recordPayment({
      subscriptionId: subscription.id,
      userId: subscription.userId,
      amount: invoice.amount_paid / 100,
      currency: invoice.currency,
      type: 'subscription',
      status: 'succeeded',
      stripePaymentIntentId: invoice.payment_intent,
      stripeInvoiceId: invoice.id,
      description: `Subscription renewal for ${subscription.planType} plan`
    }, subscription.userId);
    
    // Reset usage metrics for new billing cycle
    const { resetUsageMetrics } = await import('./usageMetricsService.js');
    // Note: You'll need storeId - this might need to be stored in subscription metadata
  }
}

/**
 * Handle payment failed
 */
async function handlePaymentFailed(invoice) {
  const subscriptions = await subscriptionsService.loadSubscriptions();
  const subscription = subscriptions.find(s => s.stripeSubscriptionId === invoice.subscription);
  
  if (subscription) {
    // Record failed payment
    const payment = await subscriptionsService.recordPayment({
      subscriptionId: subscription.id,
      userId: subscription.userId,
      amount: invoice.amount_due / 100,
      currency: invoice.currency,
      type: 'subscription',
      status: 'failed',
      stripePaymentIntentId: invoice.payment_intent,
      stripeInvoiceId: invoice.id,
      failureReason: invoice.last_payment_error?.message || 'Payment failed',
      description: `Failed subscription payment for ${subscription.planType} plan`
    }, subscription.userId);
    
    // Retry logic (3 attempts)
    if (payment.retryCount < 3) {
      // Schedule retry (you can implement a job queue here)
      console.log(`Scheduling retry ${payment.retryCount + 1} for payment ${payment.id}`);
      
      // Update retry count
      await subscriptionsService.updatePaymentStatus(
        payment.id,
        'pending',
        null
      );
      
      // In production, use a job queue to retry after delay
      setTimeout(async () => {
        try {
          if (stripe && invoice.payment_intent) {
            // Attempt to retry payment
            const paymentIntent = await stripe.paymentIntents.retrieve(invoice.payment_intent);
            // Handle retry logic here
          }
        } catch (error) {
          console.error('Payment retry failed:', error);
        }
      }, 24 * 60 * 60 * 1000); // Retry after 24 hours
    } else {
      // Final failure - cancel subscription
      await subscriptionsService.cancelSubscription(subscription.id, subscription.userId);
    }
  }
}

/**
 * Cancel Stripe subscription
 */
export async function cancelStripeSubscription(stripeSubscriptionId) {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }
  
  const subscription = await stripe.subscriptions.cancel(stripeSubscriptionId);
  return subscription;
}

/**
 * Create invoice
 */
export async function createInvoice(customerId, amount, description) {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }
  
  const invoice = await stripe.invoices.create({
    customer: customerId,
    amount: Math.round(amount * 100), // Convert to cents
    currency: 'usd',
    description
  });
  
  await stripe.invoices.finalizeInvoice(invoice.id);
  await stripe.invoices.sendInvoice(invoice.id);
  
  return invoice;
}


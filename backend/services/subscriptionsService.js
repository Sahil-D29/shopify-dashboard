// backend/services/subscriptionsService.js
import { readFileSafe, writeFileSafe } from '../utils/fileStorage.js';
import { v4 as uuidv4 } from 'uuid';
import { logActivity } from '../utils/logger.js';

// File paths
const planFeaturesFile = 'plan-features.json';
const subscriptionsFile = 'subscriptions.json';

/**
 * Get plan features
 */
export async function getPlanFeatures(planId) {
  const data = await readFileSafe(planFeaturesFile, { default: { plans: [] } });
  return data.plans.find(p => p.id === planId) || null;
}

/**
 * Get all plan features
 */
export async function getAllPlanFeatures() {
  const data = await readFileSafe(planFeaturesFile, { default: { plans: [] } });
  return data.plans || [];
}

/**
 * Load all subscriptions
 */
export async function loadSubscriptions() {
  const data = await readFileSafe(subscriptionsFile, { default: { subscriptions: [] } });
  return data.subscriptions || [];
}

// Export file paths for use in other services
export { planFeaturesFile, subscriptionsFile };

/**
 * Get subscription by ID
 */
export async function getSubscriptionById(id) {
  const subscriptions = await loadSubscriptions();
  return subscriptions.find(s => s.id === id);
}

/**
 * Get subscription by user ID
 */
export async function getSubscriptionByUserId(userId) {
  const subscriptions = await loadSubscriptions();
  return subscriptions.find(s => s.userId === userId && s.status !== 'cancelled');
}

/**
 * Get all subscriptions for a user (including cancelled)
 */
export async function getSubscriptionsByUserId(userId) {
  const subscriptions = await loadSubscriptions();
  return subscriptions.filter(s => s.userId === userId);
}

/**
 * Create new subscription
 */
export async function createSubscription(subscriptionData, actorId) {
  const subscriptions = await loadSubscriptions();
  
  // Check if user already has an active subscription
  const existingActive = subscriptions.find(
    s => s.userId === subscriptionData.userId && s.status === 'active'
  );
  
  if (existingActive) {
    throw new Error('User already has an active subscription');
  }
  
  const plan = await getPlanFeatures(subscriptionData.planType);
  if (!plan) {
    throw new Error('Invalid plan type');
  }
  
  const now = new Date();
  const endDate = new Date(now);
  
  // Set end date based on billing cycle
  if (subscriptionData.billingCycle === 'monthly') {
    endDate.setMonth(endDate.getMonth() + 1);
  } else if (subscriptionData.billingCycle === 'yearly') {
    endDate.setFullYear(endDate.getFullYear() + 1);
  }
  
  const subscription = {
    id: `sub_${uuidv4()}`,
    userId: subscriptionData.userId,
    planType: subscriptionData.planType,
    billingCycle: subscriptionData.billingCycle || 'monthly',
    status: subscriptionData.status || 'active',
    startDate: subscriptionData.startDate || now.toISOString(),
    endDate: subscriptionData.endDate || endDate.toISOString(),
    price: subscriptionData.price || plan.price,
    currency: subscriptionData.currency || 'USD',
    stripeSubscriptionId: subscriptionData.stripeSubscriptionId || null,
    stripeCustomerId: subscriptionData.stripeCustomerId || null,
    couponCode: subscriptionData.couponCode || null,
    discountAmount: subscriptionData.discountAmount || 0,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    createdBy: actorId
  };
  
  subscriptions.push(subscription);
  await writeFileSafe('subscriptions.json', { subscriptions });
  
  await logActivity({
    actor: actorId,
    action: 'subscription.created',
    resource: subscription.id,
    details: { planType: subscription.planType }
  });
  
  return subscription;
}

/**
 * Update subscription
 */
export async function updateSubscription(id, updates, actorId) {
  const subscriptions = await loadSubscriptions();
  const index = subscriptions.findIndex(s => s.id === id);
  
  if (index === -1) {
    throw new Error('Subscription not found');
  }
  
  const subscription = {
    ...subscriptions[index],
    ...updates,
    updatedAt: new Date().toISOString()
  };
  
  subscriptions[index] = subscription;
  await writeFileSafe('subscriptions.json', { subscriptions });
  
  await logActivity({
    actor: actorId,
    action: 'subscription.updated',
    resource: id,
    details: updates
  });
  
  return subscription;
}

/**
 * Upgrade subscription (basic to pro)
 */
export async function upgradeSubscription(subscriptionId, actorId) {
  const subscription = await getSubscriptionById(subscriptionId);
  if (!subscription) {
    throw new Error('Subscription not found');
  }
  
  if (subscription.planType === 'pro') {
    throw new Error('Subscription is already on Pro plan');
  }
  
  const proPlan = await getPlanFeatures('pro');
  const basicPlan = await getPlanFeatures('basic');
  
  // Calculate prorated amount
  const now = new Date();
  const endDate = new Date(subscription.endDate);
  const daysRemaining = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
  const totalDays = Math.ceil((endDate - new Date(subscription.startDate)) / (1000 * 60 * 60 * 24));
  
  const basicPricePerDay = basicPlan.price / totalDays;
  const proPricePerDay = proPlan.price / totalDays;
  const credit = basicPricePerDay * daysRemaining;
  const charge = proPricePerDay * daysRemaining;
  const proratedAmount = Math.max(0, charge - credit);
  
  const updated = await updateSubscription(subscriptionId, {
    planType: 'pro',
    price: proPlan.price,
    // Extend end date if needed, or keep same
  }, actorId);
  
  // Record prorated payment
  if (proratedAmount > 0) {
    await recordPayment({
      subscriptionId: subscriptionId,
      userId: subscription.userId,
      amount: proratedAmount,
      currency: subscription.currency,
      type: 'upgrade',
      status: 'pending',
      description: `Prorated upgrade from Basic to Pro`
    }, actorId);
  }
  
  return { subscription: updated, proratedAmount };
}

/**
 * Downgrade subscription (pro to basic)
 */
export async function downgradeSubscription(subscriptionId, actorId) {
  const subscription = await getSubscriptionById(subscriptionId);
  if (!subscription) {
    throw new Error('Subscription not found');
  }
  
  if (subscription.planType === 'basic') {
    throw new Error('Subscription is already on Basic plan');
  }
  
  const basicPlan = await getPlanFeatures('basic');
  
  // Downgrade takes effect on next billing cycle
  const updated = await updateSubscription(subscriptionId, {
    planType: 'basic',
    price: basicPlan.price,
    status: 'downgrade_scheduled',
    scheduledDowngradeDate: subscription.endDate
  }, actorId);
  
  return updated;
}

/**
 * Cancel subscription
 */
export async function cancelSubscription(subscriptionId, actorId) {
  const subscription = await getSubscriptionById(subscriptionId);
  if (!subscription) {
    throw new Error('Subscription not found');
  }
  
  return await updateSubscription(subscriptionId, {
    status: 'cancelled',
    cancelledAt: new Date().toISOString()
  }, actorId);
}

/**
 * Record payment
 */
export async function recordPayment(paymentData, actorId) {
  const paymentsData = await readFileSafe('payment-history.json', { default: { payments: [] } });
  const payments = paymentsData.payments || [];
  
  const payment = {
    id: `pay_${uuidv4()}`,
    subscriptionId: paymentData.subscriptionId,
    userId: paymentData.userId,
    amount: paymentData.amount,
    currency: paymentData.currency || 'USD',
    type: paymentData.type || 'subscription',
    status: paymentData.status || 'pending',
    paymentMethod: paymentData.paymentMethod || null,
    stripePaymentIntentId: paymentData.stripePaymentIntentId || null,
    stripeInvoiceId: paymentData.stripeInvoiceId || null,
    description: paymentData.description || null,
    failureReason: paymentData.failureReason || null,
    retryCount: paymentData.retryCount || 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  payments.push(payment);
  await writeFileSafe('payment-history.json', { payments });
  
  await logActivity({
    actor: actorId,
    action: 'payment.recorded',
    resource: payment.id,
    details: { amount: payment.amount, status: payment.status }
  });
  
  return payment;
}

/**
 * Get payment history
 */
export async function getPaymentHistory(userId = null, subscriptionId = null) {
  const paymentsData = await readFileSafe('payment-history.json', { default: { payments: [] } });
  const payments = paymentsData.payments || [];
  let filtered = payments;
  
  if (userId) {
    filtered = filtered.filter(p => p.userId === userId);
  }
  
  if (subscriptionId) {
    filtered = filtered.filter(p => p.subscriptionId === subscriptionId);
  }
  
  return filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * Update payment status
 */
export async function updatePaymentStatus(paymentId, status, failureReason = null) {
  const paymentsData = await readFileSafe('payment-history.json', { default: { payments: [] } });
  const payments = paymentsData.payments || [];
  const index = payments.findIndex(p => p.id === paymentId);
  
  if (index === -1) {
    throw new Error('Payment not found');
  }
  
  payments[index] = {
    ...payments[index],
    status,
    failureReason,
    updatedAt: new Date().toISOString()
  };
  
  await writeFileSafe('payment-history.json', { payments });
  return payments[index];
}

/**
 * Get failed payments for retry
 */
export async function getFailedPaymentsForRetry(maxRetries = 3) {
  const paymentsData = await readFileSafe('payment-history.json', { default: { payments: [] } });
  const payments = paymentsData.payments || [];
  return payments.filter(
    p => p.status === 'failed' && 
    p.retryCount < maxRetries &&
    p.type === 'subscription'
  );
}


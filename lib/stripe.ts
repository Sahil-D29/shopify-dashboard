/**
 * Stripe client and webhook handling - single source for payments
 * Replaces backend services/stripeService.js
 */
import Stripe from 'stripe';
import { prisma } from './prisma';
import { logError } from './logger';
import { getBaseUrl } from './utils/getBaseUrl';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
let stripe: Stripe | null = null;

if (stripeSecretKey) {
  stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2025-02-24.acacia',
  });
}

export function getStripe(): Stripe | null {
  return stripe;
}

export function isStripeConfigured(): boolean {
  return !!stripe;
}

/** Get plan features by planId (e.g. 'basic', 'pro') */
export async function getPlanFeatures(planId: string) {
  return prisma.planFeature.findUnique({ where: { planId } });
}

/** Create Stripe checkout session */
export async function createCheckoutSession(subscriptionData: {
  userId: string;
  email: string;
  planType: string;
  billingCycle: string;
  couponCode?: string;
  successUrl?: string;
  cancelUrl?: string;
}): Promise<Stripe.Checkout.Session> {
  if (!stripe) {
    throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY.');
  }

  const { userId, planType, billingCycle, couponCode, successUrl, cancelUrl } = subscriptionData;
  const plan = await getPlanFeatures(planType);
  if (!plan) throw new Error('Invalid plan type');

  let price = Number(plan.price);
  if (billingCycle === 'yearly') {
    price = price * 12 * 0.9;
  }

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    payment_method_types: ['card'],
    mode: 'subscription',
    customer_email: subscriptionData.email,
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${plan.name} - ${billingCycle}`,
            description: `Subscription to ${plan.name} plan (${billingCycle})`,
          },
          unit_amount: Math.round(price * 100),
          recurring: {
            interval: billingCycle === 'yearly' ? 'year' : 'month',
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      userId,
      planType,
      billingCycle,
      couponCode: couponCode || '',
    },
    success_url: successUrl || `${getBaseUrl()}/settings?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl || `${getBaseUrl()}/settings`,
  };

  const session = await stripe.checkout.sessions.create(sessionParams);
  return session;
}

/** Handle Stripe webhook event - uses Prisma for subscriptions/payments */
export async function handleWebhookEvent(event: Stripe.Event): Promise<{ received: boolean }> {
  if (!stripe) throw new Error('Stripe is not configured');

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.updated':
      case 'customer.subscription.created':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      default:
        console.log(`Unhandled Stripe event type: ${event.type}`);
    }
    return { received: true };
  } catch (error) {
    await logError({
      message: `Stripe webhook error: ${error instanceof Error ? error.message : String(error)}`,
      stack: error instanceof Error ? error.stack : undefined,
      type: 'stripe_webhook_error',
      context: { eventType: event.type },
    });
    throw error;
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const metadata = session.metadata as Record<string, string> | null;
  if (!metadata?.userId || !metadata?.planType) return;

  const plan = await getPlanFeatures(metadata.planType);
  if (!plan) return;

  const storeIds = await prisma.store.findMany({
    where: { ownerId: metadata.userId },
    select: { id: true },
  });
  const storeId = storeIds[0]?.id;
  if (!storeId) return;

  const now = new Date();
  const currentPeriodEnd = new Date(now);
  currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + (metadata.billingCycle === 'yearly' ? 12 : 1));

  await prisma.subscription.create({
    data: {
      storeId,
      planId: plan.planId,
      planName: plan.name,
      status: 'ACTIVE',
      currentPeriodStart: now,
      currentPeriodEnd,
      stripeCustomerId: session.customer as string | null,
      stripeSubscriptionId: session.subscription as string | null,
    },
  });

  if (session.amount_total) {
    const sub = await prisma.subscription.findFirst({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
    });
    if (sub) {
      await prisma.payment.create({
        data: {
          subscriptionId: sub.id,
          amount: session.amount_total / 100,
          currency: (session.currency ?? 'usd').toUpperCase(),
          status: 'SUCCEEDED',
          stripePaymentId: session.payment_intent as string | null,
          paidAt: new Date(),
        },
      });
    }
  }
}

async function handleSubscriptionUpdated(stripeSubscription: Stripe.Subscription) {
  const sub = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: stripeSubscription.id },
  });
  if (!sub) {
    console.warn(`Subscription not found for Stripe id: ${stripeSubscription.id}`);
    return;
  }

  const status =
    stripeSubscription.status === 'active'
      ? 'ACTIVE'
      : stripeSubscription.status === 'canceled'
        ? 'CANCELLED'
        : stripeSubscription.status === 'past_due'
          ? 'PAST_DUE'
          : 'UNPAID';

  await prisma.subscription.update({
    where: { id: sub.id },
    data: {
      status,
      currentPeriodEnd: stripeSubscription.current_period_end
        ? new Date(stripeSubscription.current_period_end * 1000)
        : undefined,
    },
  });
}

async function handleSubscriptionDeleted(stripeSubscription: Stripe.Subscription) {
  const sub = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: stripeSubscription.id },
  });
  if (sub) {
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { status: 'CANCELLED' },
    });
  }
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  if (!invoice.subscription) return;
  const sub = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: invoice.subscription as string },
  });
  if (!sub) return;

  await prisma.payment.create({
    data: {
      subscriptionId: sub.id,
      amount: (invoice.amount_paid ?? 0) / 100,
      currency: (invoice.currency ?? 'usd').toUpperCase(),
      status: 'SUCCEEDED',
      stripePaymentId: invoice.payment_intent as string | null,
      paidAt: new Date(),
    },
  });
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  if (!invoice.subscription) return;
  const sub = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: invoice.subscription as string },
  });
  if (!sub) return;

  await prisma.payment.create({
    data: {
      subscriptionId: sub.id,
      amount: (invoice.amount_due ?? 0) / 100,
      currency: (invoice.currency ?? 'usd').toUpperCase(),
      status: 'FAILED',
      stripePaymentId: invoice.payment_intent as string | null,
    },
  });
}

/** Cancel Stripe subscription */
export async function cancelStripeSubscription(stripeSubscriptionId: string): Promise<Stripe.Subscription> {
  if (!stripe) throw new Error('Stripe is not configured');
  return stripe.subscriptions.cancel(stripeSubscriptionId);
}

/**
 * Razorpay client for Indian payments (INR subscriptions)
 * Handles: subscription creation, cancellation, webhook verification
 */
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { prisma } from './prisma';

const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

let razorpay: Razorpay | null = null;

if (razorpayKeyId && razorpayKeySecret) {
  razorpay = new Razorpay({
    key_id: razorpayKeyId,
    key_secret: razorpayKeySecret,
  });
}

export function getRazorpay(): Razorpay | null {
  return razorpay;
}

export function isRazorpayConfigured(): boolean {
  return !!razorpay;
}

export function getRazorpayKeyId(): string | undefined {
  return razorpayKeyId;
}

// Plan ID mapping: our planId → Razorpay plan ID (set in env)
const RAZORPAY_PLAN_MAP: Record<string, string> = {
  starter: process.env.RAZORPAY_PLAN_STARTER || '',
  growth: process.env.RAZORPAY_PLAN_GROWTH || '',
};

/** Create a Razorpay subscription */
export async function createRazorpaySubscription(opts: {
  planId: string;
  email: string;
  storeId: string;
  couponCode?: string;
}): Promise<{ subscriptionId: string; shortUrl?: string }> {
  if (!razorpay) throw new Error('Razorpay is not configured');

  const razorpayPlanId = RAZORPAY_PLAN_MAP[opts.planId];
  if (!razorpayPlanId) throw new Error(`No Razorpay plan mapped for: ${opts.planId}`);

  const subscriptionOpts: Record<string, unknown> = {
    plan_id: razorpayPlanId,
    total_count: 12, // 12 billing cycles
    quantity: 1,
    notes: {
      storeId: opts.storeId,
      planId: opts.planId,
      email: opts.email,
    },
  };

  const subscription = await (razorpay as any).subscriptions.create(subscriptionOpts);

  return {
    subscriptionId: subscription.id,
    shortUrl: subscription.short_url,
  };
}

/** Cancel a Razorpay subscription */
export async function cancelRazorpaySubscription(subscriptionId: string): Promise<void> {
  if (!razorpay) throw new Error('Razorpay is not configured');
  await (razorpay as any).subscriptions.cancel(subscriptionId);
}

/** Verify Razorpay webhook signature */
export function verifyRazorpayWebhookSignature(
  body: string,
  signature: string
): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return false;

  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSig)
  );
}

/** Handle Razorpay webhook event */
export async function handleRazorpayWebhookEvent(event: {
  event: string;
  payload: Record<string, any>;
}): Promise<void> {
  const { event: eventType, payload } = event;

  switch (eventType) {
    case 'subscription.activated':
    case 'subscription.charged': {
      const subscription = payload.subscription?.entity;
      if (!subscription) return;

      const notes = subscription.notes || {};
      const storeId = notes.storeId;
      const planId = notes.planId;

      if (!storeId || !planId) return;

      const plan = await prisma.planFeature.findUnique({ where: { planId } });
      if (!plan) return;

      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      await prisma.subscription.upsert({
        where: { storeId },
        create: {
          storeId,
          planId,
          planName: plan.name,
          status: 'ACTIVE',
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          stripeSubscriptionId: subscription.id, // Reusing field for Razorpay ID
          stripeCustomerId: null,
        },
        update: {
          planId,
          planName: plan.name,
          status: 'ACTIVE',
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          stripeSubscriptionId: subscription.id,
        },
      });

      // Record payment if charged
      if (eventType === 'subscription.charged' && payload.payment?.entity) {
        const payment = payload.payment.entity;
        const sub = await prisma.subscription.findUnique({ where: { storeId } });
        if (sub) {
          await prisma.payment.create({
            data: {
              subscriptionId: sub.id,
              amount: (payment.amount || 0) / 100,
              currency: (payment.currency || 'INR').toUpperCase(),
              status: 'SUCCEEDED',
              stripePaymentId: payment.id, // Reusing field for Razorpay payment ID
              paidAt: new Date(),
            },
          });
        }
      }
      break;
    }

    case 'subscription.cancelled':
    case 'subscription.completed': {
      const subscription = payload.subscription?.entity;
      if (!subscription) return;
      const notes = subscription.notes || {};
      const storeId = notes.storeId;
      if (!storeId) return;

      await prisma.subscription.updateMany({
        where: { storeId },
        data: { status: 'CANCELLED' },
      });
      break;
    }

    case 'payment.failed': {
      const payment = payload.payment?.entity;
      if (!payment) return;
      const notes = payment.notes || {};
      const storeId = notes.storeId;
      if (!storeId) return;

      const sub = await prisma.subscription.findUnique({ where: { storeId } });
      if (sub) {
        await prisma.payment.create({
          data: {
            subscriptionId: sub.id,
            amount: (payment.amount || 0) / 100,
            currency: (payment.currency || 'INR').toUpperCase(),
            status: 'FAILED',
            stripePaymentId: payment.id,
          },
        });
      }
      break;
    }

    default:
      console.log(`Unhandled Razorpay event: ${eventType}`);
  }
}

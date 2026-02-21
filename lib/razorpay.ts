/**
 * Razorpay client for Indian payments (INR)
 * Uses Razorpay Orders API for one-time payments
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

/** Create a Razorpay order for payment */
export async function createRazorpayOrder(opts: {
  planId: string;
  planName: string;
  amountINR: number;
  email: string;
  storeId: string;
}): Promise<{ orderId: string; amount: number; currency: string }> {
  if (!razorpay) throw new Error('Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET env vars.');

  const amountInPaise = Math.round(opts.amountINR * 100); // Razorpay expects paise

  try {
    const order = await (razorpay as any).orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: `sub_${opts.storeId}_${opts.planId}_${Date.now()}`,
      notes: {
        storeId: opts.storeId,
        planId: opts.planId,
        planName: opts.planName,
        email: opts.email,
      },
    });

    return {
      orderId: order.id,
      amount: amountInPaise,
      currency: 'INR',
    };
  } catch (err: any) {
    const msg = err?.error?.description || err?.message || 'Unknown Razorpay error';
    console.error('Razorpay order creation failed:', {
      message: msg,
      statusCode: err?.statusCode,
      error: err?.error,
    });
    throw new Error(`Razorpay order creation failed: ${msg}`);
  }
}

/** Verify Razorpay payment signature after client-side checkout */
export function verifyRazorpayPaymentSignature(opts: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  if (!razorpayKeySecret) return false;

  const body = `${opts.orderId}|${opts.paymentId}`;
  const expectedSig = crypto
    .createHmac('sha256', razorpayKeySecret)
    .update(body)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(opts.signature),
    Buffer.from(expectedSig)
  );
}

/** Cancel a Razorpay subscription (legacy support) */
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
    case 'payment.captured': {
      const payment = payload.payment?.entity;
      if (!payment) return;

      const notes = payment.notes || {};
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
          stripeSubscriptionId: payment.order_id, // Store Razorpay order ID
          stripeCustomerId: null,
        },
        update: {
          planId,
          planName: plan.name,
          status: 'ACTIVE',
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          stripeSubscriptionId: payment.order_id,
        },
      });

      // Record payment
      const sub = await prisma.subscription.findUnique({ where: { storeId } });
      if (sub) {
        await prisma.payment.create({
          data: {
            subscriptionId: sub.id,
            amount: (payment.amount || 0) / 100,
            currency: (payment.currency || 'INR').toUpperCase(),
            status: 'SUCCEEDED',
            stripePaymentId: payment.id,
            paidAt: new Date(),
          },
        });
      }
      break;
    }

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
          stripeSubscriptionId: subscription.id,
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
              stripePaymentId: payment.id,
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

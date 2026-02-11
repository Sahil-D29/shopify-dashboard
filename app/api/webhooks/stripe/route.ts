export const dynamic = 'force-dynamic';
/**
 * Stripe webhook - MUST use raw body for signature verification
 * No body parser; read request.text() and pass to stripe.webhooks.constructEvent
 */
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { handleWebhookEvent } from '@/lib/stripe';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const sig = req.headers.get('stripe-signature');
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    const stripe = (await import('@/lib/stripe')).getStripe();
    if (!stripe) {
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
    }
    event = stripe.webhooks.constructEvent(rawBody, sig!, secret);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Stripe webhook signature verification failed:', message);
    return NextResponse.json({ error: `Webhook Error: ${message}` }, { status: 400 });
  }

  try {
    await handleWebhookEvent(event);
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook handler error:', error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}

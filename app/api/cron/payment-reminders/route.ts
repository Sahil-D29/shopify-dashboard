export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { checkExpiringSubscriptions, markReminderSent } from '@/lib/billing/reminders';

/**
 * Cron endpoint to send payment expiry reminders.
 * Should be called daily via external cron service (e.g., Render cron, Vercel cron).
 * Optionally protected via CRON_SECRET header.
 */
export async function GET(request: NextRequest) {
  try {
    // Optional: verify cron secret for security
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = request.headers.get('authorization');
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    // Find subscriptions expiring within 3 days
    const expiringSubscriptions = await checkExpiringSubscriptions(3);

    const results: Array<{ storeId: string; email: string; status: string }> = [];

    for (const sub of expiringSubscriptions) {
      try {
        const ownerEmail = sub.store?.owner?.email;
        const ownerName = sub.store?.owner?.name || 'User';
        const daysLeft = Math.ceil(
          (new Date(sub.currentPeriodEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );

        if (ownerEmail) {
          // TODO: Send actual email notification
          // For now, log and mark as sent
          console.log(`[PaymentReminder] Sending reminder to ${ownerEmail} for store ${sub.storeId}`);
          console.log(`  Plan: ${sub.planName}, expires in ${daysLeft} days`);

          // Mark reminder as sent to prevent duplicates
          await markReminderSent(sub.id);

          results.push({
            storeId: sub.storeId,
            email: ownerEmail,
            status: 'reminder_sent',
          });
        }
      } catch (err) {
        console.error(`[PaymentReminder] Error processing subscription ${sub.id}:`, err);
        results.push({
          storeId: sub.storeId,
          email: sub.store?.owner?.email || 'unknown',
          status: 'error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
    });
  } catch (error) {
    console.error('[PaymentReminder] Cron error:', error);
    return NextResponse.json({ error: 'Failed to process reminders' }, { status: 500 });
  }
}

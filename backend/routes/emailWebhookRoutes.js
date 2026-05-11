// backend/routes/emailWebhookRoutes.js
import express from 'express';
import { trackBounce, trackComplaint, trackDelivered } from '../services/emailAnalyticsService.js';
import { markBounced, markComplained } from '../services/emailSubscriberService.js';
import { logError } from '../utils/logger.js';

const router = express.Router();

// SES sends notifications via SNS
// This endpoint handles SNS subscription confirmation and notification messages
router.post('/ses', express.json({ type: '*/*' }), async (req, res) => {
  try {
    const message = req.body;

    // Handle SNS subscription confirmation
    if (message.Type === 'SubscriptionConfirmation') {
      console.log('SNS Subscription Confirmation URL:', message.SubscribeURL);
      // In production, auto-confirm by fetching the SubscribeURL
      return res.status(200).json({ status: 'subscription_confirmation_received' });
    }

    // Handle SNS notification
    if (message.Type === 'Notification') {
      let notification;
      try {
        notification = typeof message.Message === 'string' ? JSON.parse(message.Message) : message.Message;
      } catch {
        console.warn('Failed to parse SNS notification message');
        return res.status(200).json({ status: 'ok' });
      }

      const notificationType = notification.notificationType || notification.eventType;

      switch (notificationType) {
        case 'Bounce': {
          const bounce = notification.bounce;
          if (bounce && bounce.bouncedRecipients) {
            for (const recipient of bounce.bouncedRecipients) {
              await trackBounce(null, recipient.emailAddress, bounce.bounceType, recipient.diagnosticCode);
              await markBounced(recipient.emailAddress, null, bounce.bounceType);
            }
          }
          break;
        }

        case 'Complaint': {
          const complaint = notification.complaint;
          if (complaint && complaint.complainedRecipients) {
            for (const recipient of complaint.complainedRecipients) {
              await trackComplaint(null, recipient.emailAddress);
              await markComplained(recipient.emailAddress, null);
            }
          }
          break;
        }

        case 'Delivery': {
          const delivery = notification.delivery;
          if (delivery && delivery.recipients) {
            for (const email of delivery.recipients) {
              await trackDelivered(null, email);
            }
          }
          break;
        }

        default:
          console.log('Unhandled SES notification type:', notificationType);
      }
    }

    res.status(200).json({ status: 'ok' });
  } catch (err) {
    console.error('SES webhook error:', err.message);
    await logError({
      message: `SES webhook error: ${err.message}`,
      stack: err.stack,
      type: 'ses_webhook',
    });
    res.status(200).json({ status: 'error_logged' });
  }
});

export default router;

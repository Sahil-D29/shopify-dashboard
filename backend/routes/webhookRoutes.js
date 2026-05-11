import express from "express";
import { pushJourneyEvent } from "../services/journeysService.js";
import { logActivity } from "../utils/logger.js";

const router = express.Router();

// Get verify token from environment variable
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "6b4e51b2f6e18c99f0ba47f75507c9eb3d03a87032a200d443833f84f3c76471";

/**
 * GET /api/webhooks/whatsapp
 * WhatsApp webhook verification endpoint
 * Meta sends a GET request to verify the webhook
 */
router.get("/whatsapp", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  console.log("🔍 Webhook verification request:", { mode, token, challenge });

  // Check if mode and token are present
  if (mode && token) {
    // Check if mode is "subscribe" and token matches
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("✅ Webhook verified!");
      res.status(200).send(challenge);
    } else {
      console.log("❌ Webhook verification failed: token mismatch");
      console.log("Expected:", VERIFY_TOKEN);
      console.log("Received:", token);
      res.status(403).send("Forbidden");
    }
  } else {
    console.log("❌ Webhook verification failed: missing parameters");
    res.status(400).send("Bad Request");
  }
});

/**
 * POST /api/webhooks/whatsapp
 * WhatsApp webhook endpoint for receiving messages and events
 */
router.post("/whatsapp", express.json(), (req, res) => {
  console.log("📨 Incoming webhook data:", JSON.stringify(req.body, null, 2));

  try {
    const body = req.body;

    // Handle different webhook event types
    if (body.object === "whatsapp_business_account") {
      body.entry?.forEach((entry) => {
        const changes = entry.changes;
        changes?.forEach((change) => {
          const value = change.value;

          // Handle messages
          if (value.messages) {
            value.messages.forEach((message) => {
              handleIncomingMessage(message, value);
            });
          }

          // Handle status updates
          if (value.statuses) {
            value.statuses.forEach((status) => {
              handleStatusUpdate(status);
            });
          }
        });
      });
    }

    // Send 200 OK response to acknowledge receipt
    res.status(200).send("OK");
  } catch (error) {
    console.error("❌ Error processing webhook:", error);
    res.status(500).send("Internal Server Error");
  }
});

/**
 * Handle incoming WhatsApp messages
 */
function handleIncomingMessage(message, value) {
  console.log("💬 New message received:");
  console.log("  From:", message.from);
  console.log("  Type:", message.type);
  console.log("  Message ID:", message.id);
  console.log("  Timestamp:", message.timestamp);

  if (message.type === "text") {
    console.log("  Text:", message.text.body);
  } else if (message.type === "image") {
    console.log("  Image ID:", message.image.id);
  } else if (message.type === "location") {
    console.log("  Location:", message.location);
  }

  // TODO: Implement your message handling logic here
  // e.g., send automated responses, process commands, etc.
}

/**
 * Handle message status updates
 */
function handleStatusUpdate(status) {
  console.log("📊 Status update:");
  console.log("  Message ID:", status.id);
  console.log("  Status:", status.status);
  console.log("  Recipient:", status.recipient_id);
  console.log("  Timestamp:", status.timestamp);

  // TODO: Implement your status update logic here
  // e.g., update database, trigger notifications, etc.
}

/**
 * POST /api/webhooks/shopify
 * Shopify webhook endpoint for triggering journeys
 */
router.post("/shopify", express.json(), async (req, res) => {
  try {
    const topic = req.headers['x-shopify-topic'];
    const shop = req.headers['x-shopify-shop-domain'];
    const hmac = req.headers['x-shopify-hmac-sha256'];
    
    if (!topic || !shop) {
      return res.status(400).json({ error: 'Missing required headers' });
    }
    
    // Verify webhook signature (simplified - should verify HMAC in production)
    const body = req.body;
    
    console.log(`📦 Shopify webhook: ${topic} for ${shop}`);
    
    // Map Shopify topics to journey event types
    let eventType = null;
    let customerId = null;
    
    switch (topic) {
      case 'orders/create':
        eventType = 'order_created';
        customerId = body.customer?.id || body.customer_id;
        break;
      case 'customers/create':
        eventType = 'customer_created';
        customerId = body.id;
        break;
      case 'checkouts/create':
        eventType = 'checkout_abandoned';
        customerId = body.customer?.id || body.customer_id;
        break;
      default:
        console.log(`Unhandled Shopify webhook topic: ${topic}`);
        return res.status(200).json({ acknowledged: true, skipped: true });
    }
    
    if (eventType && customerId) {
      // Get all journeys for this store that match this event type
      const { loadJourneys } = await import('../services/journeysService.js');
      const journeys = await loadJourneys();
      
      const matchingJourneys = journeys.filter(j => 
        j.storeId === shop && 
        j.enabled && 
        j.trigger?.eventType === eventType
      );
      
      // Create journey events for each matching journey
      for (const journey of matchingJourneys) {
        await pushJourneyEvent({
          journeyId: journey.id,
          eventType: eventType,
          storeId: shop,
          customerId: customerId,
          payload: body
        });
      }
      
      await logActivity({
        type: 'shopify_webhook_received',
        actorId: 'system',
        storeId: shop,
        topic: topic,
        eventType: eventType,
        customerId: customerId,
        journeysTriggered: matchingJourneys.length
      });
    }
    
    res.status(200).json({ acknowledged: true, topic, shop });
  } catch (error) {
    console.error("❌ Error processing Shopify webhook:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;


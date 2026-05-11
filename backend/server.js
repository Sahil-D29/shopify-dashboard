import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import shopifyRoutes from "./routes/shopifyRoutes.js";
import webhookRoutes from "./routes/webhookRoutes.js";
import segmentsRoutes from "./routes/segmentsRoutes.js";
import campaignsRoutes from "./routes/campaignsRoutes.js";
import journeysRoutes from "./routes/journeysRoutes.js";
import healthRoutes from "./routes/healthRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import teamRoutes from "./routes/teamRoutes.js";
import subscriptionsRoutes from "./routes/subscriptionsRoutes.js";
import brandsRoutes from "./routes/brandsRoutes.js";
import couponsRoutes from "./routes/couponsRoutes.js";
import stripeRoutes from "./routes/stripeRoutes.js";
import emailRoutes from "./routes/emailRoutes.js";
import emailWebhookRoutes from "./routes/emailWebhookRoutes.js";
import { startCampaignWorker, stopCampaignWorker } from "./workers/campaignWorker.js";
import { startJourneyWorker, stopJourneyWorker } from "./workers/journeyWorker.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { logError } from "./utils/logger.js";
import { initializeSystemHealth, updateWorkerStatus, checkShopifyToken } from "./utils/systemHealth.js";

// Suppress dotenv informational messages
dotenv.config({ quiet: true });
const app = express();

// IMPORTANT: Configure Helmet FIRST, before any other middleware
// Disable CSP completely for development to avoid blocking localhost connections
const isDevelopment = process.env.NODE_ENV !== "production";

// Configure Helmet - COMPLETELY DISABLE CSP for development
app.use(
  helmet({
    contentSecurityPolicy: false, // Disable CSP completely
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false,
    strictTransportSecurity: false,
    xContentTypeOptions: false,
    xFrameOptions: false,
    xXssProtection: false,
  })
);

// EXPLICITLY remove any CSP headers that might be set elsewhere
app.use((req, res, next) => {
  res.removeHeader('Content-Security-Policy');
  res.removeHeader('content-security-policy');
  next();
});

// Configure CORS - Allow all origins in development
app.use(
  cors({
    origin: isDevelopment ? true : process.env.ALLOWED_ORIGINS?.split(",") || "*",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Shopify-Config"],
  })
);

// Rate limiting - Import specialized limiters
import { authLimiter, apiLimiter, webhookLimiter } from './middleware/rate-limiter.js';

// Apply to specific routes
app.use('/api/auth/', authLimiter);
app.use('/api/webhooks/', webhookLimiter);
app.use('/api/', apiLimiter);

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/teams", teamRoutes);
app.use("/api/team", teamRoutes); // Backward compatibility
app.use("/api/shopify", shopifyRoutes);
app.use("/api/webhooks", webhookRoutes);
app.use("/api/segments", segmentsRoutes);
app.use("/api/campaigns", campaignsRoutes);
app.use("/api/journeys", journeysRoutes);
app.use("/api", healthRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/subscriptions", subscriptionsRoutes);
app.use("/api/brands", brandsRoutes);
app.use("/api/coupons", couponsRoutes);
app.use("/api/stripe", stripeRoutes);
app.use("/api/email", emailRoutes);
app.use("/api/webhooks/email", emailWebhookRoutes);

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Global error handlers
process.on('uncaughtException', async (err) => {
  console.error('❌ Uncaught Exception:', err);
  await logError({
    message: 'Uncaught Exception',
    stack: err.stack,
    type: 'uncaughtException'
  });
  process.exit(1);
});

process.on('unhandledRejection', async (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  await logError({
    message: 'Unhandled Rejection',
    stack: reason?.stack || String(reason),
    type: 'unhandledRejection'
  });
});

// Graceful shutdown
let server;
const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);
  
  // Stop accepting new requests
  server.close(() => {
    console.log('HTTP server closed');
  });
  
  // Stop workers and update health
  try {
    await stopCampaignWorker();
    await updateWorkerStatus('campaign', 'stopped').catch(() => {});
    
    await stopJourneyWorker();
    await updateWorkerStatus('journey', 'stopped').catch(() => {});
  } catch (e) {
    console.error('Error updating worker status on shutdown:', e.message);
  }
  
  // Give time for cleanup
  setTimeout(() => {
    console.log('Graceful shutdown complete');
    process.exit(0);
  }, 5000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

const PORT = process.env.PORT || 5000;
const serverStartTime = new Date().toISOString();

server = app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📋 Environment: ${isDevelopment ? "Development" : "Production"}`);
  console.log(`🔒 CSP Status: ${isDevelopment ? "DISABLED (Development)" : "ENABLED (Production)"}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/api/health`);
  
  // Initialize system health - wrapped in try-catch, never crash server
  try {
    await initializeSystemHealth(serverStartTime);
    console.log('✅ System health initialized');
  } catch (e) {
    console.error('⚠️  System health init failed:', e.message);
    // Log but don't crash - server can still run
    await logError({
      message: `System health init failed: ${e.message}`,
      stack: e.stack
    }).catch(() => {});
  }
  
  // Start workers and update health - wrapped in try-catch
  try {
    await startCampaignWorker();
    await updateWorkerStatus('campaign', 'running').catch(() => {});
    
    await startJourneyWorker();
    await updateWorkerStatus('journey', 'running').catch(() => {});
    
    console.log('✅ Workers started successfully');
  } catch (e) {
    console.error('❌ Worker start failed:', e.message);
    await updateWorkerStatus('campaign', 'crashed').catch(() => {});
    await updateWorkerStatus('journey', 'crashed').catch(() => {});
    await logError({
      message: `Worker start failed: ${e.message}`,
      stack: e.stack
    }).catch(() => {});
  }
  
  // Check Shopify token on startup (non-blocking, never crash)
  checkShopifyToken().catch(err => {
    console.warn('Shopify token check failed on startup:', err.message);
  });
  
  // Periodic Shopify token check (every 5 minutes)
  setInterval(() => {
    checkShopifyToken().catch(err => {
      console.warn('Periodic Shopify token check failed:', err.message);
    });
  }, 5 * 60 * 1000);
  
  // Periodic uptime update (every 10 seconds)
  setInterval(async () => {
    try {
      const { getSystemHealth, updateSystemHealth } = await import('./utils/systemHealth.js');
      const current = await getSystemHealth();
      if (current.server?.startedAt) {
        const startedAt = new Date(current.server.startedAt);
        const now = new Date();
        if (!isNaN(startedAt.getTime())) {
          const uptimeSeconds = Math.floor((now - startedAt) / 1000);
          await updateSystemHealth({
            server: {
              ...current.server,
              uptimeSeconds: uptimeSeconds
            }
          }).catch(() => {});
        }
      }
    } catch (err) {
      // Silent fail - uptime update is non-critical
    }
  }, 10000);
});


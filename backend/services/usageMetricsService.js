// backend/services/usageMetricsService.js
import path from 'path';
import { readFileSafe, writeFileSafe } from '../utils/fileStorage.js';
import { v4 as uuidv4 } from 'uuid';
import { getSubscriptionByUserId } from './subscriptionsService.js';
import { getPlanFeatures } from './subscriptionsService.js';

const usageMetricsFile = path.join(process.cwd(), 'backend', 'data', 'usage-metrics.json');

/**
 * Load all usage metrics
 */
export async function loadUsageMetrics() {
  const data = await readFileSafe(usageMetricsFile, { default: { metrics: [] } });
  return data.metrics || [];
}

/**
 * Get current usage metrics for a store/user
 */
export async function getUsageMetrics(storeId, userId = null) {
  const metrics = await loadUsageMetrics();
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  // Find or create current month's metrics
  let metric = metrics.find(
    m => m.storeId === storeId && 
    m.period === currentMonth &&
    (userId === null || m.userId === userId)
  );
  
  if (!metric) {
    // Get user's subscription to determine limits
    const subscription = userId ? await getSubscriptionByUserId(userId) : null;
    const planType = subscription?.planType || 'basic';
    const plan = await getPlanFeatures(planType);
    
    metric = {
      id: `metric_${uuidv4()}`,
      storeId,
      userId: userId || null,
      period: currentMonth,
      planType,
      limits: {
        messagesPerMonth: plan?.features?.messagesPerMonth || 1000,
        campaignsPerMonth: plan?.features?.campaignsPerMonth || 2,
        apiCallsPerMonth: plan?.features?.apiCallsPerMonth || 10000
      },
      usage: {
        messagesSent: 0,
        campaignsCreated: 0,
        apiCalls: 0
      },
      alertsSent: {
        at80Percent: false,
        at100Percent: false
      },
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };
    
    metrics.push(metric);
    await writeFileSafe('usage-metrics.json', { metrics });
  }
  
  return metric;
}

/**
 * Increment usage counter
 */
export async function incrementUsage(storeId, type, amount = 1, userId = null) {
  const metric = await getUsageMetrics(storeId, userId);
  const metrics = await loadUsageMetrics();
  const index = metrics.findIndex(m => m.id === metric.id);
  
  if (index === -1) {
    throw new Error('Usage metric not found');
  }
  
  // Increment usage
  if (type === 'messages') {
    metric.usage.messagesSent += amount;
  } else if (type === 'campaigns') {
    metric.usage.campaignsCreated += amount;
  } else if (type === 'apiCalls') {
    metric.usage.apiCalls += amount;
  }
  
  metric.updatedAt = new Date().toISOString();
  metrics[index] = metric;
  
  await writeFileSafe('usage-metrics.json', { metrics });
  
  // Check if limits exceeded
  const limitExceeded = checkLimitExceeded(metric);
  
  return { metric, limitExceeded };
}

/**
 * Check if usage limit is exceeded
 */
export function checkLimitExceeded(metric) {
  const { limits, usage } = metric;
  
  // -1 means unlimited
  if (limits.messagesPerMonth !== -1 && usage.messagesSent >= limits.messagesPerMonth) {
    return { exceeded: true, type: 'messages' };
  }
  
  if (limits.campaignsPerMonth !== -1 && usage.campaignsCreated >= limits.campaignsPerMonth) {
    return { exceeded: true, type: 'campaigns' };
  }
  
  if (limits.apiCallsPerMonth !== -1 && usage.apiCalls >= limits.apiCallsPerMonth) {
    return { exceeded: true, type: 'apiCalls' };
  }
  
  return { exceeded: false };
}

/**
 * Get usage percentage
 */
export function getUsagePercentage(metric) {
  const { limits, usage } = metric;
  
  const messagesPercent = limits.messagesPerMonth === -1 
    ? 0 
    : (usage.messagesSent / limits.messagesPerMonth) * 100;
  
  const campaignsPercent = limits.campaignsPerMonth === -1 
    ? 0 
    : (usage.campaignsCreated / limits.campaignsPerMonth) * 100;
  
  const apiCallsPercent = limits.apiCallsPerMonth === -1 
    ? 0 
    : (usage.apiCalls / limits.apiCallsPerMonth) * 100;
  
  return {
    messages: Math.min(100, Math.round(messagesPercent)),
    campaigns: Math.min(100, Math.round(campaignsPercent)),
    apiCalls: Math.min(100, Math.round(apiCallsPercent))
  };
}

/**
 * Check if alert should be sent
 */
export async function checkAndSendAlerts(storeId, userId = null) {
  const metric = await getUsageMetrics(storeId, userId);
  const percentages = getUsagePercentage(metric);
  const maxPercent = Math.max(percentages.messages, percentages.campaigns, percentages.apiCalls);
  
  const alerts = {
    shouldSend80: maxPercent >= 80 && !metric.alertsSent.at80Percent,
    shouldSend100: maxPercent >= 100 && !metric.alertsSent.at100Percent
  };
  
  // Update alert flags if needed
  if (alerts.shouldSend80 || alerts.shouldSend100) {
    const metrics = await loadUsageMetrics();
    const index = metrics.findIndex(m => m.id === metric.id);
    
    if (index !== -1) {
      if (alerts.shouldSend80) {
        metrics[index].alertsSent.at80Percent = true;
      }
      if (alerts.shouldSend100) {
        metrics[index].alertsSent.at100Percent = true;
      }
      metrics[index].updatedAt = new Date().toISOString();
      await writeFileSafe('usage-metrics.json', { metrics });
    }
  }
  
  return alerts;
}

/**
 * Reset usage metrics for new billing cycle
 */
export async function resetUsageMetrics(storeId, userId = null) {
  const metrics = await loadUsageMetrics();
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  // Find current metric
  const index = metrics.findIndex(
    m => m.storeId === storeId && 
    m.period === currentMonth &&
    (userId === null || m.userId === userId)
  );
  
  if (index !== -1) {
    // Reset usage but keep limits
    metrics[index].usage = {
      messagesSent: 0,
      campaignsCreated: 0,
      apiCalls: 0
    };
    metrics[index].alertsSent = {
      at80Percent: false,
      at100Percent: false
    };
    metrics[index].updatedAt = new Date().toISOString();
    
    await writeFileSafe('usage-metrics.json', { metrics });
  }
}

/**
 * Get all usage metrics (admin view)
 */
export async function getAllUsageMetrics() {
  return await loadUsageMetrics();
}


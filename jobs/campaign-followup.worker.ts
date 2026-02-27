/**
 * Campaign Follow-Up Worker
 *
 * Processes follow-up steps for campaigns based on customer engagement:
 * 1. Finds campaigns with active follow-up rules
 * 2. Checks CampaignLog entries against condition triggers
 * 3. Sends follow-up messages using smart window (free-form vs template)
 * 4. Tracks metrics per follow-up step
 *
 * Run via cron endpoint every 5 minutes.
 */
import { prisma } from '@/lib/prisma';
import { sendWithSmartWindow, findContactByPhone } from '@/lib/utils/smart-window';
import { getWhatsAppConfig } from '@/lib/config/whatsapp-env';

// ─── Types ─────────────────────────────────────────────────────────

interface FollowUpStep {
  id: string;
  campaignId: string;
  stepIndex: number;
  name: string;
  condition: string;
  delayMinutes: number;
  messageBody: string;
  templateName: string | null;
  templateId: string | null;
  useSmartWindow: boolean;
  isActive: boolean;
}

interface ProcessingResult {
  processed: number;
  sent: number;
  skipped: number;
  errors: number;
  details: Array<{
    campaignId: string;
    stepIndex: number;
    sent: number;
    freeForm: number;
    template: number;
    skipped: number;
    failed: number;
  }>;
}

// ─── Condition Evaluator ───────────────────────────────────────────

/**
 * Determine which CampaignLog status values match a follow-up condition.
 *
 * | Condition      | Matches logs where...                              |
 * |----------------|-----------------------------------------------------|
 * | NOT_READ       | status IN (SUCCESS, DELIVERED) AND readAt IS NULL   |
 * | READ           | readAt IS NOT NULL                                  |
 * | NOT_CLICKED    | readAt IS NOT NULL AND clickedAt IS NULL             |
 * | CLICKED        | clickedAt IS NOT NULL                               |
 * | NOT_CONVERTED  | clickedAt IS NOT NULL AND convertedAt IS NULL        |
 * | CONVERTED      | convertedAt IS NOT NULL                             |
 * | NOT_REPLIED    | status IN (SUCCESS, DELIVERED, READ) – no reply      |
 * | REPLIED        | status = REPLIED                                    |
 */
function buildConditionFilter(condition: string): Record<string, unknown> {
  switch (condition) {
    case 'NOT_READ':
      return {
        status: { in: ['SUCCESS', 'DELIVERED'] },
        readAt: null,
      };
    case 'READ':
      return {
        readAt: { not: null },
      };
    case 'NOT_CLICKED':
      return {
        readAt: { not: null },
        clickedAt: null,
      };
    case 'CLICKED':
      return {
        clickedAt: { not: null },
      };
    case 'NOT_CONVERTED':
      return {
        clickedAt: { not: null },
        convertedAt: null,
      };
    case 'CONVERTED':
      return {
        convertedAt: { not: null },
      };
    case 'NOT_REPLIED':
      return {
        status: { in: ['SUCCESS', 'DELIVERED', 'READ', 'CLICKED'] },
        // We can't directly check for "no reply" — we check that status ≠ REPLIED
      };
    case 'REPLIED':
      return {
        status: 'REPLIED',
      };
    default:
      return {};
  }
}

// ─── Personalization ───────────────────────────────────────────────

function personalizeBody(body: string, customerId: string): string {
  // Basic personalization — customerId often contains name info
  // In production, you'd look up the customer's actual name
  return body
    .replace(/\{\{name\}\}/g, 'Customer')
    .replace(/\{\{first_name\}\}/g, 'Customer')
    .replace(/\{\{last_name\}\}/g, '')
    .replace(/\{\{email\}\}/g, '');
}

// ─── Main Worker ───────────────────────────────────────────────────

export async function runFollowUpWorkerStep(): Promise<ProcessingResult> {
  const result: ProcessingResult = {
    processed: 0,
    sent: 0,
    skipped: 0,
    errors: 0,
    details: [],
  };

  const config = getWhatsAppConfig();
  if (!config.phoneNumberId || !config.accessToken) {
    return result; // WhatsApp not configured — nothing to do
  }

  try {
    // Find campaigns with active follow-up steps
    // Include RUNNING and COMPLETED campaigns (follow-ups can fire after campaign completes)
    const followUpSteps = await prisma.campaignFollowUp.findMany({
      where: {
        isActive: true,
        campaign: {
          status: { in: ['RUNNING', 'COMPLETED'] },
        },
      },
      include: {
        campaign: {
          include: { store: true },
        },
      },
      orderBy: [
        { campaignId: 'asc' },
        { stepIndex: 'asc' },
      ],
    });

    if (followUpSteps.length === 0) return result;

    for (const step of followUpSteps) {
      const stepResult = await processFollowUpStep(step as unknown as FollowUpStep & {
        campaign: { id: string; storeId: string; store: { id: string; shopifyDomain: string | null; accessToken: string | null } };
      });

      result.processed++;
      result.sent += stepResult.sent;
      result.skipped += stepResult.skipped;
      result.errors += stepResult.failed;
      result.details.push({
        campaignId: step.campaignId,
        stepIndex: step.stepIndex,
        ...stepResult,
      });
    }
  } catch (e) {
    console.error('[FollowUp Worker] Fatal error:', e);
  }

  return result;
}

/**
 * Process a single follow-up step: find eligible logs and send follow-up messages.
 */
async function processFollowUpStep(step: FollowUpStep & {
  campaign: { id: string; storeId: string; store: { id: string; shopifyDomain: string | null; accessToken: string | null } };
}): Promise<{ sent: number; freeForm: number; template: number; skipped: number; failed: number }> {
  const stats = { sent: 0, freeForm: 0, template: 0, skipped: 0, failed: 0 };

  try {
    // Previous step index (what we're checking against)
    const prevStepIndex = step.stepIndex - 1;

    // Calculate cutoff: logs must have been created at least delayMinutes ago
    const delayCutoff = new Date(Date.now() - step.delayMinutes * 60 * 1000);

    // Build condition-specific where clause
    const conditionFilter = buildConditionFilter(step.condition);

    // Find CampaignLog entries that:
    // 1. Belong to this campaign
    // 2. Are from the previous step
    // 3. Haven't already triggered a follow-up
    // 4. Were created before the delay cutoff
    // 5. Match the engagement condition
    const eligibleLogs = await prisma.campaignLog.findMany({
      where: {
        campaignId: step.campaignId,
        stepIndex: prevStepIndex,
        followUpSent: false,
        createdAt: { lte: delayCutoff },
        ...conditionFilter,
      },
      take: 100, // Process in batches of 100
    });

    if (eligibleLogs.length === 0) return stats;

    for (const log of eligibleLogs) {
      try {
        // We need a phone number to send. customerId stores Shopify customer ID.
        // Try to find phone from Contact model
        const contact = await findContactByPhone(log.customerId, step.campaign.storeId);

        // Also try direct lookup by shopifyCustomerId
        let phone: string | null = null;
        if (contact) {
          const contactRecord = await prisma.contact.findFirst({
            where: { id: contact.id },
            select: { phone: true },
          });
          phone = contactRecord?.phone || null;
        } else {
          // Try finding contact by shopifyCustomerId field
          const contactByShopify = await prisma.contact.findFirst({
            where: {
              storeId: step.campaign.storeId,
              shopifyCustomerId: log.customerId,
            },
            select: { id: true, phone: true, lastMessageAt: true },
          });
          phone = contactByShopify?.phone || null;
        }

        if (!phone) {
          stats.skipped++;
          // Mark as follow-up sent to avoid reprocessing
          await prisma.campaignLog.update({
            where: { id: log.id },
            data: { followUpSent: true },
          });
          continue;
        }

        // Personalize message
        const personalizedBody = personalizeBody(step.messageBody, log.customerId);

        // Send using smart window logic
        const sendResult = await sendWithSmartWindow({
          phone,
          freeFormBody: personalizedBody,
          templateName: step.useSmartWindow ? (step.templateName ?? undefined) : (step.templateName || undefined),
          storeId: step.campaign.storeId,
          contactId: contact?.id,
          windowExpiresAt: log.windowExpiresAt,
        });

        // Mark original log as follow-up sent
        await prisma.campaignLog.update({
          where: { id: log.id },
          data: { followUpSent: true },
        });

        if (sendResult.success) {
          // Create new CampaignLog for this follow-up step
          await prisma.campaignLog.create({
            data: {
              campaignId: step.campaignId,
              customerId: log.customerId,
              status: 'SUCCESS',
              message: sendResult.messageId ?? undefined,
              whatsappMessageId: sendResult.messageId ?? undefined,
              stepIndex: step.stepIndex,
              stepId: step.id,
              usedFreeForm: sendResult.usedFreeForm,
              windowExpiresAt: sendResult.usedFreeForm
                ? log.windowExpiresAt // Preserve existing window
                : new Date(Date.now() + 24 * 60 * 60 * 1000),
            },
          });

          // Update follow-up step metrics
          await prisma.campaignFollowUp.update({
            where: { id: step.id },
            data: {
              totalSent: { increment: 1 },
              ...(sendResult.usedFreeForm ? { totalFreeForm: { increment: 1 } } : {}),
            },
          });

          stats.sent++;
          if (sendResult.usedFreeForm) {
            stats.freeForm++;
          } else {
            stats.template++;
          }
        } else {
          // Log failure
          await prisma.campaignLog.create({
            data: {
              campaignId: step.campaignId,
              customerId: log.customerId,
              status: 'FAILED',
              error: sendResult.error ?? 'Follow-up send failed',
              stepIndex: step.stepIndex,
              stepId: step.id,
              usedFreeForm: sendResult.usedFreeForm,
            },
          });
          stats.failed++;
        }
      } catch (err) {
        console.error(`[FollowUp Worker] Error processing log ${log.id}:`, err);
        stats.failed++;
        // Mark as processed to avoid infinite retry
        await prisma.campaignLog.update({
          where: { id: log.id },
          data: { followUpSent: true },
        }).catch(() => {});
      }
    }
  } catch (err) {
    console.error(`[FollowUp Worker] Error processing step ${step.id}:`, err);
  }

  return stats;
}

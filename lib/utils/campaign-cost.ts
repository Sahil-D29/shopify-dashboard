/**
 * Campaign Cost Estimator
 *
 * Estimates WhatsApp messaging costs before sending a campaign, taking into
 * account the 24-hour free messaging window and follow-up steps.
 */
import { countInWindowCustomers } from './smart-window';

/** Per-message cost in INR (approximate Meta pricing for India) */
const TEMPLATE_COST_INR = 0.50;     // Marketing template
const UTILITY_TEMPLATE_COST_INR = 0.30; // Utility/follow-up template
const FREE_FORM_COST_INR = 0;       // Free within 24hr window

export interface CostEstimate {
  /** Total audience size */
  totalAudience: number;
  /** Customers currently in the 24hr free window */
  inWindowCount: number;
  /** Customers outside the 24hr window */
  outOfWindowCount: number;
  /** Cost for initial message */
  initialCost: number;
  /** Estimated follow-up costs (per step) */
  followUpCosts: Array<{
    stepIndex: number;
    name: string;
    estimatedTriggerRate: number; // 0-1 percentage
    estimatedRecipients: number;
    estimatedCost: number;
  }>;
  /** Total estimated cost */
  totalEstimatedCost: number;
  /** Estimated savings from free-window sends */
  estimatedSavings: number;
  /** Currency */
  currency: string;
}

/**
 * Estimate campaign cost including follow-up steps.
 */
export async function estimateCampaignCost(params: {
  storeId: string;
  audienceSize: number;
  followUpSteps?: Array<{
    stepIndex: number;
    name: string;
    condition: string;
    useSmartWindow?: boolean;
  }>;
}): Promise<CostEstimate> {
  const { storeId, audienceSize, followUpSteps = [] } = params;

  // Get real window data
  const windowStats = await countInWindowCustomers(storeId);

  // Scale window percentages to actual audience size
  const windowRatio = windowStats.total > 0
    ? windowStats.inWindow / windowStats.total
    : 0;
  const inWindowCount = Math.round(audienceSize * windowRatio);
  const outOfWindowCount = audienceSize - inWindowCount;

  // Initial message cost
  const initialCost = outOfWindowCount * TEMPLATE_COST_INR; // Free-form for in-window, template for out-of-window
  const initialSavings = inWindowCount * TEMPLATE_COST_INR;

  // Follow-up cost estimates
  const followUpCosts = followUpSteps.map((step) => {
    // Estimate trigger rates based on condition type
    const triggerRate = estimateTriggerRate(step.condition);
    const estimatedRecipients = Math.round(audienceSize * triggerRate);
    // Follow-ups within window are free; out of window use utility template rate
    const freeFormRecipients = step.useSmartWindow
      ? Math.round(estimatedRecipients * windowRatio)
      : 0;
    const templateRecipients = estimatedRecipients - freeFormRecipients;
    const estimatedCost = templateRecipients * UTILITY_TEMPLATE_COST_INR;

    return {
      stepIndex: step.stepIndex,
      name: step.name,
      estimatedTriggerRate: triggerRate,
      estimatedRecipients,
      estimatedCost,
    };
  });

  const totalFollowUpCost = followUpCosts.reduce((sum, s) => sum + s.estimatedCost, 0);
  const totalEstimatedCost = initialCost + totalFollowUpCost;

  // Total savings from using free-form text
  const followUpSavings = followUpCosts.reduce((sum, s) => {
    const freeRecipients = Math.round(s.estimatedRecipients * windowRatio);
    return sum + freeRecipients * UTILITY_TEMPLATE_COST_INR;
  }, 0);

  return {
    totalAudience: audienceSize,
    inWindowCount,
    outOfWindowCount,
    initialCost,
    followUpCosts,
    totalEstimatedCost,
    estimatedSavings: initialSavings + followUpSavings,
    currency: 'INR',
  };
}

/**
 * Estimate what percentage of users will trigger a given condition.
 * These are industry-average estimates for WhatsApp marketing.
 */
function estimateTriggerRate(condition: string): number {
  switch (condition) {
    case 'NOT_READ':
      return 0.55;     // ~55% don't read within the delay window
    case 'READ':
      return 0.45;     // ~45% read rate for WhatsApp
    case 'NOT_CLICKED':
      return 0.35;     // Read but didn't click
    case 'CLICKED':
      return 0.10;     // ~10% click rate
    case 'NOT_CONVERTED':
      return 0.08;     // Clicked but didn't purchase
    case 'CONVERTED':
      return 0.03;     // ~3% conversion rate
    case 'REPLIED':
      return 0.05;     // ~5% reply rate
    case 'NOT_REPLIED':
      return 0.40;     // Read but didn't reply
    default:
      return 0.20;
  }
}

/**
 * Format cost for display in INR.
 */
export function formatCostINR(amount: number): string {
  if (amount === 0) return '₹0';
  if (amount < 1) return `₹${amount.toFixed(2)}`;
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

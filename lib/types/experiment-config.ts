import type { ConditionValue, OperatorType } from './condition-config';

export type ExperimentType = "ab_test" | "multivariate";
export type WinningStrategy = "automatic" | "manual";
export type PostTestAction = "send_all_to_winner" | "send_all_to_specific" | "continue_split";

export interface Variant {
  id: string;
  name: string;
  description?: string;
  trafficAllocation: number;
  isControl: boolean;
  color?: string;
}

export interface SampleSizeParams {
  baselineConversionRate: number;
  minimumDetectableEffect: number;
  confidenceLevel: number;
  statisticalPower: number;
  numberOfVariants: number;
}

export interface SampleSizeResult {
  usersPerVariant: number;
  totalUsers: number;
  estimatedDays: number;
  confidenceLevel: number;
}

export interface Goal {
  id: string;
  type: "journey_completion" | "shopify_event" | "whatsapp_engagement" | "custom_event" | "segment_entry";
  name: string;
  eventName?: string;
  segmentId?: string;
  engagementType?: string;
  notes?: string;
  filters?: Array<{
    property: string;
    operator: OperatorType;
    value: ConditionValue;
  }>;
  attributionWindow: {
    value: number;
    unit: "hours" | "days";
  };
  isPrimary: boolean;
}

export interface WinningCriteria {
  strategy: WinningStrategy;
  statisticalSignificance: number;
  minimumLift: number;
  minimumRuntime: {
    value: number;
    unit: "hours" | "days" | "weeks";
  };
  postTestAction: PostTestAction;
  specificVariantId?: string;
  removeLosingPaths: boolean;
}

export interface ExperimentStatus {
  status: "draft" | "running" | "completed" | "stopped";
  startedAt?: string;
  completedAt?: string;
  winnerDeclared?: boolean;
  winningVariantId?: string;
  declaredAt?: string;
  declaredBy?: "auto" | "manual";
}

export interface ExperimentResults {
  variantId: string;
  variantName: string;
  users: number;
  conversions: number;
  conversionRate: number;
  confidence?: number;
  isWinner?: boolean;
  lift?: number;
}

export interface ExperimentConfig {
  experimentName: string;
  description?: string;
  hypothesis?: string;
  experimentType: ExperimentType;
  variants: Variant[];
  sampleSize: {
    params: SampleSizeParams;
    result?: SampleSizeResult;
  };
  duration: {
    minimumDays: number;
    maximumDays?: number;
  };
  goals: Goal[];
  primaryGoalId: string;
  winningCriteria: WinningCriteria;
  status?: ExperimentStatus;
  results?: ExperimentResults[];
}




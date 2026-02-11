export type JsonPrimitive = string | number | boolean | null;

export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface JourneyMetrics {
  totalEntries: number;
  activeUsers: number;
  completedJourneys: number;
  conversionRate: number;
  revenueGenerated?: number;
  averageCompletionTime: number; // hours
}

export interface NodePerformance {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  usersReached: number;
  usersCompleted: number;
  dropOffRate: number;
  averageTimeSpent: number | null;
  conversionRate?: number;
}

export interface MessagePerformance {
  channel: 'email' | 'sms' | 'whatsapp';
  sent: number;
  delivered: number;
  opened?: number;
  clicked?: number;
  replied?: number;
  deliveryRate: number;
  openRate?: number;
  clickRate?: number;
  replyRate?: number;
}

export interface ExperimentResult {
  experimentId: string;
  nodeId: string;
  experimentName: string;
  variantId: string;
  variantName: string;
  users: number;
  conversions: number;
  conversionRate: number;
  confidence: number;
  isWinner: boolean;
  lift: number;
}

export interface GoalFunnelStep {
  nodeId: string;
  name: string;
  type: string;
  users: number;
  conversions: number;
  conversionRate: number;
}

export interface AudienceSegmentBreakdown {
  id: string;
  label: string;
  users: number;
  percentage: number;
}

export interface AudienceGeographyBreakdown {
  country: string;
  users: number;
  percentage: number;
}

export interface AudienceDeviceBreakdown {
  device: 'desktop' | 'mobile' | 'tablet';
  users: number;
  percentage: number;
}

export interface AudienceCohortPoint {
  cohort: string;
  retention: number;
}

export interface JourneyUserSummary {
  enrollmentId: string;
  customerId: string;
  email?: string;
  phone?: string;
  status: string;
  currentNodeId?: string | null;
  goalAchieved?: boolean;
  enteredAt: string;
  lastActivityAt: string;
}

export interface JourneyUserTimelineEvent {
  id: string;
  timestamp: string;
  eventType: string;
  nodeId?: string;
  nodeName?: string;
  details?: { [key: string]: JsonValue };
}

export interface TimelinePoint {
  date: string;
  started: number;
  completed: number;
  goalAchieved: number;
}

export interface JourneyPathSummary {
  id: string;
  rank: number;
  steps: string[];
  percentage: number;
}

export interface JourneyAnalyticsFilters {
  from?: string;
  to?: string;
  status?: 'active' | 'completed' | 'waiting' | 'exited' | 'failed';
  goalAchieved?: 'yes' | 'no';
  segmentId?: string;
}

export interface JourneyAnalyticsAudience {
  segments: AudienceSegmentBreakdown[];
  geography: AudienceGeographyBreakdown[];
  devices: AudienceDeviceBreakdown[];
  cohorts: AudienceCohortPoint[];
}

export interface JourneyAnalyticsResponse {
  journey: {
    id: string;
    name: string;
    status: string;
  };
  filters: JourneyAnalyticsFilters;
  overview: JourneyMetrics;
  timeline: TimelinePoint[];
  nodePerformance: NodePerformance[];
  messagePerformance: MessagePerformance[];
  funnel: GoalFunnelStep[];
  experiments: ExperimentResult[];
  paths: JourneyPathSummary[];
  audience: JourneyAnalyticsAudience;
  users: JourneyUserSummary[];
}

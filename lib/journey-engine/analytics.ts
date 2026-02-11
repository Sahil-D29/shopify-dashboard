import { JourneyDefinition, type JourneyNodeData } from '@/lib/types/journey';
import type {
  JourneyMetrics,
  NodePerformance as NodePerformanceDto,
  MessagePerformance,
  AudienceSegmentBreakdown,
  AudienceGeographyBreakdown,
  AudienceDeviceBreakdown,
  AudienceCohortPoint,
  GoalFunnelStep,
  ExperimentResult,
  JourneyUserSummary,
  JourneyUserTimelineEvent,
  JsonValue,
} from '@/lib/types/analytics';

import {
  getJourneyById,
  getJourneyActivityLogs,
  getEnrollments,
  JourneyActivityLogRecord,
  JourneyEnrollmentRecord,
} from './storage';

type JsonRecord = Record<string, unknown>;

interface NodeMeta extends JsonRecord {
  variants?: ExperimentVariantConfig[];
}

interface ExperimentVariantConfig {
  id?: string;
  label?: string;
  weight?: number;
}

interface ExperimentAssignmentMeta {
  variantId?: string;
  variantLabel?: string;
  weight?: number;
}

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const toString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value : undefined;

const toBoolean = (value: unknown): boolean | undefined =>
  typeof value === 'boolean' ? value : undefined;

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .map(entry => (typeof entry === 'string' ? entry : undefined))
        .filter((entry): entry is string => Boolean(entry && entry.trim().length > 0))
    : [];

const safeDateParse = (value: unknown): number | undefined => {
  if (typeof value !== 'string' || value.trim().length === 0) return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

function normaliseNodeMeta(node: JourneyDefinition['nodes'][number]): NodeMeta {
  const nodeData = node.data as JourneyNodeData | undefined;
  const meta: NodeMeta = {};

  if (isRecord(nodeData)) {
    Object.assign(meta, nodeData);
  }
  if (isRecord(nodeData?.meta)) {
    Object.assign(meta, nodeData.meta as JsonRecord);
  }
  if (isRecord(nodeData?.config)) {
    Object.assign(meta, nodeData.config as JsonRecord);
  }

  delete meta.meta;
  delete meta.config;

  if (Array.isArray(meta.variants)) {
    const variants = meta.variants.reduce<ExperimentVariantConfig[]>((acc, variant) => {
      if (!isRecord(variant)) {
        return acc;
      }
      acc.push({
        id: toString(variant.id),
        label: toString(variant.label),
        weight: toNumber(variant.weight),
      });
      return acc;
    }, []);
    meta.variants = variants;
  }

  return meta;
}

export interface AnalyticsFilters {
  from?: string;
  to?: string;
  status?: 'active' | 'completed' | 'waiting' | 'exited' | 'failed';
  goalAchieved?: 'yes' | 'no';
  segmentId?: string;
}

export interface TimelinePoint {
  date: string;
  started: number;
  completed: number;
  goalAchieved: number;
}

export interface NodeMetric {
  nodeId: string;
  name: string;
  type: string;
  customersReached: number;
  completionRate: number;
  avgTimeSpent: number | null;
  actions: Record<string, number>;
  variantMetrics?: ExperimentVariantMetric[];
}

export interface ExperimentVariantMetric {
  id: string;
  label: string;
  weight?: number;
  customers: number;
  conversions: number;
  conversionRate: number;
}

export interface FunnelStep {
  id: string;
  title: string;
  type: string;
  customers: number;
}

export interface JourneyPathSummary {
  id: string;
  rank: number;
  steps: string[];
  percentage: number;
}

export interface JourneyAnalyticsResult {
  overview: {
    totalEntered: number;
    active: number;
    completed: number;
    dropped: number;
    goalConversionRate: number;
  };
  nodeMetrics: NodeMetric[];
  timeline: TimelinePoint[];
  funnel: FunnelStep[];
  paths: JourneyPathSummary[];
  journey: JourneyDefinition;
  enrollments: JourneyEnrollmentRecord[];
  activityLogs: JourneyActivityLogRecord[];
}

export function computeJourneyAnalytics(journeyId: string, filters: AnalyticsFilters = {}): JourneyAnalyticsResult | null {
  const journey = getJourneyById(journeyId);
  if (!journey) return null;

  const from = filters.from ? safeDateParse(filters.from) : undefined;
  const to = filters.to ? safeDateParse(filters.to) : undefined;

  const enrollments = getEnrollments()
    .filter(enrollment => enrollment.journeyId === journeyId)
    .filter(enrollment => {
      const enteredAt = safeDateParse(enrollment.enteredAt);
      if (from !== undefined && (enteredAt === undefined || enteredAt < from)) return false;
      if (to !== undefined && (enteredAt === undefined || enteredAt > to)) return false;
      if (filters.status && enrollment.status !== filters.status) return false;
      if (filters.goalAchieved === 'yes' && !enrollment.goalAchieved) return false;
      if (filters.goalAchieved === 'no' && enrollment.goalAchieved) return false;
      if (filters.segmentId) {
        const entrySegment = toString(enrollment.context.segmentId);
        if (entrySegment !== filters.segmentId) return false;
      }
      return true;
    });

  const totalEntered = enrollments.length;
  const active = enrollments.filter(enrollment => enrollment.status === 'active' || enrollment.status === 'waiting').length;
  const completed = enrollments.filter(enrollment => enrollment.status === 'completed' || enrollment.goalAchieved).length;
  const dropped = enrollments.filter(enrollment => enrollment.status === 'exited' || enrollment.status === 'failed').length;
  const goalConversionRate = totalEntered ? Number(((completed / totalEntered) * 100).toFixed(1)) : 0;

  const enrollmentIds = new Set(enrollments.map(enrollment => enrollment.id));
  const logs = getJourneyActivityLogs().filter(
    log => Boolean(log.enrollmentId && enrollmentIds.has(log.enrollmentId)),
  );

  const nodeMetrics = journey.nodes.map<NodeMetric>(node => {
    const meta = normaliseNodeMeta(node);
    const reached = enrollments.filter(enrollment => {
      const completedNodes = Array.isArray(enrollment.completedNodes) ? enrollment.completedNodes : [];
      return completedNodes.includes(node.id) || enrollment.currentNodeId === node.id;
    }).length;
    const completionRate = totalEntered ? Number(((reached / Math.max(totalEntered, 1)) * 100).toFixed(1)) : 0;
    const avgTimeSpent = computeAverageNodeDuration(logs, node.id);
    const actions = summariseNodeActions(logs, node.id);
    const isExperiment =
      node.subtype === 'ab_test' ||
      (node.type === 'condition' && Array.isArray(meta.variants) && meta.variants.length > 0);
    const experimentMetrics = isExperiment ? computeExperimentVariantMetrics(node, meta, enrollments) : undefined;
    return {
      nodeId: node.id,
      name: node.name || node.subtype || node.type,
      type: node.type,
      customersReached: reached,
      completionRate,
      avgTimeSpent,
      actions,
      variantMetrics: experimentMetrics && experimentMetrics.length ? experimentMetrics : undefined,
    };
  });

  const timeline = buildTimeline(enrollments);
  const funnel = buildFunnel(journey, nodeMetrics, totalEntered);
  const paths = buildJourneyPaths(journey, logs, enrollments, totalEntered);

  return {
    overview: {
      totalEntered,
      active,
      completed,
      dropped,
      goalConversionRate,
    },
    nodeMetrics,
    timeline,
    funnel,
    paths,
    journey,
    enrollments,
    activityLogs: logs,
  };
}

function buildTimeline(enrollments: JourneyEnrollmentRecord[]): TimelinePoint[] {
  const timelineMap = new Map<string, { started: number; completed: number; goalAchieved: number }>();
  enrollments.forEach(enrollment => {
    const enteredAt = safeDateParse(enrollment.enteredAt);
    if (enteredAt === undefined) return;
    const day = new Date(enteredAt).toISOString().split('T')[0];
    const entry = timelineMap.get(day) || { started: 0, completed: 0, goalAchieved: 0 };
    entry.started += 1;
    if (enrollment.goalAchieved) entry.goalAchieved += 1;
    if (enrollment.status === 'completed') entry.completed += 1;
    timelineMap.set(day, entry);
  });

  return Array.from(timelineMap.entries())
    .sort(([a], [b]) => (a > b ? 1 : -1))
    .map(([date, stats]) => ({ date, ...stats }));
}

function buildFunnel(journey: JourneyDefinition, nodeMetrics: NodeMetric[], total: number): FunnelStep[] {
  const steps = journey.nodes
    .filter(node => node.type !== 'exit')
    .map(node => {
      const metric = nodeMetrics.find(item => item.nodeId === node.id);
      return {
        id: node.id,
        title: node.name || node.subtype || node.type,
        type: node.type,
        customers: metric?.customersReached ?? 0,
      };
    })
    .filter(step => step.customers > 0);

  if (!steps.length && total > 0) {
    return [
      {
        id: 'journey-start',
        title: 'Journey Start',
        type: 'trigger',
        customers: total,
      },
    ];
  }

  return steps;
}

function buildJourneyPaths(
  journey: JourneyDefinition,
  logs: JourneyActivityLogRecord[],
  enrollments: JourneyEnrollmentRecord[],
  total: number
): JourneyPathSummary[] {
  if (!logs.length || !enrollments.length) {
    return [];
  }

  const logsByEnrollment = new Map<string, JourneyActivityLogRecord[]>();
  logs
    .filter(log => log.eventType === 'node_entered')
    .forEach(log => {
      if (!log.enrollmentId) return;
      const list = logsByEnrollment.get(log.enrollmentId) || [];
      list.push(log);
      logsByEnrollment.set(log.enrollmentId, list);
    });

  const sequences = new Map<string, { count: number; steps: string[] }>();
  const labelLookup = new Map<string, string>();
  journey.nodes.forEach(node => {
    labelLookup.set(node.id, node.name || node.subtype || node.id);
  });

  logsByEnrollment.forEach(logList => {
    const ordered = [...logList].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
    const steps = ordered
      .map(log => log.data?.nodeId as string | undefined)
      .filter((nodeId): nodeId is string => Boolean(nodeId))
      .map(nodeId => labelLookup.get(nodeId) || nodeId);

    if (!steps.length) return;

    const key = steps.join('>');
    const sequence = sequences.get(key) || { count: 0, steps };
    sequence.count += 1;
    sequences.set(key, sequence);
  });

  return Array.from(sequences.entries())
    .map(([key, entry]) => ({
      id: key,
      steps: entry.steps,
      percentage: total ? Math.round((entry.count / total) * 100) : 0,
    }))
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 5)
    .map((item, index) => ({ ...item, rank: index + 1 }));
}

function sumConversionValue(enrollments: JourneyEnrollmentRecord[]): number {
  return enrollments.reduce((sum, enrollment) => {
    const value = Number(enrollment.conversionValue ?? 0);
    return Number.isFinite(value) ? sum + value : sum;
  }, 0);
}

function computeAverageNodeDuration(logs: JourneyActivityLogRecord[], nodeId: string): number | null {
  const durations: number[] = [];
  const grouped = new Map<string, JourneyActivityLogRecord[]>();

  logs
    .filter(log => log.eventType === 'node_entered' && typeof log.data?.nodeId === 'string' && log.data.nodeId === nodeId)
    .forEach(log => {
      if (!log.enrollmentId) return;
      const list = grouped.get(log.enrollmentId) || [];
      list.push(log);
      grouped.set(log.enrollmentId, list);
    });

  grouped.forEach(list => {
    const ordered = list
      .slice()
      .sort((a, b) => (safeDateParse(a.timestamp) ?? 0) - (safeDateParse(b.timestamp) ?? 0));
    ordered.forEach((entry, idx) => {
      const next = ordered[idx + 1];
      if (next) {
        const start = safeDateParse(entry.timestamp);
        const end = safeDateParse(next.timestamp);
        if (start !== undefined && end !== undefined && end > start) {
          durations.push(end - start);
        }
      }
    });
  });

  if (!durations.length) return null;
  const avgMinutes = durations.reduce((sum, val) => sum + val, 0) / durations.length / (1000 * 60);
  return Number(avgMinutes.toFixed(1));
}

function summariseNodeActions(logs: JourneyActivityLogRecord[], nodeId: string) {
  const actions: Record<string, number> = {};
  logs.forEach(log => {
    const matchNode = typeof log.data?.nodeId === 'string' ? log.data?.nodeId === nodeId : false;
    if (matchNode) {
      const eventType = typeof log.eventType === 'string' ? log.eventType : 'unknown';
      actions[eventType] = (actions[eventType] || 0) + 1;
    }
  });
  return actions;
}

function computeExperimentVariantMetrics(
  node: JourneyDefinition['nodes'][number],
  meta: NodeMeta,
  enrollments: JourneyEnrollmentRecord[]
) {
  const assignments = new Map<
    string,
    {
      id: string;
      label: string;
      weight?: number;
      customers: number;
      conversions: number;
    }
  >();

  const variantConfig = Array.isArray(meta?.variants) ? meta.variants : [];

  const configWeightLookup = new Map<string, number | undefined>();
  variantConfig.forEach(variant => {
    const variantId = typeof variant?.id === 'string' && variant.id.trim().length > 0 ? variant.id : undefined;
    if (variantId) {
      configWeightLookup.set(variantId, typeof variant.weight === 'number' ? variant.weight : undefined);
    }
  });

  const assignKey = (assignment: ExperimentAssignmentMeta): string =>
    assignment.variantId ?? assignment.variantLabel ?? 'variant';

  enrollments.forEach(enrollment => {
    if (!isRecord(enrollment.metadata)) return;
    const experimentsMeta = enrollment.metadata.experiments;
    if (!isRecord(experimentsMeta)) return;
    const assignmentSource = experimentsMeta[node.id];
    if (!isRecord(assignmentSource)) return;
    const assignment: ExperimentAssignmentMeta = {
      variantId: toString(assignmentSource.variantId),
      variantLabel: toString(assignmentSource.variantLabel),
      weight: toNumber(assignmentSource.weight),
    };
    const variantId = assignment.variantId;
    const variantLabel = assignment.variantLabel ?? variantId ?? 'Variant';
    const weight =
      typeof assignment.weight === 'number'
        ? assignment.weight
        : variantId
          ? configWeightLookup.get(variantId)
          : variantConfig.length
            ? 100 / variantConfig.length
            : undefined;
    const key = assignKey(assignment);
    const entry =
      assignments.get(key) || {
        id: key,
        label: variantLabel,
        weight,
        customers: 0,
        conversions: 0,
      };
    entry.weight = weight;
    entry.customers += 1;
    if (enrollment.goalAchieved || enrollment.status === 'completed') {
      entry.conversions += 1;
    }
    assignments.set(key, entry);
  });

  return Array.from(assignments.values())
    .map(entry => ({
      ...entry,
      conversionRate: entry.customers ? Number(((entry.conversions / entry.customers) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.customers - a.customers);
}

export function toJourneyMetrics(result: JourneyAnalyticsResult): JourneyMetrics {
  const { overview, enrollments } = result;
  const completionDurations = enrollments
    .filter(enrollment => enrollment.completedAt)
    .map(enrollment => {
      const completedAt = safeDateParse(enrollment.completedAt);
      const enteredAt = safeDateParse(enrollment.enteredAt);
      if (completedAt === undefined || enteredAt === undefined) {
        return undefined;
      }
      return completedAt - enteredAt;
    })
    .filter(
      (duration): duration is number =>
        typeof duration === 'number' && Number.isFinite(duration) && duration > 0
    );

  const averageCompletionHours = completionDurations.length
    ? Number(
        (completionDurations.reduce((sum, value) => sum + value, 0) /
          completionDurations.length /
          (1000 * 60 * 60)).toFixed(2)
      )
    : 0;

  return {
    totalEntries: overview.totalEntered,
    activeUsers: overview.active,
    completedJourneys: overview.completed,
    conversionRate: overview.goalConversionRate,
    revenueGenerated: Number(sumConversionValue(enrollments).toFixed(2)),
    averageCompletionTime: averageCompletionHours,
  };
}

export function toNodePerformance(
  result: JourneyAnalyticsResult
): NodePerformanceDto[] {
  const totalEntered = Math.max(result.overview.totalEntered, 1);
  return result.nodeMetrics.map(metric => {
    const completionRate = metric.completionRate;
    const usersCompleted = Math.round((completionRate / 100) * totalEntered);
    const dropOffRate = Number(Math.max(0, 100 - completionRate).toFixed(1));
    return {
      nodeId: metric.nodeId,
      nodeName: metric.name,
      nodeType: metric.type,
      usersReached: metric.customersReached,
      usersCompleted,
      dropOffRate,
      averageTimeSpent: metric.avgTimeSpent,
      conversionRate: Number(completionRate.toFixed(1)),
    };
  });
}

export function toMessagePerformance(
  result: JourneyAnalyticsResult
): MessagePerformance[] {
  const whatsappTotals = result.nodeMetrics
    .filter(metric => metric.type === 'action')
    .reduce(
      (acc, metric) => {
        const sent = metric.customersReached;
        acc.sent += sent;
        acc.delivered += Math.round(sent * 0.94);
        acc.opened += Math.round(sent * 0.62);
        acc.clicked += Math.round(sent * 0.27);
        acc.replied += Math.round(sent * 0.11);
        return acc;
      },
      { sent: 0, delivered: 0, opened: 0, clicked: 0, replied: 0 }
    );

  if (whatsappTotals.sent === 0) {
    return [
      {
        channel: 'whatsapp',
        sent: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
        replied: 0,
        deliveryRate: 0,
        openRate: 0,
        clickRate: 0,
        replyRate: 0,
      },
    ];
  }

  const { sent, delivered, opened, clicked, replied } = whatsappTotals;
  return [
    {
      channel: 'whatsapp',
      sent,
      delivered,
      opened,
      clicked,
      replied,
      deliveryRate: Number(((delivered / sent) * 100).toFixed(1)),
      openRate: Number(((opened / sent) * 100).toFixed(1)),
      clickRate: Number(((clicked / sent) * 100).toFixed(1)),
      replyRate: Number(((replied / sent) * 100).toFixed(1)),
    },
  ];
}

export function toGoalFunnel(result: JourneyAnalyticsResult): GoalFunnelStep[] {
  const conversionRate = result.overview.goalConversionRate / 100;
  return result.funnel.map(step => ({
    nodeId: step.id,
    name: step.title,
    type: step.type,
    users: step.customers,
    conversions: Math.round(step.customers * conversionRate),
    conversionRate: Number((conversionRate * 100).toFixed(1)),
  }));
}

export function toExperimentResults(result: JourneyAnalyticsResult): ExperimentResult[] {
  const experiments: ExperimentResult[] = [];

  result.nodeMetrics
    .filter(metric => Array.isArray(metric.variantMetrics) && metric.variantMetrics.length > 0)
    .forEach(metric => {
      const totalConversions = metric.variantMetrics?.reduce((sum, variant) => sum + variant.conversions, 0) ?? 0;
      const bestVariant =
        metric.variantMetrics?.reduce((winner, current) =>
          current.conversionRate > (winner?.conversionRate ?? 0) ? current : winner
        ) ?? null;

      metric.variantMetrics?.forEach(variant => {
        const isWinner = bestVariant ? variant.id === bestVariant.id : false;
        const baseRate = bestVariant ? bestVariant.conversionRate : variant.conversionRate || 0;
        const lift =
          baseRate > 0 && !isWinner
            ? Number(((variant.conversionRate - baseRate) / baseRate).toFixed(3))
            : isWinner
              ? Number(((variant.conversionRate - baseRate) / (baseRate || 1)).toFixed(3))
              : 0;

        experiments.push({
          experimentId: metric.nodeId,
          nodeId: metric.nodeId,
          experimentName: metric.name,
          variantId: variant.id,
          variantName: variant.label,
          users: variant.customers,
          conversions: variant.conversions,
          conversionRate: Number(variant.conversionRate.toFixed(1)),
          confidence: totalConversions > 0 ? Number((variant.conversions / totalConversions).toFixed(2)) : 0.5,
          isWinner,
          lift: isFinite(lift) ? lift : 0,
        });
      });
    });

  return experiments;
}

export function toAudienceBreakdown(
  result: JourneyAnalyticsResult
): {
  segments: AudienceSegmentBreakdown[];
  geography: AudienceGeographyBreakdown[];
  devices: AudienceDeviceBreakdown[];
  cohorts: AudienceCohortPoint[];
} {
  const total = Math.max(result.enrollments.length, 1);
  const segmentMap = new Map<string, { label: string; count: number }>();
  const geographyMap = new Map<string, number>();
  const deviceMap = new Map<string, number>();
  const cohortMap = new Map<string, { total: number; completed: number }>();

  result.enrollments.forEach(enrollment => {
    const segmentId = (toString(enrollment.context.segmentId) || 'unknown').toLowerCase();
    const segmentLabel = toString(enrollment.context.segmentName) || segmentId || 'unknown';
    const segmentEntry = segmentMap.get(segmentId) || { label: segmentLabel, count: 0 };
    segmentEntry.count += 1;
    segmentMap.set(segmentId, segmentEntry);

    const country = toString(enrollment.context.country) || 'Unknown';
    geographyMap.set(country, (geographyMap.get(country) || 0) + 1);

    const deviceRaw = toString(enrollment.context.device);
    const device = (deviceRaw ?? 'desktop').toLowerCase();
    deviceMap.set(device, (deviceMap.get(device) || 0) + 1);

    const enteredAt = safeDateParse(enrollment.enteredAt);
    if (enteredAt === undefined) return;
    const cohortKey = new Date(enteredAt).toISOString().slice(0, 7);
    const cohortEntry = cohortMap.get(cohortKey) || { total: 0, completed: 0 };
    cohortEntry.total += 1;
    if (enrollment.goalAchieved || enrollment.status === 'completed') {
      cohortEntry.completed += 1;
    }
    cohortMap.set(cohortKey, cohortEntry);
  });

  const segments: AudienceSegmentBreakdown[] = Array.from(segmentMap.entries())
    .map(([id, entry]) => ({
      id,
      label: entry.label || id,
      users: entry.count,
      percentage: Number(((entry.count / total) * 100).toFixed(1)),
    }))
    .sort((a, b) => b.users - a.users)
    .slice(0, 10);

  const geography: AudienceGeographyBreakdown[] = Array.from(geographyMap.entries())
    .map(([country, count]) => ({
      country,
      users: count,
      percentage: Number(((count / total) * 100).toFixed(1)),
    }))
    .sort((a, b) => b.users - a.users)
    .slice(0, 10);

  const devices: AudienceDeviceBreakdown[] = Array.from(deviceMap.entries()).map(([device, count]) => ({
    device: device === 'mobile' || device === 'tablet' ? (device as 'mobile' | 'tablet') : 'desktop',
    users: count,
    percentage: Number(((count / total) * 100).toFixed(1)),
  }));

  const cohorts: AudienceCohortPoint[] = Array.from(cohortMap.entries())
    .sort(([a], [b]) => (a > b ? 1 : -1))
    .map(([cohort, entry]) => ({
      cohort,
      retention: entry.total ? Number(((entry.completed / entry.total) * 100).toFixed(1)) : 0,
    }));

  return { segments, geography, devices, cohorts };
}

export function toJourneyUsers(result: JourneyAnalyticsResult): JourneyUserSummary[] {
  return result.enrollments.map(enrollment => ({
    enrollmentId: enrollment.id,
    customerId: enrollment.customerId,
    email: enrollment.customerEmail,
    phone: enrollment.customerPhone,
    status: enrollment.status,
    currentNodeId: enrollment.currentNodeId,
    goalAchieved: enrollment.goalAchieved,
    enteredAt: enrollment.enteredAt,
    lastActivityAt: enrollment.lastActivityAt,
  }));
}

export function toUserTimeline(
  result: JourneyAnalyticsResult,
  customerId: string
): JourneyUserTimelineEvent[] {
  const relatedEnrollments = result.enrollments.filter(enrollment => enrollment.customerId === customerId);
  if (relatedEnrollments.length === 0) return [];

  const enrollmentIds = new Set(relatedEnrollments.map(enrollment => enrollment.id));
  return result.activityLogs
    .filter(log => log.enrollmentId && enrollmentIds.has(log.enrollmentId))
    .sort((a, b) => (safeDateParse(a.timestamp) ?? 0) - (safeDateParse(b.timestamp) ?? 0))
    .map(log => ({
      id: log.id,
      timestamp: log.timestamp,
      eventType: log.eventType,
      nodeId: typeof log.data?.nodeId === 'string' ? log.data.nodeId : undefined,
      nodeName: typeof log.data?.nodeName === 'string' ? log.data.nodeName : undefined,
      details: isRecord(log.data) ? (log.data as Record<string, JsonValue>) : undefined,
    }));
}


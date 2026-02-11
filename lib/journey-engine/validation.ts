import { validateWhatsAppConfig } from '@/lib/config/whatsapp-env';
import type { JourneyDefinition, JourneyEdge, JourneyNode, JourneyNodeData } from '@/lib/types/journey';

export type JourneyValidationSeverity = 'error' | 'warning';

export interface JourneyValidationIssue {
  id: string;
  severity: JourneyValidationSeverity;
  title: string;
  description?: string;
  suggestion?: string;
  nodeId?: string;
  nodeName?: string;
}

export interface JourneyValidationSummary {
  evaluatedAt: string;
  triggerCount: number;
  actionCount: number;
  goalCount: number;
  nodeCount: number;
  edgeCount: number;
  reachableNodeCount: number;
  unreachableNodeIds: string[];
}

export interface JourneyValidationResult {
  journeyId: string;
  status: 'pass' | 'needs_attention' | 'fail';
  errors: JourneyValidationIssue[];
  warnings: JourneyValidationIssue[];
  summary: JourneyValidationSummary;
}

function ensureArray<T>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const getString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value : undefined;

function getNodeMeta(node: JourneyNode): Record<string, unknown> {
  const nodeData = (node.data ?? {}) as JourneyNodeData;
  const meta: Record<string, unknown> = {};

  if (isRecord(nodeData)) {
    Object.assign(meta, nodeData);
  }
  if (isRecord(nodeData.meta)) {
    Object.assign(meta, nodeData.meta as Record<string, unknown>);
  }
  if (isRecord(nodeData.config)) {
    Object.assign(meta, nodeData.config as Record<string, unknown>);
  }

  delete meta.meta;
  delete meta.config;

  return meta;
}

function toVariables(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) return {};
  return Object.entries(value).reduce<Record<string, unknown>>((acc, [key, val]) => {
    acc[key] = val;
    return acc;
  }, {});
}

function getNodeName(node: JourneyNode): string {
  const data = node.data as JourneyNodeData | undefined;
  return node.name || (typeof data?.label === 'string' ? data.label : undefined) || node.id;
}

function buildGraph(journey: JourneyDefinition) {
  const nodesById = new Map<string, JourneyNode>();
  const outgoing = new Map<string, JourneyEdge[]>();
  const incoming = new Map<string, JourneyEdge[]>();

  for (const node of journey.nodes) {
    nodesById.set(node.id, node);
  }

  for (const edge of journey.edges) {
    const sourceEdges = outgoing.get(edge.source);
    if (sourceEdges) sourceEdges.push(edge);
    else outgoing.set(edge.source, [edge]);

    const targetEdges = incoming.get(edge.target);
    if (targetEdges) targetEdges.push(edge);
    else incoming.set(edge.target, [edge]);
  }

  return { nodesById, outgoing, incoming };
}

function computeReachability(startIds: string[], outgoing: Map<string, JourneyEdge[]>): Set<string> {
  const visited = new Set<string>();
  const queue = [...startIds];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);
    const edges = outgoing.get(current) ?? [];
    for (const edge of edges) {
      if (!visited.has(edge.target)) {
        queue.push(edge.target);
      }
    }
  }

  return visited;
}

function validateTrigger(node: JourneyNode): JourneyValidationIssue[] {
  if (node.type !== 'trigger') return [];

  const issues: JourneyValidationIssue[] = [];
  const nodeData = node.data as JourneyNodeData | undefined;
  const trigger = (node as { trigger?: JourneyNodeData }).trigger ?? nodeData ?? {};
  const subtype = node.subtype || (typeof nodeData?.subtype === 'string' ? nodeData.subtype : undefined);
  const issueBase = {
    nodeId: node.id,
    nodeName: getNodeName(node),
  };

  if (!trigger?.type && !trigger?.triggerType) {
    issues.push({
      id: `trigger-${node.id}-missing-type`,
      severity: 'error',
      title: 'Trigger type incomplete',
      description: 'Select a trigger type (segment, event, manual, etc.) before activation.',
      suggestion: 'Open the trigger configuration and choose how customers enter this journey.',
      ...issueBase,
    });
    return issues;
  }

  const triggerType = trigger.type || trigger.triggerType || subtype;
  switch (triggerType) {
    case 'segment':
    case 'segment_joined':
      if (!trigger.segmentId && !trigger.segment) {
        issues.push({
          id: `trigger-${node.id}-missing-segment`,
          severity: 'error',
          title: 'Segment trigger requires a segment',
          description: 'Select which segment enrollment should start the journey.',
          suggestion: 'Open the trigger configuration and pick an existing customer segment.',
          ...issueBase,
        });
      }
      break;
    case 'webhook':
    case 'event_trigger':
      if (!trigger.webhookEvent && !trigger.eventName) {
        issues.push({
          id: `trigger-${node.id}-missing-event`,
          severity: 'error',
          title: 'Webhook trigger requires an event',
          description: 'Choose the Shopify event that should start this journey.',
          suggestion: 'Pick an event such as orders/create or customers/create.',
          ...issueBase,
        });
      }
      break;
    case 'abandoned_cart':
    case 'cart_abandoned':
      if (trigger.hours == null || Number(trigger.hours) <= 0) {
        issues.push({
          id: `trigger-${node.id}-missing-hours`,
          severity: 'warning',
          title: 'Cart abandonment trigger missing delay window',
          description: 'Define how many hours should elapse before someone is considered abandoned.',
          suggestion: 'Set the wait window (e.g. 4 hours) inside the trigger configuration.',
          ...issueBase,
        });
      }
      break;
    default:
      break;
  }

  return issues;
}

function validateAction(node: JourneyNode): JourneyValidationIssue[] {
  if (node.type !== 'action') return [];
  const issues: JourneyValidationIssue[] = [];
  const nodeData = (node.data as JourneyNodeData | undefined) ?? {};
  const action = (node as { action?: JourneyNodeData }).action ?? nodeData;
  const meta = getNodeMeta(node);

  const templateName = getString(action.templateName) ?? getString(meta.templateName);
  const issueBase = {
    nodeId: node.id,
    nodeName: getNodeName(node),
  };

  if (!templateName) {
    issues.push({
      id: `action-${node.id}-missing-template`,
      severity: 'error',
      title: 'WhatsApp template missing',
      description: 'Select an approved WhatsApp template for this action.',
      suggestion: 'Open the action configuration and pick an approved template from WhatsApp.',
      ...issueBase,
    });
  }

  const variables = toVariables(meta.variables ?? action.variables);
  const variablePlaceholders = Object.values(variables).filter(
    value =>
      value == null ||
      (typeof value === 'string' && value.trim().length === 0),
  );
  if (variablePlaceholders.length > 0) {
    issues.push({
      id: `action-${node.id}-empty-variables`,
      severity: 'warning',
      title: 'WhatsApp template variables are incomplete',
      description: 'Map all template variables to customer, order, or custom values.',
      suggestion: 'Review the variable mapping in the action configuration.',
      ...issueBase,
    });
  }

  return issues;
}

function validateDelay(node: JourneyNode): JourneyValidationIssue[] {
  if (node.type !== 'delay') return [];
  const nodeData = node.data as JourneyNodeData | undefined;
  const delay = (node as { delay?: JourneyNodeData }).delay ?? nodeData ?? {};
  const duration = Number(delay.value ?? delay.duration);
  if (!Number.isFinite(duration) || duration <= 0) {
    return [
      {
        id: `delay-${node.id}-invalid-duration`,
        severity: 'error',
        title: 'Delay duration required',
        description: 'Set a duration greater than zero for wait/delay nodes.',
        suggestion: 'Open the delay configuration and set how long to wait (minutes, hours, or days).',
        nodeId: node.id,
        nodeName: getNodeName(node),
      },
    ];
  }
  return [];
}

function validateCondition(node: JourneyNode): JourneyValidationIssue[] {
  if (node.type !== 'condition') return [];
  const issues: JourneyValidationIssue[] = [];
  const nodeData = node.data as JourneyNodeData | undefined;
  const isExperiment = node.subtype === 'ab_test' || nodeData?.subtype === 'ab_test';
  const meta = getNodeMeta(node);

  if (isExperiment) {
    const variants =
      (Array.isArray(meta.variants) ? meta.variants : undefined) ??
      (Array.isArray(nodeData?.variants) ? nodeData?.variants : undefined) ??
      (Array.isArray(nodeData?.meta?.variants) ? nodeData.meta?.variants : undefined) ??
      [];
    if (variants.length < 2) {
      issues.push({
        id: `condition-${node.id}-abtest-variants`,
        severity: 'error',
        title: 'A/B test requires at least two variants',
        description: 'Define at least two variants with traffic splits for an experiment node.',
        suggestion: 'Use the experiment configuration modal to add and balance variants.',
        nodeId: node.id,
        nodeName: getNodeName(node),
      });
    } else {
      const totalWeight = variants.reduce((sum: number, variant: unknown) => {
        const weight = typeof variant === 'object' && variant && 'weight' in variant ? Number((variant as { weight?: number }).weight ?? 0) : 0;
        return sum + weight;
      }, 0);
      if (!Number.isFinite(totalWeight) || totalWeight <= 0) {
        issues.push({
          id: `condition-${node.id}-abtest-weight`,
          severity: 'error',
          title: 'Experiment weights must be greater than zero',
          description: 'Variant traffic weights should sum to a positive number.',
          suggestion: 'Adjust the weights so the total adds up (e.g. 50/50).',
          nodeId: node.id,
          nodeName: getNodeName(node),
        });
      }
    }
    return issues;
  }

  const condition = (node as { condition?: JourneyNodeData }).condition ?? nodeData ?? {};
  const args = condition.args ?? nodeData?.conditions;
  const conditions = ensureArray((args as { conditions?: unknown[] })?.conditions ?? nodeData?.conditions);

  if (conditions.length === 0) {
    issues.push({
      id: `condition-${node.id}-no-rules`,
      severity: 'warning',
      title: 'Condition node has no rules',
      description: 'Add at least one rule to split customers into different paths.',
      suggestion: 'Use the condition builder to add comparison rules.',
      nodeId: node.id,
      nodeName: getNodeName(node),
    });
  }

  return issues;
}

function validateGoal(node: JourneyNode): JourneyValidationIssue[] {
  if (node.type !== 'goal') return [];
  const nodeData = node.data as JourneyNodeData | undefined;
  const goal = (node as { goal?: JourneyNodeData }).goal ?? nodeData ?? {};
  const description = goal.description || goal.goalDescription || node.data?.goalDescription;
  if (!description) {
    return [
      {
        id: `goal-${node.id}-missing-description`,
        severity: 'warning',
        title: 'Goal description recommended',
        description: 'Add a goal description to make reporting clearer.',
        suggestion: 'Provide a short summary such as “Customer places an order”.',
        nodeId: node.id,
        nodeName: getNodeName(node),
      },
    ];
  }
  return [];
}

export function validateJourney(journey: JourneyDefinition): JourneyValidationResult {
  const errors: JourneyValidationIssue[] = [];
  const warnings: JourneyValidationIssue[] = [];

  const evaluatedAt = new Date().toISOString();

  const triggers = journey.nodes.filter(node => node.type === 'trigger');
  const actions = journey.nodes.filter(node => node.type === 'action');
  const goals = journey.nodes.filter(node => node.type === 'goal');

  if (triggers.length === 0) {
    errors.push({
      id: 'journey-missing-trigger',
      severity: 'error',
      title: 'Add at least one trigger',
      description: 'Journeys must start from a trigger node. Drag a trigger from the sidebar and configure it.',
    });
  }

  if (goals.length === 0) {
    errors.push({
      id: 'journey-missing-goal',
      severity: 'error',
      title: 'Add a goal node',
      description: 'Define what success looks like by adding a goal node to the journey.',
    });
  }

  const { outgoing, nodesById } = buildGraph(journey);
  const reachable = computeReachability(triggers.map(node => node.id), outgoing);

  const unreachableNodes = journey.nodes.filter(node => !reachable.has(node.id));
  for (const node of unreachableNodes) {
    const severity: JourneyValidationSeverity = node.type === 'goal' || node.type === 'trigger' ? 'error' : 'warning';
    (severity === 'error' ? errors : warnings).push({
      id: `node-${node.id}-unreachable`,
      severity,
      title: `${getNodeName(node)} is not connected`,
      description: 'This node cannot be reached from any trigger. Connect it or remove it before activation.',
      nodeId: node.id,
      nodeName: getNodeName(node),
      suggestion: 'Connect the node with edges starting from a trigger or reachable node.',
    });
  }

  if (goals.length > 0) {
    const reachableGoals = goals.filter(goal => reachable.has(goal.id));
    if (reachableGoals.length === 0) {
      errors.push({
        id: 'journey-goal-unreachable',
        severity: 'error',
        title: 'No goal is reachable',
        description: 'Ensure at least one goal node is connected downstream from a trigger.',
        suggestion: 'Connect the journey flow so that customers can eventually reach a goal node.',
      });
    }
  }

  for (const node of journey.nodes) {
    const validators = [validateTrigger, validateAction, validateDelay, validateCondition, validateGoal];
    for (const validator of validators) {
      const issues = validator(node);
      for (const issue of issues) {
        if (issue.severity === 'error') errors.push(issue);
        else warnings.push(issue);
      }
    }
  }

  for (const node of journey.nodes) {
    if (node.type === 'goal' || node.type === 'exit') continue;
    const outgoingEdges = outgoing.get(node.id) ?? [];
    if (outgoingEdges.length === 0) {
      warnings.push({
        id: `node-${node.id}-no-outgoing`,
        severity: 'warning',
        title: `${getNodeName(node)} has no outgoing path`,
        description: 'Add at least one edge so customers know what happens next.',
        suggestion: 'Connect this node to the next step in the journey.',
        nodeId: node.id,
        nodeName: getNodeName(node),
      });
    }
  }

  const orphanEdges = journey.edges.filter(
    edge => !nodesById.has(edge.source) || !nodesById.has(edge.target)
  );

  for (const edge of orphanEdges) {
    errors.push({
      id: `edge-${edge.id}-orphan`,
      severity: 'error',
      title: 'Edge references missing nodes',
      description: `Connection ${edge.id} points to a node that no longer exists. Remove and reconnect it.`,
    });
  }

  if (actions.length > 0) {
    try {
      const whatsappValidation = validateWhatsAppConfig();
      if (!whatsappValidation.valid) {
        warnings.push({
          id: 'whatsapp-misconfigured',
          severity: 'warning',
          title: 'WhatsApp credentials missing',
          description:
            'WhatsApp actions are present but environment variables are not configured. Messages will fail to send.',
          suggestion: `Set ${whatsappValidation.missing.join(', ')} in your environment configuration.`,
        });
      }
    } catch (error) {
      warnings.push({
        id: 'whatsapp-validation-error',
        severity: 'warning',
        title: 'Unable to verify WhatsApp credentials',
        description: error instanceof Error ? error.message : 'An unexpected error occurred while checking WhatsApp configuration.',
      });
    }
  }

  const status: JourneyValidationResult['status'] =
    errors.length > 0 ? 'fail' : warnings.length > 0 ? 'needs_attention' : 'pass';

  return {
    journeyId: journey.id,
    status,
    errors,
    warnings,
    summary: {
      evaluatedAt,
      triggerCount: triggers.length,
      actionCount: actions.length,
      goalCount: goals.length,
      nodeCount: journey.nodes.length,
      edgeCount: journey.edges.length,
      reachableNodeCount: reachable.size,
      unreachableNodeIds: unreachableNodes.map(node => node.id),
    },
  };
}


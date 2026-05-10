export interface JourneyTemplateNode {
  id?: string;
  type: 'trigger' | 'delay' | 'condition' | 'action' | 'goal' | 'exit';
  subtype?: string;
  name?: string;
  description?: string;
  position?: { x: number; y: number };
  data?: Record<string, unknown>;
}

export interface JourneyTemplateDefinition {
  trigger?: JourneyTemplateNode;
  nodes: JourneyTemplateNode[];
  edges: Array<{ id?: string; source: string; target: string; label?: string }>;
  settings?: {
    entry?: Record<string, unknown>;
    exit?: Record<string, unknown>;
    [key: string]: unknown;
  };
  metrics?: {
    avgConversionRate?: number;
    avgTimeToComplete?: number;
    sampleSize?: number;
  };
}

export interface JourneyTemplateSummary {
  id: string;
  name: string;
  description: string;
  category: string;
  tags?: string[];
  difficulty?: 'Beginner' | 'Intermediate' | 'Advanced';
  estimatedImpact?: 'High' | 'Medium' | 'Low';
  journey: JourneyTemplateDefinition;
}

export type JourneyTemplate = JourneyTemplateSummary;


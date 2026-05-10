export type WhatsAppTemplateStatus = 'APPROVED' | 'PENDING' | 'REJECTED';

export type TemplateButtonType =
  | 'quick_reply'
  | 'url'
  | 'phone'
  | 'QUICK_REPLY'
  | 'URL'
  | 'PHONE_NUMBER';

export interface TemplateButton {
  id: string;
  type: TemplateButtonType;
  label?: string;
  text?: string;
  url?: string;
  phone?: string;
  phoneNumber?: string;
}

export interface TemplateHeader {
  type: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  content?: string;
  mediaUrl?: string;
}

export interface WhatsAppTemplateBodyParameter {
  type: 'text';
  text: string;
}

export type WhatsAppTemplateComponent =
  | {
      type: 'body';
      parameters: WhatsAppTemplateBodyParameter[];
    }
  | {
      type: string;
      parameters?: Array<Record<string, unknown>>;
    };

export interface WhatsAppTemplate {
  id: string;
  name: string;
  category: string;
  content: string;
  description?: string;
  language: string;
  status: WhatsAppTemplateStatus;
  variables: string[];
  hasMediaHeader: boolean;
  mediaType?: 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'TEXT';
  mediaUrl?: string;
  hasButtons: boolean;
  buttons?: TemplateButton[];
  body?: string;
  footer?: string;
  header?: TemplateHeader;
  sampleValues?: Record<string, string>;
  previewImageUrl?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  submittedAt?: number;
  metaTemplateId?: string;
  rejectionReason?: string;
  messagesSent?: number;
  approvedAt?: number;
  lastUsedAt?: number;
  lastUsed?: string | Date;
}

export type VariableDataSource = 'customer' | 'order' | 'product' | 'custom' | 'static';

export interface VariableMapping {
  variable: string;
  dataSource: VariableDataSource;
  property: string;
  fallbackValue: string;
}

export interface WhatsAppBodyField {
  id: string;
  label: string;
  value: string;
}

export interface SendWindowConfig {
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  timezone: 'customer' | string;
}

export interface RateLimitingConfig {
  maxPerDay: number;
  maxPerWeek: number;
}

export type FailureFallbackAction = 'continue' | 'exit' | 'branch';

export interface FailureHandlingConfig {
  retryCount: number;
  retryDelay: number;
  fallbackAction: FailureFallbackAction;
}

export interface ExitPath {
  type: 'sent' | 'delivered' | 'read' | 'replied' | 'button_clicked' | 'failed' | 'unreachable' | 'timeout';
  enabled: boolean;
  action: {
    type: 'continue' | 'branch' | 'exit' | 'wait';
    branchId?: string;
    nextNodeId?: string;
    waitDuration?: number;
    timeoutPath?: string;
  };
  tracking: {
    enabled: boolean;
    eventName: string;
    eventProperties?: Record<string, any>;
  };
  profileUpdates?: Array<{
    property: string;
    value: any;
    operation: 'set' | 'increment' | 'append';
  }>;
  buttonConfig?: {
    buttonId: string;
    buttonText: string;
    customPayload?: Record<string, any>;
  };
}

export interface ExitPathsConfig {
  sent?: ExitPath;
  delivered?: ExitPath;
  read?: ExitPath;
  replied?: ExitPath;
  buttonClicked?: ExitPath[];
  failed?: ExitPath;
  unreachable?: ExitPath;
  timeout?: ExitPath;
}

export interface WhatsAppActionConfig {
  templateId: string;
  templateName: string;
  templateStatus?: WhatsAppTemplateStatus;
  templateLanguage?: string;
  templateCategory?: string;
  variableMappings: VariableMapping[];
  bodyFields: WhatsAppBodyField[];
  mediaUrl?: string;
  useDynamicMedia?: boolean;
  sendWindow: SendWindowConfig;
  rateLimiting: RateLimitingConfig;
  failureHandling: FailureHandlingConfig;
  skipIfOptedOut: boolean;
  buttonActions?: Record<string, string>;
  templateDefinition?: WhatsAppTemplate;
  previewBody?: string;
  previewVariables?: Record<string, string>;
  previewPlainVariables?: Record<string, string>;
  finalRenderedMessage?: string;
  exitPaths?: ExitPathsConfig;
}



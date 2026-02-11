import type {
  WhatsAppActionConfig,
  WhatsAppTemplateStatus,
  VariableMapping,
  SendWindowConfig,
  RateLimitingConfig,
  FailureHandlingConfig,
  TemplateButton,
} from '@/lib/types/whatsapp-config';
import { getTemplates } from '@/lib/whatsapp/templates-store';

export type StepId = 'template' | 'variables' | 'media' | 'buttons' | 'send' | 'preview';

export interface ValidationError {
  step: StepId;
  field?: string;
  message: string;
}

export interface ValidationResponse {
  valid: boolean;
  firstInvalidStep?: StepId;
  errors: ValidationError[];
}

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function isValidPhoneNumber(phone: string): boolean {
  const cleaned = phone.replace(/[^\d+]/g, '');
  return cleaned.length >= 8 && /^\+?[1-9]\d{7,14}$/.test(cleaned);
}

function normalizeVariableToken(token: string): string {
  return token.replace(/^\{\{|\}\}$/g, '').trim();
}

export function validateWhatsAppConfig(config: WhatsAppActionConfig): ValidationResponse {
  const errors: ValidationError[] = [];

  // Step 1: Template Selection
  if (!config.templateId || !config.templateName) {
    errors.push({
      step: 'template',
      field: 'templateId',
      message: 'Template must be selected.',
    });
  } else {
    const templates = getTemplates();
    const template = templates.find(t => t.id === config.templateId);

    if (!template) {
      errors.push({
        step: 'template',
        field: 'templateId',
        message: 'Selected template not found.',
      });
    } else {
      // Enforce APPROVED status for production use
      const status = config.templateStatus ?? template.status;
      if (status !== 'APPROVED') {
        errors.push({
          step: 'template',
          field: 'templateStatus',
          message: 'Template must be APPROVED for production use. Use sandbox mode for testing.',
        });
      }
    }
  }

  // Step 2: Variable Mapping
  const template = getTemplates().find(t => t.id === config.templateId);
  if (template && template.variables && template.variables.length > 0) {
    if (!config.variableMappings || config.variableMappings.length === 0) {
      errors.push({
        step: 'variables',
        field: 'variableMappings',
        message: 'Variable mappings are required.',
      });
    } else {
      const templateVars = new Set(template.variables.map(normalizeVariableToken));
      const mappedVars = new Set(
        config.variableMappings.map(m => normalizeVariableToken(m.variable)),
      );

      // Check all template variables are mapped
      templateVars.forEach(varName => {
        if (!mappedVars.has(varName)) {
          errors.push({
            step: 'variables',
            field: `variable_${varName}`,
            message: `Variable "${varName}" is not mapped.`,
          });
        }
      });

      // Validate each mapping
      config.variableMappings.forEach((mapping: VariableMapping) => {
        const varName = normalizeVariableToken(mapping.variable);
        if (!mapping.dataSource) {
          errors.push({
            step: 'variables',
            field: `mapping_${varName}_source`,
            message: `Data source required for variable "${varName}".`,
          });
        } else if (mapping.dataSource !== 'static' && !mapping.property) {
          errors.push({
            step: 'variables',
            field: `mapping_${varName}_property`,
            message: `Property required for variable "${varName}" when using ${mapping.dataSource} data source.`,
          });
        }
        if (!mapping.fallbackValue || !mapping.fallbackValue.trim()) {
          errors.push({
            step: 'variables',
            field: `mapping_${varName}_fallback`,
            message: `Fallback value required for variable "${varName}".`,
          });
        }
      });
    }
  }

  // Step 3: Media Attachments
  if (template?.hasMediaHeader) {
    if (!config.useDynamicMedia) {
      if (!config.mediaUrl || !config.mediaUrl.trim()) {
        errors.push({
          step: 'media',
          field: 'mediaUrl',
          message: 'Media URL is required when template supports media headers.',
        });
      } else if (!isValidUrl(config.mediaUrl)) {
        errors.push({
          step: 'media',
          field: 'mediaUrl',
          message: 'Media URL must be a valid HTTPS URL.',
        });
      }
    }
  }

  // Step 4: Action Buttons
  if (template?.hasButtons && template.buttons && template.buttons.length > 0) {
    if (!config.buttonActions) {
      errors.push({
        step: 'buttons',
        field: 'buttonActions',
        message: 'Button actions configuration is required.',
      });
    } else {
      template.buttons.forEach((button: TemplateButton) => {
        const action = config.buttonActions?.[button.id];
        if (button.type === 'quick_reply' || button.type === 'QUICK_REPLY') {
          if (!action || !action.trim()) {
            errors.push({
              step: 'buttons',
              field: `button_${button.id}`,
              message: `Branch identifier required for quick reply button "${button.label || button.text || button.id}".`,
            });
          }
        } else if (button.type === 'url' || button.type === 'URL') {
          if (action && !isValidUrl(action)) {
            errors.push({
              step: 'buttons',
              field: `button_${button.id}`,
              message: `Valid URL required for button "${button.label || button.text || button.id}".`,
            });
          }
        } else if (button.type === 'phone' || button.type === 'PHONE_NUMBER') {
          if (action && !isValidPhoneNumber(action)) {
            errors.push({
              step: 'buttons',
              field: `button_${button.id}`,
              message: `Valid phone number required for button "${button.label || button.text || button.id}".`,
            });
          }
        }
      });
    }
  }

  // Step 5: Send Settings
  if (!config.sendWindow) {
    errors.push({
      step: 'send',
      field: 'sendWindow',
      message: 'Send window configuration is required.',
    });
  } else {
    const sendWindow = config.sendWindow as SendWindowConfig;
    if (!sendWindow.daysOfWeek || sendWindow.daysOfWeek.length === 0) {
      errors.push({
        step: 'send',
        field: 'sendWindow.daysOfWeek',
        message: 'At least one day of week must be selected.',
      });
    }
    if (!sendWindow.startTime || !sendWindow.endTime) {
      errors.push({
        step: 'send',
        field: 'sendWindow.times',
        message: 'Start and end times are required.',
      });
    } else {
      const start = sendWindow.startTime.split(':').map(Number);
      const end = sendWindow.endTime.split(':').map(Number);
      if (start.length !== 2 || end.length !== 2) {
        errors.push({
          step: 'send',
          field: 'sendWindow.times',
          message: 'Times must be in HH:mm format.',
        });
      } else {
        const startMinutes = start[0] * 60 + start[1];
        const endMinutes = end[0] * 60 + end[1];
        if (startMinutes >= endMinutes) {
          errors.push({
            step: 'send',
            field: 'sendWindow.times',
            message: 'Start time must be earlier than end time.',
          });
        }
      }
    }
  }

  if (!config.rateLimiting) {
    errors.push({
      step: 'send',
      field: 'rateLimiting',
      message: 'Rate limiting configuration is required.',
    });
  } else {
    const rateLimit = config.rateLimiting as RateLimitingConfig;
    if (rateLimit.maxPerDay <= 0 || rateLimit.maxPerWeek <= 0) {
      errors.push({
        step: 'send',
        field: 'rateLimiting',
        message: 'Rate limits must be greater than 0.',
      });
    }
  }

  if (!config.failureHandling) {
    errors.push({
      step: 'send',
      field: 'failureHandling',
      message: 'Failure handling configuration is required.',
    });
  } else {
    const failure = config.failureHandling as FailureHandlingConfig;
    if (failure.retryCount < 0 || failure.retryDelay < 0) {
      errors.push({
        step: 'send',
        field: 'failureHandling',
        message: 'Retry count and delay cannot be negative.',
      });
    }
  }

  // Determine first invalid step
  const stepOrder: StepId[] = ['template', 'variables', 'media', 'buttons', 'send', 'preview'];
  let firstInvalidStep: StepId | undefined;
  for (const step of stepOrder) {
    if (errors.some(e => e.step === step)) {
      firstInvalidStep = step;
      break;
    }
  }

  return {
    valid: errors.length === 0,
    firstInvalidStep,
    errors,
  };
}


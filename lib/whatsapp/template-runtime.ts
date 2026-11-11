import type {
  TemplateRuntimeParameter,
  WhatsAppTemplate,
} from '@/lib/types/whatsapp-config';
import type { MetaTemplateDefinition } from './template-payload';

const variableTokens = (text = ''): string[] => [
  ...new Set(Array.from(text.matchAll(/\{\{([^{}]+)\}\}/g), match => match[1].trim())),
];

export function approvedUrlPrefix(url?: string): string {
  return typeof url === 'string' ? url.split('{{')[0] : '';
}

export function normalizeTemplateRuntimeParameters(
  components: MetaTemplateDefinition['components'] = [],
  parameterFormat?: string,
): TemplateRuntimeParameter[] {
  const result: TemplateRuntimeParameter[] = [];
  for (const component of components) {
    const componentType = component.type.toUpperCase();
    if (componentType === 'BODY' || (componentType === 'HEADER' && component.format === 'TEXT')) {
      variableTokens(component.text).forEach((name, index) => {
        result.push({
          id: `${componentType.toLowerCase()}.${name}`,
          component: componentType as 'BODY' | 'HEADER',
          componentIndex: 0,
          parameterType: 'text',
          position: index,
          parameterName: parameterFormat === 'NAMED' ? name : undefined,
          token: name,
          required: true,
        });
      });
    }
    if (componentType === 'HEADER' && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(component.format ?? '')) {
      result.push({
        id: 'header.media',
        component: 'HEADER',
        componentIndex: 0,
        parameterType: (component.format ?? 'IMAGE').toLowerCase() as 'image' | 'video' | 'document',
        position: 0,
        required: true,
      });
    }
    if (componentType === 'BUTTONS') {
      component.buttons?.forEach((button, index) => {
        if (button.type === 'URL' && variableTokens(button.url).length) {
          result.push({
            id: `button.${index}`,
            component: 'BUTTON',
            componentIndex: index,
            parameterType: 'url',
            position: 0,
            token: variableTokens(button.url)[0],
            approvedPrefix: approvedUrlPrefix(button.url),
            example: Array.isArray(button.example) ? button.example[0] : undefined,
            label: button.text,
            required: true,
          });
        }
      });
    }
  }
  return result;
}

export function dynamicUrlParameters(template?: WhatsAppTemplate | null): TemplateRuntimeParameter[] {
  return (template?.runtimeParameters ?? []).filter(
    parameter => parameter.component === 'BUTTON' && parameter.parameterType === 'url',
  );
}

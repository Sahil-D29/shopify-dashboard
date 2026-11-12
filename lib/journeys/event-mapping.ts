import type { JourneyEventSchema } from './event-schema';
import type { TemplateComponentMapping } from '@/lib/types/whatsapp-config';

const TOKEN_PATTERN = /\{\{\s*([^{}]+?)\s*\}\}/g;

export function readEventPath(event: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (current == null) return undefined;
    if (Array.isArray(current) && /^\d+$/.test(key)) return current[Number(key)];
    if (typeof current !== 'object') return undefined;
    return (current as Record<string, unknown>)[key];
  }, event);
}

export function mappingTokenPaths(mapping: TemplateComponentMapping): string[] {
  if ((mapping.mode ?? 'field') === 'field') return mapping.property ? [mapping.property] : [];
  return Array.from(mapping.expression?.matchAll(TOKEN_PATTERN) ?? [], match => match[1].trim());
}

export function resolveEventMapping(mapping: TemplateComponentMapping, event: Record<string, unknown>): string {
  if ((mapping.mode ?? 'field') === 'field') {
    const value = readEventPath(event, mapping.property);
    return value == null || value === '' ? mapping.fallbackValue ?? '' : String(value);
  }
  return (mapping.expression ?? '').replace(TOKEN_PATTERN, (_token, path: string) => {
    const value = readEventPath(event, path.trim());
    return value == null ? '' : String(value);
  });
}

export function previewEventMapping(mapping: TemplateComponentMapping, schema?: JourneyEventSchema): string {
  const preview = Object.fromEntries((schema?.fields ?? []).map(item => [item.path, item.sample]));
  const nested: Record<string, unknown> = {};
  for (const [path, value] of Object.entries(preview)) {
    const parts = path.split('.');
    let target = nested;
    parts.forEach((part, index) => {
      if (index === parts.length - 1) target[part] = value;
      else target = (target[part] ??= {}) as Record<string, unknown>;
    });
  }
  return resolveEventMapping(mapping, nested);
}

export function validateEventUrlMapping(
  mapping: TemplateComponentMapping,
  approvedPrefix: string,
  schema?: JourneyEventSchema,
): string[] {
  const errors: string[] = [];
  const paths = mappingTokenPaths(mapping);
  if (!approvedPrefix.startsWith('https://')) errors.push('The approved button prefix must use HTTPS.');
  if (!paths.length) errors.push('Use at least one event field so each customer receives their own link.');
  for (const path of paths) {
    if (schema && !schema.fields.some(field => field.path === path)) errors.push(`Event field ${path} is not registered.`);
  }
  const preview = previewEventMapping(mapping, schema);
  if (!preview || /\{\{[^{}]+\}\}/.test(preview)) errors.push('The link contains an unresolved event field.');
  if (/^https?:\/\//i.test(preview) && !preview.startsWith(approvedPrefix)) {
    errors.push('A complete URL must match Meta’s approved URL prefix.');
  }
  const finalUrl = preview.startsWith(approvedPrefix) ? preview : `${approvedPrefix}${preview}`;
  try {
    const url = new URL(finalUrl);
    const prefixUrl = new URL(approvedPrefix);
    if (url.protocol !== 'https:') errors.push('The final link must use HTTPS.');
    if (url.origin !== prefixUrl.origin || !finalUrl.startsWith(approvedPrefix)) errors.push('The final link does not match Meta’s approved URL prefix.');
  } catch {
    errors.push('The final link is not a valid URL.');
  }
  return [...new Set(errors)];
}

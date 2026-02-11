/**
 * Step 2 Validation - Variable Mapping
 * Validates that all template variables are properly mapped
 */

import { extractTemplateVariables } from './templateParser';
import type { WhatsAppTemplate, VariableMapping } from '@/lib/types/whatsapp-config';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateStep2(
  template: WhatsAppTemplate | null,
  mappings: VariableMapping[],
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!template) {
    return {
      isValid: false,
      errors: ['Template is required'],
      warnings: [],
    };
  }

  // 1. Check all template variables are mapped
  const templateBody = template.body || template.content || '';
  const templateVars = extractTemplateVariables(templateBody);
  const mappedVars = mappings.map((m) => m.variable);

  const unmappedVars = templateVars
    .map((v) => v.variable)
    .filter((v) => !mappedVars.includes(v));

  if (unmappedVars.length > 0) {
    errors.push(`Unmapped variables: ${unmappedVars.join(', ')}`);
  }

  // 2. Check each mapping
  mappings.forEach((mapping, idx) => {
    const varLabel = `Variable ${idx + 1} (${mapping.variable})`;

    // Source is required
    if (!mapping.dataSource) {
      errors.push(`${varLabel}: Select a data source`);
    }

    // Property is required (except for static)
    if (mapping.dataSource !== 'static' && !mapping.property) {
      errors.push(`${varLabel}: Select a property`);
    }

    // Fallback is required
    if (!mapping.fallbackValue || mapping.fallbackValue.trim() === '') {
      errors.push(`${varLabel}: Fallback value is required`);
    }

    // Fallback cannot contain variables
    if (mapping.fallbackValue && mapping.fallbackValue.includes('{{')) {
      errors.push(`${varLabel}: Fallback cannot contain variables like {{...}}`);
    }

    // Warn about long fallbacks
    if (mapping.fallbackValue && mapping.fallbackValue.length > 30) {
      warnings.push(
        `${varLabel}: Fallback is long (${mapping.fallbackValue.length} chars). Consider shortening.`,
      );
    }
  });

  // 3. Character count validation
  let mergedBody = templateBody;
  mappings.forEach((m) => {
    // Use fallback for character count calculation
    mergedBody = mergedBody.replace(
      new RegExp(escapeRegex(m.variable), 'g'),
      m.fallbackValue || m.variable,
    );
  });

  const charCount = mergedBody.length;
  if (charCount > 1024) {
    errors.push(
      `Message is too long (${charCount}/1024 characters). Shorten fallback values.`,
    );
  } else if (charCount > 900) {
    warnings.push(
      `Message is approaching limit (${charCount}/1024). Consider shorter fallbacks.`,
    );
  }

  // 4. Check for common mistakes
  mappings.forEach((mapping, idx) => {
    // Generic fallback warning
    if (['Value', 'N/A', 'NA', ''].includes(mapping.fallbackValue)) {
      warnings.push(
        `Variable ${idx + 1}: Use a more descriptive fallback than "${mapping.fallbackValue}"`,
      );
    }

    // First variable should typically be a name
    if (idx === 0 && mapping.dataSource !== 'customer') {
      warnings.push(
        `First variable is typically customer name. Consider using Customer Properties.`,
      );
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}



export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

type TemplateButtonType = 'URL' | 'PHONE_NUMBER' | 'QUICK_REPLY';

interface TemplateButton {
  type: TemplateButtonType;
  text: string;
  url?: string;
  phoneNumber?: string;
}

export class TemplateValidator {
  // Meta's minimum word count requirements
  private static readonly MIN_WORDS_PER_VARIABLE = 5;
  private static readonly MIN_TOTAL_WORDS = 10;
  private static readonly MAX_VARIABLE_RATIO = 0.3; // 30% max

  static validateTemplate(template: {
    name: string;
    body: string;
    variables: string[];
    header?: { type: string; content: string };
    footer?: string;
    buttons?: TemplateButton[];
  }): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Validate template name
    if (!/^[a-z0-9_]+$/.test(template.name)) {
      errors.push('Template name must contain only lowercase letters, numbers, and underscores');
    }

    if (template.name.length < 3) {
      errors.push('Template name must be at least 3 characters long');
    }

    if (template.name.length > 512) {
      errors.push('Template name cannot exceed 512 characters');
    }

    // 2. Validate body text
    const bodyWords = this.countWords(template.body);
    const variableCount = template.variables.length;

    if (bodyWords < this.MIN_TOTAL_WORDS) {
      errors.push(`Template body must contain at least ${this.MIN_TOTAL_WORDS} words. Current: ${bodyWords} words`);
    }

    if (variableCount > 0) {
      const wordsPerVariable = bodyWords / variableCount;
      
      if (wordsPerVariable < this.MIN_WORDS_PER_VARIABLE) {
        errors.push(
          `Template has too many variables for its length. ` +
          `You have ${variableCount} variable(s) in ${bodyWords} words. ` +
          `Meta requires at least ${this.MIN_WORDS_PER_VARIABLE} words per variable. ` +
          `Minimum required: ${variableCount * this.MIN_WORDS_PER_VARIABLE} words.`
        );
      }

      const variableRatio = variableCount / bodyWords;
      if (variableRatio > this.MAX_VARIABLE_RATIO) {
        warnings.push(
          `High variable-to-text ratio (${(variableRatio * 100).toFixed(1)}%). ` +
          `Consider adding more context to your message.`
        );
      }
    }

    // 3. Validate body length
    if (template.body.length > 1024) {
      errors.push('Template body cannot exceed 1024 characters');
    }

    if (template.body.trim().length === 0) {
      errors.push('Template body cannot be empty');
    }

    // 4. Validate header
    if (template.header) {
      if (template.header.type === 'TEXT') {
        if (template.header.content.length > 60) {
          errors.push('Header text cannot exceed 60 characters');
        }
        if (template.header.content.trim().length === 0) {
          errors.push('Header text cannot be empty');
        }
      }
    }

    // 5. Validate footer
    if (template.footer) {
      if (template.footer.length > 60) {
        errors.push('Footer text cannot exceed 60 characters');
      }
    }

    // 6. Validate buttons
    if (template.buttons && template.buttons.length > 0) {
      if (template.buttons.length > 10) {
        errors.push('Cannot have more than 10 buttons');
      }

      template.buttons.forEach((btn, index) => {
        if (!btn.text || btn.text.trim().length === 0) {
          errors.push(`Button ${index + 1} text cannot be empty`);
        }
        if (btn.text && btn.text.length > 20) {
          errors.push(`Button ${index + 1} text cannot exceed 20 characters`);
        }
        
        if (btn.type === 'URL' && (!btn.url || !this.isValidUrl(btn.url))) {
          errors.push(`Button ${index + 1} has invalid URL`);
        }
        
        if (btn.type === 'PHONE_NUMBER' && (!btn.phoneNumber || !this.isValidPhoneNumber(btn.phoneNumber))) {
          errors.push(`Button ${index + 1} has invalid phone number`);
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  private static countWords(text: string): number {
    // Remove variables for word count
    const textWithoutVars = text.replace(/\{\{[^}]+\}\}/g, ' ');
    // Split by whitespace and filter empty strings
    return textWithoutVars.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  private static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private static isValidPhoneNumber(phone: string): boolean {
    // Basic validation: starts with + and contains only digits
    return /^\+?[1-9]\d{1,14}$/.test(phone);
  }

  static getMinimumBodyLength(variableCount: number): number {
    return Math.max(this.MIN_TOTAL_WORDS, variableCount * this.MIN_WORDS_PER_VARIABLE);
  }

  static getSuggestion(template: { body: string; variables: string[] }): string | null {
    const bodyWords = this.countWords(template.body);
    const variableCount = template.variables.length;
    
    if (variableCount === 0) return null;
    
    const requiredWords = variableCount * this.MIN_WORDS_PER_VARIABLE;
    
    if (bodyWords < requiredWords) {
      return `Add at least ${requiredWords - bodyWords} more words to your message to meet Meta's requirements.`;
    }
    
    return null;
  }
}


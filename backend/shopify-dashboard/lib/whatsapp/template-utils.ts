import type { WhatsAppTemplate } from "@/lib/types/whatsapp-config";

export function normalizeVariableToken(variable: string): string {
  if (!variable) return "";
  const stripped = variable.replace(/^\{\{|\}\}$/g, "");
  return `{{${stripped}}}`;
}

export function stripVariableDelimiters(variable: string): string {
  return variable.replace(/^\{\{|\}\}$/g, "");
}

export function renderTemplateWithVariables(
  template: WhatsAppTemplate | null | undefined,
  variableValues: Record<string, string>,
): string {
  if (!template) return "";
  const base = template.content ?? template.body ?? "";
  if (!base) return "";

  return template.variables.reduce((acc, variable) => {
    const token = normalizeVariableToken(variable);
    const fallbackToken = normalizeVariableToken(stripVariableDelimiters(variable));
    const value =
      variableValues[token] ??
      variableValues[fallbackToken] ??
      variableValues[stripVariableDelimiters(variable)] ??
      token;
    return acc.replaceAll(token, value);
  }, base);
}

export function countTemplateCharacters(
  template: WhatsAppTemplate | null | undefined,
  variableValues: Record<string, string>,
): number {
  const rendered = renderTemplateWithVariables(template, variableValues);
  return rendered.length;
}



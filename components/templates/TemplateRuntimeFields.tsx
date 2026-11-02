'use client';

/** Runtime inputs that are separate from the approved template's body text. */
export default function TemplateRuntimeFields({ template, config, onChange }: { template: any; config: any; onChange: (updates: any) => void }) {
  if (!template) return null;
  const headerVariables = template.header?.type === 'TEXT' ? [...new Set<string>(Array.from(String(template.header.content ?? '').matchAll(/\{\{([^{}]+)\}\}/g), match => match[1]))] : [];
  const buttons = (template.buttons ?? []).map((button: any, index: number) => ({ ...button, index })).filter((button: any) => String(button.type).toUpperCase() === 'URL' && button.url?.includes('{{'));
  if (!headerVariables.length && !buttons.length) return null;
  return <fieldset className="space-y-3 rounded-lg border p-4"><legend className="px-2 font-medium">Header and button values</legend>
    {headerVariables.map(key => <label key={key} className="block text-sm">Header variable {'{{' + key + '}}'}
      <input className="mt-1 block w-full rounded border p-2" value={config.variables?.[`header.${key}`] ?? ''} onChange={event => onChange({ variables: { ...config.variables, [`header.${key}`]: event.target.value } })} />
    </label>)}
    {buttons.map((button: any) => <label key={button.index} className="block text-sm">Dynamic URL value for {button.text ?? button.label ?? `button ${button.index + 1}`}
      <input className="mt-1 block w-full rounded border p-2" placeholder="Enter the dynamic part of the approved URL" value={config.buttonActions?.[String(button.index)] ?? config.buttonActions?.[button.id] ?? ''} onChange={event => onChange({ buttonActions: { ...config.buttonActions, [String(button.index)]: event.target.value, [button.id]: event.target.value } })} />
    </label>)}
  </fieldset>;
}

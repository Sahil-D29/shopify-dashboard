/** Extract WABA target ids granted to a Meta Embedded Signup token. */
export function extractWabaIdsFromTokenDebug(debugPayload: unknown): string[] {
  const root = debugPayload && typeof debugPayload === 'object'
    ? (debugPayload as Record<string, any>)
    : {};
  const scopes = Array.isArray(root.data?.granular_scopes) ? root.data.granular_scopes : [];
  const ids = new Set<string>();

  for (const scope of scopes) {
    if (!String(scope?.scope || '').startsWith('whatsapp_business_')) continue;
    for (const target of Array.isArray(scope?.target_ids) ? scope.target_ids : []) {
      if (target != null && String(target).trim()) ids.add(String(target));
    }
  }
  return Array.from(ids);
}

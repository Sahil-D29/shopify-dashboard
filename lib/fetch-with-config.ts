/**
 * @deprecated Use plain `fetch()` instead. The backend now resolves store credentials
 * from the `current_store_id` cookie via `resolveStore()`, so there's no need to
 * send tokens in headers from the frontend.
 */
export async function fetchWithConfig(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  if (typeof window === 'undefined') {
    throw new Error('fetchWithConfig can only be used on the client side');
  }

  return fetch(url, {
    ...options,
  });
}

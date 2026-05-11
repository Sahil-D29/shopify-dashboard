export function fallbackMessage(error: unknown, defaultMessage: string): string {
  if (error instanceof Error) {
    return error.message?.trim() || defaultMessage;
  }

  if (typeof error === 'string' && error.trim().length > 0) {
    return error.trim();
  }

  return defaultMessage;
}



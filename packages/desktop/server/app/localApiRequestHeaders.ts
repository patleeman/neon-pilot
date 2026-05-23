export function normalizeLocalApiRequestHeaders(headers?: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(headers ?? {}).map(([key, value]) => [key.toLowerCase(), value]));
}

export function readLocalApiRequestHeader(headers: Record<string, string>, name: string): string | undefined {
  return headers[name.toLowerCase()];
}

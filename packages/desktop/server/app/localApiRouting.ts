export function buildLocalApiRoutePattern(path: string): { pattern: RegExp; keys: string[] } {
  const keys: string[] = [];
  const escaped = path
    .split('/')
    .map((segment) => {
      if (!segment) {
        return '';
      }

      if (segment === '*') {
        keys.push('0');
        return '(.+)';
      }

      if (segment.startsWith(':')) {
        keys.push(segment.slice(1));
        return '([^/]+)';
      }

      return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');

  return {
    pattern: new RegExp(`^${escaped}$`),
    keys,
  };
}

export function buildLocalApiQueryObject(searchParams: URLSearchParams): Record<string, string | string[]> {
  const query: Record<string, string | string[]> = {};

  for (const [key, value] of searchParams.entries()) {
    const existing = query[key];
    if (existing === undefined) {
      query[key] = value;
      continue;
    }

    query[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
  }

  return query;
}

export function findMatchingLocalApiRoute<T extends { method: string; pattern: RegExp }>(
  routes: T[],
  method: string,
  pathname: string,
): T | undefined {
  return routes.find((candidate) => candidate.method === method && candidate.pattern.test(pathname));
}

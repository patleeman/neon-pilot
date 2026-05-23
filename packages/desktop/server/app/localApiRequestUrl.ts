export function buildLocalApiRequestUrl(pathname: string, search: string): string {
  return `${pathname}${search}`;
}

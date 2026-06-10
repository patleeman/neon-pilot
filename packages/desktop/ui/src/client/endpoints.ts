function normalizeBaseUrl(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

const desktopWebSocketBaseUrl = (() => {
  if (typeof window === 'undefined') return '';
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return normalizeBaseUrl(`${protocol}//${window.location.host}`);
})();

export function buildDesktopHttpUrl(path: string): string {
  return path.startsWith('/') ? path : `/${path}`;
}

export function buildDesktopWebSocketUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${desktopWebSocketBaseUrl}${normalizedPath}`;
}

interface DesktopEndpointConfig {
  httpBaseUrl: string;
  webSocketBaseUrl: string;
}

function normalizeBaseUrl(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function readDesktopEndpointConfig(): DesktopEndpointConfig {
  if (typeof window === 'undefined') {
    return { httpBaseUrl: '', webSocketBaseUrl: '' };
  }

  const httpBaseUrl = normalizeBaseUrl(window.location.origin || `${window.location.protocol}//${window.location.host}`);
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return {
    httpBaseUrl,
    webSocketBaseUrl: normalizeBaseUrl(`${protocol}//${window.location.host}`),
  };
}

export function buildDesktopHttpUrl(path: string): string {
  return path.startsWith('/') ? path : `/${path}`;
}

export function buildDesktopWebSocketUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${readDesktopEndpointConfig().webSocketBaseUrl}${normalizedPath}`;
}

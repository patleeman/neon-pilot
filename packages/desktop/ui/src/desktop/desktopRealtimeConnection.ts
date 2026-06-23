import { buildDesktopWebSocketUrl } from '../client/endpoints';
import { getDesktopBridge } from './desktopBridge';

let cachedRealtimeUrl: string | undefined;

function isCustomDesktopProtocol(): boolean {
  return typeof window !== 'undefined' && window.location.protocol === 'neon-pilot:';
}

export async function resolveDesktopRealtimeUrl(): Promise<string> {
  if (cachedRealtimeUrl !== undefined) {
    return cachedRealtimeUrl;
  }

  const bridge = getDesktopBridge();
  try {
    const realtimeUrl = await bridge?.getEnvironment().then((environment) => environment.realtimeUrl);
    if (typeof realtimeUrl === 'string' && realtimeUrl.trim()) {
      cachedRealtimeUrl = realtimeUrl.trim();
      return cachedRealtimeUrl;
    }
  } catch {
    // Fall through to the browser-origin fallback when it is usable.
  }

  if (isCustomDesktopProtocol()) {
    throw new Error('Desktop realtime URL is unavailable.');
  }

  cachedRealtimeUrl = buildDesktopWebSocketUrl('/api/realtime');
  return cachedRealtimeUrl;
}

export async function openDesktopRealtimeSocket(): Promise<WebSocket> {
  return new WebSocket(await resolveDesktopRealtimeUrl());
}

export function clearDesktopRealtimeUrlCacheForTests(): void {
  cachedRealtimeUrl = undefined;
}

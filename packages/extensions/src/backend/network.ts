const EXTENSION_HOST_CAPABILITY_BRIDGE = Symbol.for('neon-pilot.extensionHostCapabilityBridge');

type ExtensionBackendGlobal = typeof globalThis & {
  [EXTENSION_HOST_CAPABILITY_BRIDGE]?: (capability: string, operation: string, input?: unknown) => Promise<unknown>;
};

export interface NetworkFetchResult {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  text: string;
  bodyBase64?: string;
  url: string;
}

export interface NetworkFetchInit {
  method?: string;
  headers?: Record<string, string>;
  redirect?: 'follow' | 'error' | 'manual';
  timeoutMs?: number;
}

function getHostCapabilityBridge(): ((capability: string, operation: string, input?: unknown) => Promise<unknown>) | undefined {
  return (globalThis as ExtensionBackendGlobal)[EXTENSION_HOST_CAPABILITY_BRIDGE];
}

export async function networkFetch(url: string, init?: NetworkFetchInit): Promise<NetworkFetchResult> {
  const bridge = getHostCapabilityBridge();
  if (!bridge) {
    throw new Error('Network host capability is unavailable outside an extension backend worker request.');
  }
  const result = await bridge('network', 'fetch', { url, ...init });
  if (!result || typeof result !== 'object') {
    throw new Error('Network fetch returned an invalid result.');
  }
  return result as NetworkFetchResult;
}

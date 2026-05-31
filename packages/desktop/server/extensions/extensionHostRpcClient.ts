import type { ExtensionHostClient, ExtensionHostInvokeActionInput } from './extensionHostClient.js';
import type { ExtensionHostRequest, ExtensionHostResponse } from './extensionHostProtocol.js';

export interface ExtensionHostRpcClientOptions {
  baseUrl: string;
  token: string;
  fetchImpl?: typeof fetch;
}

export function hasFunction(value: unknown, seen = new WeakSet<object>()): boolean {
  if (typeof value === 'function') return true;
  if (!value || typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.some((item) => hasFunction(item, seen));
  return Object.values(value as Record<string, unknown>).some((item) => hasFunction(item, seen));
}

export function isWireableExtensionHostInvokeActionInput(input: ExtensionHostInvokeActionInput): boolean {
  return (
    !hasFunction(input.serverContext) &&
    !hasFunction(input.serverContextSnapshot) &&
    !hasFunction(input.toolContext) &&
    !hasFunction(input.toolContextSnapshot) &&
    !hasFunction(input.agentToolContext)
  );
}

function isWireableExtensionHostInvokeRouteInput(input: Parameters<ExtensionHostClient['invokeRoute']>[0]): boolean {
  return !input.request.signal && !hasFunction(input.serverContext) && !hasFunction(input.serverContextSnapshot) && !hasFunction(input.request);
}

function assertWireableInvokeActionInput(input: ExtensionHostInvokeActionInput): void {
  if (!isWireableExtensionHostInvokeActionInput(input)) {
    throw new Error('Extension host RPC cannot carry function-bearing contexts; use capability channels before enabling this call path.');
  }
}

export function createExtensionHostRpcClient(options: ExtensionHostRpcClientOptions): ExtensionHostClient {
  const baseUrl = options.baseUrl.replace(/\/$/, '');
  const fetchImpl = options.fetchImpl ?? fetch;

  async function send(request: ExtensionHostRequest): Promise<ExtensionHostResponse> {
    const response = await fetchImpl(`${baseUrl}/rpc`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${options.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ request }),
    });
    const body = (await response.json()) as ExtensionHostResponse;
    if (!response.ok) {
      return { ok: false, error: !body.ok ? body.error : `Extension host RPC failed: ${String(response.status)}` };
    }
    return body;
  }

  return {
    async health() {
      const response = await send({ type: 'health' });
      if (!response.ok) throw new Error(response.error);
      if (!('status' in response)) throw new Error('Extension host returned an invalid health response.');
      return { status: response.status };
    },
    async checkBackendHealth() {
      const response = await send({ type: 'checkBackendHealth' });
      if (!response.ok) throw new Error(response.error);
      if (!('results' in response)) throw new Error('Extension host returned an invalid backend health response.');
      return response.results;
    },
    async invokeAction(input) {
      assertWireableInvokeActionInput(input);
      const response = await send({ type: 'invokeAction', ...input });
      if (!response.ok) return { ok: false, error: response.error };
      if (!('result' in response)) return { ok: false, error: 'Extension host returned an invalid action response.' };
      return response.result;
    },
    async invokeProtocolEntrypoint() {
      throw new Error('Extension host RPC cannot carry protocol stdio streams; use capability channels before enabling this call path.');
    },
    async invokeRoute(input) {
      if (!isWireableExtensionHostInvokeRouteInput(input)) {
        throw new Error('Extension host RPC cannot carry function-bearing route contexts; use capability channels before enabling this call path.');
      }
      const response = await send({ type: 'invokeRoute', ...input });
      if (!response.ok) throw new Error(response.error);
      if (!('route' in response)) throw new Error('Extension host returned an invalid route response.');
      if (response.route.stream === 'sse' || hasFunction(response.route)) {
        throw new Error('Extension host RPC cannot carry streaming route responses; use capability channels before enabling this call path.');
      }
      return response.route;
    },
    async listActionTelemetry(extensionId) {
      const response = await send({ type: 'listActionTelemetry', ...(extensionId ? { extensionId } : {}) });
      if (!response.ok) throw new Error(response.error);
      if (!('telemetry' in response)) throw new Error('Extension host returned an invalid telemetry response.');
      return response.telemetry;
    },
    async reloadBackend(input) {
      const response = await send({ type: 'reloadBackend', ...input });
      if (!response.ok) throw new Error(response.error);
      if (!('reload' in response)) throw new Error('Extension host returned an invalid reload response.');
      return response.reload;
    },
    async runSelfTest(input) {
      const response = await send({ type: 'runSelfTest', ...input });
      if (!response.ok) throw new Error(response.error);
      if (!('selfTest' in response)) throw new Error('Extension host returned an invalid self-test response.');
      return response.selfTest;
    },
    async startStartupActions(input) {
      const response = await send({ type: 'startStartupActions', ...(input ?? {}) });
      if (!response.ok) throw new Error(response.error);
      if (!('results' in response)) throw new Error('Extension host returned an invalid startup actions response.');
      return response.results;
    },
    async publishEvent(source, payload) {
      const response = await send({ type: 'publishEvent', source, payload });
      if (!response.ok) throw new Error(response.error);
      if (!('published' in response)) throw new Error('Extension host returned an invalid publish response.');
    },
  };
}

export function createHybridExtensionHostClient(input: {
  rpcClient: ExtensionHostClient;
  fallbackClient: ExtensionHostClient;
}): ExtensionHostClient {
  return {
    async health() {
      return input.rpcClient.health();
    },
    async invokeAction(actionInput) {
      if (!isWireableExtensionHostInvokeActionInput(actionInput)) {
        return input.fallbackClient.invokeAction(actionInput);
      }
      return input.rpcClient.invokeAction(actionInput);
    },
    async checkBackendHealth() {
      return input.rpcClient.checkBackendHealth();
    },
    async invokeProtocolEntrypoint(protocolInput) {
      return input.fallbackClient.invokeProtocolEntrypoint(protocolInput);
    },
    async invokeRoute(routeInput) {
      return input.fallbackClient.invokeRoute(routeInput);
    },
    async listActionTelemetry(extensionId) {
      return input.rpcClient.listActionTelemetry(extensionId);
    },
    async reloadBackend(reloadInput) {
      return input.rpcClient.reloadBackend(reloadInput);
    },
    async runSelfTest(selfTestInput) {
      return input.rpcClient.runSelfTest(selfTestInput);
    },
    async startStartupActions(startupInput) {
      return input.rpcClient.startStartupActions(startupInput);
    },
    async publishEvent(source, payload) {
      return input.rpcClient.publishEvent(source, payload);
    },
  };
}

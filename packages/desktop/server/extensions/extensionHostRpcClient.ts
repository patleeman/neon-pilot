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
    async invokeProtocolEntrypoint(protocolInput) {
      return input.fallbackClient.invokeProtocolEntrypoint(protocolInput);
    },
    async publishEvent(source, payload) {
      return input.rpcClient.publishEvent(source, payload);
    },
  };
}

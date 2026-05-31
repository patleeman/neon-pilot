import type { ExtensionActionInvokeResult } from './extensionBackend.js';
import type { ExtensionHostInvokeActionRequest, ExtensionHostRequest, ExtensionHostResponse } from './extensionHostProtocol.js';

export type ExtensionHostInvokeActionInput = Omit<ExtensionHostInvokeActionRequest, 'type'>;

export interface ExtensionHostClient {
  health(): Promise<{ status: 'ready' }>;
  invokeAction(input: ExtensionHostInvokeActionInput): Promise<ExtensionActionInvokeResult>;
  publishEvent(source: string, payload: unknown): Promise<void>;
}

let configuredExtensionHostClient: ExtensionHostClient | undefined;

export function setExtensionHostClient(client: ExtensionHostClient | undefined): void {
  configuredExtensionHostClient = client;
}

export function getExtensionHostClient(): ExtensionHostClient {
  configuredExtensionHostClient ??= createInProcessExtensionHostClient();
  return configuredExtensionHostClient;
}

function createInProcessExtensionHostClient(): ExtensionHostClient {
  return {
    async health() {
      const response = await handleInProcessExtensionHostRequest({ type: 'health' });
      if (!response.ok) throw new Error(response.error);
      if (!('status' in response)) throw new Error('Extension host returned an invalid health response.');
      return { status: response.status };
    },
    async invokeAction(input) {
      const response = await handleInProcessExtensionHostRequest({ type: 'invokeAction', ...input });
      if (!response.ok) return { ok: false, error: response.error };
      if (!('result' in response)) return { ok: false, error: 'Extension host returned an invalid action response.' };
      return response.result;
    },
    async publishEvent(source, payload) {
      const response = await handleInProcessExtensionHostRequest({ type: 'publishEvent', source, payload });
      if (!response.ok) throw new Error(response.error);
      if (!('published' in response)) throw new Error('Extension host returned an invalid publish response.');
    },
  };
}

export async function handleInProcessExtensionHostRequest(request: ExtensionHostRequest): Promise<ExtensionHostResponse> {
  try {
    if (request.type === 'health') {
      return { ok: true, status: 'ready' };
    }
    const { invokeExtensionAction } = await import('./extensionBackend.js');
    if (request.type === 'invokeAction') {
      return {
        ok: true,
        result: await invokeExtensionAction(
          request.extensionId,
          request.actionId,
          request.input,
          request.serverContext,
          request.toolContext,
          request.agentToolContext,
        ),
      };
    }
    const { publishExtensionHostEvent } = await import('./extensionSubscriptions.js');
    await publishExtensionHostEvent(request.source, request.payload);
    return { ok: true, published: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

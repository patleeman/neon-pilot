import type { ExtensionBackendServerContext } from './extensionBackend.js';
import type {
  ExtensionHostActionInvokeResult,
  ExtensionHostActionTelemetryEntry,
  ExtensionHostBackendOperationResult,
  ExtensionHostBackendServerContext,
  ExtensionHostInvokeActionRequest,
  ExtensionHostInvokeProtocolEntrypointRequest,
  ExtensionHostInvokeRouteRequest,
  ExtensionHostReloadBackendRequest,
  ExtensionHostReloadBackendResult,
  ExtensionHostRequest,
  ExtensionHostResponse,
  ExtensionHostRouteResponse,
  ExtensionHostRunSelfTestRequest,
  ExtensionHostSelfTestResult,
  ExtensionHostStartStartupActionsRequest,
} from './extensionHostProtocol.js';

function asExtensionBackendServerContext(
  context: ExtensionHostBackendServerContext | undefined,
): ExtensionBackendServerContext | undefined {
  return context as ExtensionBackendServerContext | undefined;
}

export type ExtensionHostInvokeActionInput = Omit<ExtensionHostInvokeActionRequest, 'type'>;
export type ExtensionHostInvokeProtocolEntrypointInput = Omit<ExtensionHostInvokeProtocolEntrypointRequest, 'type'>;
export type ExtensionHostInvokeRouteInput = Omit<ExtensionHostInvokeRouteRequest, 'type'>;
export type ExtensionHostReloadBackendInput = Omit<ExtensionHostReloadBackendRequest, 'type'>;
export type ExtensionHostRunSelfTestInput = Omit<ExtensionHostRunSelfTestRequest, 'type'>;
export type ExtensionHostStartStartupActionsInput = Omit<ExtensionHostStartStartupActionsRequest, 'type'>;

export interface ExtensionHostClient {
  health(): Promise<{ status: 'ready' }>;
  checkBackendHealth(): Promise<ExtensionHostBackendOperationResult[]>;
  invokeAction(input: ExtensionHostInvokeActionInput): Promise<ExtensionHostActionInvokeResult>;
  invokeProtocolEntrypoint(input: ExtensionHostInvokeProtocolEntrypointInput): Promise<void>;
  invokeRoute(input: ExtensionHostInvokeRouteInput): Promise<ExtensionHostRouteResponse>;
  listActionTelemetry(extensionId?: string): Promise<ExtensionHostActionTelemetryEntry[]>;
  reloadBackend(input: ExtensionHostReloadBackendInput): Promise<ExtensionHostReloadBackendResult>;
  runSelfTest(input: ExtensionHostRunSelfTestInput): Promise<ExtensionHostSelfTestResult>;
  startStartupActions(input?: ExtensionHostStartStartupActionsInput): Promise<ExtensionHostBackendOperationResult[]>;
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

export function createInProcessExtensionHostClient(): ExtensionHostClient {
  return {
    async health() {
      const response = await handleInProcessExtensionHostRequest({ type: 'health' });
      if (!response.ok) throw new Error(response.error);
      if (!('status' in response)) throw new Error('Extension host returned an invalid health response.');
      return { status: response.status };
    },
    async checkBackendHealth() {
      const response = await handleInProcessExtensionHostRequest({ type: 'checkBackendHealth' });
      if (!response.ok) throw new Error(response.error);
      if (!('results' in response)) throw new Error('Extension host returned an invalid backend health response.');
      return response.results;
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
    async invokeProtocolEntrypoint(input) {
      const response = await handleInProcessExtensionHostRequest({ type: 'invokeProtocolEntrypoint', ...input });
      if (!response.ok) throw new Error(response.error);
      if (!('invoked' in response)) throw new Error('Extension host returned an invalid protocol entrypoint response.');
    },
    async invokeRoute(input) {
      const response = await handleInProcessExtensionHostRequest({ type: 'invokeRoute', ...input });
      if (!response.ok) throw new Error(response.error);
      if (!('route' in response)) throw new Error('Extension host returned an invalid route response.');
      return response.route;
    },
    async listActionTelemetry(extensionId) {
      const response = await handleInProcessExtensionHostRequest({
        type: 'listActionTelemetry',
        ...(extensionId ? { extensionId } : {}),
      });
      if (!response.ok) throw new Error(response.error);
      if (!('telemetry' in response)) throw new Error('Extension host returned an invalid telemetry response.');
      return response.telemetry;
    },
    async reloadBackend(input) {
      const response = await handleInProcessExtensionHostRequest({ type: 'reloadBackend', ...input });
      if (!response.ok) throw new Error(response.error);
      if (!('reload' in response)) throw new Error('Extension host returned an invalid reload response.');
      return response.reload;
    },
    async runSelfTest(input) {
      const response = await handleInProcessExtensionHostRequest({ type: 'runSelfTest', ...input });
      if (!response.ok) throw new Error(response.error);
      if (!('selfTest' in response)) throw new Error('Extension host returned an invalid self-test response.');
      return response.selfTest;
    },
    async startStartupActions(input) {
      const response = await handleInProcessExtensionHostRequest({ type: 'startStartupActions', ...(input ?? {}) });
      if (!response.ok) throw new Error(response.error);
      if (!('results' in response)) throw new Error('Extension host returned an invalid startup actions response.');
      return response.results;
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
      const [{ createExtensionBackendServerContextFromSnapshot }, { createExtensionBackendToolContextFromSnapshot }] = await Promise.all([
        import('./extensionHostServerContext.js'),
        import('./extensionHostToolContext.js'),
      ]);
      return {
        ok: true,
        result: await invokeExtensionAction(
          request.extensionId,
          request.actionId,
          request.input,
          asExtensionBackendServerContext(
            request.serverContext ?? createExtensionBackendServerContextFromSnapshot(request.serverContextSnapshot),
          ),
          request.toolContext ?? createExtensionBackendToolContextFromSnapshot(request.toolContextSnapshot),
          request.agentToolContext,
        ),
      };
    }
    if (request.type === 'invokeProtocolEntrypoint') {
      const [{ invokeExtensionProtocolEntrypoint }, { createExtensionBackendServerContextFromSnapshot }] = await Promise.all([
        import('./extensionBackend.js'),
        import('./extensionHostServerContext.js'),
      ]);
      await invokeExtensionProtocolEntrypoint(request.protocolId, request.input, {
        serverContext: asExtensionBackendServerContext(
          request.serverContext ?? createExtensionBackendServerContextFromSnapshot(request.serverContextSnapshot),
        ),
        stdio: request.stdio,
        signal: request.signal,
      });
      return { ok: true, invoked: true };
    }
    if (request.type === 'checkBackendHealth') {
      const { checkEnabledExtensionBackendHealth } = await import('./extensionBackend.js');
      return { ok: true, results: await checkEnabledExtensionBackendHealth() };
    }
    if (request.type === 'invokeRoute') {
      const [{ invokeExtensionRoute }, { createExtensionBackendServerContextFromSnapshot }] = await Promise.all([
        import('./extensionBackend.js'),
        import('./extensionHostServerContext.js'),
      ]);
      return {
        ok: true,
        route: await invokeExtensionRoute(
          request.extensionId,
          request.method,
          request.routePath,
          request.request,
          asExtensionBackendServerContext(
            request.serverContext ?? createExtensionBackendServerContextFromSnapshot(request.serverContextSnapshot),
          ),
        ),
      };
    }
    if (request.type === 'listActionTelemetry') {
      const { listExtensionActionTelemetry } = await import('./extensionBackend.js');
      return { ok: true, telemetry: listExtensionActionTelemetry(request.extensionId) };
    }
    if (request.type === 'reloadBackend') {
      const { reloadExtensionBackend } = await import('./extensionBackend.js');
      return { ok: true, reload: await reloadExtensionBackend(request.extensionId) };
    }
    if (request.type === 'runSelfTest') {
      const { runExtensionSelfTest } = await import('./extensionBackend.js');
      return { ok: true, selfTest: await runExtensionSelfTest(request.extensionId) };
    }
    if (request.type === 'startStartupActions') {
      const [{ startExtensionStartupActions }, { createExtensionBackendServerContextFromSnapshot }] = await Promise.all([
        import('./extensionBackend.js'),
        import('./extensionHostServerContext.js'),
      ]);
      return {
        ok: true,
        results: await startExtensionStartupActions(
          asExtensionBackendServerContext(
            request.serverContext ?? createExtensionBackendServerContextFromSnapshot(request.serverContextSnapshot),
          ),
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

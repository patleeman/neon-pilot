import type { ExtensionBackendServerContext } from './extensionBackend.js';
import type {
  ExtensionHostActionInvokeResult,
  ExtensionHostActionTelemetryEntry,
  ExtensionHostBackendOperationResult,
  ExtensionHostBackendServerContext,
  ExtensionHostInstallSubscriptionsRequest,
  ExtensionHostInvokeActionRequest,
  ExtensionHostInvokeProtocolEntrypointRequest,
  ExtensionHostInvokeRouteRequest,
  ExtensionHostPromptAssemblyContributions,
  ExtensionHostReloadBackendRequest,
  ExtensionHostReloadBackendResult,
  ExtensionHostRequest,
  ExtensionHostResponse,
  ExtensionHostRouteResponse,
  ExtensionHostRunningService,
  ExtensionHostRunSelfTestRequest,
  ExtensionHostSelfTestResult,
  ExtensionHostServiceOperationResult,
  ExtensionHostStartServicesRequest,
  ExtensionHostStartStartupActionsRequest,
  ExtensionHostStaticContributions,
} from './extensionHostProtocol.js';

function asExtensionBackendServerContext(
  context: ExtensionHostBackendServerContext | undefined,
): ExtensionBackendServerContext | undefined {
  return context as ExtensionBackendServerContext | undefined;
}

export type ExtensionHostInvokeActionInput = Omit<ExtensionHostInvokeActionRequest, 'type'>;
export type ExtensionHostInstallSubscriptionsInput = Omit<ExtensionHostInstallSubscriptionsRequest, 'type'>;
export type ExtensionHostInvokeProtocolEntrypointInput = Omit<ExtensionHostInvokeProtocolEntrypointRequest, 'type'>;
export type ExtensionHostInvokeRouteInput = Omit<ExtensionHostInvokeRouteRequest, 'type'>;
export type ExtensionHostReloadBackendInput = Omit<ExtensionHostReloadBackendRequest, 'type'>;
export type ExtensionHostRunSelfTestInput = Omit<ExtensionHostRunSelfTestRequest, 'type'>;
export type ExtensionHostStartServicesInput = Omit<ExtensionHostStartServicesRequest, 'type'>;
export type ExtensionHostStartStartupActionsInput = Omit<ExtensionHostStartStartupActionsRequest, 'type'>;

export interface ExtensionHostClient {
  health(): Promise<{ status: 'ready' }>;
  checkBackendHealth(): Promise<ExtensionHostBackendOperationResult[]>;
  invokeAction(input: ExtensionHostInvokeActionInput): Promise<ExtensionHostActionInvokeResult>;
  installSubscriptions(input: ExtensionHostInstallSubscriptionsInput): Promise<void>;
  uninstallSubscriptions(extensionId: string): Promise<void>;
  listServices(): Promise<ExtensionHostRunningService[]>;
  startServices(input?: ExtensionHostStartServicesInput): Promise<ExtensionHostServiceOperationResult[]>;
  stopServices(extensionId: string): Promise<void>;
  listPromptAssemblyContributions(): Promise<ExtensionHostPromptAssemblyContributions>;
  listStaticContributions(): Promise<ExtensionHostStaticContributions>;
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
  if (!configuredExtensionHostClient) {
    throw new Error('Extension host client is not configured. Product runtime must connect to the extension host RPC process.');
  }
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
    async installSubscriptions(input) {
      const response = await handleInProcessExtensionHostRequest({ type: 'installSubscriptions', ...input });
      if (!response.ok) throw new Error(response.error);
      if (!('subscriptionsUpdated' in response)) throw new Error('Extension host returned an invalid subscription response.');
    },
    async uninstallSubscriptions(extensionId) {
      const response = await handleInProcessExtensionHostRequest({ type: 'uninstallSubscriptions', extensionId });
      if (!response.ok) throw new Error(response.error);
      if (!('subscriptionsUpdated' in response)) throw new Error('Extension host returned an invalid subscription response.');
    },
    async listServices() {
      const response = await handleInProcessExtensionHostRequest({ type: 'listServices' });
      if (!response.ok) throw new Error(response.error);
      if (!('services' in response)) throw new Error('Extension host returned an invalid service list response.');
      return response.services;
    },
    async startServices(input) {
      const response = await handleInProcessExtensionHostRequest({ type: 'startServices', ...(input ?? {}) });
      if (!response.ok) throw new Error(response.error);
      if (!('serviceResults' in response)) throw new Error('Extension host returned an invalid service start response.');
      return response.serviceResults;
    },
    async stopServices(extensionId) {
      const response = await handleInProcessExtensionHostRequest({ type: 'stopServices', extensionId });
      if (!response.ok) throw new Error(response.error);
      if (!('servicesStopped' in response)) throw new Error('Extension host returned an invalid service stop response.');
    },
    async listPromptAssemblyContributions() {
      const response = await handleInProcessExtensionHostRequest({ type: 'listPromptAssemblyContributions' });
      if (!response.ok) throw new Error(response.error);
      if (!('promptAssemblyContributions' in response)) throw new Error('Extension host returned invalid prompt assembly contributions.');
      return response.promptAssemblyContributions;
    },
    async listStaticContributions() {
      const response = await handleInProcessExtensionHostRequest({ type: 'listStaticContributions' });
      if (!response.ok) throw new Error(response.error);
      if (!('staticContributions' in response)) throw new Error('Extension host returned invalid static contributions.');
      return response.staticContributions;
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
    if (request.type === 'publishEvent') {
      await publishExtensionHostEvent(request.source, request.payload);
      return { ok: true, published: true };
    }
    if (request.type === 'installSubscriptions') {
      const [{ installSubscriptionsForExtension }, { createExtensionBackendServerContextFromSnapshot }] = await Promise.all([
        import('./extensionSubscriptions.js'),
        import('./extensionHostServerContext.js'),
      ]);
      await installSubscriptionsForExtension(
        request.extensionId,
        asExtensionBackendServerContext(request.serverContext ?? createExtensionBackendServerContextFromSnapshot(request.serverContextSnapshot)),
      );
      return { ok: true, subscriptionsUpdated: true };
    }
    if (request.type === 'listServices') {
      const { listRunningExtensionServices } = await import('./extensionServices.js');
      return { ok: true, services: listRunningExtensionServices().map(({ extensionId, serviceId, startedAt, lastError }) => ({ extensionId, serviceId, startedAt, lastError })) };
    }
    if (request.type === 'startServices') {
      const [{ startExtensionServices }, { createExtensionBackendServerContextFromSnapshot }] = await Promise.all([
        import('./extensionServices.js'),
        import('./extensionHostServerContext.js'),
      ]);
      return {
        ok: true,
        serviceResults: await startExtensionServices(
          asExtensionBackendServerContext(
            request.serverContext ?? createExtensionBackendServerContextFromSnapshot(request.serverContextSnapshot),
          ),
        ),
      };
    }
    if (request.type === 'stopServices') {
      const { stopExtensionServices } = await import('./extensionServices.js');
      await stopExtensionServices(request.extensionId);
      return { ok: true, servicesStopped: true };
    }
    if (request.type === 'listPromptAssemblyContributions') {
      const {
        listExtensionAssemblyProviderRegistrations,
        listExtensionPromptAssemblyHookRegistrations,
        listExtensionPromptContextProviderRegistrations,
      } = await import('./extensionRegistry.js');
      return {
        ok: true,
        promptAssemblyContributions: {
          contextProviders: listExtensionPromptContextProviderRegistrations(),
          assemblyProviders: listExtensionAssemblyProviderRegistrations(),
          hooks: listExtensionPromptAssemblyHookRegistrations(),
        },
      };
    }
    if (request.type === 'listStaticContributions') {
      const { listExtensionSkillRegistrations, listExtensionToolRegistrations } = await import('./extensionRegistry.js');
      return {
        ok: true,
        staticContributions: {
          tools: listExtensionToolRegistrations(),
          skills: listExtensionSkillRegistrations(),
        },
      };
    }
    const { uninstallExtensionSubscriptions } = await import('./extensionSubscriptions.js');
    uninstallExtensionSubscriptions(request.extensionId);
    return { ok: true, subscriptionsUpdated: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

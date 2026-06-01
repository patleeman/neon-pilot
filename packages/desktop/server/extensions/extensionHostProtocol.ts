import type { ExtensionHostServerContextSnapshot } from './extensionHostServerContext.js';
import type { ExtensionHostToolContextSnapshot } from './extensionHostToolContext.js';

export type ExtensionHostActionInvokeResult = { ok: true; result: unknown } | { ok: false; error: string };

export interface ExtensionHostBackendServerContext {
  getRuntimeScope(): string;
  buildLiveSessionResourceOptions?: (profile: string) => unknown;
  getRepoRoot?: () => string;
  getSettingsFile?: () => string;
  materializeWebRuntimeConfig?: (profile: string) => unknown;
  getAuthFile?: () => string;
  getStateRoot?: () => string;
}

export interface ExtensionHostToolContext {
  conversationId?: string;
  cwd?: string;
  sessionFile?: string;
  sessionId?: string;
  preferredVisionModel?: string;
  onUpdate?: (update: { content?: Array<{ type: string; text: string }>; isError?: boolean }) => void;
}

export interface ExtensionHostProtocolStdio {
  stdin: NodeJS.ReadableStream;
  stdout: NodeJS.WritableStream;
  stderr: NodeJS.WritableStream;
}

export interface ExtensionHostRouteRequest {
  method: string;
  path: string;
  query: Record<string, string | string[]>;
  params: Record<string, string>;
  body?: unknown;
  signal?: AbortSignal;
}

export interface ExtensionHostRouteSseEvent {
  event?: string;
  data?: unknown;
  id?: string;
  retry?: number;
}

export interface ExtensionHostRouteResponse {
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
  stream?: 'sse';
  events?: AsyncIterable<ExtensionHostRouteSseEvent>;
}

export interface ExtensionHostActionTelemetryEntry {
  extensionId: string;
  actionId: string;
  ok: boolean;
  durationMs: number;
  at: string;
  error?: string;
}

export interface ExtensionHostRunningService {
  extensionId: string;
  serviceId: string;
  startedAt: string;
  lastError?: string;
}

export interface ExtensionHostEventSubscription {
  extensionId: string;
  pattern: string;
}

export interface ExtensionHostServiceOperationResult {
  extensionId: string;
  serviceId: string;
  ok: boolean;
  error?: string;
}

export interface ExtensionHostPromptContextProviderRegistration {
  extensionId: string;
  id: string;
  packageType: 'system' | 'user';
  handler: string;
  title?: string;
  priority?: number;
  scope?: Array<'global' | 'workspace' | 'conversation'>;
}

export interface ExtensionHostAssemblyProviderRegistration {
  extensionId: string;
  id: string;
  packageType: 'system' | 'user';
  handler: string;
  title?: string;
  priority?: number;
  kind: 'skills' | 'tools' | 'promptTemplates' | 'instructions';
}

export interface ExtensionHostPromptAssemblyHookRegistration {
  extensionId: string;
  id: string;
  packageType: 'system' | 'user';
  handler: string;
  title?: string;
  priority?: number;
  phase: 'after-discovery' | 'before-policy' | 'after-policy' | 'before-injection' | 'after-assembly';
}

export interface ExtensionHostPromptAssemblyContributions {
  contextProviders: ExtensionHostPromptContextProviderRegistration[];
  assemblyProviders: ExtensionHostAssemblyProviderRegistration[];
  hooks: ExtensionHostPromptAssemblyHookRegistration[];
}

export interface ExtensionHostToolRegistration {
  extensionId: string;
  packageType: 'system' | 'user';
  id: string;
  name: string;
  action: string;
  title?: string;
  label?: string;
  description: string;
  inputSchema: Record<string, unknown>;
  promptSnippet?: string;
  promptGuidelines?: string[];
  priority?: number;
  when?: {
    providers?: string[];
    models?: string[];
  };
  replaces?: string;
  nativeRegistration?: boolean;
}

export interface ExtensionHostSkillRegistration {
  extensionId: string;
  packageType: 'system' | 'user';
  id: string;
  name: string;
  title?: string;
  description?: string;
  path: string;
  packageRoot: string;
}

export interface ExtensionHostModelDiscoveryRegistration {
  extensionId: string;
  action: string;
}

export type ExtensionHostModelProfileResolution =
  | { kind: 'none' }
  | { kind: 'resolved'; profile: Record<string, unknown> }
  | { kind: 'ambiguous'; profiles: Array<Record<string, unknown>> };

export interface ExtensionHostStaticContributions {
  tools: ExtensionHostToolRegistration[];
  skills: ExtensionHostSkillRegistration[];
  modelDiscovery: ExtensionHostModelDiscoveryRegistration[];
}

export interface ExtensionHostRegistryPresentation {
  schema: Record<string, unknown>;
  installSummaries: Array<Record<string, unknown>>;
  commandRegistrations: Array<Record<string, unknown>>;
  keybindingRegistrations: Array<Record<string, unknown>>;
  slashCommandRegistrations: Array<Record<string, unknown>>;
  mentionRegistrations: Array<Record<string, unknown>>;
  quickOpenRegistrations: Array<Record<string, unknown>>;
  searchProviderRegistrations: Array<Record<string, unknown>>;
  snapshot: {
    extensions: Array<Record<string, unknown>>;
    routes: Array<Record<string, unknown>>;
    surfaces: Array<Record<string, unknown>>;
    views: Array<Record<string, unknown>>;
  } & Record<string, unknown>;
}

export interface ExtensionHostHealthRequest {
  type: 'health';
}

export interface ExtensionHostInvokeActionRequest {
  type: 'invokeAction';
  extensionId: string;
  actionId: string;
  input: unknown;
  serverContext?: ExtensionHostBackendServerContext;
  serverContextSnapshot?: ExtensionHostServerContextSnapshot;
  toolContext?: ExtensionHostToolContext;
  toolContextSnapshot?: ExtensionHostToolContextSnapshot;
  agentToolContext?: unknown;
  signal?: AbortSignal;
}

export interface ExtensionHostPublishEventRequest {
  type: 'publishEvent';
  source: string;
  payload: unknown;
}

export interface ExtensionHostInstallSubscriptionsRequest {
  type: 'installSubscriptions';
  extensionId: string;
  serverContext?: ExtensionHostBackendServerContext;
  serverContextSnapshot?: ExtensionHostServerContextSnapshot;
}

export interface ExtensionHostUninstallSubscriptionsRequest {
  type: 'uninstallSubscriptions';
  extensionId: string;
}

export interface ExtensionHostListServicesRequest {
  type: 'listServices';
}

export interface ExtensionHostStartServicesRequest {
  type: 'startServices';
  serverContext?: ExtensionHostBackendServerContext;
  serverContextSnapshot?: ExtensionHostServerContextSnapshot;
}

export interface ExtensionHostStopServicesRequest {
  type: 'stopServices';
  extensionId: string;
}

export interface ExtensionHostListPromptAssemblyContributionsRequest {
  type: 'listPromptAssemblyContributions';
}

export interface ExtensionHostListStaticContributionsRequest {
  type: 'listStaticContributions';
}

export interface ExtensionHostListEventSubscriptionsRequest {
  type: 'listEventSubscriptions';
}

export interface ExtensionHostReadRegistryPresentationRequest {
  type: 'readRegistryPresentation';
}

export interface ExtensionHostResolveModelProfileRequest {
  type: 'resolveModelProfile';
  provider: string;
  model: string;
}

export interface ExtensionHostResolveFilePathRequest {
  type: 'resolveFilePath';
  extensionId: string;
  relativePath: string;
}

export interface ExtensionHostInvokeProtocolEntrypointRequest {
  type: 'invokeProtocolEntrypoint';
  protocolId: string;
  input: unknown;
  serverContext?: ExtensionHostBackendServerContext;
  serverContextSnapshot?: ExtensionHostServerContextSnapshot;
  stdio: ExtensionHostProtocolStdio;
  signal: AbortSignal;
}

export interface ExtensionHostCheckBackendHealthRequest {
  type: 'checkBackendHealth';
}

export interface ExtensionHostBeginStartupGuardRequest {
  type: 'beginStartupGuard';
}

export interface ExtensionHostCompleteStartupGuardRequest {
  type: 'completeStartupGuard';
}

export interface ExtensionHostStartStartupActionsRequest {
  type: 'startStartupActions';
  serverContext?: ExtensionHostBackendServerContext;
  serverContextSnapshot?: ExtensionHostServerContextSnapshot;
}

export interface ExtensionHostBackendOperationResult {
  extensionId: string;
  ok: boolean;
  error?: string;
}

export interface ExtensionHostInvokeRouteRequest {
  type: 'invokeRoute';
  extensionId: string;
  method: string;
  routePath: string;
  request: ExtensionHostRouteRequest;
  serverContext?: ExtensionHostBackendServerContext;
  serverContextSnapshot?: ExtensionHostServerContextSnapshot;
}

export interface ExtensionHostListActionTelemetryRequest {
  type: 'listActionTelemetry';
  extensionId?: string;
}

export interface ExtensionHostRunSelfTestRequest {
  type: 'runSelfTest';
  extensionId: string;
}

export interface ExtensionHostReloadBackendRequest {
  type: 'reloadBackend';
  extensionId: string;
}

export interface ExtensionHostSetKeybindingRequest {
  type: 'setKeybinding';
  extensionId: string;
  keybindingId: string;
  title?: string;
  command?: string;
  args?: unknown;
  scope?: 'global' | 'surface';
  packageType?: 'system' | 'user';
  keys?: string[];
  enabled?: boolean;
  reset?: boolean;
}

export interface ExtensionHostSetEnabledRequest {
  type: 'setEnabled';
  extensionId: string;
  enabled: boolean;
  serverContext?: ExtensionHostBackendServerContext;
  serverContextSnapshot?: ExtensionHostServerContextSnapshot;
  signal?: AbortSignal;
}

export interface ExtensionHostSelfTestResult {
  ok: boolean;
  extensionId: string;
  checks: Array<{ name: string; ok: boolean; error?: string }>;
}

export interface ExtensionHostReloadBackendResult {
  ok: true;
  extensionId: string;
  rebuilt: boolean;
}

export interface ExtensionHostSetEnabledResult {
  ok: boolean;
  extension?: Record<string, unknown>;
  actionResult?: ExtensionHostActionInvokeResult;
  error?: string;
  status?: number;
}

export interface ExtensionHostStartupGuardResult {
  safeMode: boolean;
  disabledIds: string[];
}

export type ExtensionHostRequest =
  | ExtensionHostHealthRequest
  | ExtensionHostInvokeActionRequest
  | ExtensionHostPublishEventRequest
  | ExtensionHostInstallSubscriptionsRequest
  | ExtensionHostUninstallSubscriptionsRequest
  | ExtensionHostListServicesRequest
  | ExtensionHostStartServicesRequest
  | ExtensionHostStopServicesRequest
  | ExtensionHostListPromptAssemblyContributionsRequest
  | ExtensionHostListStaticContributionsRequest
  | ExtensionHostListEventSubscriptionsRequest
  | ExtensionHostReadRegistryPresentationRequest
  | ExtensionHostResolveModelProfileRequest
  | ExtensionHostResolveFilePathRequest
  | ExtensionHostInvokeProtocolEntrypointRequest
  | ExtensionHostCheckBackendHealthRequest
  | ExtensionHostBeginStartupGuardRequest
  | ExtensionHostCompleteStartupGuardRequest
  | ExtensionHostStartStartupActionsRequest
  | ExtensionHostInvokeRouteRequest
  | ExtensionHostListActionTelemetryRequest
  | ExtensionHostRunSelfTestRequest
  | ExtensionHostReloadBackendRequest
  | ExtensionHostSetKeybindingRequest
  | ExtensionHostSetEnabledRequest;

export interface ExtensionHostHealthResponse {
  ok: true;
  status: 'ready';
}

export type ExtensionHostResponse =
  | ExtensionHostHealthResponse
  | {
      ok: true;
      result: ExtensionHostActionInvokeResult;
    }
  | {
      ok: true;
      published: true;
    }
  | {
      ok: true;
      subscriptionsUpdated: true;
    }
  | {
      ok: true;
      services: ExtensionHostRunningService[];
    }
  | {
      ok: true;
      serviceResults: ExtensionHostServiceOperationResult[];
    }
  | {
      ok: true;
      servicesStopped: true;
    }
  | {
      ok: true;
      promptAssemblyContributions: ExtensionHostPromptAssemblyContributions;
    }
  | {
      ok: true;
      staticContributions: ExtensionHostStaticContributions;
    }
  | {
      ok: true;
      eventSubscriptions: ExtensionHostEventSubscription[];
    }
  | {
      ok: true;
      registryPresentation: ExtensionHostRegistryPresentation;
    }
  | {
      ok: true;
      modelProfile: ExtensionHostModelProfileResolution;
    }
  | {
      ok: true;
      filePath: string;
    }
  | {
      ok: true;
      invoked: true;
    }
  | {
      ok: true;
      results: ExtensionHostBackendOperationResult[];
    }
  | {
      ok: true;
      startupGuard: ExtensionHostStartupGuardResult;
    }
  | {
      ok: true;
      startupGuardCompleted: true;
    }
  | {
      ok: true;
      route: ExtensionHostRouteResponse;
    }
  | {
      ok: true;
      telemetry: ExtensionHostActionTelemetryEntry[];
    }
  | {
      ok: true;
      selfTest: ExtensionHostSelfTestResult;
    }
  | {
      ok: true;
      reload: ExtensionHostReloadBackendResult;
    }
  | {
      ok: true;
      keybindingUpdated: true;
    }
  | {
      ok: true;
      enabledResult: ExtensionHostSetEnabledResult;
    }
  | {
      ok: false;
      error: string;
    };

export function extensionHostRequestName(request: ExtensionHostRequest): string {
  if (request.type === 'invokeAction') return `invokeAction:${request.extensionId}/${request.actionId}`;
  if (request.type === 'invokeProtocolEntrypoint') return `invokeProtocolEntrypoint:${request.protocolId}`;
  if (request.type === 'publishEvent') return `publishEvent:${request.source}`;
  if (request.type === 'installSubscriptions') return `installSubscriptions:${request.extensionId}`;
  if (request.type === 'uninstallSubscriptions') return `uninstallSubscriptions:${request.extensionId}`;
  if (request.type === 'listServices') return 'listServices';
  if (request.type === 'startServices') return 'startServices';
  if (request.type === 'stopServices') return `stopServices:${request.extensionId}`;
  if (request.type === 'listPromptAssemblyContributions') return 'listPromptAssemblyContributions';
  if (request.type === 'listStaticContributions') return 'listStaticContributions';
  if (request.type === 'listEventSubscriptions') return 'listEventSubscriptions';
  if (request.type === 'readRegistryPresentation') return 'readRegistryPresentation';
  if (request.type === 'resolveModelProfile') return `resolveModelProfile:${request.provider}/${request.model}`;
  if (request.type === 'resolveFilePath') return `resolveFilePath:${request.extensionId}/${request.relativePath}`;
  if (request.type === 'checkBackendHealth') return 'checkBackendHealth';
  if (request.type === 'beginStartupGuard') return 'beginStartupGuard';
  if (request.type === 'completeStartupGuard') return 'completeStartupGuard';
  if (request.type === 'startStartupActions') return 'startStartupActions';
  if (request.type === 'invokeRoute') return `invokeRoute:${request.extensionId}:${request.method}:${request.routePath}`;
  if (request.type === 'listActionTelemetry') return 'listActionTelemetry';
  if (request.type === 'runSelfTest') return `runSelfTest:${request.extensionId}`;
  if (request.type === 'reloadBackend') return `reloadBackend:${request.extensionId}`;
  if (request.type === 'setKeybinding') return `setKeybinding:${request.extensionId}/${request.keybindingId}`;
  if (request.type === 'setEnabled') return `setEnabled:${request.extensionId}:${request.enabled ? 'enable' : 'disable'}`;
  return request.type;
}

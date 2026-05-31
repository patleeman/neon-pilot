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
}

export interface ExtensionHostPublishEventRequest {
  type: 'publishEvent';
  source: string;
  payload: unknown;
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

export type ExtensionHostRequest =
  | ExtensionHostHealthRequest
  | ExtensionHostInvokeActionRequest
  | ExtensionHostPublishEventRequest
  | ExtensionHostInvokeProtocolEntrypointRequest
  | ExtensionHostCheckBackendHealthRequest
  | ExtensionHostStartStartupActionsRequest
  | ExtensionHostInvokeRouteRequest
  | ExtensionHostListActionTelemetryRequest
  | ExtensionHostRunSelfTestRequest
  | ExtensionHostReloadBackendRequest;

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
      invoked: true;
    }
  | {
      ok: true;
      results: ExtensionHostBackendOperationResult[];
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
      ok: false;
      error: string;
    };

export function extensionHostRequestName(request: ExtensionHostRequest): string {
  if (request.type === 'invokeAction') return `invokeAction:${request.extensionId}/${request.actionId}`;
  if (request.type === 'invokeProtocolEntrypoint') return `invokeProtocolEntrypoint:${request.protocolId}`;
  if (request.type === 'publishEvent') return `publishEvent:${request.source}`;
  if (request.type === 'checkBackendHealth') return 'checkBackendHealth';
  if (request.type === 'startStartupActions') return 'startStartupActions';
  if (request.type === 'invokeRoute') return `invokeRoute:${request.extensionId}:${request.method}:${request.routePath}`;
  if (request.type === 'listActionTelemetry') return 'listActionTelemetry';
  if (request.type === 'runSelfTest') return `runSelfTest:${request.extensionId}`;
  if (request.type === 'reloadBackend') return `reloadBackend:${request.extensionId}`;
  return request.type;
}

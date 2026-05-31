import type {
  ExtensionActionInvokeResult,
  ExtensionActionTelemetryEntry,
  ExtensionBackendContext,
  ExtensionBackendServerContext,
  ExtensionProtocolContext,
  ExtensionRouteRequest,
  ExtensionRouteResponse,
} from './extensionBackend.js';
import type { ExtensionHostServerContextSnapshot } from './extensionHostServerContext.js';
import type { ExtensionHostToolContextSnapshot } from './extensionHostToolContext.js';

export interface ExtensionHostHealthRequest {
  type: 'health';
}

export interface ExtensionHostInvokeActionRequest {
  type: 'invokeAction';
  extensionId: string;
  actionId: string;
  input: unknown;
  serverContext?: ExtensionBackendServerContext;
  serverContextSnapshot?: ExtensionHostServerContextSnapshot;
  toolContext?: ExtensionBackendContext['toolContext'];
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
  serverContext?: ExtensionBackendServerContext;
  serverContextSnapshot?: ExtensionHostServerContextSnapshot;
  stdio: ExtensionProtocolContext['stdio'];
  signal: AbortSignal;
}

export interface ExtensionHostCheckBackendHealthRequest {
  type: 'checkBackendHealth';
}

export interface ExtensionHostStartStartupActionsRequest {
  type: 'startStartupActions';
  serverContext?: ExtensionBackendServerContext;
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
  request: ExtensionRouteRequest;
  serverContext?: ExtensionBackendServerContext;
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

export type ExtensionHostActionTelemetryEntry = ExtensionActionTelemetryEntry;
export type ExtensionHostRouteResponse = ExtensionRouteResponse;

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
      result: ExtensionActionInvokeResult;
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
      route: ExtensionRouteResponse;
    }
  | {
      ok: true;
      telemetry: ExtensionActionTelemetryEntry[];
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

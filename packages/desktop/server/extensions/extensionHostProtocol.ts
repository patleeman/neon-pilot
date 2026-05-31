import type {
  ExtensionActionInvokeResult,
  ExtensionBackendContext,
  ExtensionBackendServerContext,
  ExtensionProtocolContext,
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

export type ExtensionHostRequest =
  | ExtensionHostHealthRequest
  | ExtensionHostInvokeActionRequest
  | ExtensionHostPublishEventRequest
  | ExtensionHostInvokeProtocolEntrypointRequest;

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
      ok: false;
      error: string;
    };

export function extensionHostRequestName(request: ExtensionHostRequest): string {
  if (request.type === 'invokeAction') return `invokeAction:${request.extensionId}/${request.actionId}`;
  if (request.type === 'invokeProtocolEntrypoint') return `invokeProtocolEntrypoint:${request.protocolId}`;
  if (request.type === 'publishEvent') return `publishEvent:${request.source}`;
  return request.type;
}

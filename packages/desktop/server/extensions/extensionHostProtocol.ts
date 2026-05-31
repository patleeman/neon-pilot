import type { ExtensionBackendContext, ExtensionBackendServerContext, ExtensionActionInvokeResult } from './extensionBackend.js';

export interface ExtensionHostHealthRequest {
  type: 'health';
}

export interface ExtensionHostInvokeActionRequest {
  type: 'invokeAction';
  extensionId: string;
  actionId: string;
  input: unknown;
  serverContext?: ExtensionBackendServerContext;
  toolContext?: ExtensionBackendContext['toolContext'];
  agentToolContext?: unknown;
}

export type ExtensionHostRequest = ExtensionHostHealthRequest | ExtensionHostInvokeActionRequest;

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
      ok: false;
      error: string;
    };

export function extensionHostRequestName(request: ExtensionHostRequest): string {
  return request.type === 'invokeAction' ? `invokeAction:${request.extensionId}/${request.actionId}` : request.type;
}

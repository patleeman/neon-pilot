import type { ExtensionBackendLoadTarget } from './extensionBackendRunner.js';

export interface ExtensionBackendWorkerBackendContextOptions {
  runtimeScope?: string;
  repoRoot?: string;
  runtimeDir?: string;
  runtimeSettingsFilePath?: string;
  authFile?: string;
  stateRoot?: string;
  liveSessionResourceOptions?: Record<string, unknown>;
  toolContext?: {
    conversationId?: string;
    cwd?: string;
    sessionFile?: string;
    sessionId?: string;
    preferredVisionModel?: string;
    updateHandleId?: string;
  };
  agentToolContext?: unknown;
}

export type ExtensionBackendWorkerRequest =
  | {
      id: number;
      type: 'loadModule';
      extensionId: string;
      compiled: ExtensionBackendLoadTarget;
    }
  | {
      id: number;
      type: 'hasExport';
      extensionId: string;
      compiled: ExtensionBackendLoadTarget;
      exportName: string;
    }
  | {
      id: number;
      type: 'runExport';
      extensionId: string;
      compiled: ExtensionBackendLoadTarget;
      exportName: string;
      args: unknown[];
      timeoutMs?: number;
      context?: 'backend' | ({ type: 'backend' } & ExtensionBackendWorkerBackendContextOptions);
    }
  | {
      id: number;
      type: 'clearModule';
      extensionId: string;
    };

export type ExtensionBackendWorkerResponse =
  | {
      id: number;
      ok: true;
      result?: unknown;
    }
  | {
      id: number;
      ok: false;
      error: string;
    };

export interface ExtensionBackendWorkerCapabilityRequest {
  id: number;
  kind: 'capabilityRequest';
  extensionId: string;
  capability: string;
  operation: string;
  input?: unknown;
  context?: ExtensionBackendWorkerBackendContextOptions;
}

export type ExtensionBackendWorkerCapabilityResponse =
  | {
      id: number;
      kind: 'capabilityResponse';
      ok: true;
      result?: unknown;
    }
  | {
      id: number;
      kind: 'capabilityResponse';
      ok: false;
      error: string;
    };

export interface ExtensionBackendWorkerCapabilityEvent {
  kind: 'capabilityEvent';
  extensionId: string;
  capability: string;
  operation: string;
  input?: unknown;
}

export interface ExtensionBackendWorkerRouteStreamCancel {
  kind: 'routeStreamCancel';
  handleId: string;
}

export type ExtensionBackendWorkerRouteStreamEvent =
  | {
      kind: 'routeStreamEvent';
      handleId: string;
      event: unknown;
    }
  | {
      kind: 'routeStreamEvent';
      handleId: string;
      done: true;
    }
  | {
      kind: 'routeStreamEvent';
      handleId: string;
      error: string;
    };

export type ExtensionBackendWorkerMessage =
  | ExtensionBackendWorkerResponse
  | ExtensionBackendWorkerCapabilityRequest
  | ExtensionBackendWorkerRouteStreamEvent;

export type ExtensionBackendWorkerParentMessage =
  | ExtensionBackendWorkerRequest
  | ExtensionBackendWorkerCapabilityResponse
  | ExtensionBackendWorkerCapabilityEvent
  | ExtensionBackendWorkerRouteStreamCancel;

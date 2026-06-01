import type { ExtensionBackendLoadTarget } from './extensionBackendRunner.js';

export interface ExtensionBackendWorkerBackendContextOptions {
  runtimeScope?: string;
  toolContext?: {
    conversationId?: string;
    cwd?: string;
    sessionFile?: string;
    sessionId?: string;
    preferredVisionModel?: string;
  };
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

export type ExtensionBackendWorkerMessage = ExtensionBackendWorkerResponse | ExtensionBackendWorkerCapabilityRequest;

export type ExtensionBackendWorkerParentMessage = ExtensionBackendWorkerRequest | ExtensionBackendWorkerCapabilityResponse;

import type { ExtensionBackendLoadTarget } from './extensionBackendRunner.js';

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

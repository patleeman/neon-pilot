import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { getStateRoot } from '@neon-pilot/core';

import { defaultFileSystemAuthority, type FileAccess, type ScopedFileSystem } from '../filesystem/filesystemAuthority.js';

function workspaceRootId(cwd: string): string {
  return resolve(cwd);
}

type ExtensionFilesystemRootKind = 'workspace' | 'app' | 'cache' | 'temp';

function extensionFileRootPath(extensionId: string, kind: 'app' | 'cache', stateRoot: string = getStateRoot()): string {
  return join(stateRoot, 'extension-data', extensionId, kind === 'app' ? 'files' : 'cache');
}

export function createExtensionFilesystemCapability(extensionId: string, toolContext?: { cwd?: string }) {
  async function requestWorkspace(cwd: string, access: FileAccess[], reason: string): Promise<ScopedFileSystem> {
    return defaultFileSystemAuthority.requestRoot({
      subject: { type: 'extension', extensionId },
      root: { kind: 'workspace', id: workspaceRootId(cwd), path: cwd, displayName: cwd },
      access,
      reason,
    });
  }

  async function requestExtensionRoot(kind: 'app' | 'cache', access: FileAccess[], reason: string): Promise<ScopedFileSystem> {
    const rootPath = extensionFileRootPath(extensionId, kind);
    mkdirSync(rootPath, { recursive: true });
    return defaultFileSystemAuthority.requestRoot({
      subject: { type: 'extension', extensionId },
      root: {
        kind: 'extension-storage',
        id: `${extensionId}:${kind}`,
        path: rootPath,
        displayName: kind === 'app' ? `${extensionId} app files` : `${extensionId} cache`,
        labels: { bucket: kind },
      },
      access,
      reason,
    });
  }

  async function createTemp(input?: { access?: FileAccess[]; reason?: string; prefix?: string }): Promise<ScopedFileSystem> {
    return defaultFileSystemAuthority.createTempRoot({
      subject: { type: 'extension', extensionId },
      access: input?.access ?? ['read', 'write', 'delete', 'list', 'metadata'],
      reason: input?.reason ?? 'extension temp workspace',
      prefix: input?.prefix,
    });
  }

  return {
    async requestRoot(input: {
      kind?: ExtensionFilesystemRootKind;
      cwd?: string;
      access?: FileAccess[];
      reason?: string;
    }): Promise<ScopedFileSystem> {
      const kind = input.kind ?? 'workspace';
      if (kind === 'app')
        return requestExtensionRoot(
          'app',
          input.access ?? ['read', 'write', 'delete', 'list', 'metadata'],
          input.reason ?? 'extension app file access',
        );
      if (kind === 'cache') {
        return requestExtensionRoot(
          'cache',
          input.access ?? ['read', 'write', 'delete', 'list', 'metadata'],
          input.reason ?? 'extension cache file access',
        );
      }
      if (kind === 'temp') return createTemp(input);
      if (kind !== 'workspace') throw new Error(`Unsupported extension filesystem root kind: ${kind}`);
      const cwd = input.cwd ?? toolContext?.cwd;
      if (!cwd) throw new Error('Workspace cwd required.');
      return requestWorkspace(cwd, input.access ?? ['read', 'list', 'metadata'], input.reason ?? 'extension filesystem access');
    },

    async workspace(input?: { cwd?: string; access?: FileAccess[]; reason?: string }): Promise<ScopedFileSystem> {
      const cwd = input?.cwd ?? toolContext?.cwd;
      if (!cwd) throw new Error('Workspace cwd required.');
      return requestWorkspace(cwd, input?.access ?? ['read', 'list', 'metadata'], input?.reason ?? 'extension workspace access');
    },

    async app(input?: { access?: FileAccess[]; reason?: string }): Promise<ScopedFileSystem> {
      return requestExtensionRoot(
        'app',
        input?.access ?? ['read', 'write', 'delete', 'list', 'metadata'],
        input?.reason ?? 'extension app files',
      );
    },

    async cache(input?: { access?: FileAccess[]; reason?: string }): Promise<ScopedFileSystem> {
      return requestExtensionRoot(
        'cache',
        input?.access ?? ['read', 'write', 'delete', 'list', 'metadata'],
        input?.reason ?? 'extension cache files',
      );
    },

    async temp(input?: { access?: FileAccess[]; reason?: string; prefix?: string }): Promise<ScopedFileSystem> {
      return createTemp(input);
    },
  };
}

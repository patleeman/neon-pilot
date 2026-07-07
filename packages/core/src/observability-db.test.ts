import { randomUUID } from 'node:crypto';
import { existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ensureObservabilityDbDir, getObservabilityDbDir, getObservabilityDbPath, resolveObservabilityDbPath } from './observability-db.js';

describe('observability-db', () => {
  const stateRoot = join(tmpdir(), `observability-db-test-${randomUUID()}`);

  beforeEach(() => {
    rmSync(stateRoot, { recursive: true, force: true });
  });

  afterEach(() => {
    rmSync(stateRoot, { recursive: true, force: true });
  });

  describe('legacy stateRoot-based resolution', () => {
    it('resolveObservabilityDbPath returns the canonical db path under state root', () => {
      const path = resolveObservabilityDbPath(stateRoot);
      expect(path).toBe(join(stateRoot, 'observability', 'observability.db'));
    });

    it('resolveObservabilityDbPath falls back to default state root when no argument is given', () => {
      const path = resolveObservabilityDbPath();
      expect(path).toMatch(/observability\.db$/);
    });

    it('ensureObservabilityDbDir creates the database directory', () => {
      const dir = ensureObservabilityDbDir(stateRoot);
      expect(existsSync(dir)).toBe(true);
      expect(dir).toBe(join(stateRoot, 'observability'));
    });

    it('ensureObservabilityDbDir is idempotent when the directory already exists', () => {
      const dir = ensureObservabilityDbDir(stateRoot);
      const dir2 = ensureObservabilityDbDir(stateRoot);
      expect(dir).toBe(dir2);
      expect(existsSync(dir)).toBe(true);
    });
  });

  describe('layout-aware helpers', () => {
    const testLayout = {
      root: '/custom/desktop',
      apps: '/custom/desktop/apps',
      data: '/custom/desktop/data',
      dataApps: '/custom/desktop/data/apps',
      dataDocuments: '/custom/desktop/data/documents',
      dataExports: '/custom/desktop/data/exports',
      documents: '/custom/desktop/documents',
      agents: '/custom/desktop/agents',
      soulDoc: '/custom/desktop/agents/soul.md',
      logs: '/custom/desktop/logs',
      logsDesktop: '/custom/desktop/logs/desktop',
      logsDaemon: '/custom/desktop/logs/daemon',
      logsTelemetry: '/custom/desktop/logs/telemetry',
      system: '/custom/desktop/system',
      systemAgents: '/custom/desktop/system/agents',
      systemApps: '/custom/desktop/system/apps',
      systemCache: '/custom/desktop/system/cache',
      systemConfig: '/custom/desktop/system/config',
      systemConversations: '/custom/desktop/system/conversations',
      systemConversationsIndex: '/custom/desktop/system/conversations/session-meta-index.json',
      systemSessions: '/custom/desktop/system/conversations/sessions',
      systemDaemon: '/custom/desktop/system/daemon',
      systemElectron: '/custom/desktop/system/electron',
      systemElectronUserData: '/custom/desktop/system/electron/user-data',
      systemObservability: '/custom/desktop/system/observability',
      systemRuntime: '/custom/desktop/system/runtime',
      systemChatWorkspaces: '/custom/desktop/system/runtime/chat-workspaces',
      systemSecrets: '/custom/desktop/system/secrets',
      systemState: '/custom/desktop/system/state',
    };

    it('getObservabilityDbDir returns layout.systemObservability when layout is provided', () => {
      expect(getObservabilityDbDir(testLayout)).toBe('/custom/desktop/system/observability');
    });

    it('getObservabilityDbDir falls back to stateRoot-based path when no layout is provided', () => {
      const result = getObservabilityDbDir();
      expect(result).toMatch(/observability$/);
    });

    it('getObservabilityDbPath returns layout-derived db path when layout is provided', () => {
      expect(getObservabilityDbPath(testLayout)).toBe('/custom/desktop/system/observability/observability.db');
    });

    it('getObservabilityDbPath falls back to stateRoot-based path when no layout is provided', () => {
      const result = getObservabilityDbPath();
      expect(result).toMatch(/observability\.db$/);
    });

    it('getObservabilityDbPath matches the legacy path when neither layout nor stateRoot is provided', () => {
      // Both should resolve to the same default state root
      expect(getObservabilityDbPath().endsWith('observability/observability.db')).toBe(true);
    });
  });
});

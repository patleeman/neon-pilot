/**
 * Tests for legacy session discoverability when layout-aware sessions dir
 * differs from the default durable sessions dir.
 *
 * These tests verify that scanSessionMetas / listSessions finds sessions
 * in BOTH the primary (layout) sessions dir and the legacy default durable
 * sessions dir when the layout context is active.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// sessions.ts resolves the default durable sessions dir from getDurableSessionsDir().
// We pre-create a temp legacy dir here so tests can write legacy sessions into it.

const core = vi.hoisted(() => {
  const { mkdtempSync } = require('node:fs');
  const { tmpdir } = require('node:os');
  const { join } = require('node:path');
  const legacyDir = mkdtempSync(join(tmpdir(), 'neon-pilot-legacy-default-'));
  const runtimeDir = mkdtempSync(join(tmpdir(), 'neon-pilot-legacy-rt-'));
  return {
    legacyDir,
    runtimeDir,
    getDurableSessionsDir: vi.fn(() => legacyDir),
    getPiAgentRuntimeDir: vi.fn(() => runtimeDir),
    getRuntimeSessionsIndexFilePath: vi.fn(
      (layout?: { systemConversationsIndex?: string }) => layout?.systemConversationsIndex ?? join(runtimeDir, 'session-meta-index.json'),
    ),
    getStateRoot: vi.fn(() => legacyDir),
  };
});

const originalEnv = process.env;
const sharedLegacyDir = core.legacyDir;
const sharedRuntimeDir = core.runtimeDir;
const tempDirsToClean: string[] = [];

vi.mock('@neon-pilot/core', () => ({
  getDurableSessionsDir: core.getDurableSessionsDir,
  getPiAgentRuntimeDir: core.getPiAgentRuntimeDir,
  getRuntimeSessionsIndexFilePath: core.getRuntimeSessionsIndexFilePath,
  getStateRoot: core.getStateRoot,
}));

import { setSessionPathsContext } from './sessionPaths.js';
import { clearSessionCaches, listSessions, readSessionMeta, readSessionSearchText } from './sessions.js';

function createTempSessionsDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'neon-pilot-legacy-sessions-'));
  tempDirsToClean.push(dir);
  return dir;
}

function writeSessionFile(sessionsDir: string, sessionId: string, title: string, cwd = '/tmp/project'): string {
  const dir = join(sessionsDir, '--tmp-project--');
  mkdirSync(dir, { recursive: true });
  const filePath = join(dir, `${sessionId}.jsonl`);
  const lines = [
    JSON.stringify({ type: 'session', id: sessionId, timestamp: '2026-07-01T00:00:00.000Z', cwd }),
    JSON.stringify({ type: 'model_change', modelId: 'test-model' }),
    JSON.stringify({
      type: 'message',
      id: `${sessionId}-user-1`,
      parentId: null,
      timestamp: '2026-07-01T00:00:00.000Z',
      message: { role: 'user', content: [{ type: 'text', text: title }] },
    }),
    JSON.stringify({
      type: 'message',
      id: `${sessionId}-assistant-1`,
      parentId: `${sessionId}-user-1`,
      timestamp: '2026-07-01T00:00:01.000Z',
      message: { role: 'assistant', content: [{ type: 'text', text: 'Reply' }] },
    }),
  ];
  writeFileSync(filePath, lines.join('\n') + '\n');
  return filePath;
}

describe('legacy session discoverability', () => {
  let layoutDir: string;

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
    clearSessionCaches();
    rmSync(sharedLegacyDir, { recursive: true, force: true });
    mkdirSync(sharedLegacyDir, { recursive: true });

    layoutDir = createTempSessionsDir();

    core.getDurableSessionsDir.mockReturnValue(sharedLegacyDir);
    core.getStateRoot.mockReturnValue(sharedLegacyDir);

    const mockLayout = {
      root: layoutDir,
      data: join(layoutDir, 'data'),
      dataExports: join(layoutDir, 'data', 'exports'),
      dataApps: join(layoutDir, 'data', 'apps'),
      dataDocuments: join(layoutDir, 'data', 'documents'),
      documents: join(layoutDir, 'documents'),
      apps: join(layoutDir, 'apps'),
      agents: join(layoutDir, 'agents'),
      logs: join(layoutDir, 'logs'),
      logsDesktop: join(layoutDir, 'logs', 'desktop'),
      logsDaemon: join(layoutDir, 'logs', 'daemon'),
      logsTelemetry: join(layoutDir, 'logs', 'telemetry'),
      system: join(layoutDir, 'system'),
      systemAgents: join(layoutDir, 'system', 'agents'),
      systemApps: join(layoutDir, 'system', 'apps'),
      systemCache: join(layoutDir, 'system', 'cache'),
      systemConfig: join(layoutDir, 'system', 'config'),
      systemConversations: join(layoutDir, 'system', 'conversations'),
      systemConversationsIndex: join(layoutDir, 'system', 'conversations', 'session-meta-index.json'),
      systemSessions: layoutDir,
      systemDaemon: join(layoutDir, 'system', 'daemon'),
      systemElectron: join(layoutDir, 'system', 'electron'),
      systemElectronUserData: join(layoutDir, 'system', 'electron', 'user-data'),
      systemObservability: join(layoutDir, 'system', 'observability'),
      systemRuntime: join(layoutDir, 'system', 'runtime'),
      systemSecrets: join(layoutDir, 'system', 'secrets'),
      systemState: join(layoutDir, 'system', 'state'),
    };

    setSessionPathsContext({
      getDesktopRootLayout: () => mockLayout,
    });
  });

  afterAll(() => {
    rmSync(sharedLegacyDir, { recursive: true, force: true });
    rmSync(sharedRuntimeDir, { recursive: true, force: true });
  });

  afterEach(() => {
    clearSessionCaches();
    setSessionPathsContext({});
    process.env = originalEnv;
    for (const dir of tempDirsToClean.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns empty arrays for empty directories', () => {
    expect(listSessions()).toEqual([]);
  });

  it('discovers legacy sessions alongside layout sessions via listSessions()', () => {
    writeSessionFile(layoutDir, 'layout-session', 'Layout session');
    writeSessionFile(sharedLegacyDir, 'legacy-session', 'Legacy session');

    const all = listSessions()
      .map((s) => s.id)
      .sort();
    expect(all).toContain('layout-session');
    expect(all).toContain('legacy-session');
  });

  it('prefers primary (layout) session on ID conflict with legacy', () => {
    writeSessionFile(layoutDir, 'conflict-session', 'Layout title');
    writeSessionFile(sharedLegacyDir, 'conflict-session', 'Legacy title');

    const all = listSessions().filter((s) => s.id === 'conflict-session');
    expect(all).toHaveLength(1);
    expect(all[0].title).toBe('Layout title');
  });

  it('finds sessions when only legacy dir has sessions', () => {
    writeSessionFile(sharedLegacyDir, 'only-legacy', 'Only legacy session');

    const all = listSessions().map((s) => s.id);
    expect(all).toContain('only-legacy');
  });

  it('finds sessions when only layout dir has sessions', () => {
    writeSessionFile(layoutDir, 'only-layout', 'Only layout session');

    const all = listSessions().map((s) => s.id);
    expect(all).toContain('only-layout');
  });

  it('does not scan legacy dir when PA_SESSIONS_DIR is set', () => {
    const customDir = createTempSessionsDir();
    process.env.PA_SESSIONS_DIR = customDir;

    writeSessionFile(layoutDir, 'layout-session', 'Layout test');
    writeSessionFile(sharedLegacyDir, 'legacy-session', 'Legacy test');
    writeSessionFile(customDir, 'custom-session', 'Custom session');

    const all = listSessions()
      .map((s) => s.id)
      .sort();
    expect(all).toContain('custom-session');
    expect(all).not.toContain('layout-session');
    expect(all).not.toContain('legacy-session');
  });

  it('discovers legacy sessions via explicit listSessions(layoutDir) override', () => {
    writeSessionFile(layoutDir, 'layout-override', 'Layout override');
    writeSessionFile(sharedLegacyDir, 'legacy-override', 'Legacy override');

    const fromOverride = listSessions(layoutDir)
      .map((s) => s.id)
      .sort();
    expect(fromOverride).toContain('layout-override');
    expect(fromOverride).toContain('legacy-override');
  });

  it('readSessionMeta finds sessions from legacy dir', () => {
    writeSessionFile(sharedLegacyDir, 'legacy-meta', 'Legacy meta session');

    const meta = readSessionMeta('legacy-meta');
    expect(meta).not.toBeNull();
    expect(meta!.id).toBe('legacy-meta');
    expect(meta!.title).toBe('Legacy meta session');
  });

  it('readSessionMeta prefers layout session on ID conflict', () => {
    writeSessionFile(layoutDir, 'conflict-meta', 'Layout title');
    writeSessionFile(sharedLegacyDir, 'conflict-meta', 'Legacy title');

    const meta = readSessionMeta('conflict-meta');
    expect(meta).not.toBeNull();
    expect(meta!.id).toBe('conflict-meta');
    expect(meta!.title).toBe('Layout title');
  });

  it('readSessionSearchText returns text for legacy sessions', () => {
    writeSessionFile(sharedLegacyDir, 'legacy-search', 'Legacy search session');

    const searchText = readSessionSearchText('legacy-search');
    expect(searchText).not.toBeNull();
    expect(searchText ?? '').toContain('Legacy search session');
  });

  it('legacy sessions remain discoverable after cache clear', () => {
    writeSessionFile(sharedLegacyDir, 'cache-clear', 'After clear session');
    // First scan populates cache
    const before = listSessions().find((s) => s.id === 'cache-clear');
    expect(before).toBeDefined();

    // Clear cache and re-scan
    clearSessionCaches();
    const after = listSessions().find((s) => s.id === 'cache-clear');
    expect(after).toBeDefined();
    expect(after!.title).toBe('After clear session');
  });
});

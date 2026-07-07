import { randomUUID } from 'node:crypto';
import { appendFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { getConfigRoot, getDurableSessionsDir, getStateRoot } from '@neon-pilot/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { AppEvent } from './appEvents.js';
import { invalidateAppTopics, startAppEventMonitor, stopAppEventMonitor, subscribeAppEvents } from './appEvents.js';

const originalEnv = process.env;
const tempDirs: string[] = [];
const ALL_TOPICS = [
  'sessions',
  'sessionFiles',
  'artifacts',
  'checkpoints',
  'attachments',
  'documents',
  'extensions',
  'tasks',
  'models',
  'runs',
  'executions',
  'automation',
  'daemon',
  'workspace',
  'knowledgeBase',
  'notifications',
  'inbox',
  'readiness',
] as const;

function createTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

async function waitFor(predicate: () => boolean, timeoutMs = 30_000): Promise<void> {
  const startedAt = Date.now();

  while (!predicate()) {
    if (Date.now() - startedAt >= timeoutMs) {
      throw new Error('Timed out waiting for app event monitor update.');
    }

    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

beforeEach(() => {
  process.env = {
    ...originalEnv,
    NEON_PILOT_STATE_ROOT: createTempDir('neon-pilot-web-app-events-state-'),
    NEON_PILOT_DAEMON_SOCKET_PATH: join(tmpdir(), `np-${randomUUID()}.sock`),
  };
});

afterEach(async () => {
  stopAppEventMonitor();
  process.env = originalEnv;
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('app event monitor', () => {
  it('invalidates executions when runs change', () => {
    const events: AppEvent[] = [];
    const unsubscribe = subscribeAppEvents((event) => {
      events.push(event);
    });

    invalidateAppTopics('runs');

    expect(events).toContainEqual({ type: 'invalidate', topics: ['executions', 'runs'] });
    unsubscribe();
  });

  it('invalidates sessionFiles when an existing session file changes', async () => {
    const repoRoot = createTempDir('neon-pilot-web-app-events-repo-');
    const sessionsDir = getDurableSessionsDir();
    const taskStateFile = join(getStateRoot(), 'daemon', 'task-state.json');
    const profileConfigFile = join(getConfigRoot(), 'profile.json');
    mkdirSync(sessionsDir, { recursive: true });
    mkdirSync(dirname(taskStateFile), { recursive: true });
    mkdirSync(dirname(profileConfigFile), { recursive: true });
    writeFileSync(taskStateFile, '{}\n', 'utf-8');
    writeFileSync(profileConfigFile, '{"defaultProfile":"assistant"}\n', 'utf-8');

    const sessionDir = join(sessionsDir, '--tmp-project');
    mkdirSync(sessionDir, { recursive: true });
    const sessionFile = join(sessionDir, 'conv-1.jsonl');
    writeFileSync(sessionFile, '{"type":"session","id":"conv-1","timestamp":"2026-03-29T00:00:00.000Z","cwd":"/tmp/project"}\n', 'utf-8');

    const events: AppEvent[] = [];
    const unsubscribe = subscribeAppEvents((event) => {
      events.push(event);
    });

    startAppEventMonitor({
      repoRoot,
      sessionsDir,
      taskStateFile,
      profileConfigFile,
      getRuntimeScope: () => 'assistant',
    });

    await new Promise((resolve) => setTimeout(resolve, 200));
    events.length = 0;

    appendFileSync(sessionFile, '{"type":"message"}\n', 'utf-8');

    await waitFor(() => events.some((event) => event.type === 'invalidate' && event.topics.includes('sessionFiles')));
    await waitFor(() => events.some((event) => event.type === 'session_file_changed' && event.sessionId === 'conv-1'));
    unsubscribe();
  }, 40_000);

  it('invalidates sessionFiles when a session file is created', async () => {
    const repoRoot = createTempDir('neon-pilot-web-app-events-repo-');
    const sessionsDir = getDurableSessionsDir();
    const taskStateFile = join(getStateRoot(), 'daemon', 'task-state.json');
    const profileConfigFile = join(getConfigRoot(), 'profile.json');
    mkdirSync(sessionsDir, { recursive: true });
    mkdirSync(dirname(taskStateFile), { recursive: true });
    mkdirSync(dirname(profileConfigFile), { recursive: true });
    writeFileSync(taskStateFile, '{}\n', 'utf-8');
    writeFileSync(profileConfigFile, '{"defaultProfile":"assistant"}\n', 'utf-8');

    const sessionDir = join(sessionsDir, '--tmp-project');
    mkdirSync(sessionDir, { recursive: true });

    const events: AppEvent[] = [];
    const unsubscribe = subscribeAppEvents((event) => {
      events.push(event);
    });

    startAppEventMonitor({
      repoRoot,
      sessionsDir,
      taskStateFile,
      profileConfigFile,
      getRuntimeScope: () => 'assistant',
    });

    await new Promise((resolve) => setTimeout(resolve, 200));
    events.length = 0;

    const sessionFile = join(sessionDir, 'conv-2.jsonl');
    writeFileSync(sessionFile, '{"type":"session","id":"conv-2","timestamp":"2026-03-29T00:00:00.000Z","cwd":"/tmp/project"}\n', 'utf-8');

    await waitFor(() => events.some((event) => event.type === 'invalidate' && event.topics.includes('sessionFiles')));
    await waitFor(() => events.some((event) => event.type === 'session_file_changed' && event.sessionId === 'conv-2'));
    unsubscribe();
  }, 15_000);

  it('rebuilds watches and invalidates all topics when the active profile changes', async () => {
    const repoRoot = createTempDir('neon-pilot-web-app-events-repo-');
    const sessionsDir = getDurableSessionsDir();
    const taskStateFile = join(getStateRoot(), 'daemon', 'task-state.json');
    const profileConfigFile = join(getConfigRoot(), 'profile.json');
    mkdirSync(sessionsDir, { recursive: true });
    mkdirSync(dirname(taskStateFile), { recursive: true });
    mkdirSync(dirname(profileConfigFile), { recursive: true });
    writeFileSync(taskStateFile, '{}\n', 'utf-8');
    writeFileSync(profileConfigFile, '{"defaultProfile":"assistant"}\n', 'utf-8');

    let runtimeScope = 'assistant';
    const events: AppEvent[] = [];
    const unsubscribe = subscribeAppEvents((event) => {
      events.push(event);
    });

    startAppEventMonitor({
      repoRoot,
      sessionsDir,
      taskStateFile,
      profileConfigFile,
      getRuntimeScope: () => runtimeScope,
    });

    await new Promise((resolve) => setTimeout(resolve, 200));
    events.length = 0;

    runtimeScope = 'other';
    writeFileSync(profileConfigFile, '{"defaultProfile":"other"}\n', 'utf-8');

    await waitFor(() => events.some((event) => event.type === 'invalidate' && ALL_TOPICS.every((topic) => event.topics.includes(topic))));
    expect(events.some((event) => event.type === 'invalidate' && ALL_TOPICS.every((topic) => event.topics.includes(topic)))).toBe(true);
    unsubscribe();
  }, 15_000);

  it('uses layout-based watch paths when getDesktopRootLayout is provided', async () => {
    const repoRoot = createTempDir('neon-pilot-web-app-events-layout-');
    const layoutRoot = createTempDir('neon-pilot-web-app-events-layout-state-');
    const sessionsDir = getDurableSessionsDir();
    const taskStateFile = join(getStateRoot(), 'daemon', 'task-state.json');
    const profileConfigFile = join(getConfigRoot(), 'profile.json');
    mkdirSync(sessionsDir, { recursive: true });
    mkdirSync(dirname(taskStateFile), { recursive: true });
    mkdirSync(dirname(profileConfigFile), { recursive: true });
    writeFileSync(taskStateFile, '{}\n', 'utf-8');
    writeFileSync(profileConfigFile, '{"defaultProfile":"assistant"}\n', 'utf-8');

    const artifactsDir = join(layoutRoot, 'pi-agent', 'state', 'conversation-artifacts', 'assistant');
    const checkpointsDir = join(layoutRoot, 'pi-agent', 'state', 'conversation-commit-checkpoints', 'assistant');
    const attachmentsDir = join(layoutRoot, 'pi-agent', 'state', 'conversation-attachments', 'assistant');
    const alertsFile = join(layoutRoot, 'pi-agent', 'state', 'alerts', 'assistant.json');
    const extensionsDir = join(layoutRoot, 'extensions');
    mkdirSync(artifactsDir, { recursive: true });
    mkdirSync(checkpointsDir, { recursive: true });
    mkdirSync(attachmentsDir, { recursive: true });
    mkdirSync(dirname(alertsFile), { recursive: true });
    mkdirSync(extensionsDir, { recursive: true });
    writeFileSync(alertsFile, '{"version":1,"alerts":{},"updatedAt":"2026-01-01T00:00:00.000Z"}\n', 'utf-8');

    const layout = {
      root: layoutRoot,
      apps: layoutRoot,
      data: layoutRoot,
      dataApps: layoutRoot,
      dataDocuments: layoutRoot,
      documents: layoutRoot,
      agents: layoutRoot,
      logs: layoutRoot,
      logsDesktop: layoutRoot,
      logsDaemon: layoutRoot,
      logsTelemetry: layoutRoot,
      system: layoutRoot,
      systemAgents: layoutRoot,
      systemApps: layoutRoot,
      systemCache: layoutRoot,
      systemConfig: layoutRoot,
      systemConversations: layoutRoot,
      systemSessions: layoutRoot,
      systemDaemon: layoutRoot,
      systemElectron: layoutRoot,
      systemElectronUserData: layoutRoot,
      systemObservability: layoutRoot,
      systemRuntime: layoutRoot,
      systemSecrets: layoutRoot,
      systemState: layoutRoot,
    };

    const events: AppEvent[] = [];
    const unsubscribe = subscribeAppEvents((event) => {
      events.push(event);
    });

    startAppEventMonitor({
      repoRoot,
      sessionsDir,
      taskStateFile,
      profileConfigFile,
      getRuntimeScope: () => 'assistant',
      getDesktopRootLayout: () => layout,
    });

    await new Promise((resolve) => setTimeout(resolve, 200));
    events.length = 0;

    writeFileSync(join(artifactsDir, 'test-artifact.json'), '{"id":"test"}\n', 'utf-8');

    await waitFor(() => events.some((event) => event.type === 'invalidate' && event.topics.includes('artifacts')));
    expect(events.some((event) => event.type === 'invalidate' && event.topics.includes('artifacts'))).toBe(true);

    // Extensions invalidation also uses the layout-derived extensions root
    events.length = 0;
    writeFileSync(join(extensionsDir, 'new-ext.json'), '{"id":"test"}\n', 'utf-8');
    await waitFor(() => events.some((event) => event.type === 'invalidate' && event.topics.includes('extensions')));
    expect(events.some((event) => event.type === 'invalidate' && event.topics.includes('extensions'))).toBe(true);
    unsubscribe();
  }, 15_000);
});

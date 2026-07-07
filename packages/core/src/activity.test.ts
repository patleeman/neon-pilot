import { existsSync, mkdtempSync } from 'fs';
import { rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  closeActivityDbs,
  getProfileActivityEntry,
  hasProfileActivityEntry,
  listProfileActivityEntries,
  loadProfileActivityReadState,
  resolveActivityEntryPath,
  resolveActivityEntryPathFromLayout,
  resolveActivityReadStatePath,
  resolveActivityReadStatePathFromLayout,
  resolveProfileActivityDbPath,
  resolveProfileActivityDbPathFromLayout,
  resolveProfileActivityDir,
  resolveProfileActivityDirFromLayout,
  resolveProfileActivityStateDir,
  resolveProfileActivityStateDirFromLayout,
  saveProfileActivityReadState,
  validateActivityId,
  writeProfileActivityEntry,
} from './activity.js';
import { createProjectActivityEntry } from './project-artifacts.js';
import type { DesktopRootLayout } from './runtime/desktop-root.js';

const tempDirs: string[] = [];

afterEach(async () => {
  closeActivityDbs();
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

function createTempStateRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), 'neon-pilot-activity-'));
  tempDirs.push(dir);
  return dir;
}

describe('activity paths', () => {
  it('resolves the profile-scoped activity state directory', () => {
    const stateRoot = createTempStateRoot();
    expect(resolveProfileActivityStateDir({ stateRoot, profile: 'datadog' })).toBe(
      join(stateRoot, 'pi-agent', 'state', 'activity', 'datadog'),
    );
  });

  it('resolves the profile-scoped activity directory', () => {
    const stateRoot = createTempStateRoot();
    expect(resolveProfileActivityDir({ stateRoot, profile: 'datadog' })).toBe(
      join(stateRoot, 'pi-agent', 'state', 'activity', 'datadog', 'activities'),
    );
  });

  it('resolves a profile activity entry path', () => {
    const stateRoot = createTempStateRoot();
    expect(resolveActivityEntryPath({ stateRoot, profile: 'datadog', activityId: 'daily-report' })).toBe(
      join(stateRoot, 'pi-agent', 'state', 'activity', 'datadog', 'activities', 'daily-report.md'),
    );
  });

  it('rejects invalid activity ids', () => {
    expect(() => validateActivityId('bad/id')).toThrow('Invalid activity id');
  });

  it('resolves paths from a DesktopRootLayout', () => {
    const layout = { systemState: '/custom/root/system/state' } as Pick<DesktopRootLayout, 'systemState'>;

    expect(resolveProfileActivityStateDirFromLayout(layout as DesktopRootLayout, 'datadog')).toBe(
      join('/custom/root/system/state', 'pi-agent', 'state', 'activity', 'datadog'),
    );

    expect(resolveProfileActivityDirFromLayout(layout as DesktopRootLayout, 'datadog')).toBe(
      join('/custom/root/system/state', 'pi-agent', 'state', 'activity', 'datadog', 'activities'),
    );

    expect(resolveActivityEntryPathFromLayout(layout as DesktopRootLayout, 'datadog', 'daily-report')).toBe(
      join('/custom/root/system/state', 'pi-agent', 'state', 'activity', 'datadog', 'activities', 'daily-report.md'),
    );

    expect(resolveActivityReadStatePathFromLayout(layout as DesktopRootLayout, 'datadog')).toBe(
      join('/custom/root/system/state', 'pi-agent', 'state', 'activity', 'datadog', 'read-state.json'),
    );

    expect(resolveProfileActivityDbPathFromLayout(layout as DesktopRootLayout, 'datadog')).toBe(
      join('/custom/root/system/state', 'pi-agent', 'state', 'activity', 'datadog', 'runtime.db'),
    );
  });
});

describe('activity read state', () => {
  it('resolves the activity read-state path', () => {
    const stateRoot = createTempStateRoot();
    expect(resolveActivityReadStatePath({ stateRoot, profile: 'datadog' })).toBe(
      join(stateRoot, 'pi-agent', 'state', 'activity', 'datadog', 'read-state.json'),
    );
  });

  it('loads an empty read state when the file is missing', () => {
    const stateRoot = createTempStateRoot();
    expect(loadProfileActivityReadState({ stateRoot, profile: 'datadog' })).toEqual(new Set());
  });

  it('saves and reloads normalized read ids in sqlite', () => {
    const stateRoot = createTempStateRoot();
    const path = saveProfileActivityReadState({
      stateRoot,
      profile: 'datadog',
      ids: [' newer ', '', 'older', 'newer', 'bad/id'],
    });

    expect(path).toBe(resolveProfileActivityDbPath({ stateRoot, profile: 'datadog' }));
    expect(existsSync(path)).toBe(true);
    expect(loadProfileActivityReadState({ stateRoot, profile: 'datadog' })).toEqual(new Set(['newer', 'older']));
  });
});

describe('activity storage', () => {
  it('writes and lists activity entries newest-first', () => {
    const stateRoot = createTempStateRoot();

    const olderPath = writeProfileActivityEntry({
      stateRoot,
      profile: 'datadog',
      entry: createProjectActivityEntry({
        id: 'older',
        createdAt: '2026-03-10T10:00:00.000Z',
        profile: 'datadog',
        kind: 'scheduled-task',
        summary: 'Older activity.',
      }),
    });

    const newerPath = writeProfileActivityEntry({
      stateRoot,
      profile: 'datadog',
      entry: createProjectActivityEntry({
        id: 'newer',
        createdAt: '2026-03-10T12:00:00.000Z',
        profile: 'datadog',
        kind: 'follow-up',
        summary: 'Newer activity.',
      }),
    });

    const entries = listProfileActivityEntries({ stateRoot, profile: 'datadog' });

    expect(entries.map((entry) => entry.entry.id)).toEqual(['newer', 'older']);
    expect(entries[0]?.path).toBe(newerPath);
    expect(entries[1]?.path).toBe(olderPath);
    expect(newerPath).toBe(`${resolveProfileActivityDbPath({ stateRoot, profile: 'datadog' })}#activity/newer`);
    expect(olderPath).toBe(`${resolveProfileActivityDbPath({ stateRoot, profile: 'datadog' })}#activity/older`);
  });

  it('returns an empty list when there is no activity dir', () => {
    const stateRoot = createTempStateRoot();
    expect(listProfileActivityEntries({ stateRoot, profile: 'datadog' })).toEqual([]);
  });
});

describe('activity layout integration', () => {
  function createTestLayout(): DesktopRootLayout {
    const root = mkdtempSync(join(tmpdir(), 'neon-pilot-layout-'));
    tempDirs.push(root);
    const systemState = join(root, 'system', 'state');
    return {
      root,
      apps: join(root, 'apps'),
      data: join(root, 'data'),
      dataApps: join(root, 'data', 'apps'),
      dataDocuments: join(root, 'data', 'documents'),
      dataExports: join(root, 'data', 'exports'),
      documents: join(root, 'documents'),
      agents: join(root, 'agents'),
      soulDoc: join(root, 'agents', 'soul.md'),
      logs: join(root, 'logs'),
      logsDesktop: join(root, 'logs', 'desktop'),
      logsDaemon: join(root, 'logs', 'daemon'),
      logsTelemetry: join(root, 'logs', 'telemetry'),
      system: join(root, 'system'),
      systemAgents: join(root, 'system', 'agents'),
      systemApps: join(root, 'system', 'apps'),
      systemCache: join(root, 'system', 'cache'),
      systemConfig: join(root, 'system', 'config'),
      systemConversations: join(root, 'system', 'conversations'),
      systemConversationsIndex: join(root, 'system', 'conversations', 'session-meta-index.json'),
      systemSessions: join(root, 'system', 'conversations', 'sessions'),
      systemDaemon: join(root, 'system', 'daemon'),
      systemElectron: join(root, 'system', 'electron'),
      systemElectronUserData: join(root, 'system', 'electron', 'user-data'),
      systemObservability: join(root, 'system', 'observability'),
      systemRuntime: join(root, 'system', 'runtime'),
      systemSecrets: join(root, 'system', 'secrets'),
      systemState,
    };
  }

  it('resolves state dir via layout option', () => {
    const layout = createTestLayout();
    expect(resolveProfileActivityStateDir({ layout, profile: 'test-profile' })).toBe(
      resolveProfileActivityStateDirFromLayout(layout, 'test-profile'),
    );
  });

  it('resolves activity dir via layout option', () => {
    const layout = createTestLayout();
    expect(resolveProfileActivityDir({ layout, profile: 'test-profile' })).toBe(
      resolveProfileActivityDirFromLayout(layout, 'test-profile'),
    );
  });

  it('resolves entry path via layout option', () => {
    const layout = createTestLayout();
    expect(resolveActivityEntryPath({ layout, profile: 'test-profile', activityId: 'test-entry' })).toBe(
      resolveActivityEntryPathFromLayout(layout, 'test-profile', 'test-entry'),
    );
  });

  it('resolves read state path via layout option', () => {
    const layout = createTestLayout();
    expect(resolveActivityReadStatePath({ layout, profile: 'test-profile' })).toBe(
      resolveActivityReadStatePathFromLayout(layout, 'test-profile'),
    );
  });

  it('resolves db path via layout option', () => {
    const layout = createTestLayout();
    expect(resolveProfileActivityDbPath({ layout, profile: 'test-profile' })).toBe(
      resolveProfileActivityDbPathFromLayout(layout, 'test-profile'),
    );
  });

  it('writes activity entry using layout paths', () => {
    const layout = createTestLayout();
    const entryPath = writeProfileActivityEntry({
      layout,
      profile: 'layout-profile',
      entry: createProjectActivityEntry({
        id: 'entry-1',
        createdAt: '2026-07-06T00:00:00.000Z',
        profile: 'layout-profile',
        kind: 'test',
        summary: 'Layout entry.',
      }),
    });

    expect(entryPath).toBe(`${resolveProfileActivityDbPath({ layout, profile: 'layout-profile' })}#activity/entry-1`);
    expect(hasProfileActivityEntry({ layout, profile: 'layout-profile', activityId: 'entry-1' })).toBe(true);

    const stored = getProfileActivityEntry({ layout, profile: 'layout-profile', activityId: 'entry-1' });
    expect(stored).not.toBeNull();
    expect(stored!.entry.id).toBe('entry-1');
  });

  it('saves and loads read state using layout paths', () => {
    const layout = createTestLayout();
    const dbPath = saveProfileActivityReadState({
      layout,
      profile: 'layout-profile',
      ids: ['alpha', 'beta'],
    });

    expect(dbPath).toBe(resolveProfileActivityDbPath({ layout, profile: 'layout-profile' }));
    expect(existsSync(dbPath)).toBe(true);
    expect(loadProfileActivityReadState({ layout, profile: 'layout-profile' })).toEqual(new Set(['alpha', 'beta']));
  });

  it('lists activity entries written via layout', () => {
    const layout = createTestLayout();

    writeProfileActivityEntry({
      layout,
      profile: 'layout-profile',
      entry: createProjectActivityEntry({
        id: 'first',
        createdAt: '2026-07-06T10:00:00.000Z',
        profile: 'layout-profile',
        kind: 'test',
        summary: 'First entry.',
      }),
    });

    writeProfileActivityEntry({
      layout,
      profile: 'layout-profile',
      entry: createProjectActivityEntry({
        id: 'second',
        createdAt: '2026-07-06T12:00:00.000Z',
        profile: 'layout-profile',
        kind: 'test',
        summary: 'Second entry.',
      }),
    });

    const entries = listProfileActivityEntries({ layout, profile: 'layout-profile' });
    expect(entries.map((e) => e.entry.id)).toEqual(['second', 'first']);
    expect(entries[0]!.entry.summary).toBe('Second entry.');
    expect(entries[1]!.entry.summary).toBe('First entry.');
  });

  it('preserves legacy stateRoot fallback when layout is not provided', () => {
    const stateRoot = createTempStateRoot();

    const path = writeProfileActivityEntry({
      stateRoot,
      profile: 'legacy-profile',
      entry: createProjectActivityEntry({
        id: 'legacy-1',
        createdAt: '2026-07-06T00:00:00.000Z',
        profile: 'legacy-profile',
        kind: 'test',
        summary: 'Legacy entry.',
      }),
    });

    expect(path).toBe(`${resolveProfileActivityDbPath({ stateRoot, profile: 'legacy-profile' })}#activity/legacy-1`);
    expect(path).not.toContain('system/state');
    expect(hasProfileActivityEntry({ stateRoot, profile: 'legacy-profile', activityId: 'legacy-1' })).toBe(true);
  });
});

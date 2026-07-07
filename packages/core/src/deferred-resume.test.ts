import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  activateDeferredResume,
  activateDueDeferredResumes,
  createEmptyDeferredResumeState,
  getDueScheduledSessionDeferredResumeEntries,
  getReadySessionDeferredResumeEntries,
  loadDeferredResumeEntries,
  loadDeferredResumeState,
  mergeDeferredResumeStateDocuments,
  parseDeferredResumeDelayMs,
  readSessionConversationId,
  removeDeferredResume,
  resolveDeferredResumeStateFile,
  resolveDeferredResumeStateFileFromLayout,
  retryDeferredResume,
  saveDeferredResumeState,
  scheduleDeferredResume,
  withDeferredResumeLock,
} from './deferred-resume.js';
import type { DesktopRootLayout } from './runtime/desktop-root.js';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

function createTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

describe('deferred resume state', () => {
  it('resolves the deferred resume state file path from a DesktopRootLayout', () => {
    const layout = { systemState: '/custom/root/system/state' } as Pick<DesktopRootLayout, 'systemState'>;
    expect(resolveDeferredResumeStateFileFromLayout(layout as DesktopRootLayout)).toBe(
      '/custom/root/system/state/pi-agent/deferred-resumes-state.json',
    );
  });

  it('loads deferred resume state from a DesktopRootLayout', () => {
    const dir = createTempDir('deferred-resume-layout-');
    const layout = { systemState: dir } as Pick<DesktopRootLayout, 'systemState'>;

    const state = loadDeferredResumeState(layout as DesktopRootLayout);
    expect(state).toEqual(createEmptyDeferredResumeState());

    scheduleDeferredResume(state, {
      id: 'resume-layout-1',
      sessionFile: '/tmp/sessions/layout.jsonl',
      prompt: 'continue from layout',
      dueAt: '2026-06-01T12:00:00.000Z',
      createdAt: '2026-06-01T11:50:00.000Z',
      attempts: 0,
    });
    saveDeferredResumeState(state, layout as DesktopRootLayout);

    const loaded = loadDeferredResumeState(layout as DesktopRootLayout);
    expect(loaded.resumes['resume-layout-1']).toMatchObject({
      id: 'resume-layout-1',
      status: 'scheduled',
    });
  });

  it('uses layout-derived path consistently across load and save', () => {
    const dir = createTempDir('deferred-resume-consistency-');
    const layout = { systemState: dir } as Pick<DesktopRootLayout, 'systemState'>;
    const layoutArg = layout as DesktopRootLayout;

    const expectedPath = resolveDeferredResumeStateFileFromLayout(layoutArg);

    const state = createEmptyDeferredResumeState();
    saveDeferredResumeState(state, layoutArg);

    const loaded = loadDeferredResumeState(layoutArg);
    expect(loaded).toEqual(createEmptyDeferredResumeState());

    const viaPath = loadDeferredResumeState(expectedPath);
    expect(viaPath).toEqual(createEmptyDeferredResumeState());
  });

  it('uses layout in withDeferredResumeLock', () => {
    const dir = createTempDir('deferred-resume-lock-layout-');
    const layout = { systemState: dir } as Pick<DesktopRootLayout, 'systemState'>;
    const layoutArg = layout as DesktopRootLayout;

    const result = withDeferredResumeLock((state) => {
      scheduleDeferredResume(state, {
        id: 'resume-lock-layout',
        sessionFile: '/tmp/sessions/lock.jsonl',
        prompt: 'continue',
        dueAt: '2026-06-01T12:00:00.000Z',
        createdAt: '2026-06-01T11:50:00.000Z',
        attempts: 0,
      });
      return 'done';
    }, layoutArg);

    expect(result).toBe('done');

    const loaded = loadDeferredResumeState(layoutArg);
    expect(loaded.resumes['resume-lock-layout']).toMatchObject({ id: 'resume-lock-layout', status: 'scheduled' });
  });

  it('loads deferred resume entries from a DesktopRootLayout', () => {
    const dir = createTempDir('deferred-resume-entries-layout-');
    const layout = { systemState: dir } as Pick<DesktopRootLayout, 'systemState'>;
    const layoutArg = layout as DesktopRootLayout;

    const state = createEmptyDeferredResumeState();
    scheduleDeferredResume(state, {
      id: 'resume-entries-1',
      sessionFile: '/tmp/sessions/e1.jsonl',
      prompt: 'entry 1',
      dueAt: '2026-06-01T12:00:00.000Z',
      createdAt: '2026-06-01T11:50:00.000Z',
      attempts: 0,
    });
    saveDeferredResumeState(state, layoutArg);

    const entries = loadDeferredResumeEntries(layoutArg);
    expect(entries).toHaveLength(1);
    expect(entries[0].sessionFile).toBe('/tmp/sessions/e1.jsonl');
  });

  it('resolves the deferred resume state file path', () => {
    expect(resolveDeferredResumeStateFile('/state')).toBe('/state/pi-agent/deferred-resumes-state.json');
  });
  it('parses supported deferred resume delay strings', () => {
    expect(parseDeferredResumeDelayMs('30s')).toBe(30_000);
    expect(parseDeferredResumeDelayMs('10m')).toBe(600_000);
    expect(parseDeferredResumeDelayMs('2h')).toBe(7_200_000);
    expect(parseDeferredResumeDelayMs('1d')).toBe(86_400_000);
    expect(parseDeferredResumeDelayMs('10 minutes')).toBe(600_000);
    expect(parseDeferredResumeDelayMs('2 hours')).toBe(7_200_000);
    expect(parseDeferredResumeDelayMs('1 day')).toBe(86_400_000);
    expect(parseDeferredResumeDelayMs('later')).toBeUndefined();
    expect(parseDeferredResumeDelayMs('36501 days')).toBeUndefined();
    expect(parseDeferredResumeDelayMs('999999999999999999999999d')).toBeUndefined();
  });

  it('creates the state directory before acquiring the first write lock', () => {
    const dir = createTempDir('deferred-resume-lock-');
    const stateFile = join(dir, 'nested', 'deferred-resumes-state.json');

    withDeferredResumeLock((state) => {
      scheduleDeferredResume(state, {
        id: 'resume-locked',
        sessionFile: '/tmp/sessions/current.jsonl',
        prompt: 'continue',
        dueAt: '2026-03-08T12:00:00.000Z',
        createdAt: '2026-03-08T11:50:00.000Z',
        attempts: 0,
      });
    }, stateFile);

    expect(loadDeferredResumeState(stateFile).resumes['resume-locked']).toMatchObject({
      id: 'resume-locked',
      status: 'scheduled',
    });
  });

  it('loads entries without explicit status as scheduled', () => {
    const dir = createTempDir('deferred-resume-state-');
    const stateFile = join(dir, 'state.json');

    writeFileSync(
      stateFile,
      JSON.stringify({
        version: 1,
        resumes: {
          one: {
            id: 'one',
            sessionFile: '/tmp/sessions/1.jsonl',
            prompt: 'continue',
            dueAt: '2026-03-08T12:00:00.000Z',
            createdAt: '2026-03-08T11:50:00.000Z',
            attempts: 0,
          },
        },
      }),
    );

    const state = loadDeferredResumeState(stateFile);
    expect(state.resumes.one).toMatchObject({
      id: 'one',
      status: 'scheduled',
    });
  });

  it('schedules, activates, retries, and removes deferred resumes', () => {
    const state = createEmptyDeferredResumeState();

    scheduleDeferredResume(state, {
      id: 'resume-1',
      sessionFile: '/tmp/sessions/current.jsonl',
      prompt: 'continue',
      dueAt: '2026-03-08T12:00:00.000Z',
      createdAt: '2026-03-08T11:50:00.000Z',
      attempts: 0,
      behavior: 'followUp',
    });

    expect(getDueScheduledSessionDeferredResumeEntries(state, '/tmp/sessions/current.jsonl', new Date('2026-03-08T11:59:59.000Z'))).toEqual(
      [],
    );

    const activatedEarly = activateDeferredResume(state, {
      id: 'resume-1',
      at: new Date('2026-03-08T11:55:00.000Z'),
    });
    expect(activatedEarly).toMatchObject({
      id: 'resume-1',
      status: 'ready',
      readyAt: '2026-03-08T11:55:00.000Z',
      behavior: 'followUp',
    });
    expect(getReadySessionDeferredResumeEntries(state, '/tmp/sessions/current.jsonl')).toHaveLength(1);

    const retried = retryDeferredResume(state, {
      id: 'resume-1',
      dueAt: '2026-03-08T12:05:00.000Z',
    });
    expect(retried).toMatchObject({
      id: 'resume-1',
      status: 'scheduled',
      dueAt: '2026-03-08T12:05:00.000Z',
      attempts: 1,
      behavior: 'followUp',
    });
    expect(getReadySessionDeferredResumeEntries(state, '/tmp/sessions/current.jsonl')).toEqual([]);

    const activated = activateDueDeferredResumes(state, {
      at: new Date('2026-03-08T12:05:30.000Z'),
    });

    expect(activated).toHaveLength(1);
    expect(activated[0]).toMatchObject({
      id: 'resume-1',
      status: 'ready',
      readyAt: '2026-03-08T12:05:30.000Z',
      behavior: 'followUp',
    });
    expect(getReadySessionDeferredResumeEntries(state, '/tmp/sessions/current.jsonl')).toHaveLength(1);

    expect(removeDeferredResume(state, 'resume-1')).toBe(true);
    expect(removeDeferredResume(state, 'resume-1')).toBe(false);
  });

  it('normalizes invalid delivery options when scheduling resumes', () => {
    const state = createEmptyDeferredResumeState();

    const scheduled = scheduleDeferredResume(state, {
      id: 'resume-invalid-delivery',
      sessionFile: '/tmp/sessions/current.jsonl',
      prompt: 'continue',
      dueAt: '2026-03-08T12:00:00.000Z',
      createdAt: '2026-03-08T11:50:00.000Z',
      attempts: 0,
      kind: 'continue',
      delivery: {
        alertLevel: 'loud',
        autoResumeIfOpen: 'yes',
        requireAck: 'sure',
      } as never,
    });

    expect(scheduled.delivery).toEqual({
      alertLevel: 'none',
      autoResumeIfOpen: true,
      requireAck: false,
      mode: 'batchable',
    });
  });

  it('normalizes invalid deferred resume kinds when scheduling resumes', () => {
    const state = createEmptyDeferredResumeState();

    const scheduled = scheduleDeferredResume(state, {
      id: 'resume-invalid-kind',
      sessionFile: '/tmp/sessions/current.jsonl',
      prompt: 'continue',
      dueAt: '2026-03-08T12:00:00.000Z',
      createdAt: '2026-03-08T11:50:00.000Z',
      attempts: 0,
      kind: 'bogus',
    } as never);

    expect(scheduled.kind).toBe('continue');
    expect(scheduled.delivery).toEqual({
      alertLevel: 'none',
      autoResumeIfOpen: true,
      requireAck: false,
      mode: 'batchable',
    });
  });

  it('persists normalized state to disk', () => {
    const dir = createTempDir('deferred-resume-save-');
    const stateFile = join(dir, 'state.json');
    const state = createEmptyDeferredResumeState();

    scheduleDeferredResume(state, {
      id: 'resume-1',
      sessionFile: '/tmp/sessions/current.jsonl',
      prompt: 'continue',
      dueAt: '2026-03-08T12:00:00.000Z',
      createdAt: '2026-03-08T11:50:00.000Z',
      attempts: 0,
      behavior: 'followUp',
    });

    saveDeferredResumeState(state, stateFile);
    const persisted = JSON.parse(readFileSync(stateFile, 'utf-8')) as {
      version: number;
      resumes: Record<string, { status: string; behavior?: string }>;
    };

    expect(persisted.version).toBe(3);
    expect(persisted.resumes['resume-1']?.status).toBe('scheduled');
    expect(persisted.resumes['resume-1']?.behavior).toBe('followUp');
  });

  it('merges deferred resume documents by union and latest retry state', () => {
    const merged = mergeDeferredResumeStateDocuments({
      documents: [
        {
          version: 2,
          resumes: {
            'resume-1': {
              id: 'resume-1',
              sessionFile: '/tmp/sessions/current.jsonl',
              prompt: 'continue',
              dueAt: '2026-03-08T12:00:00.000Z',
              createdAt: '2026-03-08T11:50:00.000Z',
              attempts: 0,
              status: 'scheduled',
            },
          },
        },
        {
          version: 2,
          resumes: {
            'resume-1': {
              id: 'resume-1',
              sessionFile: '/tmp/sessions/current.jsonl',
              prompt: 'continue',
              dueAt: '2026-03-08T12:00:00.000Z',
              createdAt: '2026-03-08T11:50:00.000Z',
              attempts: 0,
              status: 'ready',
              readyAt: '2026-03-08T12:00:30.000Z',
            },
          },
        },
        {
          version: 2,
          resumes: {
            'resume-1': {
              id: 'resume-1',
              sessionFile: '/tmp/sessions/current.jsonl',
              prompt: 'continue later',
              dueAt: '2026-03-08T12:05:00.000Z',
              createdAt: '2026-03-08T11:50:00.000Z',
              attempts: 1,
              status: 'scheduled',
            },
            'resume-2': {
              id: 'resume-2',
              sessionFile: '/tmp/sessions/other.jsonl',
              prompt: 'follow up',
              dueAt: '2026-03-08T13:00:00.000Z',
              createdAt: '2026-03-08T12:55:00.000Z',
              attempts: 0,
              status: 'scheduled',
            },
          },
        },
      ],
    });

    expect(merged).toEqual({
      version: 3,
      resumes: {
        'resume-1': {
          id: 'resume-1',
          sessionFile: '/tmp/sessions/current.jsonl',
          prompt: 'continue later',
          dueAt: '2026-03-08T12:05:00.000Z',
          createdAt: '2026-03-08T11:50:00.000Z',
          attempts: 1,
          status: 'scheduled',
          kind: 'continue',
          delivery: {
            alertLevel: 'none',
            autoResumeIfOpen: true,
            requireAck: false,
            mode: 'batchable',
          },
        },
        'resume-2': {
          id: 'resume-2',
          sessionFile: '/tmp/sessions/other.jsonl',
          prompt: 'follow up',
          dueAt: '2026-03-08T13:00:00.000Z',
          createdAt: '2026-03-08T12:55:00.000Z',
          attempts: 0,
          status: 'scheduled',
          kind: 'continue',
          delivery: {
            alertLevel: 'none',
            autoResumeIfOpen: true,
            requireAck: false,
            mode: 'batchable',
          },
        },
      },
    });
  });
});

describe('deferred resume session file parsing', () => {
  it('reads the conversation id from a session file', () => {
    const dir = createTempDir('deferred-resume-session-');
    const sessionDir = join(dir, 'sessions');
    mkdirSync(sessionDir, { recursive: true });
    const sessionFile = join(sessionDir, 'current.jsonl');
    writeFileSync(
      sessionFile,
      JSON.stringify({ type: 'session', id: 'conv-123', timestamp: '2026-03-08T12:00:00.000Z', cwd: '/tmp/workspace' }) + '\n',
    );

    expect(readSessionConversationId(sessionFile)).toBe('conv-123');
  });

  it('returns undefined when the session file is missing or invalid', () => {
    const dir = createTempDir('deferred-resume-session-missing-');
    expect(readSessionConversationId(join(dir, 'missing.jsonl'))).toBeUndefined();
  });
});

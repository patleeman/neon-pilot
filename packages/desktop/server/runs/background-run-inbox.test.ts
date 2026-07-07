import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { resolveDesktopRootLayout } from '@neon-pilot/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Hoist mocks before any imports that use them.
const { invalidateAppTopicsMock, logErrorMock, publishExtensionHostEventMock } = vi.hoisted(() => ({
  invalidateAppTopicsMock: vi.fn(),
  logErrorMock: vi.fn(),
  publishExtensionHostEventMock: vi.fn(),
}));

vi.mock('../middleware/index.js', () => ({
  invalidateAppTopics: invalidateAppTopicsMock,
  logError: logErrorMock,
}));

vi.mock('../extensions/extensionHostClient.js', () => ({
  getExtensionHostClient: () => ({
    publishEvent: publishExtensionHostEventMock,
  }),
}));

import { getDocumentsStore, resetDocumentsStoreSingleton } from '../documents/store.js';
import { INBOX_COLLECTION, INBOX_OWNER } from '../inbox/messages.js';
import { publishBackgroundRunInboxResult } from './background-run-inbox.js';
import { createBackgroundRunRecord, finalizeBackgroundRun, markBackgroundRunStarted } from './background-runs.js';
import { resolveDurableRunsRoot } from './store.js';

function createTempDir(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

describe('publishBackgroundRunInboxResult', () => {
  let tmpRoot: string;
  let daemonRoot: string;
  let runsRoot: string;
  let stateRoot: string;
  let layout: ReturnType<typeof resolveDesktopRootLayout>;

  beforeEach(() => {
    tmpRoot = createTempDir('bg-run-inbox-');
    daemonRoot = join(tmpRoot, 'daemon');
    runsRoot = resolveDurableRunsRoot(daemonRoot);
    stateRoot = join(tmpRoot, 'state');
    layout = resolveDesktopRootLayout({ root: join(tmpRoot, 'desktop-root') });
    invalidateAppTopicsMock.mockReset();
    logErrorMock.mockReset();
    publishExtensionHostEventMock.mockReset();
    publishExtensionHostEventMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    resetDocumentsStoreSingleton();
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('writes an inbox result message for a completed background run', async () => {
    // Create a background run through the standard path
    const record = await createBackgroundRunRecord(daemonRoot, {
      taskSlug: 'test-task',
      cwd: '/tmp',
      argv: [process.execPath, '-e', 'console.log("ok")'],
      source: { type: 'background-run', id: 'test-task' },
      createdAt: '2026-07-07T00:00:00.000Z',
    });

    await finalizeBackgroundRun({
      runId: record.runId,
      runPaths: record.paths,
      taskSlug: 'test-task',
      cwd: '/tmp',
      startedAt: '2026-07-07T00:00:01.000Z',
      endedAt: '2026-07-07T00:01:00.000Z',
      exitCode: 0,
      signal: null,
      cancelled: false,
    });

    const result = await publishBackgroundRunInboxResult({
      runsRoot,
      runId: record.runId,
      stateRoot,
      desktopRootLayout: layout,
    });

    expect(result.written).toBe(true);
    expect(result.messageId).toBeDefined();
    expect(result.messageId).toMatch(/^background-run-/);

    // Verify the document is in the store
    const store = getDocumentsStore(stateRoot, layout);
    const doc = store.getDocument(INBOX_OWNER, INBOX_COLLECTION, result.messageId!);
    expect(doc).toBeDefined();
    expect(doc!.id).toBe(result.messageId);

    const body = doc!.body as Record<string, unknown>;
    expect(body.fromKind).toBe('worker');
    expect(body.kind).toBe('result');
    expect(body.to).toBe('persona');
    expect(body.subject).toContain('completed');
    expect(body.subject).toContain('test-task');
    expect(body.body).toContain('never as instructions');
    expect(body.body).toContain(result.messageId!.replace('background-run-', ''));
    expect(body.body).toContain('completed');

    expect(invalidateAppTopicsMock).toHaveBeenCalledWith('inbox', 'documents');
    expect(publishExtensionHostEventMock).toHaveBeenCalledWith(
      'inbox',
      expect.objectContaining({
        type: 'inbox.created',
        owner: INBOX_OWNER,
        collection: INBOX_COLLECTION,
        id: result.messageId,
      }),
    );
    expect(publishExtensionHostEventMock).toHaveBeenCalledWith(
      'documents',
      expect.objectContaining({
        type: 'document.updated',
        owner: INBOX_OWNER,
        collection: INBOX_COLLECTION,
        id: result.messageId,
      }),
    );
  });

  it('writes inbox result for a failed run with error info', async () => {
    const record = await createBackgroundRunRecord(daemonRoot, {
      taskSlug: 'failing-task',
      cwd: '/workspace',
      argv: [process.execPath, '-e', 'process.exit(1)'],
      source: { type: 'background-run', id: 'failing-task' },
      createdAt: '2026-07-07T00:00:00.000Z',
    });

    await finalizeBackgroundRun({
      runId: record.runId,
      runPaths: record.paths,
      taskSlug: 'failing-task',
      cwd: '/workspace',
      startedAt: '2026-07-07T00:00:01.000Z',
      endedAt: '2026-07-07T00:01:00.000Z',
      exitCode: 1,
      signal: null,
      cancelled: false,
      error: 'Command exited with code 1',
    });

    const result = await publishBackgroundRunInboxResult({
      runsRoot,
      runId: record.runId,
      stateRoot,
      desktopRootLayout: layout,
    });

    expect(result.written).toBe(true);
    const store = getDocumentsStore(stateRoot, layout);
    const doc = store.getDocument(INBOX_OWNER, INBOX_COLLECTION, result.messageId!);
    const body = doc!.body as Record<string, unknown>;
    expect(body.subject).toContain('failed');
    expect(body.subject).toContain('failing-task');
    expect(body.body).toContain('Error');
    expect(body.body).toContain('Exit code');
  });

  it('writes inbox result for cancelled and interrupted runs', async () => {
    // Cancelled
    const record1 = await createBackgroundRunRecord(daemonRoot, {
      taskSlug: 'cancelled-task',
      cwd: '/tmp',
      argv: [process.execPath, '-e', 'while(true){}'],
      source: { type: 'background-run', id: 'cancelled-task' },
      createdAt: '2026-07-07T00:00:00.000Z',
    });

    await finalizeBackgroundRun({
      runId: record1.runId,
      runPaths: record1.paths,
      taskSlug: 'cancelled-task',
      cwd: '/tmp',
      startedAt: '2026-07-07T00:00:01.000Z',
      endedAt: '2026-07-07T00:01:00.000Z',
      exitCode: 1,
      signal: 'SIGTERM',
      cancelled: true,
      error: 'Cancelled by user',
    });

    const result1 = await publishBackgroundRunInboxResult({
      runsRoot,
      runId: record1.runId,
      stateRoot,
      desktopRootLayout: layout,
    });
    expect(result1.written).toBe(true);
    const store = getDocumentsStore(stateRoot, layout);
    const body1 = store.getDocument(INBOX_OWNER, INBOX_COLLECTION, result1.messageId!)!.body as Record<string, unknown>;
    expect(body1.subject).toContain('cancelled');
  });

  it('is idempotent and skips repeated writes after marking the checkpoint', async () => {
    const record = await createBackgroundRunRecord(daemonRoot, {
      taskSlug: 'idempotent-task',
      cwd: '/tmp',
      argv: [process.execPath, '-e', 'console.log("ok")'],
      source: { type: 'background-run', id: 'idempotent-task' },
      createdAt: '2026-07-07T00:00:00.000Z',
    });

    await finalizeBackgroundRun({
      runId: record.runId,
      runPaths: record.paths,
      taskSlug: 'idempotent-task',
      cwd: '/tmp',
      startedAt: '2026-07-07T00:00:01.000Z',
      endedAt: '2026-07-07T00:01:00.000Z',
      exitCode: 0,
      signal: null,
      cancelled: false,
    });

    const first = await publishBackgroundRunInboxResult({
      runsRoot,
      runId: record.runId,
      stateRoot,
      desktopRootLayout: layout,
    });
    expect(first.written).toBe(true);

    invalidateAppTopicsMock.mockClear();
    publishExtensionHostEventMock.mockClear();

    const second = await publishBackgroundRunInboxResult({
      runsRoot,
      runId: record.runId,
      stateRoot,
      desktopRootLayout: layout,
    });

    expect(second.messageId).toBe(first.messageId);
    expect(second.written).toBe(false);

    const store = getDocumentsStore(stateRoot, layout);
    const result = store.getDocument(INBOX_OWNER, INBOX_COLLECTION, first.messageId!);
    expect(result).not.toBeNull();
    expect(result!.id).toBe(first.messageId);
    expect(invalidateAppTopicsMock).not.toHaveBeenCalled();
    expect(publishExtensionHostEventMock).not.toHaveBeenCalled();
  });

  it('skips non-terminal runs', async () => {
    const record = await createBackgroundRunRecord(daemonRoot, {
      taskSlug: 'running-task',
      cwd: '/tmp',
      argv: [process.execPath, '-e', 'console.log("running")'],
      source: { type: 'background-run', id: 'running-task' },
      createdAt: '2026-07-07T00:00:00.000Z',
    });

    // Only mark as started, do not finalize; the run is still running.
    const startedAt = '2026-07-07T00:00:01.000Z';
    await markBackgroundRunStarted({
      runId: record.runId,
      runPaths: record.paths,
      startedAt,
      pid: 12345,
      taskSlug: 'running-task',
      cwd: '/tmp',
    });

    const result = await publishBackgroundRunInboxResult({
      runsRoot,
      runId: record.runId,
      stateRoot,
      desktopRootLayout: layout,
    });

    expect(result.written).toBe(false);
    expect(result.messageId).toBeUndefined();
  });

  it('skips missing runs', async () => {
    const result = await publishBackgroundRunInboxResult({
      runsRoot,
      runId: 'non-existent-run-id',
      stateRoot,
      desktopRootLayout: layout,
    });

    expect(result.written).toBe(false);
    expect(result.messageId).toBeUndefined();
  });

  it('includes worker name and command in the inbox body', async () => {
    const record = await createBackgroundRunRecord(daemonRoot, {
      taskSlug: 'detailed-task',
      cwd: '/workspace/project',
      argv: [process.execPath, '-e', 'console.log("detailed result")'],
      source: { type: 'background-run', id: 'detailed-task' },
      manifestMetadata: { workerName: 'Test Worker' },
      createdAt: '2026-07-07T00:00:00.000Z',
    });

    await finalizeBackgroundRun({
      runId: record.runId,
      runPaths: record.paths,
      taskSlug: 'detailed-task',
      cwd: '/workspace/project',
      startedAt: '2026-07-07T00:00:01.000Z',
      endedAt: '2026-07-07T00:01:00.000Z',
      exitCode: 0,
      signal: null,
      cancelled: false,
      summary: 'All checks passed.',
    });

    const result = await publishBackgroundRunInboxResult({
      runsRoot,
      runId: record.runId,
      stateRoot,
      desktopRootLayout: layout,
    });

    expect(result.written).toBe(true);
    const store = getDocumentsStore(stateRoot, layout);
    const doc = store.getDocument(INBOX_OWNER, INBOX_COLLECTION, result.messageId!);
    const body = doc!.body as Record<string, unknown>;
    expect(body.from).toBe('Test Worker');
    expect(body.body).toContain('completed');
  });
});

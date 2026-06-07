import { beforeEach, describe, expect, it, vi } from 'vitest';

const existsSyncMock = vi.fn(() => true);
const statSyncMock = vi.fn(() => ({ size: 100, isDirectory: () => false }));
const readSessionBlocksByFileMock = vi.fn(() => ({
  blocks: [],
  blockOffset: 0,
  totalBlocks: 0,
  contextUsage: null,
}));
const extensionHostClient = vi.hoisted(() => ({
  resolveModelProfile: vi.fn(async () => ({ kind: 'none' })),
}));

vi.mock('node:fs', () => ({
  existsSync: existsSyncMock,
  statSync: statSyncMock,
}));

vi.mock('./sessions.js', () => ({
  buildDisplayBlocksFromEntries: () => [],
  readSessionBlocksByFile: readSessionBlocksByFileMock,
}));

vi.mock('../extensions/extensionHostClient.js', () => ({
  getExtensionHostClient: () => extensionHostClient,
}));

describe('liveSessionStateSnapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    extensionHostClient.resolveModelProfile.mockResolvedValue({ kind: 'none' });
    existsSyncMock.mockReturnValue(true);
    statSyncMock.mockReturnValue({ size: 100, isDirectory: () => false });
  });

  it('defaults unsafe live snapshot tail block limits', async () => {
    const { buildLiveSessionSnapshot } = await import('./liveSessionStateSnapshot.js');

    statSyncMock.mockReturnValue({ size: 50_000, isDirectory: () => false });

    buildLiveSessionSnapshot(
      {
        session: {
          sessionFile: '/tmp/session.jsonl',
          isStreaming: false,
          state: { messages: [] },
        },
      } as never,
      Number.MAX_SAFE_INTEGER + 1,
    );

    expect(readSessionBlocksByFileMock).toHaveBeenCalledWith('/tmp/session.jsonl', { tailBlocks: 400 });
  });

  it('caps expensive live snapshot tail block limits', async () => {
    const { buildLiveSessionSnapshot } = await import('./liveSessionStateSnapshot.js');

    statSyncMock.mockReturnValue({ size: 50_000, isDirectory: () => false });

    buildLiveSessionSnapshot(
      {
        session: {
          sessionFile: '/tmp/session.jsonl',
          isStreaming: false,
          state: { messages: [] },
        },
      } as never,
      50000,
    );

    expect(readSessionBlocksByFileMock).toHaveBeenCalledWith('/tmp/session.jsonl', { tailBlocks: 10000 });
  });

  it('skips transcript reads for empty idle live sessions', async () => {
    const { buildLiveSessionSnapshot } = await import('./liveSessionStateSnapshot.js');

    const snapshot = buildLiveSessionSnapshot({
      session: {
        sessionFile: '/tmp/session.jsonl',
        isStreaming: false,
        state: { messages: [] },
        sessionManager: { getEntries: () => [] },
      },
    } as never);

    expect(snapshot).toMatchObject({ blocks: [], blockOffset: 0, totalBlocks: 0, isStreaming: false });
    expect(readSessionBlocksByFileMock).not.toHaveBeenCalled();
  });

  it('skips transcript reads for empty new live session files', async () => {
    const { buildLiveSessionSnapshot } = await import('./liveSessionStateSnapshot.js');

    const snapshot = buildLiveSessionSnapshot({
      session: {
        sessionFile: '/tmp/session.jsonl',
        isStreaming: true,
        state: { messages: [] },
        sessionManager: { getEntries: () => [] },
      },
    } as never);

    expect(snapshot).toMatchObject({ blocks: [], blockOffset: 0, totalBlocks: 0, isStreaming: true });
    expect(readSessionBlocksByFileMock).not.toHaveBeenCalled();
  });

  it('keeps transcript reads for non-empty streaming session files', async () => {
    const { buildLiveSessionSnapshot } = await import('./liveSessionStateSnapshot.js');

    statSyncMock.mockReturnValue({ size: 50_000, isDirectory: () => false });

    buildLiveSessionSnapshot({
      session: {
        sessionFile: '/tmp/session.jsonl',
        isStreaming: true,
        state: { messages: [] },
        sessionManager: { getEntries: () => [] },
      },
    } as never);

    expect(readSessionBlocksByFileMock).toHaveBeenCalledWith('/tmp/session.jsonl', { tailBlocks: 400 });
  });

  it('skips transcript reads for small streaming session files', async () => {
    const { buildLiveSessionSnapshot } = await import('./liveSessionStateSnapshot.js');

    const snapshot = buildLiveSessionSnapshot({
      session: {
        sessionFile: '/tmp/session.jsonl',
        isStreaming: true,
        state: {
          messages: [{ role: 'user', content: [{ type: 'text', text: 'hello' }], timestamp: '2026-05-26T12:00:00.000Z' }],
        },
        sessionManager: { getEntries: () => [{ type: 'message' }] },
      },
    } as never);

    expect(snapshot).toMatchObject({ blockOffset: 0, isStreaming: true });
    expect(readSessionBlocksByFileMock).not.toHaveBeenCalled();
  });

  it('builds minimal state snapshots for empty idle live sessions', async () => {
    const { readLiveSessionStateSnapshotFromEntry } = await import('./liveSessionStateSnapshot.js');

    extensionHostClient.resolveModelProfile.mockResolvedValue({ kind: 'resolved', profile: { extensionId: 'model-ext', id: 'gpt' } });

    const snapshot = await readLiveSessionStateSnapshotFromEntry(
      {
        session: {
          sessionFile: '/tmp/session.jsonl',
          isStreaming: false,
          model: { provider: 'openai', id: 'gpt-5.5' },
          state: {
            messages: [],
            get tools(): never {
              throw new Error('tools should not be read for empty snapshots');
            },
          },
          sessionManager: { getEntries: () => [{ type: 'session_meta', cwd: '/repo' }] },
          getSessionStats: () => {
            throw new Error('stats should not be read for empty snapshots');
          },
        },
      } as never,
      'New Conversation',
    );

    expect(snapshot).toMatchObject({
      blocks: [],
      totalBlocks: 0,
      systemPrompt: null,
      toolDefinitions: [],
      tokens: null,
      cost: null,
      modelProfile: { kind: 'resolved', modelRef: 'openai/gpt-5.5' },
    });
    expect(extensionHostClient.resolveModelProfile).toHaveBeenCalledWith({ provider: 'openai', model: 'gpt-5.5' });
    expect(readSessionBlocksByFileMock).not.toHaveBeenCalled();
  });

  it('treats waiting durable run state as idle even if pi session still reports streaming', async () => {
    const { buildLiveSessionSnapshot, readLiveSessionStateSnapshotFromEntry } = await import('./liveSessionStateSnapshot.js');

    const entry = {
      lastDurableRunState: 'waiting',
      session: {
        sessionFile: '/tmp/session.jsonl',
        isStreaming: true,
        model: { provider: 'openai', id: 'gpt' },
        state: { messages: [] },
        systemPrompt: '',
        sessionManager: { getEntries: () => [] },
        getSessionStats: () => ({ tokens: { input: 0, output: 0, total: 0 }, cost: 0 }),
      },
    } as never;

    expect(buildLiveSessionSnapshot(entry)).toMatchObject({ isStreaming: false });
    await expect(readLiveSessionStateSnapshotFromEntry(entry, 'Done')).resolves.toMatchObject({ isStreaming: false });
  });
});

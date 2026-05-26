import { beforeEach, describe, expect, it, vi } from 'vitest';

const existsSyncMock = vi.fn(() => true);
const readSessionBlocksByFileMock = vi.fn(() => ({
  blocks: [],
  blockOffset: 0,
  totalBlocks: 0,
  contextUsage: null,
}));

vi.mock('node:fs', () => ({
  existsSync: existsSyncMock,
  statSync: vi.fn(() => ({ isDirectory: () => false })),
}));

vi.mock('./sessions.js', () => ({
  buildDisplayBlocksFromEntries: () => [],
  readSessionBlocksByFile: readSessionBlocksByFileMock,
}));

describe('liveSessionStateSnapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('defaults unsafe live snapshot tail block limits', async () => {
    const { buildLiveSessionSnapshot } = await import('./liveSessionStateSnapshot.js');

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

  it('builds minimal state snapshots for empty idle live sessions', async () => {
    const { readLiveSessionStateSnapshotFromEntry } = await import('./liveSessionStateSnapshot.js');

    const snapshot = readLiveSessionStateSnapshotFromEntry(
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
    });
    expect(readSessionBlocksByFileMock).not.toHaveBeenCalled();
  });
});

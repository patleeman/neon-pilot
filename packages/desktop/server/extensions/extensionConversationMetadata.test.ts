import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const invalidateAppTopics = vi.fn();
const publishAppEvent = vi.fn();
const publishExtensionHostEvent = vi.fn();

vi.mock('../shared/appEvents.js', () => ({ invalidateAppTopics, publishAppEvent }));
vi.mock('./extensionSubscriptions.js', () => ({ publishExtensionHostEvent }));

const { queryConversationMetadata, readConversationMetadata, writeConversationMetadata } =
  await import('./extensionConversationMetadata.js');

describe('extensionConversationMetadata', () => {
  const stateRoot = join(tmpdir(), `conversation-metadata-${randomUUID()}`);

  beforeEach(() => {
    invalidateAppTopics.mockReset();
    publishAppEvent.mockReset();
    publishExtensionHostEvent.mockReset().mockResolvedValue(undefined);
    rmSync(stateRoot, { recursive: true, force: true });
  });

  afterEach(() => {
    rmSync(stateRoot, { recursive: true, force: true });
  });

  it('reads empty metadata for missing files and validates conversation ids', () => {
    expect(readConversationMetadata({ conversationId: ' c1 ', extensionId: 'ext', stateRoot })).toEqual({});
    expect(() => readConversationMetadata({ conversationId: '   ', extensionId: 'ext', stateRoot })).toThrow('conversationId required');
  });

  it('writes metadata under the extension namespace and publishes host updates', async () => {
    await expect(
      writeConversationMetadata({
        conversationId: ' conversation/one ',
        extensionId: 'ext',
        values: { pinned: true, score: 3, empty: null, '': 'ignored' },
        stateRoot,
      }),
    ).resolves.toEqual({ pinned: true, score: 3 });

    expect(readConversationMetadata({ conversationId: 'conversation/one', extensionId: 'ext', stateRoot })).toEqual({
      pinned: true,
      score: 3,
    });
    expect(invalidateAppTopics).toHaveBeenCalledWith('sessions');
    expect(publishAppEvent).toHaveBeenCalledWith({ type: 'session_meta_changed', sessionId: 'conversation/one' });
    expect(publishExtensionHostEvent).toHaveBeenCalledWith('conversationSessions', {
      type: 'session.metadata.updated',
      conversationId: 'conversation/one',
      namespace: 'ext',
      updatedAt: expect.any(String),
    });

    const encodedPath = join(stateRoot, 'conversation-metadata', 'shared', `${encodeURIComponent('conversation/one')}.json`);
    expect(JSON.parse(readFileSync(encodedPath, 'utf-8'))).toMatchObject({
      conversationId: 'conversation/one',
      namespaces: { ext: { pinned: true } },
    });
  });

  it('merges values, deletes nullish keys, supports explicit namespaces, and removes empty files', async () => {
    await writeConversationMetadata({ conversationId: 'c1', extensionId: 'ext', namespace: 'custom', values: { a: 1, b: 2 }, stateRoot });
    await expect(
      writeConversationMetadata({ conversationId: 'c1', extensionId: 'ext', namespace: 'custom', values: { b: null, c: 3 }, stateRoot }),
    ).resolves.toEqual({ a: 1, c: 3 });
    expect(readConversationMetadata({ conversationId: 'c1', extensionId: 'ext', namespace: 'custom', stateRoot })).toEqual({ a: 1, c: 3 });

    await writeConversationMetadata({
      conversationId: 'c1',
      extensionId: 'ext',
      namespace: 'custom',
      values: { a: undefined, c: null },
      stateRoot,
    });
    expect(existsSync(join(stateRoot, 'conversation-metadata', 'shared', 'c1.json'))).toBe(false);
  });

  it('recovers from corrupt files and rejects invalid write values or namespaces', async () => {
    const dir = join(stateRoot, 'conversation-metadata', 'shared');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'bad.json'), '{bad', 'utf-8');

    expect(readConversationMetadata({ conversationId: 'bad', extensionId: 'ext', stateRoot })).toEqual({});
    await expect(writeConversationMetadata({ conversationId: 'bad', extensionId: 'ext', values: [] as never, stateRoot })).rejects.toThrow(
      'values must be an object',
    );
    await expect(
      writeConversationMetadata({ conversationId: 'bad', extensionId: '', namespace: ' ', values: {}, stateRoot }),
    ).rejects.toThrow('namespace required');
  });

  it('queries metadata with eq, neq, in, exists, profile, and limit handling', async () => {
    await writeConversationMetadata({
      conversationId: 'c1',
      extensionId: 'ext',
      values: { status: 'open', priority: 1 },
      runtimeScope: 'p',
      stateRoot,
    });
    await writeConversationMetadata({
      conversationId: 'c2',
      extensionId: 'ext',
      values: { status: 'closed', priority: 2 },
      runtimeScope: 'p',
      stateRoot,
    });
    await writeConversationMetadata({ conversationId: 'c3', extensionId: 'ext', values: { status: 'open' }, runtimeScope: 'p', stateRoot });

    expect(queryConversationMetadata({ namespace: 'ext', runtimeScope: 'p', stateRoot, where: [{ key: 'status', value: 'open' }] })).toEqual([
      { conversationId: 'c1', metadata: { status: 'open', priority: 1 } },
      { conversationId: 'c3', metadata: { status: 'open' } },
    ]);
    expect(
      queryConversationMetadata({ namespace: 'ext', runtimeScope: 'p', stateRoot, where: [{ key: 'priority', op: 'in', value: [2, 3] }] }),
    ).toEqual([{ conversationId: 'c2', metadata: { status: 'closed', priority: 2 } }]);
    expect(
      queryConversationMetadata({ namespace: 'ext', runtimeScope: 'p', stateRoot, where: [{ key: 'priority', op: 'exists' }], limit: 1 }),
    ).toHaveLength(1);
    expect(
      queryConversationMetadata({ namespace: 'ext', runtimeScope: 'p', stateRoot, where: [{ key: 'status', op: 'neq', value: 'open' }] }),
    ).toEqual([{ conversationId: 'c2', metadata: { status: 'closed', priority: 2 } }]);
    expect(queryConversationMetadata({ namespace: 'ext', runtimeScope: 'missing', stateRoot })).toEqual([]);
  });
});

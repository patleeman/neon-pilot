import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const conversationService = vi.hoisted(() => ({ readConversationSessionMeta: vi.fn() }));
const conversationSummaries = vi.hoisted(() => ({ readConversationSummary: vi.fn() }));
const lifecycle = vi.hoisted(() => ({ registerLiveSessionLifecycleHandler: vi.fn() }));
const logging = vi.hoisted(() => ({ logError: vi.fn() }));

vi.mock('../conversations/conversationService.js', () => conversationService);
vi.mock('../conversations/conversationSummaries.js', () => conversationSummaries);
vi.mock('../conversations/liveSessionLifecycle.js', () => lifecycle);
vi.mock('../shared/logging.js', () => logging);

import {
  drainMemoryReflectionQueueForTests,
  queueMemoryReflection,
  queueMemoryReflectionForConversationOperation,
  registerMemoryReflectionLifecycleHandler,
  resetMemoryReflectionQueueForTests,
} from './memoryReflectionQueue.js';

const originalEnv = process.env;
const tempDirs: string[] = [];

function tempRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), 'neon-pilot-memory-reflection-'));
  tempDirs.push(dir);
  return dir;
}

function meta() {
  return {
    id: 'conversation-1',
    file: '/sessions/conversation-1.jsonl',
    timestamp: '2026-06-28T12:00:00.000Z',
    cwd: '/repo/app',
    cwdSlug: 'app',
    model: 'test',
    title: 'Discuss memory',
    messageCount: 4,
    lastActivityAt: '2026-06-28T12:05:00.000Z',
  };
}

function summary() {
  return {
    sessionId: 'conversation-1',
    fingerprint: 'fingerprint-1',
    title: 'Discuss memory',
    cwd: '/repo/app',
    displaySummary: 'The user wants durable memory with scopes and skills.',
    outcome: 'Memory design was clarified.',
    status: 'done',
    promptSummary: 'Discuss memory',
    searchText: 'memory scopes skills',
    keyTerms: ['memory', 'skills'],
    filesTouched: ['docs/memory.md'],
    updatedAt: '2026-06-28T12:06:00.000Z',
  };
}

beforeEach(() => {
  const root = tempRoot();
  process.env = {
    ...originalEnv,
    NEON_PILOT_KNOWLEDGE_ROOT: join(root, 'knowledge'),
    NEON_PILOT_STATE_ROOT: join(root, 'state'),
  };
  resetMemoryReflectionQueueForTests();
  vi.clearAllMocks();
  conversationService.readConversationSessionMeta.mockReturnValue(meta());
  conversationSummaries.readConversationSummary.mockReturnValue(summary());
});

afterEach(async () => {
  await drainMemoryReflectionQueueForTests();
  process.env = originalEnv;
  resetMemoryReflectionQueueForTests();
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('memory reflection queue', () => {
  it('writes reflection drafts into Git-backed memory', async () => {
    expect(queueMemoryReflection({ conversationId: 'conversation-1', trigger: 'auto_compaction_end' })).toBe(true);
    await drainMemoryReflectionQueueForTests();

    const reflectionPath = join(process.env.NEON_PILOT_KNOWLEDGE_ROOT!, 'memory', 'reflections', 'conversation-1.md');
    expect(existsSync(reflectionPath)).toBe(true);
    const content = readFileSync(reflectionPath, 'utf-8');
    expect(content).toContain('The user wants durable memory with scopes and skills.');
    expect(content).toContain('inject: false');
  });

  it('dedupes turn-end reflection by cooldown', () => {
    expect(queueMemoryReflection({ conversationId: 'conversation-1', trigger: 'turn_end' }, 1000)).toBe(true);
    expect(queueMemoryReflection({ conversationId: 'conversation-1', trigger: 'turn_end' }, 2000)).toBe(false);
  });

  it('registers live lifecycle reflection and queues close/archive operations', async () => {
    registerMemoryReflectionLifecycleHandler();
    expect(lifecycle.registerLiveSessionLifecycleHandler).toHaveBeenCalledTimes(1);
    const handler = lifecycle.registerLiveSessionLifecycleHandler.mock.calls[0]?.[0];

    handler({ conversationId: 'conversation-1', title: 'Discuss memory', cwd: '/repo/app', trigger: 'auto_compaction_end' });
    await drainMemoryReflectionQueueForTests();

    expect(queueMemoryReflectionForConversationOperation({ conversationId: 'conversation-1', operation: 'open' })).toBe(false);
    expect(queueMemoryReflectionForConversationOperation({ conversationId: 'conversation-1', operation: 'archive' })).toBe(true);
    await drainMemoryReflectionQueueForTests();
  });

  it('logs reflection failures without rejecting the background queue', async () => {
    conversationService.readConversationSessionMeta.mockImplementation(() => {
      throw new Error('metadata unavailable');
    });

    expect(queueMemoryReflection({ conversationId: 'conversation-1', trigger: 'auto_compaction_end' })).toBe(true);
    await drainMemoryReflectionQueueForTests();

    expect(logging.logError).toHaveBeenCalledWith('memory reflection job failed', {
      conversationId: 'conversation-1',
      trigger: 'auto_compaction_end',
      message: 'metadata unavailable',
    });
  });
});

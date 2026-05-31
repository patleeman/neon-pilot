import { describe, expect, it, vi } from 'vitest';

import { createExtensionBackendToolContextFromSnapshot, createExtensionHostToolContextSnapshot } from './extensionHostToolContext.js';

describe('extension host tool context snapshots', () => {
  it('keeps serializable tool metadata and drops callback channels', () => {
    const snapshot = createExtensionHostToolContextSnapshot({
      conversationId: 'conversation-1',
      cwd: '/repo',
      onUpdate: vi.fn(),
      preferredVisionModel: 'openai/gpt-4o',
      sessionFile: '/repo/session.jsonl',
      sessionId: 'session-1',
    });

    expect(snapshot).toEqual({
      conversationId: 'conversation-1',
      cwd: '/repo',
      preferredVisionModel: 'openai/gpt-4o',
      sessionFile: '/repo/session.jsonl',
      sessionId: 'session-1',
    });
  });

  it('recreates backend tool context from snapshots', () => {
    expect(createExtensionBackendToolContextFromSnapshot({ cwd: '/repo', sessionId: 'session-1' })).toEqual({
      cwd: '/repo',
      sessionId: 'session-1',
    });
    expect(createExtensionBackendToolContextFromSnapshot()).toBeUndefined();
  });
});

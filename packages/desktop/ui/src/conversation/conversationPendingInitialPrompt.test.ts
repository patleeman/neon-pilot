import { describe, expect, it } from 'vitest';

import type { PendingConversationPrompt } from '../pending/pendingConversationPrompt';
import {
  shouldClearAcceptedPendingInitialPrompt,
  shouldClearStalePendingInitialPrompt,
  shouldResetPendingInitialPromptFailureSession,
} from './conversationPendingInitialPrompt';

const prompt: PendingConversationPrompt = { text: 'hello', images: [], attachmentRefs: [] };

describe('conversationPendingInitialPrompt', () => {
  it('detects accepted pending initial prompts', () => {
    const messages = [{ type: 'user', text: 'hello', images: [] }] as never[];
    expect(
      shouldClearAcceptedPendingInitialPrompt({
        draft: false,
        conversationId: 'conv',
        pendingInitialPrompt: prompt,
        pendingInitialPromptDispatching: true,
        messages,
      }),
    ).toBe(true);
    expect(
      shouldClearAcceptedPendingInitialPrompt({
        draft: true,
        conversationId: 'conv',
        pendingInitialPrompt: prompt,
        pendingInitialPromptDispatching: true,
        messages,
      }),
    ).toBe(false);
  });

  it('detects stale pending initial prompts and failure reset conditions', () => {
    expect(
      shouldClearStalePendingInitialPrompt({
        draft: false,
        conversationId: 'conv',
        pendingInitialPrompt: prompt,
        pendingInitialPromptDispatching: false,
        messageCount: 1,
      }),
    ).toBe(true);
    expect(
      shouldClearStalePendingInitialPrompt({
        draft: false,
        conversationId: 'conv',
        pendingInitialPrompt: prompt,
        pendingInitialPromptDispatching: true,
        messageCount: 1,
      }),
    ).toBe(false);
    expect(shouldResetPendingInitialPromptFailureSession({ conversationId: undefined, pendingInitialPrompt: prompt })).toBe(true);
    expect(shouldResetPendingInitialPromptFailureSession({ conversationId: 'conv', pendingInitialPrompt: null })).toBe(true);
    expect(shouldResetPendingInitialPromptFailureSession({ conversationId: 'conv', pendingInitialPrompt: prompt })).toBe(false);
  });
});

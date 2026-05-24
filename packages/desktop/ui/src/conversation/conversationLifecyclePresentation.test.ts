import { describe, expect, it } from 'vitest';

import {
  buildConversationLifecycleContext,
  filterConversationLifecycleElements,
  resolveConversationLifecycleEvent,
} from './conversationLifecyclePresentation';

describe('conversationLifecyclePresentation', () => {
  it('resolves lifecycle event precedence', () => {
    const base = {
      hasSessionError: false,
      hasPendingAskUserQuestion: false,
      conversationNeedsTakeover: false,
      goalActive: false,
      isCompacting: false,
      conversationRunningForPage: false,
    };
    expect(resolveConversationLifecycleEvent(base)).toBeNull();
    expect(resolveConversationLifecycleEvent({ ...base, conversationRunningForPage: true })).toBe('after-run-start');
    expect(resolveConversationLifecycleEvent({ ...base, isCompacting: true, conversationRunningForPage: true })).toBe(
      'compaction-available',
    );
    expect(resolveConversationLifecycleEvent({ ...base, goalActive: true, isCompacting: true })).toBe('goal-active');
    expect(resolveConversationLifecycleEvent({ ...base, conversationNeedsTakeover: true, goalActive: true })).toBe('blocked');
    expect(resolveConversationLifecycleEvent({ ...base, hasPendingAskUserQuestion: true, conversationNeedsTakeover: true })).toBe(
      'waiting-for-user',
    );
    expect(resolveConversationLifecycleEvent({ ...base, hasSessionError: true, hasPendingAskUserQuestion: true })).toBe('model-error');
  });

  it('filters lifecycle elements and builds context', () => {
    const elements = [
      { id: 'run', events: ['after-run-start'] },
      { id: 'goal', events: ['goal-active'] },
    ];
    expect(filterConversationLifecycleElements(elements, 'goal-active')).toEqual([elements[1]]);
    expect(filterConversationLifecycleElements(elements, null)).toEqual([]);
    expect(
      buildConversationLifecycleContext({
        lifecycleEvent: 'goal-active',
        conversationId: 'conv',
        cwd: '/repo',
        isStreaming: true,
        hasGoal: true,
        isCompacting: false,
        error: undefined,
      }),
    ).toEqual({
      conversationId: 'conv',
      cwd: '/repo',
      event: 'goal-active',
      isStreaming: true,
      hasGoal: true,
      isCompacting: false,
      error: null,
    });
    expect(
      buildConversationLifecycleContext({
        lifecycleEvent: null,
        conversationId: undefined,
        cwd: null,
        isStreaming: false,
        hasGoal: false,
        isCompacting: false,
        error: null,
      }),
    ).toBeNull();
  });
});

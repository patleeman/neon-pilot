import { describe, expect, it } from 'vitest';

import {
  CHILD_CONVERSATION_TOPOLOGY_CUSTOM_TYPE,
  CONVERSATION_WORKSPACE_CHANGE_CUSTOM_TYPE,
  GOAL_CONTINUATION_CUSTOM_TYPE,
  isInjectedContextMessage,
  PARENT_CONVERSATION_BACKLINK_CUSTOM_TYPE,
  REFERENCED_CONTEXT_CUSTOM_TYPE,
} from './sessionInjectedContext';

describe('sessionInjectedContext', () => {
  it('detects custom messages that should be treated as injected context', () => {
    for (const customType of [
      REFERENCED_CONTEXT_CUSTOM_TYPE,
      CONVERSATION_WORKSPACE_CHANGE_CUSTOM_TYPE,
      CHILD_CONVERSATION_TOPOLOGY_CUSTOM_TYPE,
      PARENT_CONVERSATION_BACKLINK_CUSTOM_TYPE,
      GOAL_CONTINUATION_CUSTOM_TYPE,
    ]) {
      expect(isInjectedContextMessage({ role: 'custom', customType })).toBe(true);
    }
  });

  it('ignores non-custom or unrelated messages', () => {
    expect(isInjectedContextMessage({ role: 'assistant', customType: REFERENCED_CONTEXT_CUSTOM_TYPE })).toBe(false);
    expect(isInjectedContextMessage({ role: 'custom', customType: 'other' })).toBe(false);
    expect(isInjectedContextMessage({ role: 'custom' })).toBe(false);
  });
});

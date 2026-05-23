import { describe, expect, it } from 'vitest';

import {
  buildConversationStateBridgeEvent,
  shouldEmitConversationState,
  shouldRecoverConversationState,
} from './localApiConversationStateEvents';

describe('localApiConversationStateEvents', () => {
  it('emits state only while open and when serialized state changes', () => {
    expect(shouldEmitConversationState({ closed: false, serializedState: 'a', lastSerializedState: '' })).toBe(true);
    expect(shouldEmitConversationState({ closed: false, serializedState: 'a', lastSerializedState: 'a' })).toBe(false);
    expect(shouldEmitConversationState({ closed: true, serializedState: 'a', lastSerializedState: '' })).toBe(false);
  });

  it('builds conversation state bridge events', () => {
    expect(buildConversationStateBridgeEvent({ id: 'c1' })).toEqual({ type: 'state', state: { id: 'c1' } });
  });

  it('recovers only non-live state with session details while open', () => {
    expect(shouldRecoverConversationState({ closed: false, live: false, hasSessionDetail: true })).toBe(true);
    expect(shouldRecoverConversationState({ closed: false, live: true, hasSessionDetail: true })).toBe(false);
    expect(shouldRecoverConversationState({ closed: false, live: false, hasSessionDetail: false })).toBe(false);
    expect(shouldRecoverConversationState({ closed: true, live: false, hasSessionDetail: true })).toBe(false);
  });
});

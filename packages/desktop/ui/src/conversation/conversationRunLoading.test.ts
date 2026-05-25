import { describe, expect, it } from 'vitest';

import { filterVisibleActiveConversationBackgroundExecutions, shouldLoadConversationRun } from './conversationRunLoading';

describe('conversationRunLoading', () => {
  it('hides the active conversation run from background executions', () => {
    expect(filterVisibleActiveConversationBackgroundExecutions([{ id: 'run-1' }, { id: 'run-2' }], 'run-1')).toEqual([{ id: 'run-2' }]);
    expect(filterVisibleActiveConversationBackgroundExecutions([{ id: 'run-1' }], null)).toEqual([{ id: 'run-1' }]);
  });

  it('loads conversation run details only for stopped non-live conversations', () => {
    const base = { conversationRunId: 'run-1', draft: false, isLiveSession: false, stoppedMidTurn: false, stoppedWithError: false };
    expect(shouldLoadConversationRun(base)).toBe(false);
    expect(shouldLoadConversationRun({ ...base, stoppedMidTurn: true })).toBe(true);
    expect(shouldLoadConversationRun({ ...base, stoppedWithError: true })).toBe(true);
    expect(shouldLoadConversationRun({ ...base, conversationRunId: null, stoppedWithError: true })).toBe(false);
    expect(shouldLoadConversationRun({ ...base, knownRunIds: new Set(['run-2']), stoppedWithError: true })).toBe(false);
    expect(shouldLoadConversationRun({ ...base, knownRunIds: new Set(['run-1']), stoppedWithError: true })).toBe(true);
    expect(shouldLoadConversationRun({ ...base, draft: true, stoppedWithError: true })).toBe(false);
    expect(shouldLoadConversationRun({ ...base, isLiveSession: true, stoppedWithError: true })).toBe(false);
  });
});

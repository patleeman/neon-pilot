import { describe, expect, it } from 'vitest';

import { buildComposerQuestionAnswersStorageKey, hasAskUserQuestionAnswers } from './conversationQuestionAnswers';

describe('conversationQuestionAnswers', () => {
  it('builds storage keys only when conversation and pending question are present', () => {
    expect(buildComposerQuestionAnswersStorageKey('abc', 'q1')).toBe('pa:conversation-question-answers:abc:q1');
    expect(buildComposerQuestionAnswersStorageKey(undefined, 'q1')).toBeNull();
    expect(buildComposerQuestionAnswersStorageKey('abc', '')).toBeNull();
  });

  it('detects whether any answers are selected', () => {
    expect(hasAskUserQuestionAnswers({})).toBe(false);
    expect(hasAskUserQuestionAnswers({ q1: [] })).toBe(false);
    expect(hasAskUserQuestionAnswers({ q1: ['yes'] })).toBe(true);
  });
});

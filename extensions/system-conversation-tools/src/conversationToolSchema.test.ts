import { describe, expect, it } from 'vitest';

import { CONVERSATION_ACTIONS, ConversationToolParams } from './conversationToolSchema.js';

describe('conversationToolSchema', () => {
  it('declares the supported conversation actions in UI/tool order', () => {
    expect(CONVERSATION_ACTIONS).toEqual(['ask', 'inspect', 'set_title', 'change_working_directory', 'deferred_resume']);
  });

  it('combines action-specific properties into a closed conversation tool schema', () => {
    expect(ConversationToolParams.additionalProperties).toBe(false);
    expect(Object.keys(ConversationToolParams.properties)).toEqual(
      expect.arrayContaining([
        'action',
        'question',
        'inspectAction',
        'title',
        'cwd',
        'continuePrompt',
        'deferredAction',
        'trigger',
        'delay',
        'deliverAs',
        'reason',
      ]),
    );
    expect(ConversationToolParams.required).toEqual(['action']);
  });

  it('keeps deferred resume action optional inside the merged schema while requiring top-level action', () => {
    expect(JSON.stringify(ConversationToolParams.properties.action)).toContain('deferred_resume');
    expect(JSON.stringify(ConversationToolParams.properties.deferredAction)).toContain('cancel');
    expect(ConversationToolParams.properties.reason.description).toContain('Required when scheduling a wakeup');
  });
});

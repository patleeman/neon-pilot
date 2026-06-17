import { describe, expect, it } from 'vitest';

import { CONVERSATION_ACTIONS, ConversationToolParams } from './conversationToolSchema.js';

describe('conversationToolSchema', () => {
  it('declares the supported conversation actions in UI/tool order', () => {
    expect(CONVERSATION_ACTIONS).toEqual([
      'activity',
      'connections',
      'inspect',
      'set_title',
      'change_working_directory',
      'deferred_resume',
      'create',
      'create_and_run',
      'ensure_live',
      'send_message',
      'run_turn',
      'abort',
      'compact',
      'fork',
      'set_active_tools',
      'workspace_get',
      'workspace_update',
      'workspace_open_update',
      'delete',
      'retention_prune',
      'append_transcript_block',
      'update_transcript_block',
      'rollback',
    ]);
  });

  it('combines action-specific properties into a closed conversation tool schema', () => {
    expect(ConversationToolParams.additionalProperties).toBe(false);
    expect(Object.keys(ConversationToolParams.properties)).toEqual(
      expect.arrayContaining([
        'action',
        'inspectAction',
        'title',
        'cwd',
        'continuePrompt',
        'deferredAction',
        'trigger',
        'delay',
        'deliverAs',
        'reason',
        'conversationId',
        'text',
        'steer',
        'images',
        'timeoutMs',
        'toolNames',
        'openConversationIds',
        'remoteControlledConversationIds',
        'blockType',
        'blockId',
        'count',
      ]),
    );
    expect(ConversationToolParams.required).toEqual(['action']);
  });

  it('keeps deferred resume action optional inside the merged schema while requiring top-level action', () => {
    expect(JSON.stringify(ConversationToolParams.properties.action)).toContain('deferred_resume');
    expect(JSON.stringify(ConversationToolParams.properties.deferredAction)).toContain('cancel');
    expect(ConversationToolParams.properties.reason.description).toContain('Required when scheduling a wakeup');
  });

  it('includes key conversation admin actions and parameters', () => {
    expect(JSON.stringify(ConversationToolParams.properties.action)).toContain('run_turn');
    expect(JSON.stringify(ConversationToolParams.properties.action)).toContain('workspace_update');
    expect(JSON.stringify(ConversationToolParams.properties.images)).toContain('mimeType');
    expect(JSON.stringify(ConversationToolParams.properties.toolNames)).toContain('Active tool names');
  });
});

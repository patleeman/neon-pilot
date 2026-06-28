import { describe, expect, it, vi } from 'vitest';

import { repairDanglingToolCallContext, resolveTranscriptTailRecoveryPlan } from './liveSessionRecovery.js';

type BranchEntry = {
  type: string;
  id: string;
  parentId?: string | null;
  message?: {
    role: string;
    content: Array<Record<string, unknown>>;
    toolCallId?: string;
    stopReason?: string;
    errorMessage?: string;
  };
  details?: unknown;
};

function message(
  id: string,
  parentId: string | null,
  role: string,
  content: Array<Record<string, unknown>>,
  extra: Record<string, unknown> = {},
): BranchEntry {
  return {
    type: 'message',
    id,
    parentId,
    message: {
      role,
      content,
      ...extra,
    },
  };
}

function user(id: string, parentId: string | null, text = 'prompt'): BranchEntry {
  return message(id, parentId, 'user', [{ type: 'text', text }]);
}

function assistantToolCall(id: string, parentId: string | null, toolCallId = 'call_1'): BranchEntry {
  return message(id, parentId, 'assistant', [{ type: 'toolCall', id: toolCallId, name: 'read', arguments: { path: 'README.md' } }], {
    stopReason: 'toolUse',
  });
}

function toolResult(id: string, parentId: string | null, toolCallId = 'call_1'): BranchEntry {
  return {
    type: 'message',
    id,
    parentId,
    message: {
      role: 'toolResult',
      toolCallId,
      content: [{ type: 'text', text: 'ok' }],
    },
  };
}

function assistantText(id: string, parentId: string | null, text = 'done'): BranchEntry {
  return message(id, parentId, 'assistant', [{ type: 'text', text }], { stopReason: 'stop' });
}

function overflowRecoverySummary(id: string, parentId: string | null): BranchEntry {
  return {
    type: 'branch_summary',
    id,
    parentId,
    details: {
      source: 'conversation-recovery',
      reason: 'assistant_error',
      errorMessage: 'Codex error: context_length_exceeded',
    },
  } as BranchEntry;
}

describe('live session recovery', () => {
  describe('resolveTranscriptTailRecoveryPlan', () => {
    it('recovers a tail assistant tool call with no result by planning synthetic aborted output', () => {
      const plan = resolveTranscriptTailRecoveryPlan({
        getBranch: () => [user('user-1', null), assistantToolCall('assistant-1', 'user-1')],
      } as never);

      expect(plan).toMatchObject({
        targetEntryId: null,
        reason: 'dangling_tool_call',
        summary: 'Recovered from an unfinished tool-use tail so the conversation can continue from the last stable point.',
        danglingToolCalls: [{ toolCallId: 'call_1', toolName: 'read' }],
      });
    });

    it('does not rewrite older dangling tool calls before a later final assistant answer', () => {
      const plan = resolveTranscriptTailRecoveryPlan({
        getBranch: () => [
          user('user-1', null),
          assistantToolCall('assistant-1', 'user-1', 'call_stale'),
          user('user-2', 'assistant-1', 'continue'),
          assistantText('assistant-2', 'user-2', 'Implemented and checkpointed.'),
        ],
      } as never);

      expect(plan).toBeNull();
    });

    it('does not repair after a later user message because the missing output is no longer the tail', () => {
      const plan = resolveTranscriptTailRecoveryPlan({
        getBranch: () => [
          user('user-1', null),
          assistantToolCall('assistant-1', 'user-1', 'call_stale'),
          user('user-2', 'assistant-1', 'What else to do?'),
        ],
      } as never);

      expect(plan).toBeNull();
    });

    it('does not recover when the tail tool call has a matching result', () => {
      const plan = resolveTranscriptTailRecoveryPlan({
        getBranch: () => [user('user-1', null), assistantToolCall('assistant-1', 'user-1'), toolResult('tool-1', 'assistant-1')],
      } as never);

      expect(plan).toBeNull();
    });

    it('recovers when the tail assistant has multiple tool calls and only some trailing results arrived', () => {
      const plan = resolveTranscriptTailRecoveryPlan({
        getBranch: () => [
          user('user-1', null),
          message(
            'assistant-1',
            'user-1',
            'assistant',
            [
              { type: 'toolCall', id: 'call_1', name: 'read', arguments: {} },
              { type: 'toolCall', id: 'call_2', name: 'bash', arguments: {} },
            ],
            { stopReason: 'toolUse' },
          ),
          toolResult('tool-1', 'assistant-1', 'call_1'),
        ],
      } as never);

      expect(plan).toMatchObject({
        targetEntryId: null,
        reason: 'dangling_tool_call',
        danglingToolCalls: [{ toolCallId: 'call_2', toolName: 'bash' }],
      });
    });

    it('does not keep adding branch summaries after a context overflow recovery already failed', () => {
      const plan = resolveTranscriptTailRecoveryPlan({
        getBranch: () => [
          user('user-1', null),
          overflowRecoverySummary('summary-1', 'user-1'),
          user('user-2', 'summary-1', 'status?'),
          message('assistant-1', 'user-2', 'assistant', [], {
            stopReason: 'error',
            errorMessage: 'Codex error: context_length_exceeded',
          }),
        ],
      } as never);

      expect(plan).toBeNull();
    });
  });

  describe('repairDanglingToolCallContext', () => {
    it('appends synthetic aborted tool results for dangling tail calls', () => {
      const appendMessage = vi.fn();
      const buildSessionContext = vi.fn(() => ({
        messages: [
          { role: 'user', content: [{ type: 'text', text: 'prompt' }] },
          { role: 'assistant', content: [{ type: 'toolCall', id: 'call_stale', name: 'read', arguments: {} }] },
          { role: 'toolResult', toolCallId: 'call_stale', content: [{ type: 'text', text: 'aborted' }] },
          { role: 'custom', customType: 'conversation_recovery_turn_aborted', content: '<turn_aborted>marker</turn_aborted>' },
        ],
      }));
      const state = { messages: [{ role: 'assistant', content: [{ type: 'toolCall', id: 'call_stale', name: 'read', arguments: {} }] }] };

      const repaired = repairDanglingToolCallContext({
        state,
        sessionManager: {
          getBranch: () => [user('user-1', null), assistantToolCall('assistant-1', 'user-1', 'call_stale')],
          getEntry: vi.fn(),
          appendMessage,
          buildSessionContext,
        },
      } as never);

      expect(repaired).toBe(true);
      expect(appendMessage).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          role: 'toolResult',
          toolCallId: 'call_stale',
          toolName: 'read',
          content: [{ type: 'text', text: 'aborted' }],
          isError: true,
          details: expect.objectContaining({ source: 'conversation-recovery', reason: 'dangling_tool_call', synthetic: true }),
        }),
      );
      expect(appendMessage).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          role: 'custom',
          customType: 'conversation_recovery_turn_aborted',
          display: false,
          content: expect.stringContaining('<turn_aborted>'),
          details: expect.objectContaining({ source: 'conversation-recovery', reason: 'dangling_tool_call', synthetic: true }),
        }),
      );
      expect(buildSessionContext).toHaveBeenCalledOnce();
      expect(state.messages.at(-1)).toMatchObject({ role: 'custom', customType: 'conversation_recovery_turn_aborted' });
    });
  });
});

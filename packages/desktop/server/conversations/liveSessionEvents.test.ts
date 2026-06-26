import { describe, expect, it } from 'vitest';

import { toSse } from './liveSessionEvents.js';

describe('toSse tool execution events', () => {
  it('drops empty streamed deltas before broadcasting', () => {
    expect(
      toSse({
        type: 'message_update',
        message: {},
        assistantMessageEvent: { type: 'text_delta', delta: '' },
      } as never),
    ).toBeNull();
    expect(
      toSse({
        type: 'message_update',
        message: {},
        assistantMessageEvent: { type: 'thinking_delta', delta: '' },
      } as never),
    ).toBeNull();
    expect(
      toSse({
        type: 'tool_execution_update',
        toolCallId: 'tool-1',
        partialResult: '',
      } as never),
    ).toBeNull();
    expect(
      toSse({
        type: 'tool_execution_update',
        toolCallId: 'tool-1',
        partialResult: { content: [{ text: '' }] },
      } as never),
    ).toBeNull();
  });

  it('keeps ordinary bash tool calls in the generic tool pipeline', () => {
    const start = toSse({
      type: 'tool_execution_start',
      toolCallId: 'bash-1',
      toolName: 'bash',
      args: { command: 'pwd' },
    } as never);
    const end = toSse({
      type: 'tool_execution_end',
      toolCallId: 'bash-1',
      toolName: 'bash',
      isError: false,
      result: {
        content: [{ type: 'text', text: '/repo' }],
      },
    } as never);

    expect(start).toEqual({
      type: 'tool_start',
      toolCallId: 'bash-1',
      toolName: 'bash',
      args: { command: 'pwd' },
    });
    expect(end).toMatchObject({
      type: 'tool_end',
      toolCallId: 'bash-1',
      toolName: 'bash',
      isError: false,
      output: '/repo',
    });
    expect(end && 'details' in end ? end.details : undefined).toBeUndefined();
  });

  it('presents extension-host abort tool failures without leaking local RPC URLs', () => {
    const end = toSse({
      type: 'tool_execution_end',
      toolCallId: 'bash-abort',
      toolName: 'bash',
      isError: false,
      result: {
        content: [
          {
            type: 'text',
            text: 'Extension host RPC request action:system-runs/bash failed at http://127.0.0.1:55183/action: This operation was aborted',
          },
        ],
      },
    } as never);

    expect(end).toMatchObject({
      type: 'tool_end',
      toolCallId: 'bash-abort',
      toolName: 'bash',
      isError: true,
      output: 'Stopped before finishing. The tool call was interrupted or cancelled.',
    });
  });

  it('broadcasts structured streamed tool partials with text content', () => {
    const partialResult = { content: [{ type: 'text', text: 'streamed output' }] };

    expect(
      toSse({
        type: 'tool_execution_update',
        toolCallId: 'tool-structured',
        partialResult,
      } as never),
    ).toEqual({
      type: 'tool_update',
      toolCallId: 'tool-structured',
      partialResult: 'streamed output',
    });
  });

  it('normalizes accumulated tool progress into deltas for transcript streaming', () => {
    expect(
      toSse({
        type: 'tool_execution_start',
        toolCallId: 'tool-accumulated',
        toolName: 'bash',
        args: {},
      } as never),
    ).toMatchObject({ type: 'tool_start', toolCallId: 'tool-accumulated' });
    expect(
      toSse({
        type: 'tool_execution_update',
        toolCallId: 'tool-accumulated',
        partialResult: { content: [{ type: 'text', text: 'first' }] },
      } as never),
    ).toEqual({ type: 'tool_update', toolCallId: 'tool-accumulated', partialResult: 'first' });
    expect(
      toSse({
        type: 'tool_execution_update',
        toolCallId: 'tool-accumulated',
        partialResult: { content: [{ type: 'text', text: 'first second' }] },
      } as never),
    ).toEqual({ type: 'tool_update', toolCallId: 'tool-accumulated', partialResult: ' second' });
    expect(
      toSse({
        type: 'tool_execution_update',
        toolCallId: 'tool-accumulated',
        partialResult: { content: [{ type: 'text', text: 'first second' }] },
      } as never),
    ).toBeNull();
    expect(
      toSse({
        type: 'tool_execution_end',
        toolCallId: 'tool-accumulated',
        toolName: 'bash',
        isError: false,
        result: { content: [{ type: 'text', text: 'first second' }] },
      } as never),
    ).toMatchObject({ type: 'tool_end', toolCallId: 'tool-accumulated' });
  });

  it('broadcasts bash tool names directly', () => {
    const start = toSse({
      type: 'tool_execution_start',
      toolCallId: 'shell-1',
      toolName: 'bash',
      args: { command: 'pwd', background: true },
    } as never);
    const end = toSse({
      type: 'tool_execution_end',
      toolCallId: 'shell-1',
      toolName: 'bash',
      isError: false,
      result: { content: [{ type: 'text', text: 'done' }] },
    } as never);

    expect(start).toMatchObject({ type: 'tool_start', toolName: 'bash' });
    expect(end).toMatchObject({ type: 'tool_end', toolName: 'bash' });
  });

  it('preserves explicit bash tool details without forcing terminal mode', () => {
    const end = toSse({
      type: 'tool_execution_end',
      toolCallId: 'bash-2',
      toolName: 'bash',
      isError: false,
      result: {
        content: [{ type: 'text', text: 'done' }],
        details: { exitCode: 0 },
      },
    } as never);

    expect(end).toMatchObject({
      type: 'tool_end',
      toolCallId: 'bash-2',
      toolName: 'bash',
      details: { exitCode: 0 },
    });
    expect(end && 'details' in end && typeof end.details === 'object' && end.details !== null ? 'displayMode' in end.details : false).toBe(
      false,
    );
  });

  it('maps compaction lifecycle events', () => {
    expect(
      toSse({
        type: 'compaction_start',
        reason: 'overflow',
      } as never),
    ).toEqual({ type: 'compaction_start', mode: 'auto', reason: 'overflow' });

    expect(
      toSse({
        type: 'compaction_end',
        reason: 'overflow',
        aborted: false,
        willRetry: true,
        result: { summary: 'short', firstKeptEntryId: 'entry-1', tokensBefore: 120000 },
      } as never),
    ).toEqual({
      type: 'compaction_end',
      mode: 'auto',
      reason: 'overflow',
      aborted: false,
      willRetry: true,
      tokensBefore: 120000,
    });

    expect(
      toSse({
        type: 'compaction_end',
        reason: 'manual',
        aborted: false,
        willRetry: false,
        result: undefined,
        errorMessage: 'Compaction failed: nope',
      } as never),
    ).toEqual({
      type: 'compaction_end',
      mode: 'manual',
      reason: 'manual',
      aborted: false,
      willRetry: false,
      errorMessage: 'Compaction failed: nope',
    });
  });
});

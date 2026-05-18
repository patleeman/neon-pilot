import { describe, expect, it, vi } from 'vitest';

import { createContextHardeningAgentExtension, TOOL_RESULT_TEXT_MAX_CHARS, truncateToolResultMessage } from './backend.js';

describe('context hardening', () => {
  it('truncates oversized tool-result text blocks', () => {
    const message = {
      role: 'toolResult' as const,
      content: [{ type: 'text' as const, text: 'a'.repeat(TOOL_RESULT_TEXT_MAX_CHARS + 1000) }],
    };

    expect(truncateToolResultMessage(message)).toBe(true);
    expect(message.content[0].text.length).toBeLessThanOrEqual(TOOL_RESULT_TEXT_MAX_CHARS);
    expect(message.content[0].text).toContain('Personal Agent truncated oversized tool output');
    expect(message.truncated).toBe(true);
    expect(message.details?.contextHardening).toMatchObject({ truncated: true, maxChars: TOOL_RESULT_TEXT_MAX_CHARS });
  });

  it('mutates tool-result message_end events before persistence', async () => {
    const handlers = new Map<string, Array<(event: Record<string, unknown>) => unknown>>();
    const pi = {
      on: vi.fn((name: string, handler: (event: Record<string, unknown>) => unknown) => {
        handlers.set(name, [...(handlers.get(name) ?? []), handler]);
      }),
    };

    createContextHardeningAgentExtension()(pi as never);
    const event = {
      type: 'message_end',
      message: { role: 'toolResult', content: [{ type: 'text', text: 'x'.repeat(TOOL_RESULT_TEXT_MAX_CHARS + 1) }] },
    };

    await handlers.get('message_end')?.[0]?.(event);

    expect((event.message.content[0] as { text: string }).text).toContain('Personal Agent truncated oversized tool output');
  });

  it('caps OpenAI Responses function call output payloads as a provider-request backstop', () => {
    const handlers = new Map<string, Array<(event: Record<string, unknown>) => unknown>>();
    const pi = {
      on: vi.fn((name: string, handler: (event: Record<string, unknown>) => unknown) => {
        handlers.set(name, [...(handlers.get(name) ?? []), handler]);
      }),
    };

    createContextHardeningAgentExtension()(pi as never);
    const payload = { input: [{ type: 'function_call_output', call_id: 'call_1', output: 'y'.repeat(TOOL_RESULT_TEXT_MAX_CHARS + 1) }] };

    const rewritten = handlers.get('before_provider_request')?.[0]?.({ type: 'before_provider_request', payload });

    expect(rewritten).toBe(payload);
    expect((payload.input[0] as { output: string }).output).toContain('Personal Agent truncated oversized tool output');
  });
});

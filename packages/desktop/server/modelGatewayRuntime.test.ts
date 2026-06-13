import { describe, expect, it } from 'vitest';

import { responsesInputToPiMessages } from './modelGatewayRuntime.js';

describe('modelGatewayRuntime', () => {
  it('replays Codex Responses function calls before matching tool outputs', () => {
    const messages = responsesInputToPiMessages([
      { role: 'user', content: 'list tmp' },
      { type: 'function_call', call_id: 'call_1', name: 'shell', arguments: '{"command":"ls"}' },
      { type: 'function_call_output', call_id: 'call_1', output: 'file.txt' },
    ]);

    expect(messages).toMatchObject([
      { role: 'user', content: 'list tmp' },
      {
        role: 'assistant',
        content: [{ type: 'toolCall', id: 'call_1', name: 'shell', arguments: { command: 'ls' } }],
        stopReason: 'tool_use',
      },
      {
        role: 'toolResult',
        toolCallId: 'call_1',
        toolName: 'shell',
        content: [{ type: 'text', text: 'file.txt' }],
      },
    ]);
  });
});

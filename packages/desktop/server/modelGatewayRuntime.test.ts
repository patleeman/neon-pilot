import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildContext, requestToolsToPiTools, responsesInputToPiMessages, writeModelGatewayCatalog } from './modelGatewayRuntime.js';

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
        stopReason: 'toolUse',
      },
      {
        role: 'toolResult',
        toolCallId: 'call_1',
        toolName: 'shell',
        content: [{ type: 'text', text: 'file.txt' }],
      },
    ]);
  });

  it('keeps tool results adjacent when Codex interleaves assistant text before output', () => {
    const messages = responsesInputToPiMessages([
      { role: 'user', content: 'say note and list tmp' },
      { type: 'function_call', call_id: 'call_1', name: 'shell', arguments: '{"command":"pwd"}' },
      { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'NOTE' }] },
      { type: 'function_call_output', call_id: 'call_1', output: '/tmp' },
    ]);

    expect(messages).toMatchObject([
      { role: 'user', content: 'say note and list tmp' },
      {
        role: 'assistant',
        content: [{ type: 'text', text: 'NOTE' }],
        stopReason: 'stop',
      },
      {
        role: 'assistant',
        content: [{ type: 'toolCall', id: 'call_1', name: 'shell', arguments: { command: 'pwd' } }],
        stopReason: 'toolUse',
      },
      {
        role: 'toolResult',
        toolCallId: 'call_1',
        toolName: 'shell',
        content: [{ type: 'text', text: '/tmp' }],
      },
    ]);
  });

  it('coalesces consecutive function calls before matching tool outputs', () => {
    const messages = responsesInputToPiMessages([
      { role: 'user', content: 'run both' },
      { type: 'function_call', call_id: 'call_1', name: 'shell', arguments: '{"command":"pwd"}' },
      { type: 'function_call', call_id: 'call_2', name: 'shell', arguments: '{"command":"ls"}' },
      { type: 'function_call_output', call_id: 'call_1', output: '/tmp' },
      { type: 'function_call_output', call_id: 'call_2', output: 'file.txt' },
    ]);

    expect(messages).toMatchObject([
      { role: 'user', content: 'run both' },
      {
        role: 'assistant',
        content: [
          { type: 'toolCall', id: 'call_1', name: 'shell', arguments: { command: 'pwd' } },
          { type: 'toolCall', id: 'call_2', name: 'shell', arguments: { command: 'ls' } },
        ],
        stopReason: 'toolUse',
      },
      { role: 'toolResult', toolCallId: 'call_1', toolName: 'shell', content: [{ type: 'text', text: '/tmp' }] },
      { role: 'toolResult', toolCallId: 'call_2', toolName: 'shell', content: [{ type: 'text', text: 'file.txt' }] },
    ]);
  });

  it('preserves invalid JSON function arguments as an empty object', () => {
    const messages = responsesInputToPiMessages([
      { type: 'function_call', call_id: 'call_1', name: 'broken', arguments: '{' },
      { type: 'function_call_output', call_id: 'call_1', output: 'ignored' },
    ]);

    expect(messages[0]).toMatchObject({
      role: 'assistant',
      content: [{ type: 'toolCall', id: 'call_1', name: 'broken', arguments: {} }],
    });
  });

  it('preserves text and data-url images from Codex input messages', () => {
    const messages = responsesInputToPiMessages([
      {
        role: 'user',
        content: [
          { type: 'input_text', text: 'Inspect this.' },
          { type: 'input_image', image_url: 'data:image/png;base64,QUJD', detail: 'original' },
        ],
      },
    ]);

    expect(messages).toMatchObject([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Inspect this.' },
          { type: 'image', mimeType: 'image/png', data: 'QUJD' },
        ],
      },
    ]);
  });

  it('preserves computer call screenshots as tool result images', () => {
    const messages = responsesInputToPiMessages([
      {
        type: 'computer_call_output',
        call_id: 'cu_1',
        output: { type: 'input_image', image_url: 'data:image/jpeg;base64,REVG' },
      },
    ]);

    expect(messages).toMatchObject([
      {
        role: 'toolResult',
        toolCallId: 'cu_1',
        toolName: 'computer_use',
        content: [{ type: 'image', mimeType: 'image/jpeg', data: 'REVG' }],
      },
    ]);
  });

  it('preserves visual function call outputs as tool result images', () => {
    const messages = responsesInputToPiMessages([
      { type: 'function_call', call_id: 'call_1', name: 'computer_use', arguments: '{}' },
      {
        type: 'function_call_output',
        call_id: 'call_1',
        output: [{ type: 'input_image', image_url: 'data:image/png;base64,R0hJ' }],
      },
    ]);

    expect(messages).toMatchObject([
      {
        role: 'assistant',
        content: [{ type: 'toolCall', id: 'call_1', name: 'computer_use', arguments: {} }],
      },
      {
        role: 'toolResult',
        toolCallId: 'call_1',
        toolName: 'computer_use',
        content: [{ type: 'image', mimeType: 'image/png', data: 'R0hJ' }],
      },
    ]);
  });

  it('attaches developer messages to the Pi system prompt', () => {
    const context = buildContext({
      instructions: 'System',
      input: [
        { type: 'message', role: 'developer', content: [{ type: 'input_text', text: 'Rules' }] },
        { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Hi' }] },
      ],
    });

    expect(context.systemPrompt).toBe('System\n\nRules');
    expect(context.messages).toMatchObject([{ role: 'user', content: 'Hi' }]);
  });

  it('provides function fallbacks for native Codex tool declarations', () => {
    const tools = requestToolsToPiTools([
      { type: 'computer_use_preview' },
      { type: 'web_search_preview' },
      { type: 'apply_patch' },
      { type: 'function', name: 'list_mcp_resources', parameters: { type: 'object' } },
    ]);

    expect(tools).toMatchObject([
      { name: 'computer_use', parameters: { required: ['action'] } },
      { name: 'web_search', parameters: { required: ['query'] } },
      { name: 'apply_patch', parameters: { required: ['patch'] } },
      { name: 'list_mcp_resources', parameters: { type: 'object' } },
    ]);
  });

  it('writes a Codex model catalog for custom provider model metadata', () => {
    const runtimeDir = mkdtempSync(join(tmpdir(), 'model-gateway-catalog-'));
    try {
      const path = writeModelGatewayCatalog({ runtimeDir });
      const catalog = JSON.parse(readFileSync(path, 'utf8')) as { models: Array<Record<string, unknown>> };

      expect(path).toBe(join(runtimeDir, 'model-gateway', 'codex-model-catalog.json'));
      expect(catalog.models).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            slug: 'neon-pilot-fake',
            display_name: 'Neon Pilot Fake',
            visibility: 'list',
            apply_patch_tool_type: 'freeform',
            shell_type: 'shell_command',
            model_messages: expect.any(Object),
          }),
        ]),
      );
    } finally {
      rmSync(runtimeDir, { recursive: true, force: true });
    }
  });
});

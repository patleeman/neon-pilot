import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

const { streamMock } = vi.hoisted(() => ({
  streamMock: vi.fn(),
}));

vi.mock('@earendil-works/pi-ai/compat', () => ({ stream: streamMock }));

import {
  buildContext,
  createModelGatewayResponse,
  requestToolsToPiTools,
  responsesInputToPiMessages,
  streamModelGatewayResponseEvents,
  writeModelGatewayCatalog,
} from './modelGatewayRuntime.js';

describe('modelGatewayRuntime', () => {
  function fileMode(path: string): number {
    return statSync(path).mode & 0o777;
  }

  function createRuntimeWithModel(prefix: string): string {
    const runtimeDir = mkdtempSync(join(tmpdir(), prefix));
    writeFileSync(
      join(runtimeDir, 'models.json'),
      JSON.stringify({
        providers: {
          test: {
            baseUrl: 'http://127.0.0.1:1/v1',
            api: 'openai-responses',
            apiKey: 'test-key',
            models: [{ id: 'alpha', name: 'Alpha', input: ['text'], contextWindow: 128000 }],
          },
        },
      }),
    );
    return runtimeDir;
  }

  function usage(input = 11, output = 7) {
    return {
      input,
      output,
      cacheRead: 3,
      cacheWrite: 2,
      totalTokens: input + output,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    };
  }

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

  it('converts non-fake provider responses into Responses API output', async () => {
    const runtimeDir = createRuntimeWithModel('model-gateway-response-');
    try {
      streamMock.mockReturnValueOnce({
        result: async () => ({
          role: 'assistant',
          content: [
            { type: 'text', text: 'Hello' },
            { type: 'thinking', thinking: 'Plan' },
            { type: 'toolCall', id: 'call_1', name: 'lookup', arguments: { q: 'neon' } },
          ],
          provider: 'test',
          model: 'alpha',
          api: 'openai-responses',
          usage: usage(),
          stopReason: 'stop',
          timestamp: Date.now(),
          responseId: 'resp_provider',
        }),
      });

      await expect(
        createModelGatewayResponse(
          { runtimeDir },
          { model: 'test/alpha', input: 'Say hello', temperature: 0.2, max_output_tokens: 64 },
          { host: '127.0.0.1', port: 8766, defaultModel: 'test/alpha', authToken: 'token' },
        ),
      ).resolves.toMatchObject({
        id: 'resp_provider',
        object: 'response',
        status: 'completed',
        model: 'test/alpha',
        output: [
          { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Hello', annotations: [] }] },
          { type: 'reasoning', summary: [{ type: 'summary_text', text: 'Plan' }] },
          { type: 'function_call', call_id: 'call_1', name: 'lookup', arguments: '{"q":"neon"}' },
        ],
        usage: {
          input_tokens: 11,
          output_tokens: 7,
          total_tokens: 18,
          input_tokens_details: { cached_tokens: 3, cache_creation_input_tokens: 2 },
        },
      });

      expect(streamMock).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'alpha', provider: 'test' }),
        expect.objectContaining({ messages: [{ role: 'user', content: 'Say hello', timestamp: expect.any(Number) }] }),
        expect.objectContaining({ apiKey: 'test-key', temperature: 0.2, maxTokens: 64 }),
      );
    } finally {
      rmSync(runtimeDir, { recursive: true, force: true });
    }
  });

  it('streams non-fake provider text, tool calls, completion, and done sentinel as Responses events', async () => {
    const runtimeDir = createRuntimeWithModel('model-gateway-stream-');
    try {
      const events = async function* () {
        yield { type: 'text_delta', delta: 'Hel' };
        yield { type: 'text_delta', delta: 'lo' };
        yield { type: 'toolcall_end', toolCall: { id: 'call_1', name: 'lookup', arguments: { q: 'neon' } } };
        yield {
          type: 'done',
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: 'Hello' }],
            provider: 'test',
            model: 'alpha',
            api: 'openai-responses',
            usage: usage(5, 2),
            stopReason: 'stop',
            timestamp: Date.now(),
            responseId: 'resp_done',
          },
        };
      };
      streamMock.mockReturnValueOnce(events());

      const output = [];
      for await (const event of streamModelGatewayResponseEvents(
        { runtimeDir },
        { model: 'test/alpha', input: 'Say hello' },
        { host: '127.0.0.1', port: 8766, defaultModel: 'test/alpha', authToken: 'token' },
      )) {
        output.push(event);
      }

      expect(output).toEqual([
        expect.objectContaining({
          type: 'response.created',
          response: expect.objectContaining({ status: 'in_progress', model: 'test/alpha' }),
        }),
        {
          type: 'response.output_item.added',
          output_index: 0,
          item: { id: 'msg_0', type: 'message', status: 'in_progress', role: 'assistant', content: [] },
        },
        { type: 'response.output_text.delta', output_index: 0, content_index: 0, delta: 'Hel' },
        { type: 'response.output_text.delta', output_index: 0, content_index: 0, delta: 'lo' },
        { type: 'response.output_text.done', output_index: 0, content_index: 0, text: 'Hello' },
        {
          type: 'response.output_item.done',
          output_index: 0,
          item: {
            id: 'msg_0',
            type: 'message',
            status: 'completed',
            role: 'assistant',
            content: [{ type: 'output_text', text: 'Hello', annotations: [] }],
          },
        },
        {
          type: 'response.output_item.added',
          output_index: 1,
          item: {
            id: 'call_1',
            type: 'function_call',
            status: 'in_progress',
            call_id: 'call_1',
            name: 'lookup',
            arguments: '{"q":"neon"}',
          },
        },
        {
          type: 'response.output_item.done',
          output_index: 1,
          item: {
            id: 'call_1',
            type: 'function_call',
            status: 'completed',
            call_id: 'call_1',
            name: 'lookup',
            arguments: '{"q":"neon"}',
          },
        },
        expect.objectContaining({
          type: 'response.completed',
          response: expect.objectContaining({ id: 'resp_done', status: 'completed', model: 'test/alpha' }),
        }),
        '[DONE]',
      ]);
    } finally {
      rmSync(runtimeDir, { recursive: true, force: true });
    }
  });

  it('writes a model catalog for custom provider model metadata', () => {
    const runtimeDir = mkdtempSync(join(tmpdir(), 'model-gateway-catalog-'));
    try {
      const path = writeModelGatewayCatalog({ runtimeDir });
      const catalog = JSON.parse(readFileSync(path, 'utf8')) as { models: Array<Record<string, unknown>> };

      expect(path).toBe(join(runtimeDir, 'model-gateway', 'model-catalog.json'));
      expect(fileMode(path)).toBe(0o600);
      expect(catalog.models).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            slug: 'neon-pilot-fake',
            display_name: 'Neon Pilot Fake',
            priority: 1,
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

  it('orders auto first in the model catalog when gateway models exist', () => {
    const runtimeDir = mkdtempSync(join(tmpdir(), 'model-gateway-catalog-models-'));
    try {
      writeFileSync(
        join(runtimeDir, 'models.json'),
        JSON.stringify({
          providers: {
            test: {
              baseUrl: 'http://127.0.0.1:1/v1',
              api: 'openai-completions',
              apiKey: 'test',
              models: [{ id: 'alpha', name: 'Alpha', input: ['text'], contextWindow: 128000 }],
            },
          },
        }),
      );
      const path = writeModelGatewayCatalog({ runtimeDir });
      const catalog = JSON.parse(readFileSync(path, 'utf8')) as { models: Array<Record<string, unknown>> };

      expect(catalog.models.slice(0, 3)).toEqual([
        expect.objectContaining({ slug: 'auto', display_name: 'Neon Pilot Auto', priority: 0 }),
        expect.objectContaining({ slug: 'neon-pilot-fake', display_name: 'Neon Pilot Fake', priority: 1 }),
        expect.objectContaining({ slug: 'test/alpha', display_name: 'Alpha', priority: 2 }),
      ]);
    } finally {
      rmSync(runtimeDir, { recursive: true, force: true });
    }
  });
});

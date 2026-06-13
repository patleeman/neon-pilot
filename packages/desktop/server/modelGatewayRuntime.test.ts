import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  buildContext,
  installModelGatewayCodexConfig,
  readModelGatewayCodexConfigStatus,
  removeModelGatewayCodexConfig,
  requestToolsToPiTools,
  responsesInputToPiMessages,
  writeModelGatewayCatalog,
} from './modelGatewayRuntime.js';

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

  it('installs a managed Codex config block and preserves previous top-level model settings', () => {
    const runtimeDir = mkdtempSync(join(tmpdir(), 'model-gateway-install-'));
    const configPath = join(runtimeDir, 'codex', 'config.toml');
    try {
      mkdirSync(join(runtimeDir, 'codex'), { recursive: true });
      writeFileSync(
        configPath,
        [
          'model = "gpt-5.5"',
          'model_provider = "openai"',
          'approval_policy = "never"',
          '',
          '[model_providers.neon-pilot]',
          'base_url = "http://old"',
          '',
          '[profiles.default]',
          'model = "gpt-5.5"',
          '',
        ].join('\n'),
      );

      const result = installModelGatewayCodexConfig(
        { runtimeDir },
        { host: '127.0.0.1', port: 8766, defaultModel: 'auto' },
        { configPath },
      );
      const next = readFileSync(configPath, 'utf8');

      expect(result.status).toMatchObject({ installed: true, activeProvider: 'neon-pilot', activeModel: 'auto' });
      expect(result.backupPath && existsSync(result.backupPath)).toBe(true);
      expect(next).toContain('# >>> neon-pilot-model-gateway managed >>>');
      expect(next).toContain('# neon-pilot previous-top-level = model = "gpt-5.5"');
      expect(next).toContain('model_catalog_json = "');
      expect(next).toContain('[model_providers.neon-pilot]');
      expect(next).toContain('approval_policy = "never"');
      expect(next).not.toContain('base_url = "http://old"');
    } finally {
      rmSync(runtimeDir, { recursive: true, force: true });
    }
  });

  it('removes the managed Codex config block and restores previous top-level settings', () => {
    const runtimeDir = mkdtempSync(join(tmpdir(), 'model-gateway-remove-'));
    const configPath = join(runtimeDir, 'codex', 'config.toml');
    try {
      mkdirSync(join(runtimeDir, 'codex'), { recursive: true });
      writeFileSync(configPath, 'model = "gpt-5.5"\nmodel_provider = "openai"\napproval_policy = "never"\n');
      installModelGatewayCodexConfig({ runtimeDir }, { host: '127.0.0.1', port: 8766, defaultModel: 'auto' }, { configPath });
      const result = removeModelGatewayCodexConfig({ runtimeDir }, { configPath });
      const next = readFileSync(configPath, 'utf8');

      expect(result.status).toMatchObject({ installed: false, managed: false });
      expect(result.backupPath && existsSync(result.backupPath)).toBe(true);
      expect(next).toContain('model = "gpt-5.5"');
      expect(next).toContain('model_provider = "openai"');
      expect(next).toContain('approval_policy = "never"');
      expect(next).not.toContain('neon-pilot-model-gateway managed');
      expect(readModelGatewayCodexConfigStatus({ runtimeDir }, { configPath })).toMatchObject({ installed: false });
    } finally {
      rmSync(runtimeDir, { recursive: true, force: true });
    }
  });
});

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const PKG_ROOT = resolve(import.meta.dirname, '..');
const EXTENSION_JSON_PATH = resolve(PKG_ROOT, 'extension.json');

describe('system-conversation-tools manifest', () => {
  const manifest = JSON.parse(readFileSync(EXTENSION_JSON_PATH, 'utf-8'));

  it('declares conversation list context menu actions', () => {
    expect(manifest.contributes.contextMenus).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'duplicate-conversation',
          title: 'Duplicate',
          action: 'duplicateConversation',
          surface: 'conversationList',
        }),
        expect.objectContaining({
          id: 'copy-working-directory',
          title: 'Copy Working Directory',
          action: 'copyWorkingDirectory',
          surface: 'conversationList',
        }),
        expect.objectContaining({
          id: 'copy-conversation-id',
          title: 'Copy Session ID',
          action: 'copyConversationId',
          surface: 'conversationList',
        }),
        expect.objectContaining({ id: 'copy-deeplink', title: 'Copy Deeplink', action: 'copyDeeplink', surface: 'conversationList' }),
      ]),
    );
  });

  it('declares backend handlers for context menu actions', () => {
    expect(manifest.backend.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'duplicateConversation', handler: 'duplicateConversation' }),
        expect.objectContaining({ id: 'copyWorkingDirectory', handler: 'copyWorkingDirectory' }),
        expect.objectContaining({ id: 'copyConversationId', handler: 'copyConversationId' }),
        expect.objectContaining({ id: 'copyDeeplink', handler: 'copyDeeplink' }),
      ]),
    );
  });

  it('keeps question prompts on the generic tool renderer and normal bash tool calls grouped', () => {
    expect(manifest.contributes.transcriptRenderers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'terminal-bash-tool-block', tool: 'bash', component: 'TerminalBashTranscriptRenderer' }),
      ]),
    );

    expect(manifest.contributes.transcriptRenderers).not.toEqual(expect.arrayContaining([expect.objectContaining({ tool: 'ask_user' })]));

    const bashRenderer = manifest.contributes.transcriptRenderers.find(
      (renderer: { id: string }) => renderer.id === 'terminal-bash-tool-block',
    );
    expect(bashRenderer).not.toHaveProperty('standalone');
  });

  it('does not expose duplicate conversation self-admin tools to models', () => {
    const toolNames = (manifest.contributes.tools ?? []).map((t: { name?: string }) => t.name);
    expect(toolNames).toEqual(['ask_user']);
    expect(toolNames).not.toEqual(
      expect.arrayContaining(['conversation_admin', 'conversation_inspect', 'conversation_title', 'conversation_cwd', 'deferred_resume']),
    );
  });

  it('declares backend actions for the focused conversation tools', () => {
    const actionIds = (manifest.backend.actions ?? []).map((a: { id: string }) => a.id);
    expect(actionIds).toEqual(
      expect.arrayContaining([
        'conversationTool',
        'askUser',
        'conversationInspect',
        'conversationTitle',
        'conversationCwd',
        'deferredResume',
      ]),
    );
  });

  it('declares conversation CLI commands on the conversation tool action', () => {
    expect(manifest.contributes.cliCommands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ command: 'conversations list', action: 'conversationTool' }),
        expect.objectContaining({ command: 'conversations search', action: 'conversationTool' }),
        expect.objectContaining({ command: 'conversations inspect', action: 'conversationTool' }),
        expect.objectContaining({ command: 'conversations create', action: 'conversationTool' }),
        expect.objectContaining({ command: 'conversations title', action: 'conversationTool' }),
        expect.objectContaining({ command: 'conversations cwd', action: 'conversationTool' }),
        expect.objectContaining({ command: 'conversations abort', action: 'conversationTool' }),
        expect.objectContaining({ command: 'conversations compact', action: 'conversationTool' }),
        expect.objectContaining({ command: 'conversations workspace', action: 'conversationTool' }),
      ]),
    );
  });

  it('keeps query and workspace CLI positional schemas explicit', () => {
    const commands = new Map(manifest.contributes.cliCommands.map((command: { command: string }) => [command.command, command]));

    expect(commands.get('conversations list')).toMatchObject({
      usage: 'conversations list [query...] [--json]',
      argsSchema: { items: { type: 'string' } },
    });
    expect(commands.get('conversations search')).toMatchObject({
      usage: 'conversations search [query...] [--json]',
      argsSchema: { items: { type: 'string' } },
    });
    expect(commands.get('conversations workspace')).toMatchObject({
      usage: 'conversations workspace [--json]',
      argsSchema: { maxItems: 0 },
    });
    expect(commands.get('conversations open list')).toMatchObject({
      usage: 'conversations open list [--json]',
      argsSchema: { maxItems: 0 },
    });
  });

  it('keeps write-side conversation CLI positional schemas aligned with backend normalization', () => {
    const commands = new Map(manifest.contributes.cliCommands.map((command: { command: string }) => [command.command, command]));

    expect(commands.get('conversations create')).toMatchObject({
      usage:
        'conversations create [title...] [--title <title>] [--cwd <path>] [--model <provider/model>] [--live] [--initial-prompt <text>] [--thinking-level <level>] [--service-tier <tier>] [--tool <name>] [--json]',
      argsSchema: { description: 'Optional positional args: title.' },
      flagsSchema: {
        properties: {
          title: { type: 'string' },
          cwd: { type: 'string' },
          model: { type: 'string' },
          live: { type: 'boolean' },
          'initial-prompt': { type: 'string' },
          prompt: { type: 'string' },
          'thinking-level': { type: 'string' },
          'service-tier': { type: 'string' },
          tool: { type: 'string' },
          tools: { type: 'string' },
        },
      },
    });
    expect(commands.get('conversations open active')).toMatchObject({
      usage: 'conversations open active [conversationId] [--json]',
      argsSchema: { maxItems: 1 },
    });
    expect(commands.get('conversations retention prune')).toMatchObject({
      usage: 'conversations retention prune [olderThan] [--older-than <duration>] [--archived-only] [--dry-run] [--json]',
      argsSchema: { maxItems: 1 },
      flagsSchema: { properties: { 'older-than': { type: 'string' }, 'archived-only': { type: 'boolean' } } },
    });
    expect(commands.get('conversations transcript append')).toMatchObject({
      usage: 'conversations transcript append <conversationId> [type] [--type <type>] [--data <json>] [--json]',
      argsSchema: { minItems: 1, maxItems: 2 },
      flagsSchema: { properties: { type: { type: 'string' }, data: { type: 'string' } } },
    });
    expect(commands.get('conversations transcript update')).toMatchObject({
      usage: 'conversations transcript update <conversationId> <blockId> [type] [--type <type>] [--data <json>] [--json]',
      argsSchema: { minItems: 2, maxItems: 3 },
      flagsSchema: { properties: { type: { type: 'string' }, data: { type: 'string' }, 'block-id': { type: 'string' } } },
    });
  });

  it('does not use an agentExtension for conversation tools', () => {
    expect(manifest.backend.agentExtension).toBeUndefined();
  });
});

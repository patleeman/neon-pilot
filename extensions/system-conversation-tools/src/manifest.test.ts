import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createConversationToolsAgentExtension } from './backend.js';

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

  it('keeps question prompts standalone and groups normal bash tool calls into internal work', () => {
    expect(manifest.contributes.transcriptRenderers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'ask-user-question-tool-block', tool: 'ask_user_question', standalone: true }),
        expect.objectContaining({ id: 'terminal-bash-tool-block', tool: 'bash', component: 'TerminalBashTranscriptRenderer' }),
      ]),
    );

    const bashRenderer = manifest.contributes.transcriptRenderers.find(
      (renderer: { id: string }) => renderer.id === 'terminal-bash-tool-block',
    );
    expect(bashRenderer).not.toHaveProperty('standalone');
  });

  it('registers only the consolidated conversation agent tool', () => {
    const registered: Array<{ name?: string }> = [];
    const pi = {
      registerTool(tool: { name?: string }) {
        registered.push(tool);
      },
    };

    createConversationToolsAgentExtension()(pi as never);

    expect(registered.map((tool) => tool.name)).toEqual(['conversation']);
    expect(registered.map((tool) => tool.name)).not.toEqual(
      expect.arrayContaining(['ask_user_question', 'conversation_inspect', 'set_conversation_title', 'change_working_directory']),
    );
  });
});

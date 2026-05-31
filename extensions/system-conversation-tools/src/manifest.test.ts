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

  it('declares focused conversation tools in contributes.tools', () => {
    const toolNames = (manifest.contributes.tools ?? []).map((t: { name?: string }) => t.name);
    expect(toolNames).toEqual(['conversation', 'ask_user', 'conversation_inspect', 'conversation_title', 'conversation_cwd', 'deferred_resume']);
    expect(manifest.contributes.tools[0]).toEqual(
      expect.objectContaining({
        name: 'conversation',
        action: 'conversationTool',
      }),
    );
  });

  it('declares backend actions for the focused conversation tools', () => {
    const actionIds = (manifest.backend.actions ?? []).map((a: { id: string }) => a.id);
    expect(actionIds).toEqual(
      expect.arrayContaining(['conversationTool', 'askUser', 'conversationInspect', 'conversationTitle', 'conversationCwd', 'deferredResume']),
    );
  });

  it('does not use an agentExtension for conversation tools', () => {
    expect(manifest.backend.agentExtension).toBeUndefined();
  });
});

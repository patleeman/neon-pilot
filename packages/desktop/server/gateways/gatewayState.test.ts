import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  attachGatewayConversation,
  detachArchivedGatewayConversations,
  ensureGatewayConnection,
  readGatewayState,
  resolveGatewayStateFile,
} from './gatewayState.js';

let tempDir: string | null = null;

function makeStateRoot(): string {
  tempDir = mkdtempSync(join(tmpdir(), 'pa-gateway-state-'));
  return tempDir;
}

afterEach(() => {
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
    tempDir = null;
  }
});

describe('gatewayState', () => {
  it('creates a telegram gateway connection', () => {
    const stateRoot = makeStateRoot();

    ensureGatewayConnection({ stateRoot, profile: 'shared', provider: 'telegram' });
    const state = readGatewayState({ stateRoot, profile: 'shared' });

    expect(state.connections).toMatchObject([{ provider: 'telegram', label: 'Telegram', status: 'needs_config' }]);
  });

  it('writes gateway state files with restrictive permissions', () => {
    const stateRoot = makeStateRoot();

    ensureGatewayConnection({ stateRoot, profile: 'shared', provider: 'telegram' });

    expect(statSync(resolveGatewayStateFile(stateRoot, 'shared')).mode & 0o777).toBe(0o600);
  });

  it('keeps extension gateway providers in persisted state and public provider summaries', () => {
    const stateRoot = makeStateRoot();

    ensureGatewayConnection({ stateRoot, profile: 'shared', provider: 'discord' });
    const state = readGatewayState({
      stateRoot,
      profile: 'shared',
      providers: [
        {
          id: 'discord',
          label: 'Discord',
          description: 'Route Discord messages into Neon Pilot.',
          implemented: true,
          configurationLocation: 'extension',
          extensionId: 'discord-gateway',
        },
      ],
    });

    expect(state.providers).toMatchObject([{ id: 'discord', label: 'Discord', extensionId: 'discord-gateway' }]);
    expect(state.connections).toMatchObject([{ provider: 'discord', label: 'discord', status: 'needs_config' }]);
  });

  it('keeps multiple external chat bindings for one provider connection', () => {
    const stateRoot = makeStateRoot();

    attachGatewayConversation({
      stateRoot,
      profile: 'shared',
      provider: 'discord',
      conversationId: 'conv-a',
      conversationTitle: 'A',
      externalChatId: 'C123',
      externalChatLabel: 'channel-a',
    });
    const state = attachGatewayConversation({
      stateRoot,
      profile: 'shared',
      provider: 'discord',
      conversationId: 'conv-b',
      conversationTitle: 'B',
      externalChatId: 'C456',
      externalChatLabel: 'channel-b',
    });

    expect(state.bindings).toHaveLength(2);
    expect(state.bindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ conversationId: 'conv-a', externalChatId: 'C123', conversationTitle: 'A' }),
        expect.objectContaining({ conversationId: 'conv-b', externalChatId: 'C456', conversationTitle: 'B' }),
      ]),
    );
  });

  it('updates an existing external chat binding without duplicating it', () => {
    const stateRoot = makeStateRoot();

    attachGatewayConversation({
      stateRoot,
      profile: 'shared',
      provider: 'discord',
      conversationId: 'conv-a',
      conversationTitle: 'A',
      externalChatId: 'C123',
      externalChatLabel: 'old-label',
    });
    const state = attachGatewayConversation({
      stateRoot,
      profile: 'shared',
      provider: 'discord',
      conversationId: 'conv-b',
      conversationTitle: 'B',
      externalChatId: 'C123',
      externalChatLabel: 'new-label',
    });

    expect(state.bindings).toHaveLength(1);
    expect(state.bindings[0]).toMatchObject({ conversationId: 'conv-b', externalChatId: 'C123', externalChatLabel: 'new-label' });
  });

  it('keeps chat target config when a gateway thread is detached', () => {
    const stateRoot = makeStateRoot();
    attachGatewayConversation({
      stateRoot,
      profile: 'shared',
      provider: 'telegram',
      conversationId: 'conv-a',
      conversationTitle: 'A',
      externalChatId: '123456789',
      externalChatLabel: '123456789',
    });

    const state = detachArchivedGatewayConversations({ stateRoot, profile: 'shared', conversationIds: ['conv-a'] });

    expect(state.bindings).toEqual([]);
    expect(state.chatTargets).toMatchObject([{ provider: 'telegram', externalChatId: '123456789', repliesEnabled: false }]);
  });

  it('detaches archived conversations from gateways', () => {
    const stateRoot = makeStateRoot();
    attachGatewayConversation({ stateRoot, profile: 'shared', provider: 'telegram', conversationId: 'conv-a', conversationTitle: 'A' });

    const state = detachArchivedGatewayConversations({ stateRoot, profile: 'shared', conversationIds: ['conv-a'] });

    expect(state.bindings).toEqual([]);
    expect(state.events[0]?.message).toContain('archived');
  });
});

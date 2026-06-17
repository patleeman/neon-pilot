import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const resolver = vi.hoisted(() => ({ callServerExtensionModuleExport: vi.fn(), callServerModuleExport: vi.fn() }));

vi.mock('./serverModuleResolver.js', () => resolver);

describe('backendApi/conversations', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('exports inspect constants used by tool schemas', async () => {
    const conversations = await import('./conversations.js');

    expect(conversations.CONVERSATION_INSPECT_SCOPE_VALUES).toEqual(['all', 'live', 'running', 'archived']);
    expect(conversations.CONVERSATION_INSPECT_ACTION_VALUES).toContain('read_window');
    expect(conversations.CONVERSATION_INSPECT_BLOCK_TYPE_VALUES).toContain('tool_use');
    expect(conversations.CONVERSATION_INSPECT_SEARCH_MODE_VALUES).toEqual(['phrase', 'allTerms', 'anyTerm']);
  });

  it('forwards direct conversation API calls to their owning server modules', async () => {
    const conversations = await import('./conversations.js');
    resolver.callServerModuleExport.mockResolvedValueOnce('Normalized Title');
    await expect(conversations.normalizeGeneratedConversationTitle('  title  ')).resolves.toBe('Normalized Title');
    expect(resolver.callServerModuleExport).toHaveBeenLastCalledWith(
      '../../conversations/conversationAutoTitle.js',
      'normalizeGeneratedConversationTitle',
      '  title  ',
    );

    resolver.callServerModuleExport.mockResolvedValueOnce({ sessionId: 'session-1' });
    await expect(conversations.createSession('/repo', { title: 'Hello' })).resolves.toEqual({ sessionId: 'session-1' });
    expect(resolver.callServerModuleExport).toHaveBeenLastCalledWith('../../conversations/liveSessions.js', 'createSession', '/repo', {
      title: 'Hello',
    });

    resolver.callServerModuleExport.mockResolvedValueOnce([{ id: 'conv-1' }]);
    await expect(conversations.searchIndexedConversationDocuments({ query: 'hello' })).resolves.toEqual([{ id: 'conv-1' }]);
    expect(resolver.callServerModuleExport).toHaveBeenLastCalledWith(
      '../../conversations/conversationSearchIndex.js',
      'searchIndexedConversationDocuments',
      { query: 'hello' },
    );
  });

  it('resolves and validates existing conversation directories through the host API', async () => {
    const conversations = await import('./conversations.js');
    const root = mkdtempSync(join(tmpdir(), 'np-conversation-cwd-'));
    const target = join(root, 'repo');
    mkdirSync(target);
    const file = join(root, 'notes.txt');
    writeFileSync(file, 'not a directory\n');
    resolver.callServerModuleExport.mockResolvedValueOnce(target);

    await expect(conversations.resolveExistingConversationDirectory('./repo', root)).resolves.toBe(target);
    expect(resolver.callServerModuleExport).toHaveBeenLastCalledWith(
      '../../conversations/conversationCwd.js',
      'resolveRequestedCwd',
      './repo',
      root,
    );

    resolver.callServerModuleExport.mockResolvedValueOnce(file);
    await expect(conversations.resolveExistingConversationDirectory('./notes.txt', root)).rejects.toThrow(`Not a directory: ${file}`);
  });

  it('wraps unavailable backend API export errors with conversation-specific context', async () => {
    const conversations = await import('./conversations.js');
    resolver.callServerModuleExport.mockRejectedValueOnce(new Error('Backend API export executeConversationInspect is unavailable.'));

    await expect(conversations.executeConversationInspect({ inspectAction: 'list' })).rejects.toThrow(
      'Conversation backend API export executeConversationInspect is unavailable.',
    );
  });

  it('does not wrap unrelated server module errors', async () => {
    const conversations = await import('./conversations.js');
    resolver.callServerModuleExport.mockRejectedValueOnce(new Error('database locked'));

    await expect(conversations.readSessionDetailForRoute('session-1')).rejects.toThrow('database locked');
  });

  it('routes extension conversation mutations through the extension conversations capability', async () => {
    const conversations = await import('./conversations.js');
    const capability = {
      create: vi.fn().mockResolvedValue({ id: 'created' }),
      fork: vi.fn().mockResolvedValue({ id: 'forked' }),
      appendTranscriptBlock: vi.fn().mockResolvedValue({ id: 'block-1' }),
      updateTranscriptBlock: vi.fn().mockResolvedValue({ id: 'block-1', updated: true }),
    };
    resolver.callServerExtensionModuleExport.mockResolvedValue(capability);

    await expect(conversations.createConversation({ title: 'New' })).resolves.toEqual({ id: 'created' });
    await expect(conversations.forkConversation('conv-1')).resolves.toEqual({ id: 'forked' });
    await expect(conversations.appendTranscriptBlock('conv-1', { role: 'assistant' })).resolves.toEqual({ id: 'block-1' });
    await expect(conversations.updateTranscriptBlock('conv-1', 'block-1', { text: 'updated' })).resolves.toEqual({
      id: 'block-1',
      updated: true,
    });

    expect(resolver.callServerExtensionModuleExport).toHaveBeenCalledWith(
      '../extensionConversations.js',
      'createExtensionConversationsCapability',
    );
    expect(resolver.callServerModuleExport).not.toHaveBeenCalledWith(
      '../extensionConversations.js',
      'createExtensionConversationsCapability',
    );
    expect(capability.create).toHaveBeenCalledWith({ title: 'New' });
    expect(capability.fork).toHaveBeenCalledWith('conv-1');
    expect(capability.appendTranscriptBlock).toHaveBeenCalledWith('conv-1', { role: 'assistant' });
    expect(capability.updateTranscriptBlock).toHaveBeenCalledWith('conv-1', 'block-1', { text: 'updated' });
  });

  it('routes extension metadata and runtime helpers through the extension module resolver', async () => {
    const conversations = await import('./conversations.js');
    resolver.callServerExtensionModuleExport.mockResolvedValueOnce({ ok: true });
    await expect(conversations.writeConversationMetadata({ conversationId: 'conv-1' })).resolves.toEqual({ ok: true });
    expect(resolver.callServerExtensionModuleExport).toHaveBeenLastCalledWith(
      '../extensionConversationMetadata.js',
      'writeConversationMetadata',
      { conversationId: 'conv-1' },
    );

    resolver.callServerExtensionModuleExport.mockResolvedValueOnce(['factory']);
    await expect(conversations.buildLiveSessionExtensionFactoriesForRuntime('shared')).resolves.toEqual(['factory']);
    expect(resolver.callServerExtensionModuleExport).toHaveBeenLastCalledWith(
      '../runtimeAgentHooks.js',
      'buildLiveSessionExtensionFactoriesForRuntime',
      'shared',
    );
  });
});

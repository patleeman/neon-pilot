import { beforeEach, describe, expect, it, vi } from 'vitest';

const resolver = vi.hoisted(() => ({ callServerModuleExport: vi.fn() }));

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
    resolver.callServerModuleExport.mockResolvedValue(capability);

    await expect(conversations.createConversation({ title: 'New' })).resolves.toEqual({ id: 'created' });
    await expect(conversations.forkConversation('conv-1')).resolves.toEqual({ id: 'forked' });
    await expect(conversations.appendTranscriptBlock('conv-1', { role: 'assistant' })).resolves.toEqual({ id: 'block-1' });
    await expect(conversations.updateTranscriptBlock('conv-1', 'block-1', { text: 'updated' })).resolves.toEqual({
      id: 'block-1',
      updated: true,
    });

    expect(resolver.callServerModuleExport).toHaveBeenCalledWith('../extensionConversations.js', 'createExtensionConversationsCapability');
    expect(capability.create).toHaveBeenCalledWith({ title: 'New' });
    expect(capability.fork).toHaveBeenCalledWith('conv-1');
    expect(capability.appendTranscriptBlock).toHaveBeenCalledWith('conv-1', { role: 'assistant' });
    expect(capability.updateTranscriptBlock).toHaveBeenCalledWith('conv-1', 'block-1', { text: 'updated' });
  });
});

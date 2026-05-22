import { beforeEach, describe, expect, it, vi } from 'vitest';

const conversationsBackend = vi.hoisted(() => ({
  CONVERSATION_INSPECT_ACTION_VALUES: ['list', 'search', 'query', 'diff', 'outline', 'read_window'],
  CONVERSATION_INSPECT_BLOCK_TYPE_VALUES: ['user', 'text', 'context', 'summary', 'tool_use', 'image', 'error'],
  CONVERSATION_INSPECT_ORDER_VALUES: ['asc', 'desc'],
  CONVERSATION_INSPECT_ROLE_VALUES: ['user', 'assistant', 'tool', 'context', 'summary', 'image', 'error'],
  CONVERSATION_INSPECT_SCOPE_VALUES: ['all', 'live', 'running', 'archived'],
  CONVERSATION_INSPECT_SEARCH_MODE_VALUES: ['phrase', 'allTerms', 'anyTerm'],
  buildLiveSessionExtensionFactoriesForRuntime: vi.fn(),
  buildLiveSessionResourceOptionsForRuntime: vi.fn(),
  requestConversationWorkingDirectoryChange: vi.fn(),
}));
const queue = vi.hoisted(() => ({ deferredResume: vi.fn() }));
const ask = vi.hoisted(() => ({ executeAskUserQuestion: vi.fn() }));
const cwd = vi.hoisted(() => ({ executeChangeWorkingDirectory: vi.fn() }));
const inspect = vi.hoisted(() => ({ executeConversationInspectTool: vi.fn() }));
const title = vi.hoisted(() => ({ executeSetConversationTitle: vi.fn() }));

vi.mock('@neon-pilot/extensions/backend/conversations', () => conversationsBackend);
vi.mock('../../system-automations/src/conversationQueueBackend.js', () => queue);
vi.mock('./askUserQuestionAgentExtension.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./askUserQuestionAgentExtension.js')>()),
  ...ask,
}));
vi.mock('./changeWorkingDirectoryAgentExtension.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./changeWorkingDirectoryAgentExtension.js')>()),
  ...cwd,
}));
vi.mock('./conversationInspectAgentExtension.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./conversationInspectAgentExtension.js')>()),
  ...inspect,
}));
vi.mock('./conversationTitleAgentExtension.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./conversationTitleAgentExtension.js')>()),
  ...title,
}));

import { conversationTool, copyConversationId, copyDeeplink, copyWorkingDirectory, duplicateConversation } from './backend.js';

function ctx(overrides: Record<string, unknown> = {}) {
  return {
    profile: 'shared',
    log: { info: vi.fn() },
    toolContext: { conversationId: 'conv-1', sessionFile: '/session.json', cwd: '/repo' },
    conversations: { setTitle: vi.fn() },
    ...overrides,
  } as never;
}

describe('system-conversation-tools backend routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ask.executeAskUserQuestion.mockResolvedValue({ content: [{ type: 'text', text: 'asked' }] });
    inspect.executeConversationInspectTool.mockResolvedValue({ content: [{ type: 'text', text: 'inspected' }] });
    title.executeSetConversationTitle.mockResolvedValue({ content: [{ type: 'text', text: 'titled' }] });
    cwd.executeChangeWorkingDirectory.mockResolvedValue({ content: [{ type: 'text', text: 'changed' }] });
    queue.deferredResume.mockResolvedValue({ text: 'scheduled', id: 'resume-1' });
    conversationsBackend.buildLiveSessionResourceOptionsForRuntime.mockReturnValue({ resources: true });
    conversationsBackend.buildLiveSessionExtensionFactoriesForRuntime.mockReturnValue(['factory']);
  });

  it('logs and returns simple context menu payloads', async () => {
    const context = ctx();
    await expect(duplicateConversation({ conversationId: 'conv-1', sessionTitle: 'Title' }, context)).resolves.toEqual({
      ok: true,
      conversationId: 'conv-1',
    });
    await expect(copyWorkingDirectory({ conversationId: 'conv-1', sessionTitle: 'Title', cwd: '/repo' }, context)).resolves.toEqual({
      ok: true,
      cwd: '/repo',
    });
    await expect(copyConversationId({ conversationId: 'conv-1', sessionTitle: 'Title' }, context)).resolves.toEqual({
      ok: true,
      conversationId: 'conv-1',
    });
    await expect(copyDeeplink({ conversationId: 'conv-1', sessionTitle: 'Title' }, context)).resolves.toEqual({
      ok: true,
      conversationId: 'conv-1',
    });
    expect((context as { log: { info: ReturnType<typeof vi.fn> } }).log.info).toHaveBeenCalledTimes(4);
  });

  it('routes ask, inspect, and set_title actions with normalized payloads', async () => {
    const context = ctx();

    await conversationTool({ action: 'ask', question: 'Proceed?' }, context);
    expect(ask.executeAskUserQuestion).toHaveBeenCalledWith(
      { question: 'Proceed?' },
      expect.objectContaining({ sessionManager: expect.objectContaining({ getSessionId: expect.any(Function) }), cwd: '/repo' }),
    );

    await conversationTool({ action: 'inspect', inspectAction: 'query', conversationId: 'conv-2' }, context);
    expect(inspect.executeConversationInspectTool).toHaveBeenCalledWith(
      { action: 'query', conversationId: 'conv-2' },
      expect.objectContaining({ cwd: '/repo' }),
    );

    await conversationTool({ action: 'set_title', title: 'New Title' }, context);
    const setTitleCallback = title.executeSetConversationTitle.mock.calls[0][2] as (nextTitle: string) => Promise<unknown>;
    await setTitleCallback('New Title');
    expect((context as { conversations: { setTitle: ReturnType<typeof vi.fn> } }).conversations.setTitle).toHaveBeenCalledWith(
      'conv-1',
      'New Title',
    );
  });

  it('routes working directory changes with live session runtime resources', async () => {
    await conversationTool({ action: 'change_working_directory', cwd: '/next' }, ctx());

    const changeCallback = cwd.executeChangeWorkingDirectory.mock.calls[0][2] as (input: unknown) => Promise<unknown>;
    await changeCallback({ conversationId: 'conv-1', cwd: '/next' });

    expect(conversationsBackend.requestConversationWorkingDirectoryChange).toHaveBeenCalledWith(
      { conversationId: 'conv-1', cwd: '/next' },
      { resources: true, extensionFactories: ['factory'] },
    );
  });

  it('routes deferred resume using extension profile and tool context', async () => {
    await expect(conversationTool({ action: 'deferred_resume', deferredAction: 'add', prompt: 'Continue' }, ctx())).resolves.toEqual({
      content: [{ type: 'text', text: 'scheduled' }],
      details: { text: 'scheduled', id: 'resume-1' },
    });

    expect(queue.deferredResume).toHaveBeenCalledWith(
      { action: 'add', prompt: 'Continue' },
      { profile: 'shared', toolContext: { sessionId: 'conv-1', sessionFile: '/session.json', cwd: '/repo' } },
    );
  });

  it('rejects missing or unsupported conversation actions', async () => {
    await expect(conversationTool(null, ctx())).rejects.toThrow('conversation action is required.');
    await expect(conversationTool({ action: 'bogus' }, ctx())).rejects.toThrow('Unsupported conversation action: bogus');
  });
});

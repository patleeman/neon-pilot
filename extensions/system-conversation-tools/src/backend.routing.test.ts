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

import {
  askUser,
  conversationCwd,
  conversationInspect,
  conversationTitle,
  conversationTool,
  copyConversationId,
  copyDeeplink,
  copyWorkingDirectory,
  deferredResumeTool,
  duplicateConversation,
} from './backend.js';

function ctx(overrides: Record<string, unknown> = {}) {
  const conversations = {
    setTitle: vi.fn().mockResolvedValue({ ok: true }),
    create: vi.fn().mockResolvedValue({ conversationId: 'created-1' }),
    ensureLive: vi.fn().mockResolvedValue({ conversationId: 'conv-2' }),
    sendMessage: vi.fn().mockResolvedValue({ accepted: true }),
    runTurn: vi.fn().mockResolvedValue({ accepted: true }),
    abort: vi.fn().mockResolvedValue({ ok: true }),
    compact: vi.fn().mockResolvedValue({ ok: true }),
    fork: vi.fn().mockResolvedValue({ conversationId: 'fork-1' }),
    setActiveTools: vi.fn().mockResolvedValue({ conversationId: 'conv-2', toolNames: ['bash'] }),
    getWorkspace: vi.fn().mockResolvedValue({ openConversationIds: ['conv-1'] }),
    updateWorkspace: vi.fn().mockResolvedValue({ openConversationIds: ['conv-2'] }),
    delete: vi.fn().mockResolvedValue({ ok: true, deleted: [{ id: 'conv-old' }] }),
    prune: vi.fn().mockResolvedValue({ ok: true, dryRun: true, candidates: [] }),
    appendTranscriptBlock: vi.fn().mockResolvedValue({ blockId: 'block-1' }),
    updateTranscriptBlock: vi.fn().mockResolvedValue({ blockId: 'block-1' }),
    rollback: vi.fn().mockResolvedValue({ rolledBackTo: 'entry-1' }),
  };
  return {
    profile: 'shared',
    log: { info: vi.fn() },
    toolContext: { conversationId: 'conv-1', sessionFile: '/session.json', cwd: '/repo' },
    conversations,
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

  it('normalizes contributed conversation CLI commands into conversation actions', async () => {
    const context = ctx();
    const conversations = (context as { conversations: Record<string, ReturnType<typeof vi.fn>> }).conversations;

    await conversationTool({ cli: { command: 'conversations list', args: ['repo'] } }, context);
    expect(inspect.executeConversationInspectTool).toHaveBeenLastCalledWith(
      { action: 'list', query: 'repo' },
      expect.objectContaining({ cwd: '/repo' }),
    );

    await conversationTool({ cli: { command: 'conversations create', args: ['CLI', 'Thread'] } }, context);
    expect(conversations.create).toHaveBeenLastCalledWith({ title: 'CLI Thread' });

    await conversationTool({ cli: { command: 'conversations title', args: ['conv-2', 'Renamed', 'Thread'] } }, context);
    const setTitleCallback = title.executeSetConversationTitle.mock.calls.at(-1)?.[2] as (nextTitle: string) => Promise<unknown>;
    await setTitleCallback('Renamed Thread');
    expect(conversations.setTitle).toHaveBeenLastCalledWith('conv-2', 'Renamed Thread');

    await conversationTool({ cli: { command: 'conversations abort', args: ['conv-2'] } }, context);
    expect(conversations.abort).toHaveBeenLastCalledWith('conv-2');

    await conversationTool(
      { cli: { command: 'conversations run-turn', args: ['conv-2', '--text', 'Finish', '--timeout-ms', '123'] } },
      context,
    );
    expect(conversations.runTurn).toHaveBeenLastCalledWith('conv-2', 'Finish', { timeoutMs: 123 });

    await conversationTool(
      { cli: { command: 'conversations workspace update', args: ['--open', 'conv-1,conv-2', '--active', 'conv-2'] } },
      context,
    );
    expect(conversations.updateWorkspace).toHaveBeenLastCalledWith({
      openConversationIds: ['conv-1', 'conv-2'],
      activeConversationId: 'conv-2',
    });

    await conversationTool({ cli: { command: 'conversations delete', args: ['conv-old'] } }, context);
    expect(conversations.delete).toHaveBeenLastCalledWith({ conversationIds: ['conv-old'] });

    await conversationTool(
      { cli: { command: 'conversations retention prune', args: ['--older-than', '90d', '--archived-only', '--dry-run'] } },
      context,
    );
    expect(conversations.prune).toHaveBeenLastCalledWith({ olderThanMs: 7_776_000_000, archivedOnly: true, dryRun: true });
  });

  it('sets the title on an explicit target conversation when conversationId is provided', async () => {
    const context = ctx();

    await conversationTool({ action: 'set_title', conversationId: 'conv-2', title: 'Target Title' }, context);
    const setTitleCallback = title.executeSetConversationTitle.mock.calls[0][2] as (nextTitle: string) => Promise<unknown>;
    await setTitleCallback('Target Title');

    expect((context as { conversations: { setTitle: ReturnType<typeof vi.fn> } }).conversations.setTitle).toHaveBeenCalledWith(
      'conv-2',
      'Target Title',
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

  it('exposes split tool handlers with focused payloads', async () => {
    const context = ctx();

    await askUser({ question: 'Proceed?' }, context);
    expect(ask.executeAskUserQuestion).toHaveBeenLastCalledWith({ question: 'Proceed?' }, expect.objectContaining({ cwd: '/repo' }));

    await conversationInspect({ action: 'query', conversationId: 'conv-2' }, context);
    expect(inspect.executeConversationInspectTool).toHaveBeenLastCalledWith(
      { action: 'query', conversationId: 'conv-2' },
      expect.objectContaining({ cwd: '/repo' }),
    );

    await conversationTitle({ title: 'New Title' }, context);
    const setTitleCallback = title.executeSetConversationTitle.mock.calls.at(-1)?.[2] as (nextTitle: string) => Promise<unknown>;
    await setTitleCallback('New Title');
    expect((context as { conversations: { setTitle: ReturnType<typeof vi.fn> } }).conversations.setTitle).toHaveBeenLastCalledWith(
      'conv-1',
      'New Title',
    );

    await conversationCwd({ cwd: '/next' }, context);
    const changeCallback = cwd.executeChangeWorkingDirectory.mock.calls.at(-1)?.[2] as (input: unknown) => Promise<unknown>;
    await changeCallback({ conversationId: 'conv-1', cwd: '/next' });
    expect(conversationsBackend.requestConversationWorkingDirectoryChange).toHaveBeenLastCalledWith(
      { conversationId: 'conv-1', cwd: '/next' },
      { resources: true, extensionFactories: ['factory'] },
    );

    await expect(deferredResumeTool({ action: 'add', prompt: 'Continue' }, context)).resolves.toEqual({
      content: [{ type: 'text', text: 'scheduled' }],
      details: { text: 'scheduled', id: 'resume-1' },
    });
    expect(queue.deferredResume).toHaveBeenLastCalledWith(
      { action: 'add', prompt: 'Continue' },
      { profile: 'shared', toolContext: { sessionId: 'conv-1', sessionFile: '/session.json', cwd: '/repo' } },
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

  it('routes remote conversation admin actions through ctx.conversations', async () => {
    const context = ctx();
    const conversations = (context as { conversations: Record<string, ReturnType<typeof vi.fn>> }).conversations;

    await expect(conversationTool({ action: 'create', title: 'New', cwd: '/repo', live: false }, context)).resolves.toMatchObject({
      details: { conversationId: 'created-1' },
    });
    expect(conversations.create).toHaveBeenCalledWith({ title: 'New', cwd: '/repo', live: false });

    await conversationTool({ action: 'ensure_live', conversationId: 'conv-2', cwd: '/repo' }, context);
    expect(conversations.ensureLive).toHaveBeenCalledWith('conv-2', { cwd: '/repo' });

    await conversationTool({ action: 'send_message', conversationId: 'conv-2', text: 'Go', steer: true }, context);
    expect(conversations.sendMessage).toHaveBeenCalledWith('conv-2', 'Go', { steer: true });

    await conversationTool(
      {
        action: 'run_turn',
        conversationId: 'conv-2',
        text: 'Finish',
        cwd: '/repo',
        steer: true,
        timeoutMs: 123,
        images: [{ data: 'abc', mimeType: 'image/png', name: 'a.png' }],
      },
      context,
    );
    expect(conversations.runTurn).toHaveBeenCalledWith('conv-2', 'Finish', {
      cwd: '/repo',
      steer: true,
      timeoutMs: 123,
      images: [{ data: 'abc', mimeType: 'image/png', name: 'a.png' }],
    });

    await conversationTool({ action: 'abort', conversationId: 'conv-2' }, context);
    expect(conversations.abort).toHaveBeenCalledWith('conv-2');

    await conversationTool({ action: 'compact', conversationId: 'conv-2', customInstructions: 'short' }, context);
    expect(conversations.compact).toHaveBeenCalledWith('conv-2', 'short');

    await conversationTool({ action: 'fork', conversationId: 'conv-2', targetCwd: '/fork', title: 'Fork' }, context);
    expect(conversations.fork).toHaveBeenCalledWith({ conversationId: 'conv-2', targetCwd: '/fork', title: 'Fork' });

    await conversationTool({ action: 'set_active_tools', conversationId: 'conv-2', toolNames: [' bash ', ''] }, context);
    expect(conversations.setActiveTools).toHaveBeenCalledWith('conv-2', ['bash']);

    await conversationTool({ action: 'workspace_get' }, context);
    expect(conversations.getWorkspace).toHaveBeenCalledWith();

    await conversationTool({ action: 'rollback', conversationId: 'conv-2', count: 2 }, context);
    expect(conversations.rollback).toHaveBeenCalledWith('conv-2', 2);
  });

  it('passes only provided fields for workspace updates', async () => {
    const context = ctx();
    const conversations = (context as { conversations: { updateWorkspace: ReturnType<typeof vi.fn> } }).conversations;

    await conversationTool(
      {
        action: 'workspace_update',
        openConversationIds: ['conv-2'],
        remoteControlledConversationIds: ['conv-2'],
      },
      context,
    );

    expect(conversations.updateWorkspace).toHaveBeenCalledWith({
      openConversationIds: ['conv-2'],
      remoteControlledConversationIds: ['conv-2'],
    });
  });

  it('routes transcript block writes', async () => {
    const context = ctx();
    const conversations = (
      context as {
        conversations: { appendTranscriptBlock: ReturnType<typeof vi.fn>; updateTranscriptBlock: ReturnType<typeof vi.fn> };
      }
    ).conversations;

    await conversationTool(
      { action: 'append_transcript_block', conversationId: 'conv-2', blockType: 'note', title: 'Note', data: { ok: true } },
      context,
    );
    expect(conversations.appendTranscriptBlock).toHaveBeenCalledWith({
      conversationId: 'conv-2',
      blockType: 'note',
      title: 'Note',
      data: { ok: true },
    });

    await conversationTool(
      { action: 'update_transcript_block', conversationId: 'conv-2', blockType: 'note', blockId: 'block-1', data: { ok: false } },
      context,
    );
    expect(conversations.updateTranscriptBlock).toHaveBeenCalledWith({
      conversationId: 'conv-2',
      blockType: 'note',
      blockId: 'block-1',
      data: { ok: false },
    });
  });

  it('lets host live-only errors surface without masking', async () => {
    const context = ctx({
      conversations: {
        ...((ctx() as { conversations: Record<string, unknown> }).conversations as Record<string, unknown>),
        abort: vi.fn().mockRejectedValue(new Error('Conversation "conv-2" is not live.')),
      },
    });

    await expect(conversationTool({ action: 'abort', conversationId: 'conv-2' }, context)).rejects.toThrow(
      'Conversation "conv-2" is not live.',
    );
  });

  it('rejects missing or unsupported conversation actions', async () => {
    await expect(conversationTool(null, ctx())).rejects.toThrow('conversation action is required.');
    await expect(conversationTool({ action: 'bogus' }, ctx())).rejects.toThrow('Unsupported conversation action: bogus');
  });
});

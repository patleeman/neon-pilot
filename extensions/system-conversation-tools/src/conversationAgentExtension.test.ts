import { beforeEach, describe, expect, it, vi } from 'vitest';

const queue = vi.hoisted(() => ({ deferredResume: vi.fn() }));
const ask = vi.hoisted(() => ({ executeAskUserQuestion: vi.fn() }));
const cwd = vi.hoisted(() => ({ executeChangeWorkingDirectory: vi.fn() }));
const inspect = vi.hoisted(() => ({ executeConversationInspectTool: vi.fn() }));
const title = vi.hoisted(() => ({ executeSetConversationTitle: vi.fn() }));
const conversationsBackend = vi.hoisted(() => ({
  CONVERSATION_INSPECT_ACTION_VALUES: ['list', 'search', 'query', 'diff', 'outline', 'read_window'],
  CONVERSATION_INSPECT_BLOCK_TYPE_VALUES: ['user', 'text', 'context', 'summary', 'tool_use', 'image', 'error'],
  CONVERSATION_INSPECT_ORDER_VALUES: ['asc', 'desc'],
  CONVERSATION_INSPECT_ROLE_VALUES: ['user', 'assistant', 'tool', 'context', 'summary', 'image', 'error'],
  CONVERSATION_INSPECT_SCOPE_VALUES: ['all', 'live', 'running', 'archived'],
  CONVERSATION_INSPECT_SEARCH_MODE_VALUES: ['phrase', 'allTerms', 'anyTerm'],
}));

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

import { createConversationAgentExtension } from './conversationAgentExtension.js';

type RegisteredTool = {
  execute: (toolCallId: string, params: Record<string, unknown>, signal?: unknown, onUpdate?: unknown, ctx?: ToolCtx) => Promise<unknown>;
};
type ToolCtx = { sessionManager: { getSessionId(): string; getSessionFile?(): string | undefined; getCwd?(): string | undefined } };

function register() {
  let tool: RegisteredTool | undefined;
  const pi = { registerTool: vi.fn((registered: RegisteredTool) => (tool = registered)), setSessionName: vi.fn() };
  const requestConversationWorkingDirectoryChange = vi.fn().mockResolvedValue({ status: 'queued' });
  createConversationAgentExtension({ requestConversationWorkingDirectoryChange })(pi as never);
  if (!tool) throw new Error('tool not registered');
  return { tool, pi, requestConversationWorkingDirectoryChange };
}

const ctx: ToolCtx = {
  sessionManager: {
    getSessionId: () => 'conv-1',
    getSessionFile: () => '/session.json',
    getCwd: () => '/repo',
  },
};

describe('conversationAgentExtension', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ask.executeAskUserQuestion.mockResolvedValue({ content: [{ type: 'text', text: 'asked' }] });
    inspect.executeConversationInspectTool.mockResolvedValue({ content: [{ type: 'text', text: 'inspected' }] });
    title.executeSetConversationTitle.mockResolvedValue({ content: [{ type: 'text', text: 'titled' }] });
    cwd.executeChangeWorkingDirectory.mockResolvedValue({ content: [{ type: 'text', text: 'changed' }] });
    queue.deferredResume.mockResolvedValue({ text: 'scheduled', id: 'resume-1' });
  });

  it('registers the conversation tool with expected metadata', () => {
    const { pi } = register();
    expect(pi.registerTool).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'conversation',
        label: 'Conversation',
        promptGuidelines: expect.arrayContaining(['Use action="deferred_resume" for wait-then-continue; do not run sleep in bash.']),
      }),
    );
  });

  it('routes ask, inspect, set_title, and cwd changes', async () => {
    const { tool, pi, requestConversationWorkingDirectoryChange } = register();

    await tool.execute('call-1', { action: 'ask', question: 'Proceed?' }, undefined, undefined, ctx);
    expect(ask.executeAskUserQuestion).toHaveBeenCalledWith({ question: 'Proceed?' }, ctx);

    await tool.execute('call-1', { action: 'inspect', inspectAction: 'query', conversationId: 'conv-2' }, undefined, undefined, ctx);
    expect(inspect.executeConversationInspectTool).toHaveBeenCalledWith({ action: 'query', conversationId: 'conv-2' }, ctx);

    await tool.execute('call-1', { action: 'set_title', title: 'New Title' }, undefined, undefined, ctx);
    const setTitleCallback = title.executeSetConversationTitle.mock.calls[0][2] as (nextTitle: string) => void;
    setTitleCallback('New Title');
    expect(pi.setSessionName).toHaveBeenCalledWith('New Title');

    await tool.execute('call-1', { action: 'change_working_directory', cwd: '/next' }, undefined, undefined, ctx);
    expect(cwd.executeChangeWorkingDirectory).toHaveBeenCalledWith({ cwd: '/next' }, ctx, requestConversationWorkingDirectoryChange);
  });

  it('routes deferred resume with shared profile and session manager context', async () => {
    const { tool } = register();

    await expect(
      tool.execute('call-1', { action: 'deferred_resume', deferredAction: 'add', prompt: 'Continue' }, undefined, undefined, ctx),
    ).resolves.toEqual({
      content: [{ type: 'text', text: 'scheduled' }],
      details: { text: 'scheduled', id: 'resume-1' },
    });
    expect(queue.deferredResume).toHaveBeenCalledWith(
      { action: 'add', prompt: 'Continue' },
      { profile: 'shared', toolContext: { sessionId: 'conv-1', sessionFile: '/session.json', cwd: '/repo' } },
    );
  });

  it('throws for missing and unsupported actions', async () => {
    const { tool } = register();
    await expect(tool.execute('call-1', null as never, undefined, undefined, ctx)).rejects.toThrow('conversation action is required.');
    await expect(tool.execute('call-1', { action: 'bogus' }, undefined, undefined, ctx)).rejects.toThrow(
      'Unsupported conversation action: bogus',
    );
  });
});

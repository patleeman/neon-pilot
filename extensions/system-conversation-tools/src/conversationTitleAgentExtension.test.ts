import type { ExtensionAPI } from '@neon-pilot/extensions';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const conversationsBackend = vi.hoisted(() => ({
  normalizeGeneratedConversationTitle: vi.fn(async (title: string | null | undefined, maxLength = 80) => {
    if (typeof title !== 'string') return null;
    const firstLine = title
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.length > 0);
    const normalized = (firstLine ?? '')
      .replace(/^title\s*:\s*/i, '')
      .replace(/^[-*•#]+\s*/, '')
      .replace(/^['"`]+/, '')
      .replace(/['"`]+$/, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!normalized) return null;
    if (normalized.length <= maxLength) return normalized;
    return `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
  }),
}));

vi.mock('@neon-pilot/extensions/backend/conversations', () => conversationsBackend);

import { createConversationTitleAgentExtension, executeSetConversationTitle } from './conversationTitleAgentExtension.js';

type RegisteredTool = Parameters<ExtensionAPI['registerTool']>[0];
type ExecuteContext = Parameters<NonNullable<RegisteredTool['execute']>>[4];

function registerConversationTitleTool() {
  let registeredTool: RegisteredTool | undefined;
  const setSessionName = vi.fn();
  createConversationTitleAgentExtension()({
    registerTool: (tool: RegisteredTool) => {
      registeredTool = tool;
    },
    setSessionName,
  } as never);

  if (!registeredTool) {
    throw new Error('Conversation title tool was not registered.');
  }

  return { registeredTool, setSessionName };
}

function createToolContext(conversationId = 'conv-123'): ExecuteContext {
  return {
    sessionManager: {
      getSessionId: () => conversationId,
    },
  } as ExecuteContext;
}

describe('conversation title agent extension', () => {
  beforeEach(() => {
    conversationsBackend.normalizeGeneratedConversationTitle.mockClear();
  });

  it('registers title-specific guidance', () => {
    const { registeredTool } = registerConversationTitleTool();
    const guidelines = registeredTool.promptGuidelines?.join('\n') ?? '';

    expect(registeredTool.name).toBe('set_conversation_title');
    expect(guidelines).toContain('3-7 word title');
    expect(guidelines).toContain('do not mention the title update');
    expect(guidelines).not.toContain('Fix diff screen layout');
  });

  it('sets the normalized current conversation title', async () => {
    const { registeredTool, setSessionName } = registerConversationTitleTool();

    const result = await registeredTool.execute(
      'tool-1',
      { title: '  Title: "Fix diff screen layout"\nextra junk  ' },
      undefined,
      undefined,
      createToolContext('conv-title'),
    );

    expect(setSessionName).toHaveBeenCalledWith('Fix diff screen layout');
    expect(result.details).toEqual({
      conversationId: 'conv-title',
      title: 'Fix diff screen layout',
    });
  });

  it('waits for asynchronous title persistence before reporting success', async () => {
    let releaseTitleWrite!: () => void;
    const setSessionName = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          releaseTitleWrite = resolve;
        }),
    );
    const pending = executeSetConversationTitle({ title: 'Async Title' }, createToolContext('conv-title'), setSessionName);
    let settled = false;
    void pending.then(() => {
      settled = true;
    });

    await vi.waitFor(() => expect(setSessionName).toHaveBeenCalledWith('Async Title'));
    expect(settled).toBe(false);

    releaseTitleWrite();
    await expect(pending).resolves.toEqual({
      content: [{ type: 'text', text: 'Conversation title set to "Async Title".' }],
      details: { conversationId: 'conv-title', title: 'Async Title' },
    });
  });

  it('reports asynchronous title persistence failures', async () => {
    await expect(
      executeSetConversationTitle({ title: 'Async Title' }, createToolContext('conv-title'), async () => {
        throw new Error('title write failed');
      }),
    ).rejects.toThrow('title write failed');
  });

  it('caps generated tool titles before setting them', async () => {
    const { registeredTool, setSessionName } = registerConversationTitleTool();
    const title = 'Long generated tool title '.repeat(10).trim();

    const result = await registeredTool.execute('tool-1', { title }, undefined, undefined, createToolContext('conv-title'));

    expect(String(result.details?.title).length).toBeLessThanOrEqual(80);
    expect(conversationsBackend.normalizeGeneratedConversationTitle).toHaveBeenCalledWith(title, 80);
    expect(setSessionName).toHaveBeenCalledWith(result.details?.title);
  });

  it('rejects blank titles', async () => {
    const { registeredTool, setSessionName } = registerConversationTitleTool();

    await expect(registeredTool.execute('tool-1', { title: '   \n  ' }, undefined, undefined, createToolContext())).rejects.toThrow(
      'Conversation title must not be empty.',
    );

    expect(setSessionName).not.toHaveBeenCalled();
  });
});

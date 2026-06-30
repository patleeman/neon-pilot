// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '../../client/api';
import type { MessageBlock } from '../../shared/types';
import { CONVERSATION_TRANSCRIPT_DISCLOSURE_SETTING_KEY } from './toolPresentation';

const timeAgoSpy = vi.hoisted(() => vi.fn<(iso: string) => void>());
const nativeExtensionInvokeMock = vi.hoisted(() => vi.fn());

vi.mock('../../shared/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../shared/utils')>();
  return {
    ...actual,
    timeAgo: vi.fn((iso: string) => {
      timeAgoSpy(iso);
      return actual.timeAgo(iso);
    }),
  };
});

vi.mock('../../extensions/nativePaClient.js', () => ({
  createNativeExtensionClient: () => ({
    extension: {
      invoke: nativeExtensionInvokeMock,
    },
  }),
}));

import { ChatView } from './ChatView';

const mountedRoots: Root[] = [];

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

function createUserBlock(): Extract<MessageBlock, { type: 'user' }> {
  return {
    id: 'user-1',
    type: 'user',
    ts: '2026-04-23T18:00:00.000Z',
    text: 'User prompt',
  };
}

function createAssistantBlock(): Extract<MessageBlock, { type: 'text' }> {
  return {
    id: 'assistant-1',
    type: 'text',
    ts: '2026-04-23T18:00:01.000Z',
    text: 'Stable assistant reply',
  };
}

function createStreamingTail(text: string): Extract<MessageBlock, { type: 'text' }> {
  return {
    id: 'assistant-tail',
    type: 'text',
    ts: '2026-04-23T18:00:02.000Z',
    text,
  };
}

function renderChatView(messages: MessageBlock[], props: Partial<React.ComponentProps<typeof ChatView>> = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<ChatView messages={messages} isStreaming {...props} />);
  });

  mountedRoots.push(root);
  return { container, root };
}

describe('ChatView rendering stability', () => {
  beforeEach(() => {
    timeAgoSpy.mockReset();
    nativeExtensionInvokeMock.mockReset();
    nativeExtensionInvokeMock.mockResolvedValue({});
    if (!window.requestAnimationFrame) {
      window.requestAnimationFrame = ((callback: FrameRequestCallback) =>
        window.setTimeout(() => callback(performance.now()), 0)) as typeof window.requestAnimationFrame;
    }
    if (!window.cancelAnimationFrame) {
      window.cancelAnimationFrame = ((handle: number) => window.clearTimeout(handle)) as typeof window.cancelAnimationFrame;
    }
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    for (const root of mountedRoots.splice(0)) {
      act(() => {
        root.unmount();
      });
    }
    document.body.innerHTML = '';
  });

  it('does not rerender stable transcript rows when only the streaming tail changes', () => {
    const userBlock = createUserBlock();
    const assistantBlock = createAssistantBlock();
    const initialTail = createStreamingTail('Tail draft');
    const { container, root } = renderChatView([userBlock, assistantBlock, initialTail]);

    expect(container.textContent).toContain('Tail draft');

    timeAgoSpy.mockClear();
    const updatedTail = {
      ...initialTail,
      text: 'Tail draft with more output',
    } satisfies Extract<MessageBlock, { type: 'text' }>;

    act(() => {
      root.render(<ChatView messages={[userBlock, assistantBlock, updatedTail]} isStreaming />);
    });

    expect(container.textContent).toContain('Tail draft with more output');
    expect(timeAgoSpy).toHaveBeenCalledTimes(1);
    expect(timeAgoSpy).toHaveBeenCalledWith(updatedTail.ts);
  });

  it('keeps assistant message nodes mounted when earlier history is prepended', () => {
    const userBlock = createUserBlock();
    const assistantBlock = createAssistantBlock();
    const olderBlock = {
      id: 'assistant-older',
      type: 'text' as const,
      ts: '2026-04-23T17:59:59.000Z',
      text: 'Earlier assistant reply',
    };
    const { container, root } = renderChatView([userBlock, assistantBlock], { isStreaming: false });

    const initialAssistantNode = Array.from(container.querySelectorAll<HTMLElement>('[data-message-index]')).find((node) =>
      node.textContent?.includes('Stable assistant reply'),
    );
    expect(initialAssistantNode).toBeTruthy();

    act(() => {
      root.render(<ChatView messages={[olderBlock, userBlock, assistantBlock]} isStreaming={false} />);
    });

    const nextAssistantNode = Array.from(container.querySelectorAll<HTMLElement>('[data-message-index]')).find((node) =>
      node.textContent?.includes('Stable assistant reply'),
    );
    expect(nextAssistantNode).toBe(initialAssistantNode);
    expect(nextAssistantNode?.getAttribute('data-message-index')).toBe('2');
  });

  it('renders voted Model Arena duels as assistant response variations', () => {
    const messages: MessageBlock[] = [
      createUserBlock(),
      createAssistantBlock(),
      {
        id: 'model_arena_duel:duel-1',
        type: 'context',
        customType: 'model_arena_duel',
        ts: '2026-04-23T18:00:02.000Z',
        text: 'Model Arena duel',
        details: {
          sourceBlockId: 'assistant-1',
          status: 'voted',
          vote: 'b',
          sideA: { role: 'primary', text: 'Stable assistant reply' },
          sideB: { role: 'challenger', text: 'Alternative model reply' },
          models: {
            primary: 'opencode-go/glm-5.2',
            challenger: 'opencode-go/deepseek-v4-flash',
          },
        },
      },
    ];
    const { container } = renderChatView(messages, { isStreaming: false });

    expect(container.textContent).toContain('Stable assistant reply');
    expect(container.textContent).not.toContain('Model Arena duel');
    expect(container.textContent).toContain('Version 1 of 2');

    const next = container.querySelector<HTMLButtonElement>('button[aria-label="Next model response"]');
    expect(next).toBeTruthy();
    act(() => {
      next?.click();
    });

    expect(container.textContent).toContain('Alternative model reply');
    expect(container.textContent).toContain('Version 2 of 2');
  });

  it('renders active Model Arena duels in a wide context shelf', () => {
    const messages: MessageBlock[] = [
      createUserBlock(),
      createAssistantBlock(),
      {
        id: 'model_arena_duel:duel-1',
        type: 'context',
        customType: 'model_arena_duel',
        ts: '2026-04-23T18:00:02.000Z',
        text: 'Model Arena duel',
        details: {
          sourceBlockId: 'assistant-1',
          status: 'ready',
          sideA: { role: 'primary', text: 'Stable assistant reply' },
          sideB: { role: 'challenger', text: 'Alternative model reply' },
        },
      },
    ];
    const { container } = renderChatView(messages, { isStreaming: false });

    expect(container.querySelector('[data-context-shelf-layout="wide"]')).toBeTruthy();
  });

  it('switches the conversation model when the preferred Model Arena side is the challenger', async () => {
    const updatePreferenceSpy = vi.spyOn(api, 'updateConversationModelPreferences').mockResolvedValue({
      currentModel: 'opencode-go/deepseek-v4-flash',
    });
    nativeExtensionInvokeMock.mockResolvedValue({
      duel: {
        duelId: 'duel-1',
        conversationId: 'conv-1',
        status: 'voted',
        vote: 'b',
        sideA: { role: 'primary', text: 'Stable assistant reply' },
        sideB: { role: 'challenger', text: 'Alternative model reply' },
        models: {
          primary: 'opencode-go/glm-5.2',
          challenger: 'opencode-go/deepseek-v4-flash',
          a: 'opencode-go/glm-5.2',
          b: 'opencode-go/deepseek-v4-flash',
        },
      },
    });
    const messages: MessageBlock[] = [
      createUserBlock(),
      createAssistantBlock(),
      {
        id: 'model_arena_duel:duel-1',
        type: 'context',
        customType: 'model_arena_duel',
        ts: '2026-04-23T18:00:02.000Z',
        text: 'Model Arena duel',
        details: {
          duelId: 'duel-1',
          conversationId: 'conv-1',
          sourceBlockId: 'assistant-1',
          status: 'ready',
          sideA: { role: 'primary', text: 'Stable assistant reply' },
          sideB: { role: 'challenger', text: 'Alternative model reply' },
        },
      },
    ];
    const { container } = renderChatView(messages, { isStreaming: false });

    const preferB = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) =>
      button.textContent?.includes('Prefer B'),
    );
    expect(preferB).toBeTruthy();

    await act(async () => {
      preferB?.click();
    });

    expect(nativeExtensionInvokeMock).toHaveBeenCalledWith('voteDuel', { duelId: 'duel-1', choice: 'b' });
    expect(updatePreferenceSpy).toHaveBeenCalledWith('conv-1', { model: 'opencode-go/deepseek-v4-flash' });
  });

  it('does not switch the conversation model when the preferred Model Arena side is already primary', async () => {
    const updatePreferenceSpy = vi.spyOn(api, 'updateConversationModelPreferences').mockResolvedValue({
      currentModel: 'opencode-go/glm-5.2',
    });
    nativeExtensionInvokeMock.mockResolvedValue({
      duel: {
        duelId: 'duel-1',
        conversationId: 'conv-1',
        status: 'voted',
        vote: 'a',
        sideA: { role: 'primary', text: 'Stable assistant reply' },
        sideB: { role: 'challenger', text: 'Alternative model reply' },
        models: {
          primary: 'opencode-go/glm-5.2',
          challenger: 'opencode-go/deepseek-v4-flash',
          a: 'opencode-go/glm-5.2',
          b: 'opencode-go/deepseek-v4-flash',
        },
      },
    });
    const messages: MessageBlock[] = [
      createUserBlock(),
      createAssistantBlock(),
      {
        id: 'model_arena_duel:duel-1',
        type: 'context',
        customType: 'model_arena_duel',
        ts: '2026-04-23T18:00:02.000Z',
        text: 'Model Arena duel',
        details: {
          duelId: 'duel-1',
          conversationId: 'conv-1',
          sourceBlockId: 'assistant-1',
          status: 'ready',
          sideA: { role: 'primary', text: 'Stable assistant reply' },
          sideB: { role: 'challenger', text: 'Alternative model reply' },
        },
      },
    ];
    const { container } = renderChatView(messages, { isStreaming: false });

    const preferA = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) =>
      button.textContent?.includes('Prefer A'),
    );
    expect(preferA).toBeTruthy();

    await act(async () => {
      preferA?.click();
    });

    expect(nativeExtensionInvokeMock).toHaveBeenCalledWith('voteDuel', { duelId: 'duel-1', choice: 'a' });
    expect(updatePreferenceSpy).not.toHaveBeenCalled();
  });

  it('keeps the source assistant answer visible while a Model Arena challenger answer is pending', () => {
    const messages: MessageBlock[] = [
      { type: 'user', id: 'user-1', ts: '2026-04-23T18:00:00.000Z', text: 'Tell me a funny story' },
      { type: 'text', id: 'assistant-1-x5', ts: '2026-04-23T18:00:01.000Z', text: 'Primary story answer' },
      {
        id: 'model_arena_duel:duel-1',
        type: 'context',
        customType: 'model_arena_duel',
        ts: '2026-04-23T18:00:02.000Z',
        text: 'Model Arena duel',
        details: {
          sourceBlockId: 'assistant-1-x5',
          status: 'running',
          sideA: { role: 'primary', text: 'Primary story answer' },
          sideB: { role: 'challenger', text: '' },
        },
      },
    ];
    const { container } = renderChatView(messages, { isStreaming: false });

    expect(container.textContent).toContain('Primary story answer');
    expect(container.textContent).not.toContain('1 of 2');
  });

  it('renders markdown in the streaming assistant tail before the stream settles', () => {
    const streamingTail = createStreamingTail('**streaming** tail');
    const { container, root } = renderChatView([streamingTail], { isStreaming: true });

    expect(container.textContent).toContain('streaming tail');
    expect(container.querySelector('strong')?.textContent).toBe('streaming');

    act(() => {
      root.render(<ChatView messages={[streamingTail]} isStreaming={false} />);
    });

    expect(container.textContent).toContain('streaming tail');
    expect(container.querySelector('strong')?.textContent).toBe('streaming');
  });

  it('renders completed markdown-looking chunks while the stream is active', () => {
    const streamingTail = createStreamingTail(['# Streaming title', '', '**active** tail'].join('\n'));
    const { container } = renderChatView([streamingTail], { isStreaming: true });

    expect(container.textContent).toContain('Streaming title');
    expect(container.textContent).toContain('active tail');
    expect(container.querySelector('h1')?.textContent).toBe('Streaming title');
    expect(container.querySelector('strong')?.textContent).toBe('active');
  });

  it('renders an unfinished streaming code fence as a code block', () => {
    const streamingTail = createStreamingTail(['```ts', 'const value = 1;'].join('\n'));
    const { container } = renderChatView([streamingTail], { isStreaming: true });

    expect(container.querySelector('pre')?.textContent).toContain('const value = 1;');
    expect(container.textContent).not.toContain('```');
  });

  it('keeps assistant ordered-list markers out of clipped overflow', () => {
    const desktopCss = readFileSync(join(process.cwd(), 'packages/desktop/ui/src/app/index.css'), 'utf8');
    const uiCss = readFileSync(join(process.cwd(), 'packages/ui/src/styles.css'), 'utf8');
    const listRule = desktopCss.match(/\.ui-markdown ul,\s*\.ui-markdown ol\s*{[^}]+}/)?.[0];
    const assistantCardRule = uiCss.match(/\.ui-message-card-assistant\s*{[^}]+}/)?.[0];

    expect(listRule).toContain('padding-inline-start: 2rem');
    expect(listRule).toContain('overflow: visible');
    expect(assistantCardRule).toContain('overflow: visible');
  });

  it('does not install continuous reply-selection polling when selection replies are enabled', () => {
    const setIntervalSpy = vi.spyOn(window, 'setInterval');

    renderChatView([createAssistantBlock()]);

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoots.push(root);

    act(() => {
      root.render(<ChatView messages={[createAssistantBlock()]} onReplyToSelection={() => undefined} />);
    });

    expect(setIntervalSpy).not.toHaveBeenCalled();
  });

  it('renders a visible label for image-only user messages', () => {
    const { container } = renderChatView([
      {
        id: 'user-image-only',
        type: 'user',
        ts: '2026-04-23T18:00:00.000Z',
        text: '',
        images: [{ alt: 'Attached image', src: 'data:image/png;base64,abc' }],
      },
      createAssistantBlock(),
    ]);

    expect(container.textContent).toContain('Image attachment');
  });

  it('collapses live tool shelves as soon as assistant text follows them', () => {
    vi.useFakeTimers();
    const toolBlock = {
      id: 'tool-1',
      type: 'tool_use',
      ts: '2026-04-23T18:00:02.000Z',
      tool: 'bash',
      input: { command: 'npm test -- --runInBand' },
      output: '',
      status: 'ok',
    } satisfies Extract<MessageBlock, { type: 'tool_use' }>;
    const { container, root } = renderChatView([toolBlock], { isStreaming: true });

    expect(container.textContent).toContain('1 step');
    expect(container.textContent).toContain('live');
    expect(container.textContent).toContain('npm test -- --runInBand');

    act(() => {
      root.render(<ChatView messages={[toolBlock, createAssistantBlock()]} isStreaming />);
    });

    expect(container.textContent).toContain('1 step');
    expect(container.textContent).toContain('Stable assistant reply');
    expect(container.textContent).not.toContain('npm test -- --runInBand');

    act(() => {
      vi.advanceTimersByTime(899);
    });

    expect(container.textContent).not.toContain('npm test -- --runInBand');

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(container.textContent).toContain('1 step');
    expect(container.textContent).not.toContain('npm test -- --runInBand');

    act(() => {
      root.render(<ChatView messages={[toolBlock, createAssistantBlock()]} isStreaming={false} />);
    });

    expect(container.textContent).toContain('Stable assistant reply');
    expect(container.textContent).not.toContain('npm test -- --runInBand');
  });

  it('does not mark completed thinking details live when transcript details are expanded', async () => {
    vi.spyOn(api, 'settings').mockResolvedValue({ [CONVERSATION_TRANSCRIPT_DISCLOSURE_SETTING_KEY]: 'expanded' });
    const thinkingBlock = {
      id: 'thinking-1',
      type: 'thinking',
      ts: '2026-04-23T18:00:02.000Z',
      text: 'The assistant is planning the answer.',
    } satisfies Extract<MessageBlock, { type: 'thinking' }>;
    const { container } = renderChatView([thinkingBlock, createAssistantBlock()], { isStreaming: false });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain('1 step');
    expect(container.textContent).toContain('Stable assistant reply');
    expect(container.textContent).not.toContain('The assistant is planning the answer.');

    act(() => {
      container.querySelector('button[aria-expanded="false"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('The assistant is planning the answer.');
    expect(container.textContent).not.toContain('live');
  });

  it('auto-expands the running tool block in the live trace cluster', () => {
    const toolBlock = {
      id: 'tool-1',
      type: 'tool_use',
      ts: '2026-04-23T18:00:02.000Z',
      tool: 'bash',
      input: { command: 'pnpm vitest run' },
      output: 'RUN  v4.0.18\n',
      status: 'running',
      running: true,
    } satisfies Extract<MessageBlock, { type: 'tool_use' }>;
    const { container } = renderChatView([toolBlock], { isStreaming: true });

    expect(container.textContent).toContain('1 step');
    expect(container.textContent).toContain('live');
    expect(container.textContent).toContain('pnpm vitest run');
    expect(container.textContent).toContain('RUN  v4.0.18');
  });

  it('requests composer focus when the transcript background is clicked', () => {
    const onFocusComposerRequest = vi.fn();
    const { container } = renderChatView([createAssistantBlock()], { onFocusComposerRequest });
    const transcriptPanel = container.querySelector('[data-chat-transcript-panel="1"]');

    expect(transcriptPanel).not.toBeNull();

    act(() => {
      transcriptPanel?.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }));
    });

    expect(onFocusComposerRequest).toHaveBeenCalledTimes(1);
  });

  it('does not request composer focus when a message is clicked', () => {
    const onFocusComposerRequest = vi.fn();
    const { container } = renderChatView([createAssistantBlock()], { onFocusComposerRequest });
    const message = container.querySelector('[data-message-index="0"]');

    expect(message).not.toBeNull();

    act(() => {
      message?.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }));
    });

    expect(onFocusComposerRequest).not.toHaveBeenCalled();
  });

  it('renders browser tool calls as an explicit open-browser widget', () => {
    const onOpenBrowser = vi.fn();
    const browserBlock = {
      id: 'browser-tool-1',
      type: 'tool_use',
      ts: '2026-04-23T18:00:01.000Z',
      tool: 'browser_snapshot',
      input: {},
      output: 'URL: https://example.com/',
      status: 'ok',
      details: { url: 'https://example.com/' },
    } satisfies Extract<MessageBlock, { type: 'tool_use' }>;

    const { container } = renderChatView([browserBlock], { onOpenBrowser });

    expect(container.textContent).toContain('browser_snapshot');
    expect(onOpenBrowser).not.toHaveBeenCalled();
  });
});

// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import type { KeyboardEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useConversationComposerMenus } from './useConversationComposerMenus';

describe('useConversationComposerMenus', () => {
  function createKeyboardEvent(key: string): KeyboardEvent<HTMLTextAreaElement> {
    return {
      key,
      shiftKey: false,
      preventDefault: vi.fn(),
    } as unknown as KeyboardEvent<HTMLTextAreaElement>;
  }

  it('prevents the textarea newline when Enter commits a built-in slash command', async () => {
    const onSlashCommandCommit = vi.fn(async () => true);
    const onSlashMenuSelect = vi.fn();
    const preventDefault = vi.fn();
    const { result } = renderHook(() =>
      useConversationComposerMenus({
        input: '/copy',
        slashItems: [],
        mentionItems: [],
        models: [],
        onSlashCommandCommit,
        onSlashMenuSelect,
        onMentionSelect: vi.fn(),
        onModelSelect: vi.fn(),
        onClearComposer: vi.fn(),
      }),
    );

    let handled = false;
    await act(async () => {
      handled = await result.current.handleMenuKeyDown({
        key: 'Enter',
        shiftKey: false,
        preventDefault,
      } as unknown as KeyboardEvent<HTMLTextAreaElement>);
    });

    expect(handled).toBe(true);
    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(onSlashCommandCommit).toHaveBeenCalledWith('/copy');
    expect(onSlashMenuSelect).not.toHaveBeenCalled();
  });

  it('clears the slash query when Escape closes the slash menu', async () => {
    const onClearComposer = vi.fn();
    const event = createKeyboardEvent('Escape');
    const { result } = renderHook(() =>
      useConversationComposerMenus({
        input: '/compact',
        slashItems: [
          {
            key: 'compact',
            insertText: '/compact',
            displayCmd: '/compact',
            icon: 'C',
            desc: 'Compact the conversation.',
            section: 'Commands',
            kind: 'command',
          },
        ],
        mentionItems: [],
        models: [],
        onSlashMenuSelect: vi.fn(),
        onMentionSelect: vi.fn(),
        onModelSelect: vi.fn(),
        onClearComposer,
      }),
    );

    let handled = false;
    await act(async () => {
      handled = await result.current.handleMenuKeyDown(event);
    });

    expect(handled).toBe(true);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(onClearComposer).toHaveBeenCalledTimes(1);
  });

  it('clears the mention query when Escape closes the mention menu', async () => {
    const onClearComposer = vi.fn();
    const event = createKeyboardEvent('Escape');
    const { result } = renderHook(() =>
      useConversationComposerMenus({
        input: '@README.md',
        slashItems: [],
        mentionItems: [
          {
            id: '@README.md',
            label: 'README.md',
            detail: 'README.md',
            kind: 'file',
            title: 'README.md',
            searchText: 'README.md',
          },
        ],
        models: [],
        onSlashMenuSelect: vi.fn(),
        onMentionSelect: vi.fn(),
        onModelSelect: vi.fn(),
        onClearComposer,
      }),
    );

    let handled = false;
    await act(async () => {
      handled = await result.current.handleMenuKeyDown(event);
    });

    expect(handled).toBe(true);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(onClearComposer).toHaveBeenCalledTimes(1);
  });

  it('clears the model query when Escape closes the model picker', async () => {
    const onClearComposer = vi.fn();
    const event = createKeyboardEvent('Escape');
    const { result } = renderHook(() =>
      useConversationComposerMenus({
        input: '/model gpt',
        slashItems: [],
        mentionItems: [],
        models: [{ id: 'gpt-5.4', provider: 'openai', name: 'GPT-5.4', context: 272_000 }],
        onSlashMenuSelect: vi.fn(),
        onMentionSelect: vi.fn(),
        onModelSelect: vi.fn(),
        onClearComposer,
      }),
    );

    let handled = false;
    await act(async () => {
      handled = await result.current.handleMenuKeyDown(event);
    });

    expect(handled).toBe(true);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(onClearComposer).toHaveBeenCalledTimes(1);
  });

  it('leaves ordinary drafts alone when Escape has no open composer menu', async () => {
    const onClearComposer = vi.fn();
    const event = createKeyboardEvent('Escape');
    const { result } = renderHook(() =>
      useConversationComposerMenus({
        input: 'ordinary draft',
        slashItems: [],
        mentionItems: [],
        models: [],
        onSlashMenuSelect: vi.fn(),
        onMentionSelect: vi.fn(),
        onModelSelect: vi.fn(),
        onClearComposer,
      }),
    );

    let handled = true;
    await act(async () => {
      handled = await result.current.handleMenuKeyDown(event);
    });

    expect(handled).toBe(false);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(onClearComposer).not.toHaveBeenCalled();
  });
});

// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';

import { writeClipboardText } from '../../desktop/clipboard';
import { parseReplySelectionMessageIndex, useChatReplySelection } from './useChatReplySelection.js';

vi.mock('../../desktop/clipboard', () => ({
  writeClipboardText: vi.fn(),
}));

(globalThis as typeof globalThis & { React?: typeof React; IS_REACT_ACT_ENVIRONMENT?: boolean }).React = React;
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Harness({ text = 'selected text' }: { text?: string }) {
  const { selectionContextMenu, handleTranscriptContextMenu, runSelectionContextMenuAction } = useChatReplySelection({
    onReplyToSelection: vi.fn(),
  });

  return React.createElement(
    'div',
    { onContextMenu: handleTranscriptContextMenu },
    React.createElement('p', { 'data-selection-reply-scope': 'assistant-message', 'data-message-index': '0' }, text),
    selectionContextMenu
      ? React.createElement(
          'div',
          { role: 'menu', 'data-selection-context-menu': 'true' },
          React.createElement('span', null, selectionContextMenu.text),
          React.createElement(
            'button',
            {
              type: 'button',
              onClick: () => {
                void runSelectionContextMenuAction('copy', selectionContextMenu);
              },
            },
            'Copy',
          ),
        )
      : null,
  );
}

function renderHarness(text?: string) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(React.createElement(Harness, { text }));
  });

  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

function selectElementText(element: HTMLElement) {
  const range = document.createRange();
  range.selectNodeContents(element);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

describe('useChatReplySelection helpers', () => {
  it('rejects malformed reply selection message indexes', () => {
    expect(parseReplySelectionMessageIndex('12')).toBe(12);
    expect(parseReplySelectionMessageIndex('12abc')).toBeNull();
    expect(parseReplySelectionMessageIndex(String(Number.MAX_SAFE_INTEGER + 1))).toBeNull();
  });

  it('keeps the transcript context menu open when right-click selectionchange clears text immediately', () => {
    const { container, unmount } = renderHarness();

    try {
      const paragraph = container.querySelector<HTMLElement>('[data-selection-reply-scope="assistant-message"]');
      expect(paragraph).not.toBeNull();
      selectElementText(paragraph!);

      act(() => {
        paragraph?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 100, clientY: 100 }));
      });
      expect(container.querySelector('[role="menu"]')?.textContent).toContain('selected text');

      act(() => {
        window.getSelection()?.removeAllRanges();
        document.dispatchEvent(new Event('selectionchange'));
      });
      expect(container.querySelector('[role="menu"]')?.textContent).toContain('selected text');
    } finally {
      unmount();
      window.getSelection()?.removeAllRanges();
    }
  });

  it('copies the exact raw selected text instead of the normalized quote text', async () => {
    vi.mocked(writeClipboardText).mockResolvedValue(undefined);
    const { container, unmount } = renderHarness('  selected text  ');

    try {
      const paragraph = container.querySelector<HTMLElement>('[data-selection-reply-scope="assistant-message"]');
      expect(paragraph).not.toBeNull();
      selectElementText(paragraph!);

      act(() => {
        paragraph?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 100, clientY: 100 }));
      });
      expect(container.querySelector('[role="menu"]')?.textContent).toContain('selected text');

      await act(async () => {
        container.querySelector<HTMLButtonElement>('button')?.click();
      });

      expect(writeClipboardText).toHaveBeenCalledWith('  selected text  ');
    } finally {
      unmount();
      window.getSelection()?.removeAllRanges();
      vi.mocked(writeClipboardText).mockReset();
    }
  });
});

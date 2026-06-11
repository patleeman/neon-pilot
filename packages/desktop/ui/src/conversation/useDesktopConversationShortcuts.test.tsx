// @vitest-environment jsdom
import React, { createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useDesktopConversationShortcuts } from './useDesktopConversationShortcuts';

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

const roots: Root[] = [];

function renderShortcutHarness(options: {
  draft?: boolean;
  draftCwdPickBusy?: boolean;
  beginTitleEdit?: () => void;
  beginConversationCwdEdit?: () => void;
  pickDraftConversationCwd?: () => void;
}) {
  const textareaRef = createRef<HTMLTextAreaElement>();
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.push(root);

  function Harness() {
    useDesktopConversationShortcuts({
      draft: options.draft ?? false,
      draftCwdPickBusy: options.draftCwdPickBusy ?? false,
      textareaRef,
      beginTitleEdit: options.beginTitleEdit ?? vi.fn(),
      beginConversationCwdEdit: options.beginConversationCwdEdit ?? vi.fn(),
      pickDraftConversationCwd: options.pickDraftConversationCwd ?? vi.fn(),
    });
    return <textarea ref={textareaRef} defaultValue="hello" aria-label="Composer" />;
  }

  act(() => root.render(<Harness />));
  const textarea = container.querySelector('textarea');
  if (!(textarea instanceof HTMLTextAreaElement)) {
    throw new Error('Expected textarea');
  }
  return textarea;
}

function dispatchShortcut(action: string): void {
  act(() => {
    window.dispatchEvent(new CustomEvent('neon-pilot-desktop-shortcut', { detail: { action } }));
  });
}

describe('useDesktopConversationShortcuts', () => {
  afterEach(() => {
    while (roots.length > 0) act(() => roots.pop()?.unmount());
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('focuses the composer at the end for the desktop focus shortcut', () => {
    const textarea = renderShortcutHarness({});

    dispatchShortcut('focus-composer');

    expect(document.activeElement).toBe(textarea);
    expect(textarea.selectionStart).toBe(5);
    expect(textarea.selectionEnd).toBe(5);
  });

  it('routes rename and working-directory shortcuts to conversation actions', () => {
    const beginTitleEdit = vi.fn();
    const beginConversationCwdEdit = vi.fn();
    renderShortcutHarness({ beginTitleEdit, beginConversationCwdEdit });

    dispatchShortcut('rename-conversation');
    dispatchShortcut('edit-working-directory');

    expect(beginTitleEdit).toHaveBeenCalledTimes(1);
    expect(beginConversationCwdEdit).toHaveBeenCalledTimes(1);
  });

  it('routes draft working-directory shortcuts through the draft picker', () => {
    const beginConversationCwdEdit = vi.fn();
    const pickDraftConversationCwd = vi.fn();
    renderShortcutHarness({ draft: true, beginConversationCwdEdit, pickDraftConversationCwd });

    dispatchShortcut('edit-working-directory');

    expect(pickDraftConversationCwd).toHaveBeenCalledTimes(1);
    expect(beginConversationCwdEdit).not.toHaveBeenCalled();
  });
});

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
  saveTitleEdit?: () => void;
  cancelTitleEdit?: () => void;
  beginConversationCwdEdit?: () => void;
  pickDraftConversationCwd?: () => void;
  saveConversationCwdEdit?: () => void;
  cancelConversationCwdEdit?: () => void;
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
      saveTitleEdit: options.saveTitleEdit ?? vi.fn(),
      cancelTitleEdit: options.cancelTitleEdit ?? vi.fn(),
      beginConversationCwdEdit: options.beginConversationCwdEdit ?? vi.fn(),
      saveConversationCwdEdit: options.saveConversationCwdEdit ?? vi.fn(),
      cancelConversationCwdEdit: options.cancelConversationCwdEdit ?? vi.fn(),
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

function dispatchShortcutCommand(command: string): void {
  act(() => {
    window.dispatchEvent(new CustomEvent('neon-pilot-desktop-shortcut', { detail: { command } }));
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

  it('accepts command-only desktop shortcut events for shared conversation commands', () => {
    const beginTitleEdit = vi.fn();
    const saveTitleEdit = vi.fn();
    const cancelTitleEdit = vi.fn();
    const beginConversationCwdEdit = vi.fn();
    const saveConversationCwdEdit = vi.fn();
    const cancelConversationCwdEdit = vi.fn();
    const textarea = renderShortcutHarness({
      beginTitleEdit,
      saveTitleEdit,
      cancelTitleEdit,
      beginConversationCwdEdit,
      saveConversationCwdEdit,
      cancelConversationCwdEdit,
    });

    dispatchShortcutCommand('composer.focus');
    dispatchShortcutCommand('conversation.rename');
    dispatchShortcutCommand('conversation.saveTitle');
    dispatchShortcutCommand('conversation.cancelTitleEdit');
    dispatchShortcutCommand('conversation.editCwd');
    dispatchShortcutCommand('conversation.saveCwd');
    dispatchShortcutCommand('conversation.cancelCwdEdit');

    expect(document.activeElement).toBe(textarea);
    expect(beginTitleEdit).toHaveBeenCalledTimes(1);
    expect(saveTitleEdit).toHaveBeenCalledTimes(1);
    expect(cancelTitleEdit).toHaveBeenCalledTimes(1);
    expect(beginConversationCwdEdit).toHaveBeenCalledTimes(1);
    expect(saveConversationCwdEdit).toHaveBeenCalledTimes(1);
    expect(cancelConversationCwdEdit).toHaveBeenCalledTimes(1);
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

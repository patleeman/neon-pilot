// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import { KeyboardShortcutCaptureInput } from './primitives';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const mountedRoots: Root[] = [];

afterEach(() => {
  for (const root of mountedRoots.splice(0)) {
    act(() => {
      root.unmount();
    });
  }
  document.body.innerHTML = '';
});

describe('KeyboardShortcutCaptureInput', () => {
  it('exits capture when focus moves outside', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoots.push(root);

    act(() => {
      root.render(
        createElement(
          'div',
          null,
          createElement(KeyboardShortcutCaptureInput, { value: 'CommandOrControl+Shift+P', onChange: () => undefined }),
          createElement('button', { type: 'button' }, 'Outside'),
        ),
      );
    });

    const shortcutButton = container.querySelector('.ui-shortcut-capture');
    const outsideButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Outside');
    if (!(shortcutButton instanceof HTMLButtonElement) || !(outsideButton instanceof HTMLButtonElement)) {
      throw new Error('Expected shortcut and outside buttons');
    }

    act(() => {
      shortcutButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(shortcutButton.textContent).toContain('Press shortcut...');

    act(() => {
      outsideButton.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    });

    expect(shortcutButton.textContent).toContain('⌘/Ctrl + Shift + P');
    expect(shortcutButton.textContent).not.toContain('Press shortcut...');
  });
});

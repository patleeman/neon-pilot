// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { MessageBlock } from '../../shared/types';
import { ChatView } from './ChatView';

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

const mountedRoots: Root[] = [];

afterEach(() => {
  for (const root of mountedRoots.splice(0)) {
    act(() => root.unmount());
  }
  document.body.innerHTML = '';
});

describe('ChatView path links', () => {
  it('uses the latest file path opener after rerendering the same transcript', () => {
    const messages: MessageBlock[] = [
      {
        type: 'text',
        ts: '2026-03-11T18:00:00.000Z',
        text: 'Open packages/desktop/ui/src/app/App.tsx.',
      },
    ];
    const validatedFilePathTargets = new Set(['packages/desktop/ui/src/app/App.tsx']);
    const firstOpen = vi.fn();
    const secondOpen = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoots.push(root);

    act(() => {
      root.render(<ChatView messages={messages} onOpenFilePath={firstOpen} validatedFilePathTargets={validatedFilePathTargets} />);
    });

    expect(container.querySelector<HTMLAnchorElement>('a[title="Open packages/desktop/ui/src/app/App.tsx"]')).toBeTruthy();

    act(() => {
      root.render(<ChatView messages={messages} onOpenFilePath={secondOpen} validatedFilePathTargets={validatedFilePathTargets} />);
    });

    const link = container.querySelector<HTMLAnchorElement>('a[title="Open packages/desktop/ui/src/app/App.tsx"]');
    expect(link).toBeTruthy();

    act(() => {
      link?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
    });

    expect(firstOpen).not.toHaveBeenCalled();
    expect(secondOpen).toHaveBeenCalledWith('packages/desktop/ui/src/app/App.tsx');
  });
});

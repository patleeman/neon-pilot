// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DictationButton } from './frontend';

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

const roots: Root[] = [];

function renderDictationButton(input: { composerDisabled: boolean; setContext: ReturnType<typeof vi.fn> }) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.push(root);

  act(() => {
    root.render(
      <DictationButton
        pa={
          {
            commands: { setContext: input.setContext },
            extension: { invoke: vi.fn() },
            ui: { toast: vi.fn() },
          } as never
        }
        controlContext={{
          composerDisabled: input.composerDisabled,
          insertText: vi.fn(),
        }}
      />,
    );
  });

  return { container, root };
}

describe('DictationButton', () => {
  afterEach(() => {
    for (const root of roots.splice(0)) {
      act(() => root.unmount());
    }
    document.body.innerHTML = '';
  });

  it('publishes command availability while mounted', () => {
    const setContext = vi.fn();
    const { root } = renderDictationButton({ composerDisabled: false, setContext });

    expect(setContext).toHaveBeenLastCalledWith('toggleAvailable', true);

    act(() => {
      root.render(
        <DictationButton
          pa={
            {
              commands: { setContext },
              extension: { invoke: vi.fn() },
              ui: { toast: vi.fn() },
            } as never
          }
          controlContext={{
            composerDisabled: true,
            insertText: vi.fn(),
          }}
        />,
      );
    });

    expect(setContext).toHaveBeenLastCalledWith('toggleAvailable', false);

    act(() => root.unmount());
    roots.splice(roots.indexOf(root), 1);

    expect(setContext).toHaveBeenLastCalledWith('toggleAvailable', null);
  });
});

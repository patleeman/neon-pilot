// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DictationButton } from './frontend';
import { startComposerDictationCapture } from './capture';

vi.mock('./capture', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./capture')>();
  return {
    ...actual,
    startComposerDictationCapture: vi.fn(),
  };
});

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

const roots: Root[] = [];
const startCaptureMock = vi.mocked(startComposerDictationCapture);

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

function dispatchPointerDown(button: HTMLButtonElement) {
  Object.defineProperty(button, 'setPointerCapture', { configurable: true, value: vi.fn() });
  const event = new Event('pointerdown', { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    button: { value: 0 },
    pointerId: { value: 1 },
  });
  button.dispatchEvent(event);
}

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
    vi.clearAllMocks();
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

  it('stops a recording capture when unmounted', async () => {
    const setContext = vi.fn();
    const stop = vi.fn(async () => ({ audio: new Uint8Array(), durationMs: 0, mimeType: 'audio/pcm', fileName: 'dictation.pcm' }));
    startCaptureMock.mockResolvedValueOnce({ stop });
    const { container, root } = renderDictationButton({ composerDisabled: false, setContext });

    await act(async () => {
      dispatchPointerDown(container.querySelector('button')!);
    });
    expect(startCaptureMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });
    roots.splice(roots.indexOf(root), 1);

    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('stops a late capture when startup finishes after unmount', async () => {
    const setContext = vi.fn();
    const stop = vi.fn(async () => ({ audio: new Uint8Array(), durationMs: 0, mimeType: 'audio/pcm', fileName: 'dictation.pcm' }));
    const deferred = createDeferred<{ stop: typeof stop }>();
    startCaptureMock.mockReturnValueOnce(deferred.promise);
    const { container, root } = renderDictationButton({ composerDisabled: false, setContext });

    act(() => {
      dispatchPointerDown(container.querySelector('button')!);
    });
    act(() => root.unmount());
    roots.splice(roots.indexOf(root), 1);

    await act(async () => {
      deferred.resolve({ stop });
      await deferred.promise;
    });

    expect(stop).toHaveBeenCalledTimes(1);
  });
});

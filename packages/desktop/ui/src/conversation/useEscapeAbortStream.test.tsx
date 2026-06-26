// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useEscapeAbortStream } from './useEscapeAbortStream';

(globalThis as typeof globalThis & { React?: typeof React }).React = React;
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function Harness({
  isStreaming,
  abort,
  hasBlockingOverlay,
}: {
  isStreaming: boolean;
  abort: () => void;
  hasBlockingOverlay?: () => boolean;
}) {
  useEscapeAbortStream({ isStreaming, abort, hasBlockingOverlay });
  return null;
}

describe('useEscapeAbortStream', () => {
  let root: Root | null = null;

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
      root = null;
    }
    vi.restoreAllMocks();
  });

  function renderHarness(props: React.ComponentProps<typeof Harness>) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root?.render(<Harness {...props} />);
    });
  }

  it('aborts on Escape whenever the caller marks stream controls active', () => {
    const abort = vi.fn();
    renderHarness({ isStreaming: true, abort });

    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    act(() => {
      window.dispatchEvent(event);
    });

    expect(abort).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('does not abort while a blocking overlay is open', () => {
    const abort = vi.fn();
    renderHarness({ isStreaming: true, abort, hasBlockingOverlay: () => true });

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    });

    expect(abort).not.toHaveBeenCalled();
  });
});
